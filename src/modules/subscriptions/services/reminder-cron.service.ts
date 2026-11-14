import cron from "node-cron";
import { Types } from "mongoose";
import { env } from "../../../config/application";
import { logger } from "../../../common/logger/logger";
import { NotificationEvent } from "../../notifications/models/notification.model";
import { NotificationService } from "../../notifications/services/notification.service";
import { contributionReminderTemplate } from "../../auth/templates/contribution-reminder.template";
import { ISubscription } from "../models/subscription.model";
import { SubscriptionRepository } from "../repositories/subscription.repository";

// These small shapes describe the owner and plan fields populated by the
// subscription query, so the reminder job can build a useful message.
interface ReminderOwner { _id: Types.ObjectId; email: string; name?: string; }
interface ReminderPlan { _id: Types.ObjectId; packageDetails?: { currency: string; amount: number; }; }

// The repository returns subscriptions with their owner and plan populated.
type PopulatedSubscription = Omit<ISubscription, "owner" | "plan"> & { owner: ReminderOwner; plan: ReminderPlan };

// Keep track of whether this process has already registered the scheduled job.
let started = false;

// Register the daily reminder job once, and only when reminders are enabled.
export function startContributionReminderCron(): void {
  // Avoid duplicate schedules if startup code calls this function more than once.
  if (started || !env.CONTRIBUTION_REMINDERS_ENABLED) return;
  started = true;

  // Run at 9 a.m. Lagos time and send both the one-week and three-day reminders.
  cron.schedule("0 9 * * *", async () => {
    try {
      await sendReminders(7);
      await sendReminders(3);
    } catch (error) {
      // Record unexpected failures so the scheduled run does not fail silently.
      logger.error({ err: error }, "Contribution reminder run failed");
    }
  }, { timezone: "Africa/Lagos" });

  // Confirm in the application logs that the schedule was registered.
  logger.info("Paystack subscription contribution reminders enabled");
}

// Find subscriptions due on the date that is `days` from today and notify each owner.
async function sendReminders(days: 3 | 7): Promise<void> {
  // Convert Lagos' current calendar date to the target due date, then build that
  // Lagos day as a half-open interval [start, next day) for the database query.
  const targetKey = addDateKeyDays(lagosDateKey(new Date()), days);
  const target = new Date(`${targetKey}T00:00:00+01:00`);
  const end = new Date(target.getTime() + 86400000);

  // Load subscriptions whose next payment falls inside the target day.
  const subscriptions = await new SubscriptionRepository().listRemindersBetween(target, end);

  // Reuse one notification service for all reminders in this scheduled run.
  const notifications = new NotificationService();

  // Process each matching subscription independently.
  for (const rawSubscription of subscriptions) {
    // The repository populates `owner` and `plan`; cast to the shape used below.
    const subscription = rawSubscription as unknown as PopulatedSubscription;
    const owner = subscription.owner;
    const plan = subscription.plan;

    // Email is the contact channel for this reminder, and a due date is needed
    // to describe when the contribution is expected.
    if (!owner?.email || !subscription.nextPaymentDate) continue;

    // Prepare localized due-date and amount values for the notification copy.
    const dueDate = subscription.nextPaymentDate.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "long" });
    const currency = plan.packageDetails?.currency || "NGN";
    const amountMinor = plan.packageDetails?.amount || 0;
    const amount = new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amountMinor / 100);

    // Use the Lagos due date in the key so the same reminder type is not sent
    // repeatedly for the same subscription and payment date.
    const dateKey = lagosDateKey(subscription.nextPaymentDate);
    const dedupeKey = `contribution-reminder:${subscription._id}:${days}:${dateKey}`;

    // Persist and deliver the in-app/email reminder through the shared
    // notification module. Paystack still collects the scheduled payment.
    await notifications.notifyUser({
      userId: subscription.owner._id.toString(),
      event: NotificationEvent.UPCOMING_CONTRIBUTION,
      dedupeKey,
      title: `${days}-day reminder: upcoming plan contribution`,
      message: `Your ${amount} plan contribution is expected on ${dueDate}. Paystack handles the scheduled collection; this notification is a reminder only.`,
      emailHtml: contributionReminderTemplate({ name: owner.name || "there", amount, dueDate, days }),
    });
  }
}

// Format a timestamp as its calendar date in Lagos, independent of the server timezone.
function lagosDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

// Add whole calendar days to a YYYY-MM-DD key using UTC arithmetic, avoiding
// server-local timezone and daylight-saving behavior.
function addDateKeyDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

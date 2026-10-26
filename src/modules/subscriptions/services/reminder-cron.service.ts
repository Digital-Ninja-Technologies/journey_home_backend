import cron from "node-cron";
import { Types } from "mongoose";
import { env } from "../../../config/application";
import { logger } from "../../../common/logger/logger";
import { NotificationEvent } from "../../notifications/models/notification.model";
import { NotificationService } from "../../notifications/services/notification.service";
import { contributionReminderTemplate } from "../../auth/templates/contribution-reminder.template";
import { ISubscription } from "../models/subscription.model";
import { SubscriptionRepository } from "../repositories/subscription.repository";

interface ReminderOwner { _id: Types.ObjectId; email: string; name?: string; }
interface ReminderPlan { _id: Types.ObjectId; packageDetails?: { currency: string; amount: number; }; }
type PopulatedSubscription = Omit<ISubscription, "owner" | "plan"> & { owner: ReminderOwner; plan: ReminderPlan };

let started = false;
export function startContributionReminderCron(): void {
  if (started || !env.CONTRIBUTION_REMINDERS_ENABLED) return;
  started = true;
  cron.schedule("0 9 * * *", async () => {
    try {
      await sendReminders(7);
      await sendReminders(3);
    } catch (error) {
      logger.error({ err: error }, "Contribution reminder run failed");
    }
  }, { timezone: "Africa/Lagos" });
  logger.info("Paystack subscription contribution reminders enabled");
}

async function sendReminders(days: 3 | 7): Promise<void> {
  const targetKey = addDateKeyDays(lagosDateKey(new Date()), days);
  const target = new Date(`${targetKey}T00:00:00+01:00`);
  const end = new Date(target.getTime() + 86400000);
  const subscriptions = await new SubscriptionRepository().listRemindersBetween(target, end);
  const notifications = new NotificationService();

  for (const rawSubscription of subscriptions) {
    const subscription = rawSubscription as unknown as PopulatedSubscription;
    const owner = subscription.owner;
    const plan = subscription.plan;
    if (!owner?.email || !subscription.nextPaymentDate) continue;

    const dueDate = subscription.nextPaymentDate.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "long" });
    const currency = plan.packageDetails?.currency || "NGN";
    const amountMinor = plan.packageDetails?.amount || 0;
    const amount = new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amountMinor / 100);
    const dateKey = lagosDateKey(subscription.nextPaymentDate);
    const dedupeKey = `contribution-reminder:${subscription._id}:${days}:${dateKey}`;

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

function lagosDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDateKeyDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

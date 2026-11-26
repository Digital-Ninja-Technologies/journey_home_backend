import cron from "node-cron";
import { Types } from "mongoose";
import { env } from "../../../config/application";
import { logger } from "../../../common/logger/logger";
import { NotificationEvent } from "../../notifications/models/notification.model";
import { NotificationService } from "../../notifications/services/notification.service";
import { contributionReminderTemplate } from "../../auth/templates/contribution-reminder.template";
import { ISubscription } from "../models/subscription.model";
import { SubscriptionRepository } from "../repositories/subscription.repository";

// These shapes describe the owner and plan fields populated by the
// subscription query, so the reminder job can build a useful message.
export interface ReminderOwner {
  _id: Types.ObjectId;
  email: string;
  name?: string;
}

export interface ReminderPlan {
  _id: Types.ObjectId;
  packageDetails?: {
    currency?: string;
    amount?: number;
    name?: string;
  };
  amount?: number;
  currency?: string;
}

// The repository returns subscriptions with their owner and plan populated.
export type PopulatedSubscription = Omit<ISubscription, "owner" | "plan"> & {
  owner: ReminderOwner;
  plan: ReminderPlan | null;
};

// Keep track of whether this process has already registered the scheduled job.
let started = false;

// Register the daily reminder job once, and only when reminders are enabled.
export function startContributionReminderCron(): void {
  // Avoid duplicate schedules if startup code calls this function more than once.
  if (started || !env.CONTRIBUTION_REMINDERS_ENABLED) return;
  started = true;

  // Run at 9 a.m. Lagos time and send both the one-week and three-day reminders.
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        await runContributionReminders();
      } catch (error) {
        // Record unexpected failures so the scheduled run does not fail silently.
        logger.error({ err: error }, "Contribution reminder scheduled run failed");
      }
    },
    { timezone: "Africa/Lagos" }
  );

  // Confirm in the application logs that the schedule was registered.
  logger.info("Paystack subscription contribution reminders enabled (scheduled daily at 09:00 Africa/Lagos)");

  // Run immediately on process startup if explicitly requested (useful for testing and development).
  if (env.CONTRIBUTION_REMINDERS_RUN_ON_STARTUP) {
    logger.info("Running contribution reminders on startup (CONTRIBUTION_REMINDERS_RUN_ON_STARTUP=true)");
    runContributionReminders().catch((error) => {
      logger.error({ err: error }, "Startup contribution reminder run failed");
    });
  }
}

// Execute the reminder run for both 7-day and 3-day windows.
export async function runContributionReminders(referenceDate: Date = new Date()): Promise<{
  sevenDayCount: number;
  threeDayCount: number;
}> {
  logger.info(
    { referenceDate: referenceDate.toISOString(), lagosKey: lagosDateKey(referenceDate) },
    "Starting contribution reminders run"
  );

  const sevenDayCount = await sendReminders(7, referenceDate);
  const threeDayCount = await sendReminders(3, referenceDate);

  logger.info(
    { sevenDayCount, threeDayCount, referenceDate: referenceDate.toISOString() },
    "Completed contribution reminders run"
  );

  return { sevenDayCount, threeDayCount };
}

// Find subscriptions due on the date that is `days` from reference date and notify each owner.
export async function sendReminders(days: 3 | 7, referenceDate: Date = new Date()): Promise<number> {
  // Convert Lagos' current calendar date to the target due date, then build that
  // Lagos day as a half-open interval [start, next day) for the database query.
  const targetKey = addDateKeyDays(lagosDateKey(referenceDate), days);
  const target = new Date(`${targetKey}T00:00:00+01:00`);
  const end = new Date(target.getTime() + 86400000);

  // Load subscriptions whose next payment falls inside the target day.
  const subscriptions = await new SubscriptionRepository().listRemindersBetween(target, end);

  logger.info(
    {
      days,
      targetKey,
      targetStart: target.toISOString(),
      targetEnd: end.toISOString(),
      matchedSubscriptions: subscriptions.length,
    },
    `Evaluating ${days}-day contribution reminders`
  );

  // Reuse one notification service for all reminders in this scheduled run.
  const notifications = new NotificationService();
  let processedCount = 0;

  // Process each matching subscription independently.
  for (const rawSubscription of subscriptions) {
    try {
      // The repository populates `owner` and `plan`; cast to the shape used below.
      const subscription = rawSubscription as unknown as PopulatedSubscription;
      const owner = subscription.owner;
      const plan = subscription.plan;

      // Email is the contact channel for this reminder, and a due date is needed
      // to describe when the contribution is expected.
      if (!owner?.email || !subscription.nextPaymentDate) {
        logger.warn(
          {
            subscriptionId: rawSubscription._id,
            hasOwner: !!owner,
            hasEmail: !!owner?.email,
            hasDueDate: !!subscription.nextPaymentDate,
          },
          "Skipping contribution reminder: missing owner email or next payment date"
        );
        continue;
      }

      if (!plan) {
        logger.warn(
          { subscriptionId: rawSubscription._id, ownerId: owner._id },
          "Skipping contribution reminder: plan record not found for subscription"
        );
        continue;
      }

      // Prepare localized due-date and amount values for the notification copy.
      const dueDate = subscription.nextPaymentDate.toLocaleDateString("en-NG", {
        timeZone: "Africa/Lagos",
        dateStyle: "long",
      });
      const currency = plan.packageDetails?.currency || plan.currency || "NGN";
      const amountMinor = plan.packageDetails?.amount ?? plan.amount ?? 0;
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

      processedCount++;
      logger.info(
        {
          subscriptionId: subscription._id,
          ownerEmail: owner.email,
          days,
          dueDate,
          amount,
          dedupeKey,
        },
        "Contribution reminder successfully processed"
      );
    } catch (subscriptionError) {
      logger.error(
        {
          err: subscriptionError,
          subscriptionId: rawSubscription._id,
          days,
        },
        "Failed to process contribution reminder for subscription"
      );
    }
  }

  return processedCount;
}

// Format a timestamp as its calendar date in Lagos, independent of the server timezone.
export function lagosDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

// Add whole calendar days to a YYYY-MM-DD key using UTC arithmetic, avoiding
// server-local timezone and daylight-saving behavior.
export function addDateKeyDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

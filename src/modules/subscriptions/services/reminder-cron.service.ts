import cron from "node-cron";
import { logger } from "../../../common/logger/logger";
import { EmailService } from "../../../common/services/email.service";
import { Notification, NotificationEvent, NotificationStatus } from "../../notifications/models/notification.model";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { env } from "../../../config/application";

let started = false;
export function startContributionReminderCron() {
  if (started || !env.CONTRIBUTION_REMINDERS_ENABLED) return;
  started = true;
  cron.schedule("0 9 * * *", async () => {
    try { await sendReminders(7); await sendReminders(3); await retryFailedReminders(); }
    catch (error) { logger.error({ err: error }, "Contribution reminder run failed"); }
  }, { timezone: "Africa/Lagos" });
  logger.info("Paystack subscription contribution reminders enabled");
}

async function sendReminders(days: 3 | 7) {
  const today = lagosDateKey(new Date());
  const targetKey = addDateKeyDays(today, days);
  const target = new Date(`${targetKey}T00:00:00+01:00`);
  const end = new Date(target.getTime() + 86400000);
  const subscriptions = await new SubscriptionRepository().listRemindersBetween(target, end);
  for (const subscription of subscriptions) {
    const owner: any = subscription.owner; const plan: any = subscription.plan;
    if (!owner?.email || !subscription.nextPaymentDate) continue;
    const dateKey = lagosDateKey(subscription.nextPaymentDate);
    const dedupeKey = `contribution-reminder:${subscription._id}:${days}:${dateKey}`;
    const record: any = await Notification.findOneAndUpdate({ dedupeKey }, { $setOnInsert: { owner: owner._id, plan: plan?._id, event: NotificationEvent.UPCOMING_CONTRIBUTION, dedupeKey, status: NotificationStatus.PENDING, channel: "email", subject: `${days}-day contribution reminder` } }, { upsert: true, new: true }).exec();
    if (record.status === NotificationStatus.SENT) continue;
    const claimed = await claimReminder(dedupeKey);
    if (!claimed) continue;
    const sent = await new EmailService().sendEmail(owner.email, `Journey Home contribution reminder`, `<p>Hello ${owner.name || "there"},</p><p>Your contribution of ${plan?.packageSnapshot?.currency || ""} ${plan?.packageSnapshot?.monthlyContributionMinor || ""} is expected on ${subscription.nextPaymentDate.toLocaleDateString("en-NG")}.</p><p>This is a reminder only. Your subscription collection is handled securely by Paystack.</p>`);
    claimed.status = sent ? NotificationStatus.SENT : NotificationStatus.FAILED; await claimed.save();
  }
}

async function retryFailedReminders() {
  const stale = new Date(Date.now() - 30 * 60 * 1000);
  const records: any[] = await Notification.find({ event: NotificationEvent.UPCOMING_CONTRIBUTION, status: NotificationStatus.FAILED, updatedAt: { $lte: stale }, dedupeKey: /^contribution-reminder:/ })
    .populate("owner", "email name").populate("plan", "nextPaymentDate packageSnapshot").exec();
  const nowKey = lagosDateKey(new Date());
  for (const record of records) {
    const owner: any = record.owner; const plan: any = record.plan;
    if (!owner?.email || !plan?.nextPaymentDate || lagosDateKey(plan.nextPaymentDate) < nowKey) continue;
    const match = String(record.dedupeKey).match(/:(3|7):(\d{4}-\d{2}-\d{2})$/);
    if (!match || match[2] !== lagosDateKey(plan.nextPaymentDate)) continue;
    const claimed = await claimReminder(record.dedupeKey);
    if (!claimed) continue;
    const days = match[1];
    const sent = await new EmailService().sendEmail(owner.email, "Journey Home contribution reminder", `<p>Hello ${owner.name || "there"},</p><p>Your contribution is expected on ${new Date(plan.nextPaymentDate).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}. This is a ${days}-day reminder. Paystack handles subscription collection; this email does not initiate or retry a payment.</p>`);
    claimed.status = sent ? NotificationStatus.SENT : NotificationStatus.FAILED; await claimed.save();
  }
}

async function claimReminder(dedupeKey: string) {
  const stale = new Date(Date.now() - 5 * 60 * 1000);
  return Notification.findOneAndUpdate({ dedupeKey, $or: [
    { status: { $in: [NotificationStatus.PENDING, NotificationStatus.FAILED] } },
    { status: NotificationStatus.PROCESSING, updatedAt: { $lte: stale } },
  ] }, { $set: { status: NotificationStatus.PROCESSING } }, { new: true }).exec();
}

function lagosDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function addDateKeyDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

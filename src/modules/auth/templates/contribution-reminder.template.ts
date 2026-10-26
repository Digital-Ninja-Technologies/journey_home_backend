import { emailLayout, escapeHtml } from "./email-layout.template";

export function contributionReminderTemplate(input: { name: string; amount: string; dueDate: string; days: number }): string {
  return emailLayout("Upcoming plan contribution", `<p>Hello ${escapeHtml(input.name)},</p><p>Your contribution of <strong>${escapeHtml(input.amount)}</strong> is expected on <strong>${escapeHtml(input.dueDate)}</strong> (in ${input.days} days).</p><p>Paystack handles the scheduled collection. This message is a reminder only and does not initiate or retry a payment.</p>`);
}

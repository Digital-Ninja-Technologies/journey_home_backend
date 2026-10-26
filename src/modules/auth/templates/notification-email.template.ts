import { emailLayout, escapeHtml } from "./email-layout.template";

export function notificationEmailTemplate(input: { name: string; title: string; message: string }): string {
  return emailLayout(input.title, `<p>Hello ${escapeHtml(input.name)},</p><p>${escapeHtml(input.message)}</p><p style="color:#6b6762;font-size:13px">You can view this update in your Journey Home notifications.</p>`);
}

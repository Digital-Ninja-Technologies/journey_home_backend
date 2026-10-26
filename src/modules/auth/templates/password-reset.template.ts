import { emailButton, emailLayout, escapeHtml } from "./email-layout.template";

export function passwordResetTemplate(name: string, url: string): string {
  return emailLayout("Reset your password", `<p>Hello ${escapeHtml(name)},</p><p>We received a request to reset your Journey Home password. Use the button below to choose a new password.</p>${emailButton("Reset password", url)}<p style="color:#6b6762;font-size:13px">This link expires in one hour. If you did not request a reset, you can ignore this email.</p>`);
}

import { emailButton, emailLayout, escapeHtml } from "./email-layout.template";

export function emailVerificationTemplate(name: string, url: string): string {
  return emailLayout("Verify your email address", `<p>Hello ${escapeHtml(name)},</p><p>Please verify your email address to finish setting up your Journey Home account.</p>${emailButton("Verify email", url)}<p style="color:#6b6762;font-size:13px">This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`);
}

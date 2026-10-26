import { emailLayout, escapeHtml } from "./email-layout.template";

export interface BasicEnquiry {
  type?: string;
  source?: string;
  name: string;
  email?: string;
  phone?: string;
  details?: unknown;
  createdAt?: Date;
}

export function adminEnquiryTemplate(enquiry: BasicEnquiry): string {
  const details =
    enquiry.details === undefined
      ? "No additional details were provided."
      : JSON.stringify(enquiry.details, null, 2);
  const receivedAt = (enquiry.createdAt || new Date()).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "full",
    timeStyle: "short",
  });
  const rows = [
    ["Type", enquiry.type || "General"],
    ["Source", enquiry.source || "Direct"],
    ["Name", enquiry.name],
    ["Email", enquiry.email || "Not provided"],
    ["Phone", enquiry.phone || "Not provided"],
    ["Received", receivedAt],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid #e3dfda;color:#6b6762;width:130px">${escapeHtml(label)}</td><td style="padding:9px 0;border-bottom:1px solid #e3dfda;color:#252321">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return emailLayout(
    "A new enquiry was received",
    `<p>A new enquiry has been submitted. Contact details are below.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table><h2 style="margin:24px 0 8px;font-size:16px;color:#252321">Enquiry details</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:#f3f1ee;border-radius:6px;color:#33302d;font:13px Arial,sans-serif">${escapeHtml(details)}</pre>`,
  );
}

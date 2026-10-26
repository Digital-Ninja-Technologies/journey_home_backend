export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] as string,
  );
}

export function emailLayout(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f1ee;color:#252321;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f3f1ee"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #ded9d2;border-radius:12px;overflow:hidden"><tr><td style="padding:24px 32px;background:#6f5948;color:#fff;font-size:13px;letter-spacing:1px;font-weight:bold">JOURNEY HOME</td></tr><tr><td style="padding:32px;color:#33302d"><h1 style="margin:0 0 20px;color:#252321;font-size:23px">${escapeHtml(title)}</h1>${body}</td></tr><tr><td style="padding:18px 32px;background:#efedea;color:#6b6762;font-size:12px">This is an automated message from Journey Home. Please contact support if you need help.</td></tr></table></td></tr></table></body></html>`;
}

export function emailButton(label: string, url: string): string {
  return `<p style="margin:26px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#6f5948;border-radius:6px;color:#fff;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;
}

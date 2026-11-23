// Outbound email. Uses Resend's HTTP API when RESEND_API_KEY is set; otherwise
// logs to the console (local dev) so flows can be exercised without sending.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export function resendTransport(apiKey: string, from: string): EmailTransport {
  return {
    name: "resend",
    async send(m) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    },
  };
}

export const consoleTransport: EmailTransport = {
  name: "console",
  async send(m) {
    console.info(`[email:dev] to=${m.to} subject="${m.subject}"\n${m.text}`);
  },
};

export function defaultTransport(): EmailTransport {
  const key = process.env.RESEND_API_KEY;
  return key ? resendTransport(key, process.env.EMAIL_FROM ?? "Boldly OS <notifications@boldlymedia.com>") : consoleTransport;
}

/** Absolute base URL for links in emails. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Minimal branded email. */
export function renderEmail(opts: { title: string; body?: string | null; link?: string | null; cta?: string }): {
  text: string;
  html: string;
} {
  const url = opts.link ? `${appUrl()}${opts.link}` : null;
  const text = [opts.title, opts.body ?? "", url ? `${opts.cta ?? "Open in Boldly OS"}: ${url}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const html = `<!doctype html><html><body style="margin:0;background:#F3F1EA;font-family:Inter,Arial,sans-serif;color:#0E2B2B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #E3DFD4">
<tr><td style="background:#012F37;border-radius:12px 12px 0 0;padding:20px 28px;font-family:Georgia,serif;font-size:20px;color:#F3F1EA">Boldly <span style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;background:#A9E0D6;color:#012F37;padding:2px 4px;border-radius:2px">OS</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:500;font-size:22px;line-height:1.3;color:#012F37">${esc(opts.title)}</h1>
${opts.body ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#3d5553;white-space:pre-line">${esc(opts.body)}</p>` : ""}
${url ? `<a href="${esc(url)}" style="display:inline-block;background:#012F37;color:#F3F1EA;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px">${esc(opts.cta ?? "Open in Boldly OS")}</a>` : ""}
</td></tr></table>
<p style="font-size:12px;color:#5E716F;margin-top:16px">Boldly Media · Hamilton, ON</p>
</td></tr></table></body></html>`;
  return { text, html };
}

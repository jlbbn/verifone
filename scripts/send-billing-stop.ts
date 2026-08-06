const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = ["jose.barrientos@banxicoplusllc.org", "emiliano.maldonado@banxicoplusllc.org"];
const SUBJECT = "⚠️ Execution Stopped — Billing Issue · Banxico Plus LLC";

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#F3F4F6;"><tr><td align="center" style="padding:32px 12px;">
<table cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- hero -->
  <tr><td style="background:#0a0a0a;padding:28px 32px;">
    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;color:#6B7280;text-transform:uppercase;">Banxico Plus LLC · Internal Notice</p>
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#ffffff;">⚠️ Execution Stopped</h1>
    <p style="margin:0;font-size:13px;color:#9CA3AF;">Billing issue — development sprint paused</p>
  </td></tr>

  <!-- body -->
  <tr><td style="padding:28px 32px;">

    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">
      The current development execution for the <strong>Cybrid audit sprint</strong> has been
      temporarily stopped due to a <strong style="color:#c8322b;">pending billing balance</strong>.
    </p>

    <!-- status box -->
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr style="background:#F9FAFB;"><td colspan="2" style="padding:10px 16px;font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Current Status</td></tr>
      <tr style="border-top:1px solid #E5E7EB;">
        <td style="padding:12px 16px;font-size:13px;color:#374151;">Phase completed</td>
        <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#166534;text-align:right;">Phase 1 ✓ — DO Migration</td>
      </tr>
      <tr style="border-top:1px solid #E5E7EB;background:#fafafa;">
        <td style="padding:12px 16px;font-size:13px;color:#374151;">Next phase</td>
        <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#1E40AF;text-align:right;">Phase 2 — HMAC + Idempotency</td>
      </tr>
      <tr style="border-top:1px solid #E5E7EB;">
        <td style="padding:12px 16px;font-size:13px;color:#374151;">Outstanding balance</td>
        <td style="padding:12px 16px;font-size:16px;font-weight:900;color:#c8322b;text-align:right;">$800.00 USD</td>
      </tr>
      <tr style="border-top:1px solid #E5E7EB;background:#FFF7ED;">
        <td style="padding:12px 16px;font-size:13px;color:#374151;">Payment needed by</td>
        <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#D97706;text-align:right;">Thu, Aug 6 · 6:00 PM CT</td>
      </tr>
      <tr style="border-top:1px solid #E5E7EB;background:#F0FDF4;">
        <td style="padding:12px 16px;font-size:13px;color:#374151;">Target delivery (on payment)</td>
        <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#166534;text-align:right;">Fri, Aug 7 · 3:00 PM CT</td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
      Execution will resume immediately upon payment confirmation.<br/>
      Infrastructure (DigitalOcean $1,600 · Cloudflare $960) is fully operational.
    </p>

  </td></tr>

  <!-- footer -->
  <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:14px 32px;">
    <p style="margin:0;font-size:10px;color:#9CA3AF;text-align:center;">
      Banxico Plus LLC · August 5, 2026 · Confidential
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

async function main() {
  for (const to of RECIPIENTS) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM, to, subject: SUBJECT, html }),
    });
    const data = await res.json() as { id?: string };
    if (data.id) console.log(`SENT → ${to} | id: ${data.id}`);
    else { console.error("ERROR:", JSON.stringify(data)); process.exit(1); }
  }
}

main();

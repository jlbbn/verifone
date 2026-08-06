const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = ["jose.barrientos@banxicoplusllc.org", "emiliano.maldonado@banxicoplusllc.org"];
const SUBJECT = "Execution Update — Phase 2 In Progress · Redeployment 9:11 PM CT · Cybrid Sandbox Integration";

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#F3F4F6;"><tr><td align="center" style="padding:32px 12px;">
<table cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- hero -->
  <tr><td style="background:#0a0a0a;padding:28px 32px;">
    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;color:#6B7280;text-transform:uppercase;">Banxico Plus LLC · Execution Update</p>
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#ffffff;">Phase 2 — In Progress</h1>
    <p style="margin:0;font-size:13px;color:#9CA3AF;">Cybrid webhook hardening: HMAC signature fix + idempotency guard</p>
    <p style="margin:12px 0 0;font-size:11px;color:#4B5563;">August 6, 2026 · Objective: Cybrid Sandbox Integration</p>
  </td></tr>

  <!-- status strip -->
  <tr><td style="padding:20px 24px 0;">
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:8px;">
      <tr>
        <td style="background:#F0FDF4;border-radius:8px;padding:12px;text-align:center;width:33%;">
          <p style="margin:0;font-size:9px;color:#16A34A;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Phase 1</p>
          <p style="margin:4px 0 0;font-size:13px;font-weight:900;color:#166534;">Completed</p>
        </td>
        <td style="background:#EFF6FF;border-radius:8px;padding:12px;text-align:center;width:33%;border:2px solid #1E40AF;">
          <p style="margin:0;font-size:9px;color:#1E40AF;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Phase 2 — Active</p>
          <p style="margin:4px 0 0;font-size:13px;font-weight:900;color:#1E3A8A;">HMAC + Idempotency · 8h</p>
        </td>
        <td style="background:#FFF7ED;border-radius:8px;padding:12px;text-align:center;width:33%;">
          <p style="margin:0;font-size:9px;color:#D97706;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Redeployment</p>
          <p style="margin:4px 0 0;font-size:13px;font-weight:900;color:#92400E;">Today · 9:11 PM CT</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- what is this phase -->
  <tr><td style="padding:24px 32px 0;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">What Phase 2 is</p>
    <p style="margin:0 0 14px;font-size:13px;color:#374151;line-height:1.7;">
      Phase 2 resolves the two blocking observations reported by the Cybrid audit team on the
      webhook layer. Both must pass verification in the <strong>Cybrid Sandbox environment</strong>
      before the integration can advance to certification. The work is done against the live
      DigitalOcean deployment completed in Phase 1.
    </p>
  </td></tr>

  <!-- change 1 -->
  <tr><td style="padding:8px 32px 0;">
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <tr style="background:#F9FAFB;">
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">Change 1 — HMAC signature verification fix</p>
          <p style="margin:2px 0 0;font-size:10px;color:#9CA3AF;">4 hours · webhook security layer</p>
        </td>
      </tr>
      <tr style="border-top:1px solid #E5E7EB;">
        <td style="padding:14px 16px;font-size:12px;color:#374151;line-height:1.7;">
          <strong>Problem.</strong> Cybrid signs each webhook with HMAC-SHA256 over the raw request
          bytes. Our current verification recomputes the signature over the parsed JSON body, which
          re-serializes the payload and produces a different byte sequence. Signatures fail
          intermittently and legitimate events can be rejected.<br/><br/>
          <strong>Changes to be executed.</strong><br/>
          1. Capture the raw request body before any JSON parsing (raw-body middleware on the webhook route only).<br/>
          2. Compute HMAC-SHA256 over the exact received bytes using the Cybrid signing secret.<br/>
          3. Compare signatures with a constant-time comparison to prevent timing attacks.<br/>
          4. Reject with 401 on mismatch and log the event to the audit trail without exposing the signature.
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- change 2 -->
  <tr><td style="padding:12px 32px 0;">
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <tr style="background:#F9FAFB;">
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">Change 2 — Webhook idempotency guard</p>
          <p style="margin:2px 0 0;font-size:10px;color:#9CA3AF;">4 hours · payment integrity layer</p>
        </td>
      </tr>
      <tr style="border-top:1px solid #E5E7EB;">
        <td style="padding:14px 16px;font-size:12px;color:#374151;line-height:1.7;">
          <strong>Problem.</strong> Cybrid retries webhook delivery when it does not receive a 2xx
          response in time. Today a retried event is processed as if it were new, which can credit
          a deposit or trigger a disbursement twice.<br/><br/>
          <strong>Changes to be executed.</strong><br/>
          1. Persist every received event ID in a dedicated processed-events table with a unique constraint.<br/>
          2. Insert the event ID and process the payload inside a single database transaction.<br/>
          3. On duplicate event ID, return 200 immediately without reprocessing (safe acknowledgment).<br/>
          4. Respond to Cybrid before heavy processing where possible, moving slow work to a queued step.
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- redeployment -->
  <tr><td style="padding:12px 32px 0;">
    <table cellpadding="0" cellspacing="0" style="width:100%;border:2px solid #1E40AF;border-radius:8px;overflow:hidden;background:#EFF6FF;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#1E40AF;text-transform:uppercase;letter-spacing:1px;">Redeployment — Today 9:11 PM CT</p>
          <p style="margin:0;font-size:12px;color:#1E3A8A;line-height:1.7;">
            Both changes ship in a single redeployment to the DigitalOcean droplet at
            <strong>9:11 PM CT</strong>. The deployment is zero-downtime: the new process starts
            under PM2, health checks pass, then traffic switches over. Expected service
            interruption: none. Rollback plan: previous build is retained and can be restored in
            under one minute if any health check fails.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- objective -->
  <tr><td style="padding:20px 32px 24px;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Objective</p>
    <p style="margin:0;font-size:13px;color:#374151;line-height:1.7;">
      After this redeployment, the webhook endpoint meets both Cybrid requirements and the
      <strong>Cybrid Sandbox integration</strong> can be exercised end to end: signed event
      delivery, duplicate-retry handling, and verified acknowledgment. This clears the path for
      Phase 3 (OAuth2 token cache and audit log) on Friday morning and the 3:00 PM CT delivery.
    </p>
  </td></tr>

  <!-- footer -->
  <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:14px 32px;">
    <p style="margin:0;font-size:10px;color:#9CA3AF;text-align:center;">
      Banxico Plus LLC · August 6, 2026 · Confidential
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

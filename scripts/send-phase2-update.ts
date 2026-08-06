import { shell, sec, row, mono, fp } from "./email-template";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = [
  "jose.barrientos@banxicoplusllc.org",
  "emiliano.maldonado@banxicoplusllc.org",
];

const body = `
  <!-- status strip -->
  <tr><td style="padding:20px 28px 0;">
    <table cellpadding="0" cellspacing="0" role="presentation"
           style="width:100%;border-collapse:separate;border-spacing:8px;">
      <tr>
        <td style="background:rgba(61,220,132,.08);border:1px solid rgba(61,220,132,.2);
                   border-radius:8px;padding:12px;text-align:center;width:33%;">
          <p style="margin:0 0 3px;font-size:9px;color:#3DDC84;font-weight:700;
                    text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">Phase 1</p>
          <p style="margin:0;font-size:13px;font-weight:800;color:#3DDC84;
                    font-family:Arial,Helvetica,sans-serif;">Completed</p>
        </td>
        <td style="background:rgba(96,165,250,.08);border:2px solid rgba(96,165,250,.3);
                   border-radius:8px;padding:12px;text-align:center;width:33%;">
          <p style="margin:0 0 3px;font-size:9px;color:#60A5FA;font-weight:700;
                    text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">Phase 2 — Active</p>
          <p style="margin:0;font-size:12px;font-weight:800;color:#93C5FD;
                    font-family:Arial,Helvetica,sans-serif;">HMAC + Idempotency · 8h</p>
        </td>
        <td style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);
                   border-radius:8px;padding:12px;text-align:center;width:33%;">
          <p style="margin:0 0 3px;font-size:9px;color:#FBBF24;font-weight:700;
                    text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">Redeployment</p>
          <p style="margin:0;font-size:13px;font-weight:800;color:#FCD34D;
                    font-family:Arial,Helvetica,sans-serif;">Today · 9:11 PM CT</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 28px 0;">
    <p style="margin:0;font-size:13px;color:#C4C4CB;line-height:1.7;
              font-family:Arial,Helvetica,sans-serif;">
      Phase 2 resolves the two blocking observations reported by the Cybrid audit team on the
      webhook layer. Both must pass verification in the <strong style="color:#fff;">Cybrid Sandbox</strong>
      before the integration can advance to certification. Work executes against the live
      DigitalOcean deployment completed in Phase 1.
    </p>
  </td></tr>

  ${sec("Change 1 — HMAC signature verification fix · 4h", `
    ${row("Problem", "Signature recomputed over re-serialized JSON body — byte sequence differs from raw input. Legitimate events rejected intermittently.")}
    ${row("Fix 1", "Raw body captured by middleware before " + mono("JSON.parse()") + " on this route only", "#C4C4CB", true)}
    ${row("Fix 2", "HMAC-SHA256 computed over exact received bytes", "#C4C4CB")}
    ${row("Fix 3", mono("crypto.timingSafeEqual()") + " — constant-time comparison, no timing attack surface", "#C4C4CB", true)}
    ${row("Fix 4", "Reject with 401, audit log entry written — signature value never exposed", "#C4C4CB")}
  `)}

  ${sec("Change 2 — Webhook idempotency guard · 4h", `
    ${row("Problem", "Cybrid retries on timeout. Duplicate event processed as new — credits or disbursements execute twice.", "#9A9AA2")}
    ${row("Fix 1", mono("processed_events") + " table with " + mono("UNIQUE (idempotency_key)") + " constraint", "#C4C4CB", true)}
    ${row("Fix 2", "INSERT key + process payload in a single DB transaction — atomic commit", "#C4C4CB")}
    ${row("Fix 3", "On duplicate key: return " + mono("200 OK") + " without reprocessing — safe acknowledgment to Cybrid", "#C4C4CB", true)}
    ${row("Fix 4", "Tron broadcast wrapped inside the same transaction — rollback on failure", "#C4C4CB")}
  `)}

  ${sec("Redeployment — Today 9:11 PM CT", `
    ${row("Method", "PM2 zero-downtime reload — new process starts, health checks pass, traffic switches")}
    ${row("Downtime", mono("none expected"), "#3DDC84", true)}
    ${row("Rollback", "Previous build retained on droplet — restores in under 60 seconds if health check fails")}
    ${row("Post-deploy", "Cybrid Sandbox smoke test — signed event delivery end-to-end", "#C4C4CB", true)}
  `)}

  <tr><td style="padding:16px 28px 22px;">
    <p style="margin:0;font-size:12px;color:#C4C4CB;line-height:1.7;
              font-family:Arial,Helvetica,sans-serif;">
      After this redeployment, the <strong style="color:#fff;">Cybrid Sandbox integration</strong>
      can be exercised end to end: signed event delivery, duplicate-retry handling, and
      verified acknowledgment. Clears the path for Phase 3 (OAuth2 + audit log)
      Friday morning and the <strong style="color:#fff;">3:00 PM CT delivery.</strong>
    </p>
  </td></tr>
`;

const html = shell({
  kicker: "Banxico Plus LLC — Phase 2 Execution",
  title: `Phase 2 — <span style="color:#E8332B;">In Progress</span>`,
  subtitle: "Cybrid webhook hardening: HMAC signature fix + idempotency guard",
  liveLabel: "Phase 2 active",
  date: "August 6, 2026",
  body,
});

async function main() {
  for (const to of RECIPIENTS) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM, to,
        subject: "Execution Update — Phase 2 In Progress · Redeployment 9:11 PM CT · Cybrid Sandbox Integration",
        html,
      }),
    });
    const data = await res.json() as { id?: string };
    if (data.id) console.log(`SENT → ${to} | ${data.id}`);
    else { console.error("ERROR:", JSON.stringify(data)); process.exit(1); }
  }
}
main();

import { shell, sec, row, tag, mono } from "./email-template";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = [
  "jose.barrientos@banxicoplusllc.org",
  "emiliano.maldonado@banxicoplusllc.org",
];

const body = `
  <tr><td style="padding:22px 28px 4px;">
    <p style="margin:0;font-size:13px;color:#C4C4CB;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
      The current development execution for the <strong style="color:#fff;">Cybrid audit sprint</strong>
      has been temporarily stopped due to a pending billing balance.
      Execution will resume immediately upon payment confirmation.
    </p>
  </td></tr>

  ${sec("Current status", `
    ${row("Phase completed",  `<strong style="color:#3DDC84;">Phase 1 — DO Migration</strong>`, "#3DDC84")}
    ${row("Next phase",       `<strong style="color:#60A5FA;">Phase 2 — HMAC + Idempotency</strong>`, "#60A5FA", true)}
    ${row("Outstanding",      `<span style="font-size:18px;font-weight:800;color:#E8332B;font-family:Arial,Helvetica,sans-serif;">$800.00 USD</span>`, "#E8332B")}
    ${row("Payment needed by",`<strong style="color:#FBBF24;">Thu, Aug 6 · 6:00 PM CT</strong>`, "#FBBF24", true)}
    ${row("Delivery on payment", `<strong style="color:#3DDC84;">Fri, Aug 7 · 3:00 PM CT</strong>`, "#3DDC84")}
  `)}

  <tr><td style="padding:16px 28px 22px;">
    <p style="margin:0;font-size:11px;color:#6D6D76;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
      Infrastructure fully operational — ${mono("DigitalOcean $1,600")} · ${mono("Cloudflare $960")} · DO droplet healthy.
    </p>
  </td></tr>
`;

const html = shell({
  kicker: "Banxico Plus LLC — Execution Notice",
  title: `Execution <span style="color:#E8332B;">Stopped</span>`,
  subtitle: "Billing issue — development sprint paused pending payment",
  liveLabel: "Awaiting payment",
  date: "August 6, 2026",
  body,
  badges: ["PCI DSS", "AES-256", "TRC-20"],
});

async function main() {
  for (const to of RECIPIENTS) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM, to,
        subject: "Execution Stopped — Billing Issue · $800 USD · Banxico Plus LLC",
        html,
      }),
    });
    const data = await res.json() as { id?: string };
    if (data.id) console.log(`SENT → ${to} | ${data.id}`);
    else { console.error("ERROR:", JSON.stringify(data)); process.exit(1); }
  }
}
main();

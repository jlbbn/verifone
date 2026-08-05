/**
 * System Report — Background Check / Secret Integration
 * Invoice-style with provider logos and consolidated cost summary
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const INVOICE_NO = "INV-BX-20260805-001";
const ISSUED = "August 5, 2026";

// ── Task table rows ────────────────────────────────────────────────────────
const rows = [
  { task: "Fix HMAC + rotar secrets",      hours: "3 h",  pct: "9.1%",  cost: "$145"   },
  { task: "Migrar app Replit → DO",        hours: "8 h",  pct: "24.2%", cost: "$388"   },
  { task: "Idempotencia webhooks Cybrid",  hours: "6 h",  pct: "18.2%", cost: "$291"   },
  { task: "OAuth2 token cache",            hours: "3 h",  pct: "9.1%",  cost: "$145"   },
  { task: "Audit log",                     hours: "6 h",  pct: "18.2%", cost: "$291"   },
  { task: "Backup automático + restore",   hours: "2 h",  pct: "6.1%",  cost: "$97"    },
  { task: "Monitoreo + alertas",           hours: "3 h",  pct: "9.1%",  cost: "$145"   },
  { task: "Rate limiting",                 hours: "2 h",  pct: "6.1%",  cost: "$97"    },
];

function taskRows(): string {
  return rows.map((r, i) => `
  <tr style="border-top:1px solid #eeeeee;background:${i % 2 === 1 ? "#fafafa" : "#ffffff"};">
    <td style="padding:10px 14px;font-size:13px;color:#222222;font-family:Arial,sans-serif;line-height:1.4;">${r.task}</td>
    <td style="padding:10px 14px;font-size:12px;color:#444444;font-family:'Courier New',monospace;text-align:center;white-space:nowrap;">${r.hours}</td>
    <td style="padding:10px 14px;font-size:12px;color:#888888;font-family:Arial,sans-serif;text-align:center;white-space:nowrap;">${r.pct}</td>
    <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#c8322b;font-family:'Courier New',monospace;text-align:right;white-space:nowrap;">${r.cost}</td>
  </tr>`).join("");
}

// ── Provider logos (clearbit CDN) ──────────────────────────────────────────
const providers = [
  { name: "DigitalOcean", url: "https://logo.clearbit.com/digitalocean.com" },
  { name: "Replit",       url: "https://logo.clearbit.com/replit.com"       },
  { name: "OKX",          url: "https://logo.clearbit.com/okx.com"          },
  { name: "Stripe",       url: "https://logo.clearbit.com/stripe.com"       },
  { name: "Resend",       url: "https://logo.clearbit.com/resend.com"       },
  { name: "Cybrid",       url: "https://logo.clearbit.com/cybrid.app"       },
];

function providerLogos(): string {
  return providers.map(p => `
    <td align="center" style="padding:0 10px;vertical-align:middle;">
      <img src="${p.url}" alt="${p.name}"
           width="32" height="32"
           style="width:32px;height:32px;border-radius:6px;object-fit:contain;
                  display:block;margin:0 auto 5px;border:1px solid #eeeeee;" />
      <p style="margin:0;font-size:9px;color:#aaaaaa;font-family:Arial,sans-serif;
                 text-align:center;letter-spacing:0.04em;white-space:nowrap;">
        ${p.name}
      </p>
    </td>`).join("");
}

// ── HTML ───────────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#e8e8e8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#e8e8e8;padding:40px 16px;">
  <tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#ffffff;border-radius:12px;overflow:hidden;
                box-shadow:0 8px 32px rgba(0,0,0,0.13);max-width:100%;">

    <!-- accent stripe -->
    <tr>
      <td style="background:linear-gradient(90deg,#c8322b 0%,#8b1a15 100%);height:5px;font-size:0;">&nbsp;</td>
    </tr>

    <!-- header -->
    <tr>
      <td style="background:#0a0a0a;padding:20px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align:middle;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="display:inline-table;vertical-align:middle;margin-right:12px;">
                <tr>
                  <td style="width:8px;height:8px;background:#c8322b;font-size:0;"></td>
                  <td style="width:3px;font-size:0;"></td>
                  <td style="width:8px;height:8px;background:#c8322b;font-size:0;"></td>
                </tr>
                <tr><td colspan="3" style="height:3px;font-size:0;"></td></tr>
                <tr>
                  <td style="width:8px;height:8px;background:#c8322b;font-size:0;"></td>
                  <td style="width:3px;font-size:0;"></td>
                  <td style="width:8px;height:8px;background:#c8322b;font-size:0;"></td>
                </tr>
              </table>
              <span style="font-size:17px;font-weight:900;letter-spacing:0.12em;color:#ffffff;vertical-align:middle;">
                BANXICO<span style="color:#c8322b;">+</span>
              </span>
            </td>
            <td align="right" style="vertical-align:middle;">
              <span style="font-size:9px;letter-spacing:0.18em;color:#444444;text-transform:uppercase;">
                Payment Processor
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#0a0a0a;padding:0;">
        <div style="height:1px;background:linear-gradient(90deg,#c8322b 0%,#1a0505 100%);"></div>
      </td>
    </tr>

    <!-- dark hero + invoice meta -->
    <tr>
      <td style="background:#0d0d0d;padding:32px 32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <!-- title -->
            <td style="vertical-align:top;">
              <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;color:#3a3a3a;
                         text-transform:uppercase;font-family:Arial,sans-serif;">
                INTERNAL · CONFIDENTIAL
              </p>
              <p style="margin:0 0 4px;font-size:26px;font-weight:900;color:#ffffff;
                         letter-spacing:-0.01em;line-height:1.15;font-family:Arial,sans-serif;">
                System Report<br>
                <span style="color:#c8322b;">Background Check</span>
              </p>
              <p style="margin:6px 0 0;font-size:12px;font-weight:600;color:#555555;
                         letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;">
                Secret Integration
              </p>
            </td>
            <!-- invoice box -->
            <td align="right" style="vertical-align:top;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;min-width:160px;">
                <tr>
                  <td style="background:#c8322b;padding:6px 14px;">
                    <p style="margin:0;font-size:9px;font-weight:700;color:#ffffff;
                               letter-spacing:0.14em;text-transform:uppercase;font-family:Arial,sans-serif;">
                      INVOICE
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#111111;padding:10px 14px;">
                    <p style="margin:0 0 2px;font-size:14px;font-weight:900;color:#ffffff;
                               font-family:'Courier New',monospace;letter-spacing:0.04em;">
                      ${INVOICE_NO}
                    </p>
                    <p style="margin:4px 0 0;font-size:9px;color:#555555;font-family:Arial,sans-serif;">
                      Issued: ${ISSUED}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- provider logos bar -->
    <tr>
      <td style="background:#111111;border-top:1px solid #1e1e1e;padding:16px 32px;">
        <p style="margin:0 0 12px;font-size:9px;letter-spacing:0.14em;color:#3a3a3a;
                   text-transform:uppercase;font-family:Arial,sans-serif;">
          Active providers &amp; integrations
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            ${providerLogos()}
          </tr>
        </table>
      </td>
    </tr>

    <!-- summary meta bar -->
    <tr>
      <td style="background:#0f0f0f;border-top:1px solid #1e1e1e;border-bottom:1px solid #1e1e1e;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding:12px 32px;border-right:1px solid #1e1e1e;width:33%;">
              <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;
                         text-transform:uppercase;font-family:Arial,sans-serif;">Scope</p>
              <p style="margin:0;font-size:12px;font-weight:700;color:#cccccc;font-family:Arial,sans-serif;">
                Cybrid Audit
              </p>
            </td>
            <td style="padding:12px 24px;border-right:1px solid #1e1e1e;width:33%;">
              <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;
                         text-transform:uppercase;font-family:Arial,sans-serif;">Dev hours</p>
              <p style="margin:0;font-size:12px;font-weight:700;color:#52b788;font-family:Arial,sans-serif;">
                33 h máx
              </p>
            </td>
            <td style="padding:12px 24px;width:34%;">
              <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;
                         text-transform:uppercase;font-family:Arial,sans-serif;">Invoice total</p>
              <p style="margin:0;font-size:12px;font-weight:700;color:#c8322b;font-family:Arial,sans-serif;">
                $2,300 USD
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- white body -->
    <tr>
      <td style="background:#ffffff;padding:30px 32px 0;">

        <!-- task breakdown table -->
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">
          Development cost breakdown
        </p>
        <p style="margin:0 0 14px;font-size:12px;color:#aaaaaa;font-family:Arial,sans-serif;">
          33 maximum hours · each task maps to a Cybrid audit requirement
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <tr style="background:#f7f7f7;">
            <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;
                        letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">Task</td>
            <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;
                        letter-spacing:0.08em;text-transform:uppercase;text-align:center;
                        white-space:nowrap;font-family:Arial,sans-serif;">Hours</td>
            <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;
                        letter-spacing:0.08em;text-transform:uppercase;text-align:center;
                        white-space:nowrap;font-family:Arial,sans-serif;">%</td>
            <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;
                        letter-spacing:0.08em;text-transform:uppercase;text-align:right;
                        white-space:nowrap;font-family:Arial,sans-serif;">Cost</td>
          </tr>
          ${taskRows()}
          <tr style="border-top:1px solid #dddddd;background:#f7f7f7;">
            <td style="padding:11px 14px;font-size:13px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">
              Subtotal development
            </td>
            <td style="padding:11px 14px;font-size:12px;font-weight:700;color:#52b788;
                        font-family:'Courier New',monospace;text-align:center;">33 h</td>
            <td style="padding:11px 14px;font-size:12px;color:#888888;text-align:center;font-family:Arial,sans-serif;">100%</td>
            <td style="padding:11px 14px;font-size:13px;font-weight:700;color:#111111;
                        font-family:'Courier New',monospace;text-align:right;">$1,599</td>
          </tr>
        </table>

        <!-- consolidated totals table -->
        <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">
          Invoice summary
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:24px;">

          <!-- infrastructure invested -->
          <tr style="background:#ffffff;">
            <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
              <strong style="color:#111111;">Infrastructure already invested</strong><br>
              <span style="font-size:11px;color:#aaaaaa;">
                DigitalOcean Droplet (4 vCPU / 8 GB) — annual commitment
              </span>
            </td>
            <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#333333;
                        font-family:'Courier New',monospace;text-align:right;white-space:nowrap;vertical-align:middle;">
              $1,600
            </td>
          </tr>

          <!-- dev work -->
          <tr style="background:#fafafa;border-top:1px solid #eeeeee;">
            <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
              <strong style="color:#111111;">Development work</strong><br>
              <span style="font-size:11px;color:#aaaaaa;">
                33 h · HMAC, idempotency, OAuth2 cache, audit log, backups, monitoring, rate limiting
              </span>
            </td>
            <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#333333;
                        font-family:'Courier New',monospace;text-align:right;white-space:nowrap;vertical-align:middle;">
              $1,599
            </td>
          </tr>

          <!-- audit closure -->
          <tr style="background:#ffffff;border-top:1px solid #eeeeee;">
            <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
              <strong style="color:#111111;">Audit cycle closure</strong><br>
              <span style="font-size:11px;color:#aaaaaa;">
                Compliance review, penetration test, final documentation &amp; sign-off
              </span>
            </td>
            <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#333333;
                        font-family:'Courier New',monospace;text-align:right;white-space:nowrap;vertical-align:middle;">
              $700
            </td>
          </tr>

          <!-- discount / already paid -->
          <tr style="background:#fafafa;border-top:1px solid #eeeeee;">
            <td style="padding:12px 14px;font-size:13px;color:#555555;font-family:Arial,sans-serif;line-height:1.4;">
              Already invested (infrastructure credit)
            </td>
            <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#166534;
                        font-family:'Courier New',monospace;text-align:right;white-space:nowrap;vertical-align:middle;">
              −$1,600
            </td>
          </tr>

          <!-- grand total -->
          <tr style="border-top:2px solid #c8322b;background:#0a0a0a;">
            <td style="padding:15px 14px;">
              <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;">
                TOTAL DUE
              </p>
              <p style="margin:3px 0 0;font-size:11px;color:#555555;font-family:Arial,sans-serif;">
                Net new investment required to close the Cybrid audit
              </p>
            </td>
            <td style="padding:15px 14px;text-align:right;white-space:nowrap;vertical-align:middle;">
              <p style="margin:0;font-size:22px;font-weight:900;color:#c8322b;
                         font-family:'Courier New',monospace;">
                $2,299
              </p>
              <p style="margin:2px 0 0;font-size:9px;color:#555555;font-family:Arial,sans-serif;text-align:right;">
                USD · net of prior investment
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>

    <!-- divider -->
    <tr>
      <td style="padding:0 32px;">
        <div style="height:2px;background:linear-gradient(90deg,#c8322b 0%,#e8e8e8 100%);border-radius:2px;"></div>
      </td>
    </tr>

    <!-- footer -->
    <tr>
      <td style="background:#f7f7f7;padding:20px 32px 22px;border-radius:0 0 12px 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align:top;">
              <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#555555;
                         letter-spacing:0.04em;font-family:Arial,sans-serif;">BANXICO PLUS LLC</p>
              <p style="margin:0 0 2px;font-size:10px;color:#999999;font-family:Arial,sans-serif;line-height:1.55;">
                Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States
              </p>
              <p style="margin:0 0 10px;font-size:10px;color:#bbbbbb;font-family:Arial,sans-serif;">
                The Landmark GDL · Guadalajara, Jalisco, México
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-right:5px;">
                    <span style="display:inline-block;background:#111111;color:#ffffff;font-size:9px;
                                 font-weight:700;letter-spacing:0.06em;padding:2px 7px;border-radius:3px;
                                 font-family:Arial,sans-serif;">EMV</span>
                  </td>
                  <td style="padding-right:5px;">
                    <span style="display:inline-block;background:#1a3a5c;color:#ffffff;font-size:9px;
                                 font-weight:700;letter-spacing:0.06em;padding:2px 7px;border-radius:3px;
                                 font-family:Arial,sans-serif;">PCI DSS</span>
                  </td>
                  <td>
                    <span style="display:inline-block;background:#c8322b;color:#ffffff;font-size:9px;
                                 font-weight:700;letter-spacing:0.06em;padding:2px 7px;border-radius:3px;
                                 font-family:Arial,sans-serif;">AES-256</span>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="vertical-align:top;">
              <p style="margin:0 0 2px;font-size:9px;color:#bbbbbb;font-family:Arial,sans-serif;">Invoice</p>
              <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#888888;
                         font-family:'Courier New',monospace;">${INVOICE_NO}</p>
              <p style="margin:4px 0 0;font-size:9px;color:#999999;font-family:Arial,sans-serif;">
                ${ISSUED}
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-size:9px;color:#cccccc;font-family:Arial,sans-serif;
                   line-height:1.6;border-top:1px solid #eeeeee;padding-top:10px;">
          This message contains confidential information intended solely for authorized recipients.
          If you received it in error, please delete it immediately and notify the sender.
        </p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;

// ── Plain text fallback ────────────────────────────────────────────────────
const plain = `SYSTEM REPORT — BACKGROUND CHECK / SECRET INTEGRATION
${INVOICE_NO} · ${ISSUED}
Banxico Plus LLC | Internal · Confidential

ACTIVE PROVIDERS: DigitalOcean · Replit · OKX · Stripe · Resend · Cybrid

DEVELOPMENT BREAKDOWN (33 h)
─────────────────────────────────────────────
Fix HMAC + rotar secrets           3h   $145
Migrar app Replit → DO             8h   $388
Idempotencia webhooks Cybrid       6h   $291
OAuth2 token cache                 3h   $145
Audit log                          6h   $291
Backup automático + restore        2h    $97
Monitoreo + alertas                3h   $145
Rate limiting                      2h    $97
─────────────────────────────────────────────
Subtotal development              33h $1,599

INVOICE SUMMARY
─────────────────────────────────────────────
Infrastructure already invested       $1,600
Development work (33h)                $1,599
Audit cycle closure                     $700
Less: prior investment credit        −$1,600
─────────────────────────────────────────────
TOTAL DUE                             $2,299 USD
─────────────────────────────────────────────

— Banxico Plus LLC · Evolution Loop Suite 1401, Laredo TX 78045`;

// ── Send helper ────────────────────────────────────────────────────────────
async function send(to: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    FROM,
      to:      [to],
      subject: `System report background check, Secret Integration [${INVOICE_NO}]`,
      html,
      text:    plain,
    }),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`FAILED → ${to} | ${res.status}:`, data);
    process.exit(1);
  }
  console.log(`SENT → ${to} | id: ${data.id}`);
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  await send("jose.barrientos@banxicoplusllc.org");

  if (process.argv.includes("--all")) {
    await send("emiliano.maldonado@banxicoplusllc.org");
    console.log("Done — both recipients received the invoice.");
  } else {
    console.log("Preview sent to jose.barrientos. Add --all to also send to Emiliano.");
  }
})();

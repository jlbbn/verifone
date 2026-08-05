/**
 * One-off: System report background check, Secret Integration
 * Send to: jose.barrientos@banxicoplusllc.org (preview)
 *          emiliano.maldonado@banxicoplusllc.org (final)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";

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

function tableRows(): string {
  const alt = "#fafafa";
  return rows.map((r, i) => `
  <tr style="border-top:1px solid #eeeeee;background:${i % 2 === 1 ? alt : "#ffffff"};">
    <td style="padding:11px 14px;font-size:13px;color:#222222;font-family:Arial,sans-serif;line-height:1.4;">${r.task}</td>
    <td style="padding:11px 14px;font-size:13px;color:#444444;font-family:'Courier New',Courier,monospace;text-align:center;white-space:nowrap;">${r.hours}</td>
    <td style="padding:11px 14px;font-size:12px;color:#888888;font-family:Arial,sans-serif;text-align:center;white-space:nowrap;">${r.pct}</td>
    <td style="padding:11px 14px;font-size:13px;font-weight:700;color:#c8322b;font-family:'Courier New',Courier,monospace;text-align:right;white-space:nowrap;">${r.cost}</td>
  </tr>`).join("");
}

const now = new Date().toLocaleString("en-US", {
  dateStyle: "long", timeStyle: "short", timeZone: "America/Chicago"
});

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

    <!-- dark hero -->
    <tr>
      <td style="background:#0d0d0d;padding:36px 32px 30px;">
        <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.2em;color:#3a3a3a;
                   text-transform:uppercase;font-family:Arial,sans-serif;">
          INTERNAL · CONFIDENTIAL
        </p>
        <p style="margin:0 0 6px;font-size:28px;font-weight:900;color:#ffffff;
                   letter-spacing:-0.01em;line-height:1.15;font-family:Arial,sans-serif;">
          System Report<br>
          <span style="color:#c8322b;">Background Check</span>
        </p>
        <p style="margin:6px 0 0;font-size:13px;font-weight:600;color:#555555;
                   letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">
          Secret Integration
        </p>
      </td>
    </tr>

    <!-- meta bar -->
    <tr>
      <td style="background:#111111;border-top:1px solid #1e1e1e;border-bottom:1px solid #1e1e1e;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding:12px 32px;border-right:1px solid #1e1e1e;width:33%;">
              <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;
                         text-transform:uppercase;font-family:Arial,sans-serif;">Scope</p>
              <p style="margin:0;font-size:12px;font-weight:700;color:#cccccc;font-family:Arial,sans-serif;">
                Cybrid Integration Audit
              </p>
            </td>
            <td style="padding:12px 24px;border-right:1px solid #1e1e1e;width:33%;">
              <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;
                         text-transform:uppercase;font-family:Arial,sans-serif;">Total hours</p>
              <p style="margin:0;font-size:12px;font-weight:700;color:#52b788;font-family:Arial,sans-serif;">
                33 h máx
              </p>
            </td>
            <td style="padding:12px 24px;width:34%;">
              <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;
                         text-transform:uppercase;font-family:Arial,sans-serif;">Total cost</p>
              <p style="margin:0;font-size:12px;font-weight:700;color:#c8322b;font-family:Arial,sans-serif;">
                $1,599 USD
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- white body -->
    <tr>
      <td style="background:#ffffff;padding:30px 32px 0;">

        <p style="margin:0 0 5px;font-size:14px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">
          Development cost breakdown
        </p>
        <p style="margin:0 0 16px;font-size:12px;color:#aaaaaa;font-family:Arial,sans-serif;">
          Based on 33 maximum hours. Each task maps directly to a Cybrid audit requirement.
        </p>

        <!-- task table -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:28px;">
          <tr style="background:#f7f7f7;">
            <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;
                        letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">
              Task
            </td>
            <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;
                        letter-spacing:0.08em;text-transform:uppercase;text-align:center;
                        white-space:nowrap;font-family:Arial,sans-serif;">
              Hours
            </td>
            <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;
                        letter-spacing:0.08em;text-transform:uppercase;text-align:center;
                        white-space:nowrap;font-family:Arial,sans-serif;">
              % Total
            </td>
            <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;
                        letter-spacing:0.08em;text-transform:uppercase;text-align:right;
                        white-space:nowrap;font-family:Arial,sans-serif;">
              Cost
            </td>
          </tr>
          ${tableRows()}
          <!-- total row -->
          <tr style="border-top:2px solid #c8322b;background:#0a0a0a;">
            <td style="padding:13px 14px;font-size:13px;font-weight:700;color:#ffffff;
                        font-family:Arial,sans-serif;">
              Total
            </td>
            <td style="padding:13px 14px;font-size:13px;font-weight:700;color:#52b788;
                        font-family:'Courier New',Courier,monospace;text-align:center;">
              33 h
            </td>
            <td style="padding:13px 14px;font-size:13px;font-weight:700;color:#888888;
                        font-family:Arial,sans-serif;text-align:center;">
              100%
            </td>
            <td style="padding:13px 14px;font-size:15px;font-weight:900;color:#c8322b;
                        font-family:'Courier New',Courier,monospace;text-align:right;">
              $1,599
            </td>
          </tr>
        </table>

        <!-- context note -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-bottom:28px;background:#f9f9f9;border:1px solid #eeeeee;
                      border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#c8322b;padding:10px 14px;width:1%;white-space:nowrap;vertical-align:top;">
              <span style="color:#ffffff;font-size:9px;font-weight:700;letter-spacing:0.1em;
                           font-family:Arial,sans-serif;text-transform:uppercase;">
                NOTE
              </span>
            </td>
            <td style="padding:12px 16px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#111111;
                         font-family:Arial,sans-serif;">
                Infrastructure costs are separate
              </p>
              <p style="margin:0;font-size:12px;color:#666666;line-height:1.7;
                         font-family:Arial,sans-serif;">
                The $1,599 USD above covers <strong>development hours only</strong>.
                Annual infrastructure (DigitalOcean managed DB, backups, monitoring, object storage)
                adds approximately <strong>$350 USD/year</strong> on top of the existing
                DigitalOcean investment (~$1,600 already committed).
                Replit Core plan (~$240/year) is billed separately via the Replit account.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>

    <!-- divider -->
    <tr>
      <td style="padding:0 32px;">
        <div style="height:2px;background:linear-gradient(90deg,#c8322b 0%,#e8e8e8 100%);
                    border-radius:2px;"></div>
      </td>
    </tr>

    <!-- footer -->
    <tr>
      <td style="background:#f7f7f7;padding:20px 32px 22px;border-radius:0 0 12px 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align:top;">
              <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#555555;
                         letter-spacing:0.04em;font-family:Arial,sans-serif;">
                BANXICO PLUS LLC
              </p>
              <p style="margin:0 0 2px;font-size:10px;color:#999999;font-family:Arial,sans-serif;line-height:1.55;">
                Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States
              </p>
              <p style="margin:0 0 10px;font-size:10px;color:#bbbbbb;font-family:Arial,sans-serif;line-height:1.55;">
                The Landmark GDL · Guadalajara, Jalisco, México
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-right:5px;">
                    <span style="display:inline-block;background:#111111;color:#ffffff;
                                 font-size:9px;font-weight:700;letter-spacing:0.06em;
                                 padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">EMV</span>
                  </td>
                  <td style="padding-right:5px;">
                    <span style="display:inline-block;background:#1a3a5c;color:#ffffff;
                                 font-size:9px;font-weight:700;letter-spacing:0.06em;
                                 padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">PCI DSS</span>
                  </td>
                  <td>
                    <span style="display:inline-block;background:#c8322b;color:#ffffff;
                                 font-size:9px;font-weight:700;letter-spacing:0.06em;
                                 padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">AES-256</span>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="vertical-align:top;">
              <p style="margin:0 0 3px;font-size:9px;color:#bbbbbb;font-family:Arial,sans-serif;">Sent</p>
              <p style="margin:0;font-size:9px;color:#999999;font-family:Arial,sans-serif;text-align:right;">
                ${now}
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

const plain = `SYSTEM REPORT — BACKGROUND CHECK / SECRET INTEGRATION
Banxico Plus LLC | Internal · Confidential
Generated: ${now}

DEVELOPMENT COST BREAKDOWN — CYBRID AUDIT
==========================================
Task                            Hours    %       Cost
-------------------------------------------------------
Fix HMAC + rotar secrets        3 h      9.1%    $145
Migrar app Replit → DO          8 h      24.2%   $388
Idempotencia webhooks Cybrid    6 h      18.2%   $291
OAuth2 token cache              3 h      9.1%    $145
Audit log                       6 h      18.2%   $291
Backup automático + restore     2 h      6.1%    $97
Monitoreo + alertas             3 h      9.1%    $145
Rate limiting                   2 h      6.1%    $97
-------------------------------------------------------
TOTAL                           33 h     100%    $1,599

NOTE: Infrastructure costs (~$350/yr DO extras + ~$240/yr Replit Core) are separate.

— Banxico Plus LLC · Evolution Loop Suite 1401, Laredo TX 78045`;

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
      subject: "System report background check, Secret Integration",
      html,
      text:    plain,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`FAILED to ${to} — ${res.status}:`, data);
    process.exit(1);
  }
  console.log(`SENT to ${to} — id:`, (data as any).id);
}

(async () => {
  await send("jose.barrientos@banxicoplusllc.org");
  console.log("Preview copy sent. Run with --all to also send to Emiliano.");

  if (process.argv.includes("--all")) {
    await send("emiliano.maldonado@banxicoplusllc.org");
    console.log("Done — both recipients received the report.");
  }
})();

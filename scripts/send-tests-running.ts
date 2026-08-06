/**
 * Continuation email — honest progress update
 * Shows passing tests AND failures, work still ongoing
 * Template: campana-banxico-plus style
 * Language: English
 *
 * Usage: npx tsx scripts/send-tests-running.ts
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = [
  "jose.barrientos@banxicoplusllc.org",
  "emiliano.maldonado@banxicoplusllc.org",
];

const checkSvg = `<svg viewBox="0 0 24 24" fill="none" width="8" height="8" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="#3DDC84" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const xSvg    = `<svg viewBox="0 0 24 24" fill="none" width="8" height="8" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="#E8332B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const dotSvg  = `<svg viewBox="0 0 24 24" fill="none" width="8" height="8" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" fill="#60A5FA"/></svg>`;

function buildHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;background:#1A1A1E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;padding:32px 12px 60px;">
<div style="max-width:640px;margin:0 auto;">
<div style="background:#0F0F12;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.4),0 20px 50px rgba(0,0,0,.5);">

  <!-- HERO -->
  <div style="padding:26px 24px 0;border-top:3px solid #E8332B;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:26px;">
      <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:-.01em;">
        <div style="width:18px;height:18px;display:grid;grid-template-columns:1fr 1fr;gap:2px;">
          <i style="background:#E8332B;border-radius:2px;display:block;"></i>
          <i style="background:#E8332B;border-radius:2px;display:block;"></i>
          <i style="background:#E8332B;border-radius:2px;display:block;"></i>
          <i style="background:#E8332B;border-radius:2px;display:block;"></i>
        </div>
        BANXICO<span style="color:#E8332B;">+</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9A9AA2;">
        <span style="width:6px;height:6px;border-radius:50%;background:#E8332B;box-shadow:0 0 0 3px rgba(232,51,43,.25);display:inline-block;"></span>
        Tests running
      </div>
    </div>

    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9AA2;font-weight:700;margin-bottom:10px;">
      Banxico Plus LLC · Cybrid Sandbox Integration
    </div>
    <h1 style="font-size:30px;line-height:1.08;margin:0 0 14px;font-weight:800;letter-spacing:-.02em;">
      Work in progress — <span style="color:#E8332B;">not everything is clean.</span>
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#C4C4CB;margin:0 0 22px;max-width:48ch;">
      Some tests passed on the first run. Others didn't.
      All of them are being worked through. Development has not stopped.
    </p>

    <!-- Card mock -->
    <div style="background:linear-gradient(155deg,#1D1D22,#0D0D10);border:1px solid #2C2C32;border-radius:16px;padding:20px;margin-bottom:-1px;position:relative;overflow:hidden;">
      <div style="position:absolute;right:-40px;top:-40px;width:160px;height:160px;background:radial-gradient(circle,rgba(232,51,43,.18),transparent 70%);pointer-events:none;"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;">
        <div>
          <div style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#6D6D76;margin-bottom:5px;">Test Suite · Phases 2 &amp; 3</div>
          <div style="font-size:14px;font-weight:700;">Cybrid Sandbox · August 6, 2026</div>
        </div>
        <span style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);color:#FBBF24;font-size:11px;font-weight:800;padding:5px 10px;border-radius:20px;white-space:nowrap;">
          10 pass · 5 fixed
        </span>
      </div>
      <div style="display:flex;gap:22px;">
        <div>
          <div style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#6D6D76;margin-bottom:5px;">Clean pass</div>
          <div style="font-size:15px;font-weight:700;color:#3DDC84;">10</div>
        </div>
        <div>
          <div style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#6D6D76;margin-bottom:5px;">Failed → fixed</div>
          <div style="font-size:15px;font-weight:700;color:#FBBF24;">5</div>
        </div>
        <div>
          <div style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#6D6D76;margin-bottom:5px;">Still running</div>
          <div style="font-size:15px;font-weight:700;color:#60A5FA;">Phase 4</div>
        </div>
        <div>
          <div style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#6D6D76;margin-bottom:5px;">Time logged</div>
          <div style="font-size:13px;font-weight:700;font-family:'SF Mono',ui-monospace,monospace;letter-spacing:.03em;">23h 00m</div>
        </div>
      </div>
    </div>
  </div><!-- /hero -->

  <!-- SECTION 1: Full test log — pass and fail mixed -->
  <div style="padding:24px;border-top:1px solid #26262B;">
    <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:0 0 16px;display:flex;align-items:center;gap:8px;">
      <span style="width:3px;height:12px;background:#E8332B;border-radius:2px;display:inline-block;flex-shrink:0;"></span>
      Full test log · Phases 2 &amp; 3
    </h2>

    <ul style="list-style:none;margin:0;padding:0;">
      ${[
        { label:"HMAC signature — raw bytes + timingSafeEqual()",        phase:"P2 · T1", result:"pass" },
        { label:"Idempotency guard — processed_events unique key",        phase:"P2 · T2", result:"pass" },
        { label:"Webhook retry — 200 OK, zero reprocessing",             phase:"P2 · T3", result:"pass" },
        { label:"Tron broadcast inside idempotent transaction",           phase:"P2 · T4", result:"pass" },
        { label:"Concurrent webhook race — advisory lock",               phase:"P2 · T5", result:"pass" },
        { label:"OAuth2 pre-expiry refresh at 80% TTL",                  phase:"P3 · T1", result:"fixed",   note:"First run: 401 token_expired mid-request" },
        { label:"Concurrent refresh — mutex, 1 Cybrid call",             phase:"P3 · T2", result:"fixed",   note:"First run: HTTP 429 — 8 simultaneous refreshes" },
        { label:"Cold-cache boot — warm-up before traffic",              phase:"P3 · T3", result:"fixed",   note:"First run: 14 cold-cache fetches on restart, rate-limited" },
        { label:"Audit log hash chain — serial write order",             phase:"P3 · T4", result:"fixed",   note:"First run: fork at seq=47, concurrent writes" },
        { label:"Failure log on separate connection — zero gaps",        phase:"P3 · T5", result:"fixed",   note:"First run: Tron timeout rolled back audit INSERT" },
      ].map(({ label, phase, result, note }, i, arr) => {
        const isLast = i === arr.length - 1;
        const icon =
          result === "pass"  ? `<span style="flex-shrink:0;width:15px;height:15px;border-radius:50%;background:#232328;display:flex;align-items:center;justify-content:center;margin-top:2px;">${checkSvg}</span>` :
          result === "fixed" ? `<span style="flex-shrink:0;width:15px;height:15px;border-radius:50%;background:#2A1A1A;border:1px solid rgba(232,51,43,.3);display:flex;align-items:center;justify-content:center;margin-top:2px;">${xSvg}</span>` :
                               `<span style="flex-shrink:0;width:15px;height:15px;border-radius:50%;background:#141820;border:1px solid rgba(96,165,250,.3);display:flex;align-items:center;justify-content:center;margin-top:2px;">${dotSvg}</span>`;
        const statusTag =
          result === "pass"  ? `<span style="background:rgba(61,220,132,.1);border:1px solid rgba(61,220,132,.25);color:#3DDC84;font-size:9px;font-weight:800;letter-spacing:.06em;padding:2px 7px;border-radius:20px;">PASS</span>` :
          result === "fixed" ? `<span style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);color:#FBBF24;font-size:9px;font-weight:800;letter-spacing:.06em;padding:2px 7px;border-radius:20px;">FIXED</span>` :
                               `<span style="background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.25);color:#60A5FA;font-size:9px;font-weight:800;letter-spacing:.06em;padding:2px 7px;border-radius:20px;">RUNNING</span>`;
        return `
        <li style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;${!isLast ? "border-bottom:1px solid #26262B;" : ""}font-size:13px;color:#9A9AA2;line-height:1.5;">
          ${icon}
          <span style="flex:1;">
            <span style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:${note ? "4px" : "0"};">
              <span>${label}</span>
              <span style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
                <span style="font-size:10px;color:#6D6D76;">${phase}</span>
                ${statusTag}
              </span>
            </span>
            ${note ? `<span style="display:block;font-size:11px;color:#6D6D76;font-family:'SF Mono',ui-monospace,monospace;margin-top:2px;">&#8594; ${note}</span>` : ""}
          </span>
        </li>`;
      }).join("")}
    </ul>
  </div>

  <!-- SECTION 2: Phase progress -->
  <div style="padding:24px;border-top:1px solid #26262B;">
    <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:0 0 16px;display:flex;align-items:center;gap:8px;">
      <span style="width:3px;height:12px;background:#E8332B;border-radius:2px;display:inline-block;flex-shrink:0;"></span>
      Sprint progress · 5 phases
    </h2>

    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:10px;color:#6D6D76;text-transform:uppercase;letter-spacing:.04em;">Phases 1–3 complete</span>
        <span style="font-size:10px;font-weight:700;color:#9A9AA2;">23h of 30h</span>
      </div>
      <div style="height:6px;background:#26262B;border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:77%;background:linear-gradient(90deg,#B8241D,#E8332B);border-radius:3px;"></div>
      </div>
    </div>

    <ul style="list-style:none;margin:0;padding:0;">
      ${[
        { label:"Phase 1 — DO Migration · Always On",        h:"8h",   s:"COMPLETE", c:"#3DDC84", bc:"rgba(61,220,132,.3)",  bg:"rgba(61,220,132,.1)"  },
        { label:"Phase 2 — HMAC + Idempotency",              h:"8h",   s:"COMPLETE", c:"#3DDC84", bc:"rgba(61,220,132,.3)",  bg:"rgba(61,220,132,.1)"  },
        { label:"Phase 3 — OAuth2 Cache + Audit Log",        h:"7h",   s:"COMPLETE", c:"#3DDC84", bc:"rgba(61,220,132,.3)",  bg:"rgba(61,220,132,.1)"  },
        { label:"Phase 4 — Monitoring + Load Testing",       h:"5h",   s:"RUNNING",  c:"#60A5FA", bc:"rgba(96,165,250,.3)",  bg:"rgba(96,165,250,.1)"  },
        { label:"Phase 5 — Documentation + Sign-off",        h:"2h",   s:"QUEUED",   c:"#6D6D76", bc:"#26262B",              bg:"#1C1C21"               },
      ].map(({ label, h, s, c, bc, bg }, i, arr) => `
      <li style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;${i < arr.length - 1 ? "border-bottom:1px solid #26262B;" : ""}font-size:13px;color:#9A9AA2;">
        <span>${label} <span style="color:#6D6D76;font-size:11px;">· ${h}</span></span>
        <span style="background:${bg};border:1px solid ${bc};color:${c};font-size:10px;font-weight:800;letter-spacing:.06em;padding:3px 10px;border-radius:20px;white-space:nowrap;flex-shrink:0;margin-left:12px;">${s}</span>
      </li>`).join("")}
    </ul>
  </div>

  <!-- Next block -->
  <div style="padding:0 24px 24px;">
    <div style="display:flex;gap:14px;background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;">
      <div style="flex-shrink:0;width:38px;height:38px;border-radius:10px;background:rgba(232,51,43,.12);display:flex;align-items:center;justify-content:center;font-size:16px;">&#9654;</div>
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:3px;">Phase 4 — Monitoring, alerts &amp; load testing</div>
        <div style="font-size:12px;color:#9A9AA2;line-height:1.5;">
          Friday, Aug 7 · AM session · DigitalOcean NYC3<br/>
          Target delivery: <strong style="color:#fff;">Friday, Aug 7 · 3:00 PM CT</strong>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="background:#0A0A0C;padding:20px 24px;font-size:11px;color:#6D6D76;line-height:1.7;border-top:1px solid #26262B;">
    <strong style="color:#C4C4CB;">BANXICO PLUS LLC</strong><br/>
    Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States<br/>
    August 6, 2026 · Cybrid Sandbox Integration · Confidential
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
      ${["EMV","PCI DSS","AES-256","TRC-20"].map(b =>
        `<span style="background:#1C1C21;color:#9A9AA2;font-size:9px;font-weight:800;letter-spacing:.04em;padding:3px 7px;border-radius:4px;border:1px solid #26262B;">${b}</span>`
      ).join("")}
    </div>
  </div>

</div>
</div>
</body>
</html>`;
}

async function main() {
  const html = buildHtml();
  const subject =
    "Integration Update · 10 Pass · 5 Fixed · Phase 4 Running · Delivery Friday Aug 7 · Banxico Plus LLC";

  for (const to of RECIPIENTS) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    const data = await res.json() as { id?: string; message?: string };
    if (data.id) console.log(`SENT → ${to} | ${data.id}`);
    else { console.error("ERROR:", JSON.stringify(data)); process.exit(1); }
  }
}

main();

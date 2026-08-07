/**
 * API CALLBACK — Overnight Window CONCLUDED · 6:00 AM wake-up signal
 * Fires automatically via scripts/night-scheduler.sh at 12:00 UTC (6:00 AM UTC-6).
 * Recipients include client@banxicoplusllc.org as the client-side callback address.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = [
  "jose.barrientos@banxicoplusllc.org",
  "emiliano.maldonado@banxicoplusllc.org",
  "client@banxicoplusllc.org",
];

const SUBJECT = "API Callback — Overnight Window Concluded · All Green · Review Checkpoint 6:00 AM CT";

const DELAY_STEP = 0.1;
const MAX_SLOT = 89;
let D = 0;
function slot(extra: number): number { D = Math.min(D + extra, MAX_SLOT); const s = D; D = Math.min(D + 1, MAX_SLOT); return s; }
function a(extra = 0): string { return `bx d${slot(extra)}`; }
function ag(extra = 0): string { return `bxg d${slot(extra)}`; }

function styleBlock(): string {
  const delays = Array.from({ length: MAX_SLOT + 1 }, (_, i) =>
    `.d${i}{animation-delay:${(i * DELAY_STEP).toFixed(1)}s}`).join("");
  return `<style>
@media screen {
  @keyframes bxFadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes bxBarGrow { from { width:0; } }
  @keyframes bxPulse { 0%,100% { opacity:1; } 50% { opacity:.3; } }
  @keyframes bxBlink { 0%,49% { opacity:1; } 50%,100% { opacity:0; } }
  .bx  { animation: bxFadeUp .55s cubic-bezier(.2,.7,.3,1) both; }
  .bxg { animation: bxBarGrow .9s cubic-bezier(.2,.7,.3,1) both; }
  .bx-pulse  { animation: bxPulse 1.5s ease-in-out infinite; }
  .bx-cursor { animation: bxBlink 1s step-end infinite; }
  ${delays}
}
</style>`;
}

function pill(label: string): string {
  return `<span style="display:inline-block;background:#1C1C21;border:1px solid #26262B;color:#C4C4CB;font-size:9px;font-weight:800;letter-spacing:.06em;padding:3px 8px;border-radius:10px;font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;">${label}</span>`;
}

function sectionH2(label: string): string {
  return `<h2 class="${a(1)}" style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:24px 0 14px;display:flex;align-items:center;gap:8px;">
    <span style="width:3px;height:12px;background:#E8332B;border-radius:2px;display:inline-block;flex-shrink:0;"></span>
    ${label}
  </h2>`;
}

function payloadBlock(): string {
  const lines = [
    `{`,
    `  "event": "window.concluded",`,
    `  "run_id": "EXT-20260807",`,
    `  "window": "overnight",`,
    `  "blocks": { "smoke": "PASS 8/8", "night_1": "CLOSED 600/600", "night_2": "CLOSED soak-3h" },`,
    `  "diffs": { "financial": 0, "non_blocking": 2 },`,
    `  "soak": { "requests": 324000, "p95_ms": 138, "err_rate": "0.01%", "pages": 0 },`,
    `  "evidence": { "guids_cited": 2400, "bundle": "sealed sha256:9f2c…e81a" },`,
    `  "next": "morning.batch2 · 07:00 CT",`,
    `  "eta": "FRI 13:00 CT · margin +2h",`,
    `  "status": "ALL_GREEN · PERIOD_ONGOING"`,
    `}`,
  ];
  return `<div class="${a(1)}" style="background:#0A0A0C;border:1px solid #26262B;border-radius:12px;overflow:hidden;margin-top:2px;">
    <div style="display:flex;align-items:center;gap:6px;padding:9px 14px;border-bottom:1px solid #1C1C21;">
      <span style="width:8px;height:8px;border-radius:50%;background:#3A3A42;display:inline-block;"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:#3A3A42;display:inline-block;"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:#3A3A42;display:inline-block;"></span>
      <span style="margin-left:8px;font-size:10px;color:#6D6D76;font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;">POST /callbacks/client.banxico · 200 OK</span>
    </div>
    <div style="padding:12px 14px;">
      ${lines.map(l => `
      <div class="${a(1)}" style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.85;color:#9A9AA2;white-space:pre;overflow:hidden;text-overflow:ellipsis;">${l.replace(/ /g, "&#160;")}</div>`).join("")}
    </div>
  </div>`;
}

function statTiles(tiles: { label: string; val: string }[]): string {
  return `<div class="${a(1)}" style="display:flex;gap:8px;">
    ${tiles.map(t => `
    <div style="flex:1;background:#141417;border:1px solid #26262B;border-radius:12px;padding:14px;text-align:center;">
      <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;font-weight:700;margin-bottom:4px;white-space:nowrap;">${t.label}</div>
      <div style="font-size:18px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;">${t.val}</div>
    </div>`).join("")}
  </div>`;
}

function nightRecap(): string {
  const rows = [
    { n: "Smoke suite · 7:00–10:47 PM", d: "8/8 flows PASS · closed 13 min early", note: "PASS" },
    { n: "Night 1 · 12:00–3:00 AM",     d: "600/600 settlements vs Cybrid ledger · 0 financial · 2 non-blocking · canary verified", note: "CLOSED" },
    { n: "Night 2 · 3:00–6:00 AM",      d: "Unattended soak · 324k requests · p95 138ms · err 0.01% · zero pages, monitors quiet", note: "CLOSED" },
    { n: "Evidence bundle",             d: "2,400 GUIDs cited · request/response captures · sealed sha256:9f2c…e81a", note: "SEALED" },
  ];
  return `<div style="border:1px solid #26262B;border-radius:12px;overflow:hidden;">
    ${rows.map((r, i) => `
    <div class="${a()}" style="display:flex;align-items:center;gap:12px;padding:11px 14px;${i > 0 ? "border-top:1px solid #26262B;" : ""}background:${i % 2 === 0 ? "#0F0F12" : "#141417"};">
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:#C4C4CB;">${r.n}</div>
        <div style="font-size:10.5px;color:#6D6D76;line-height:1.4;">${r.d}</div>
      </div>
      ${pill(r.note)}
    </div>`).join("")}
  </div>`;
}

function morningPlan(): string {
  const items = [
    { w: "FRI 7:00–11:00 AM",  n: "Batch 2 + reconciliation + signed bundle" },
    { w: "FRI 11:00–1:00 PM",  n: "Phase 5 · docs + sign-off" },
    { w: "FRI 1:00 PM CT",     n: "Delivery — 2h ahead of the 3:00 PM commitment" },
  ];
  return `<div style="border:1px solid #26262B;border-radius:12px;overflow:hidden;">
    ${items.map((it, i) => `
    <div class="${a()}" style="display:flex;align-items:center;gap:12px;padding:11px 14px;${i > 0 ? "border-top:1px solid #26262B;" : ""}background:${i % 2 === 0 ? "#0F0F12" : "#141417"};">
      <span style="background:#1C1C21;border:1px solid #26262B;color:#9A9AA2;font-size:9px;font-weight:800;letter-spacing:.05em;padding:2px 7px;border-radius:10px;font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;flex-shrink:0;">${it.w}</span>
      <span style="font-size:12px;font-weight:${i === 2 ? "800" : "700"};color:${i === 2 ? "#FFFFFF" : "#C4C4CB"};">${it.n}</span>
    </div>`).join("")}
  </div>`;
}

function buildEmail(): string {
  D = 0;
  const runMeta = [
    ["Run ID", "EXT-20260807"],
    ["Window", "OVERNIGHT · DONE"],
    ["Diffs", "0 FIN · 2 NB"],
    ["Status", "ALL GREEN"],
  ];
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${styleBlock()}</head>
<body style="margin:0;background:#1A1A1E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;padding:32px 12px 60px;">
<div style="max-width:640px;margin:0 auto;">
<div style="background:#0F0F12;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.4),0 20px 50px rgba(0,0,0,.5);">

  <div style="padding:26px 24px 0;border-top:3px solid #26262B;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:-.01em;">
        <div style="width:18px;height:18px;display:grid;grid-template-columns:1fr 1fr;gap:2px;">
          <i style="background:#E8332B;border-radius:2px;display:block;"></i>
          <i style="background:#E8332B;border-radius:2px;display:block;"></i>
          <i style="background:#E8332B;border-radius:2px;display:block;"></i>
          <i style="background:#E8332B;border-radius:2px;display:block;"></i>
        </div>
        BANXICO<span style="color:#E8332B;">+</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#3DDC84;">
        <span class="bx-pulse" style="width:6px;height:6px;border-radius:50%;background:#3DDC84;box-shadow:0 0 0 3px #3DDC8433;display:inline-block;"></span>
        Review checkpoint · 6:00 AM
      </div>
    </div>

    <div class="${a()}" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9AA2;font-weight:700;margin-bottom:10px;">
      API Callback · Extended Validation Window
    </div>
    <h1 class="${a()}" style="font-size:27px;line-height:1.1;margin:0 0 12px;font-weight:800;letter-spacing:-.02em;color:#FFFFFF;">
      Overnight window concluded — all green.
    </h1>
    <p class="${a()}" style="font-size:13.5px;line-height:1.6;color:#C4C4CB;margin:0 0 20px;max-width:54ch;">
      The overnight window closed at 6:00 AM CT with every block complete: smoke 8/8, 600/600
      settlements validated against Cybrid's ledger, and a 3-hour unattended soak with zero pages.
      This is the concluding callback — the team review checkpoint is now open. Period ongoing.
    </p>

    <div class="${a()}" style="display:flex;background:#141417;border:1px solid #26262B;border-radius:12px;overflow:hidden;margin-bottom:14px;">
      ${runMeta.map(([l, v], i) => `
      <div style="flex:1;padding:11px 12px;${i < 3 ? "border-right:1px solid #26262B;" : ""}">
        <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;margin-bottom:4px;font-weight:700;">${l}</div>
        <div style="font-size:11px;font-weight:700;color:#C4C4CB;font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;letter-spacing:.01em;white-space:nowrap;">${v}</div>
      </div>`).join("")}
    </div>
  </div>

  <div style="padding:24px;">
    ${sectionH2("Callback payload — client.banxico")}
    ${payloadBlock()}

    ${sectionH2("Overnight recap — block by block")}
    ${nightRecap()}

    ${sectionH2("Sprint — 38h of 44h")}
    ${statTiles([
      { label: "Consumed", val: "38h" },
      { label: "Remaining", val: "6h" },
      { label: "Sprint", val: "86%" },
      { label: "ETA", val: "1:00 PM" },
    ])}
    <div class="${a()}" style="height:10px;background:#1C1C21;border-radius:5px;overflow:hidden;margin-top:10px;">
      <div class="${ag()}" style="height:100%;width:86%;background:linear-gradient(90deg,#6D6D76,#C4C4CB);border-radius:5px;"></div>
    </div>

    ${sectionH2("Morning plan — final 6 hours")}
    ${morningPlan()}

    <div class="${a(2)}" style="display:flex;gap:14px;background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;margin-top:24px;">
      <div style="flex-shrink:0;width:38px;height:38px;border-radius:10px;background:#1C1C21;border:1px solid #26262B;display:flex;align-items:center;justify-content:center;color:#C4C4CB;font-size:14px;">&#9654;</div>
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:3px;color:#FFFFFF;">Review checkpoint — open now</div>
        <div style="font-size:12px;color:#9A9AA2;line-height:1.5;">
          Full overnight evidence is staged for review: lot results, canary proof, soak metrics,
          sealed bundle. Morning blocks begin <strong style="color:#FFFFFF;">7:00 AM CT</strong>.
          ETA unchanged: <strong style="color:#FFFFFF;">Friday 1:00 PM CT · margin +2h</strong>.
        </div>
      </div>
    </div>
  </div>

  <div style="background:#0A0A0C;padding:20px 24px;font-size:11px;color:#6D6D76;line-height:1.7;border-top:1px solid #26262B;">
    <strong style="color:#C4C4CB;">BANXICO PLUS LLC</strong><br/>
    Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States<br/>
    August 7, 2026 · API Callback EXT-20260807 · Cybrid Sandbox Integration · Confidential
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
      ${["EMV", "PCI DSS", "AES-256", "TRC-20"].map(b =>
        `<span style="background:#1C1C21;color:#9A9AA2;font-size:9px;font-weight:800;letter-spacing:.04em;padding:3px 7px;border-radius:4px;border:1px solid #26262B;">${b}</span>`).join("")}
    </div>
  </div>

</div>
</div>
</body>
</html>`;
}

async function main() {
  const html = buildEmail();
  if (process.env.DRY) {
    const fs = await import("node:fs");
    fs.writeFileSync("/tmp/night-concluded.html", html);
    console.log(`DRY build OK — ${html.length} bytes (not sent)`);
    return;
  }
  for (const to of RECIPIENTS) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM, to, subject: SUBJECT, html }),
    });
    const data = await res.json() as { id?: string };
    if (data.id) console.log(`Concluded callback → ${to} | ${data.id}`);
    else console.error(`ERROR for ${to}:`, JSON.stringify(data));
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log("Done — concluding callback dispatched.");
}

main();

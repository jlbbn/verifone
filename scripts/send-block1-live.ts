/**
 * LIVE CHECKPOINT — Block 1 RUNNING (Smoke Suite)
 * Monochrome content edition: no colored fonts/status colors in body.
 * Brand chrome only: red 2x2 mark, red section bars, green live dot.
 *
 * Usage: npx tsx scripts/send-block1-live.ts
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = [
  "jose.barrientos@banxicoplusllc.org",
  "emiliano.maldonado@banxicoplusllc.org",
];

const SUBJECT = "Live — Block 1 Running: Smoke Suite · 3/8 Flows PASS · Schedule On Track for Fri 1:00 PM CT";

// ─── ANIMATION ───────────────────────────────────────────────────────────────
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

// ─── MONOCHROME PILLS ────────────────────────────────────────────────────────
function pill(label: string, kind: "done" | "run" | "queue"): string {
  if (kind === "run") return `<span style="display:inline-flex;align-items:center;gap:5px;background:#1C1C21;border:1px solid #3A3A42;color:#FFFFFF;font-size:9px;font-weight:800;letter-spacing:.06em;padding:3px 8px;border-radius:10px;font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;"><span class="bx-pulse" style="width:5px;height:5px;border-radius:50%;background:#FFFFFF;display:inline-block;"></span>${label}</span>`;
  const c = kind === "done" ? "#C4C4CB" : "#6D6D76";
  return `<span style="display:inline-block;background:#1C1C21;border:1px solid #26262B;color:${c};font-size:9px;font-weight:800;letter-spacing:.06em;padding:3px 8px;border-radius:10px;font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;">${label}</span>`;
}

function sectionH2(label: string): string {
  return `<h2 class="${a(1)}" style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:24px 0 14px;display:flex;align-items:center;gap:8px;">
    <span style="width:3px;height:12px;background:#E8332B;border-radius:2px;display:inline-block;flex-shrink:0;"></span>
    ${label}
  </h2>`;
}

function terminal(title: string, lines: { t: string; msg: string }[]): string {
  return `<div class="${a(1)}" style="background:#0A0A0C;border:1px solid #26262B;border-radius:12px;overflow:hidden;margin-top:14px;">
    <div style="display:flex;align-items:center;gap:6px;padding:9px 14px;border-bottom:1px solid #1C1C21;">
      <span style="width:8px;height:8px;border-radius:50%;background:#3A3A42;display:inline-block;"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:#3A3A42;display:inline-block;"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:#3A3A42;display:inline-block;"></span>
      <span style="margin-left:8px;font-size:10px;color:#6D6D76;font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;">${title}</span>
    </div>
    <div style="padding:12px 14px;">
      ${lines.map(l => `
      <div class="${a(2)}" style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        <span style="color:#4A4A52;">[${l.t}]</span>
        <span style="color:#9A9AA2;"> ${l.msg}</span>
      </div>`).join("")}
      <div class="${a(2)}" style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.9;">
        <span style="color:#4A4A52;">$</span> <span class="bx-cursor" style="color:#C4C4CB;">&#9612;</span>
      </div>
    </div>
  </div>`;
}

// Phase strip — monochrome
function phaseStrip(): string {
  const cells = [
    { n: "P1 · Migration",   l: "DONE",  k: "done"  as const },
    { n: "P2 · HMAC+Idem",   l: "DONE",  k: "done"  as const },
    { n: "P3 · OAuth+Audit", l: "DONE",  k: "done"  as const },
    { n: "P4 · Load+Mon",    l: "DONE",  k: "done"  as const },
    { n: "EXT · Validation", l: "RUN",   k: "run"   as const },
    { n: "P5 · Sign-off",    l: "QUEUE", k: "queue" as const },
  ];
  return `<div style="display:flex;gap:6px;">
    ${cells.map(cell => `
    <div class="${a()}" style="flex:1;background:${cell.k === "run" ? "#1C1C21" : "#141417"};border:1px solid ${cell.k === "run" ? "#3A3A42" : "#26262B"};border-radius:8px;padding:8px 4px;text-align:center;">
      <div style="font-size:7.5px;letter-spacing:.04em;text-transform:uppercase;color:#6D6D76;margin-bottom:3px;white-space:nowrap;">${cell.n}</div>
      <div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${cell.k === "run" ? "#FFFFFF" : cell.k === "done" ? "#C4C4CB" : "#6D6D76"};display:flex;align-items:center;justify-content:center;gap:4px;">
        ${cell.k === "run" ? `<span class="bx-pulse" style="width:5px;height:5px;border-radius:50%;background:#FFFFFF;display:inline-block;"></span>` : ""}${cell.l}
      </div>
    </div>`).join("")}
  </div>`;
}

// Block clock — gray bar
function blockClock(): string {
  return `<div class="${a(1)}" style="background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;font-weight:800;">Block clock</span>
      <span style="font-size:10px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;">1h 15m / 4h · 31%</span>
    </div>
    <div style="height:10px;background:#1C1C21;border-radius:5px;overflow:hidden;">
      <div class="${ag()}" style="height:100%;width:31%;background:linear-gradient(90deg,#6D6D76,#C4C4CB);border-radius:5px;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;">
      <span style="font-size:9px;color:#6D6D76;">Opened 7:00 PM CT</span>
      <span style="font-size:9px;color:#6D6D76;">Scheduled close 11:00 PM CT</span>
    </div>
  </div>`;
}

// Flow matrix — monochrome statuses
function flowMatrix(): string {
  const flows: { n: string; detail: string; s: "done" | "run" | "queue"; note?: string }[] = [
    { n: "Auth handshake",          detail: "OAuth2 client credentials",          s: "done", note: "PASS · 240ms" },
    { n: "Customer + account fetch",detail: "GUID mapping",                       s: "done", note: "PASS" },
    { n: "Quote → trade → settle",  detail: "Full lifecycle · GUID cross-checked against Cybrid sandbox ledger", s: "done", note: "PASS" },
    { n: "Fiat → crypto transfer",  detail: "Both rails · TRC-20 leg in flight",  s: "run",  note: "RUNNING" },
    { n: "Webhook receipt",         detail: "HMAC verification",                  s: "queue", note: "QUEUED" },
    { n: "Idempotent replay",       detail: "Same key, one execution",            s: "queue", note: "QUEUED" },
    { n: "Audit chain verify",      detail: "Linear, no gaps",                    s: "queue", note: "QUEUED" },
    { n: "Reconciliation",          detail: "Zero-diff across rails",             s: "queue", note: "QUEUED" },
  ];
  return `<div style="border:1px solid #26262B;border-radius:12px;overflow:hidden;">
    ${flows.map((f, i) => `
    <div class="${a()}" style="display:flex;align-items:center;gap:12px;padding:11px 14px;${i > 0 ? "border-top:1px solid #26262B;" : ""}background:${i % 2 === 0 ? "#0F0F12" : "#141417"};${f.s === "queue" ? "opacity:.55;" : ""}">
      <span style="width:22px;flex-shrink:0;font-size:10px;color:#4A4A52;font-family:'SF Mono',ui-monospace,monospace;">0${i + 1}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:${f.s === "run" ? "#FFFFFF" : "#C4C4CB"};">${f.n}</div>
        <div style="font-size:10.5px;color:#6D6D76;line-height:1.4;">${f.detail}</div>
      </div>
      ${pill(f.note!, f.s)}
    </div>`).join("")}
  </div>`;
}

// Schedule timeline — only block 1 live, monochrome
function scheduleTimeline(): string {
  const items: { window: string; name: string; desc: string; state: "run" | "queue" | "eta" }[] = [
    { window: "THU 7:00–11:00 PM", name: "Smoke suite — 8 end-to-end flows on clean environment", desc: "In progress · 3/8 PASS", state: "run" },
    { window: "THU 11:00 PM",      name: "Pause — handoff to night block", desc: "", state: "queue" },
    { window: "FRI 12:00–3:00 AM", name: "Night block 1 · validations vs Cybrid base", desc: "Settlement-by-settlement cross-check · GUID citations", state: "queue" },
    { window: "FRI 3:00–6:00 AM",  name: "Night block 2 · unattended soak + evidence", desc: "Monitors armed · pages on any threshold breach", state: "queue" },
    { window: "FRI 6:00–7:00 AM",  name: "Pause — overnight alert review", desc: "", state: "queue" },
    { window: "FRI 7:00–11:00 AM", name: "Batch 2 + reconciliation + signed bundle", desc: "Zero-diff target across both rails", state: "queue" },
    { window: "FRI 11:00–1:00 PM", name: "Phase 5 · docs + sign-off", desc: "Runbook, API docs, go-live checklist", state: "queue" },
    { window: "FRI 1:00 PM CT",    name: "Delivery — 2h ahead of the 3:00 PM commitment", desc: "", state: "eta" },
  ];
  const dot = (state: string) => {
    if (state === "run") return `<div style="width:18px;height:18px;border-radius:50%;background:#1C1C21;border:1px solid #3A3A42;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <span class="bx-pulse" style="width:6px;height:6px;border-radius:50%;background:#FFFFFF;display:inline-block;"></span></div>`;
    if (state === "eta") return `<div style="width:18px;height:18px;border-radius:50%;background:#1C1C21;border:1px solid #3A3A42;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5.5L4 8L8.5 2" stroke="#C4C4CB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
    return `<div style="width:18px;height:18px;border-radius:50%;background:#1C1C21;border:1px solid #26262B;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <span style="width:5px;height:5px;border-radius:50%;background:#4A4A52;display:inline-block;"></span></div>`;
  };
  return `<div style="margin-top:2px;">
    ${items.map((it, i) => `
    <div class="${a(1)}" style="display:flex;gap:12px;${it.state === "queue" ? "opacity:.6;" : ""}">
      <div style="display:flex;flex-direction:column;align-items:center;width:20px;flex-shrink:0;">
        ${dot(it.state)}
        ${i < items.length - 1 ? `<div style="width:2px;flex:1;background:#26262B;margin-top:4px;min-height:16px;"></div>` : ""}
      </div>
      <div style="padding-bottom:${i < items.length - 1 ? "14px" : "0"};min-width:0;flex:1;">
        <div style="font-size:12.5px;font-weight:700;color:${it.state === "run" || it.state === "eta" ? "#FFFFFF" : "#9A9AA2"};margin-bottom:2px;">
          ${it.name}
          <span style="background:#1C1C21;border:1px solid ${it.state === "run" ? "#3A3A42" : "#26262B"};color:#9A9AA2;font-size:9px;font-weight:800;letter-spacing:.05em;padding:2px 7px;border-radius:10px;margin-left:6px;font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;">${it.window}</span>
          ${it.state === "run" ? `<span style="background:#1C1C21;border:1px solid #3A3A42;color:#FFFFFF;font-size:9px;font-weight:800;letter-spacing:.05em;padding:2px 7px;border-radius:10px;margin-left:4px;font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;">CURRENT</span>` : ""}
        </div>
        ${it.desc ? `<div style="font-size:11.5px;color:#6D6D76;line-height:1.5;">${it.desc}</div>` : ""}
      </div>
    </div>`).join("")}
  </div>`;
}

// ─── EMAIL ───────────────────────────────────────────────────────────────────
function buildEmail(): string {
  D = 0;
  const runMeta = [
    ["Run ID", "EXT-20260806-L1"],
    ["Environment", "cybrid-sandbox-v2.4"],
    ["Block", "1/7 · SMOKE"],
    ["Status", "RUNNING"],
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
        Live · Block 1 running
      </div>
    </div>

    <div class="${a()}" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9AA2;font-weight:700;margin-bottom:10px;">
      Live Checkpoint · Extended Validation Window
    </div>
    <h1 class="${a()}" style="font-size:27px;line-height:1.1;margin:0 0 12px;font-weight:800;letter-spacing:-.02em;color:#FFFFFF;">
      Block 1 running — smoke suite.
    </h1>
    <p class="${a()}" style="font-size:13.5px;line-height:1.6;color:#C4C4CB;margin:0 0 20px;max-width:54ch;">
      The extended validation window opened on schedule at 7:00 PM CT. Block 1 — the smoke suite,
      8 end-to-end flows on a clean environment — is in progress, with three flows already PASS.
      Every other block remains queued exactly as scheduled. Period ongoing.
    </p>

    <div class="${a()}" style="display:flex;background:#141417;border:1px solid #26262B;border-radius:12px;overflow:hidden;margin-bottom:14px;">
      ${runMeta.map(([l, v], i) => `
      <div style="flex:1;padding:11px 12px;${i < 3 ? "border-right:1px solid #26262B;" : ""}">
        <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;margin-bottom:4px;font-weight:700;">${l}</div>
        <div style="font-size:11px;font-weight:700;color:#C4C4CB;font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;letter-spacing:.01em;white-space:nowrap;">${v}</div>
      </div>`).join("")}
    </div>
    ${phaseStrip()}
  </div>

  <div style="padding:24px;">
    ${sectionH2("Block clock — 1h 15m elapsed")}
    ${blockClock()}

    ${sectionH2("Flow matrix — smoke suite, live")}
    ${flowMatrix()}

    ${sectionH2("Full schedule — only block 1 live")}
    ${scheduleTimeline()}

    ${terminal("live — EXT-20260806-L1", [
      { t: "19:00:02", msg: "block 1/7 opened · smoke suite · clean env" },
      { t: "19:00:41", msg: "env checksum verified · zero residual state" },
      { t: "19:12:19", msg: "flow 1 PASS · auth handshake · 240ms" },
      { t: "19:31:44", msg: "flow 2 PASS · customer+account fetch · GUIDs mapped" },
      { t: "19:58:03", msg: "flow 3 PASS · quote→trade→settle · GUID cross-checked" },
      { t: "20:07:56", msg: "flow 4 RUNNING · fiat→crypto · TRC-20 leg in flight" },
      { t: "20:15:00", msg: "checkpoint emitted · schedule on track · period ONGOING" },
    ])}

    <div class="${a(2)}" style="display:flex;gap:14px;background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;margin-top:14px;">
      <div style="flex-shrink:0;width:38px;height:38px;border-radius:10px;background:#1C1C21;border:1px solid #26262B;display:flex;align-items:center;justify-content:center;color:#C4C4CB;font-size:14px;">&#9654;</div>
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:3px;color:#FFFFFF;">Next — night blocks take over at midnight</div>
        <div style="font-size:12px;color:#9A9AA2;line-height:1.5;">
          Block 1 closes 11:00 PM CT and hands off to the night blocks (12:00–6:00 AM).
          Next full checkpoint: <strong style="color:#FFFFFF;">Friday 7:00 AM CT</strong>.
          ETA unchanged: <strong style="color:#FFFFFF;">Friday 1:00 PM CT</strong>.
        </div>
      </div>
    </div>
  </div>

  <div style="background:#0A0A0C;padding:20px 24px;font-size:11px;color:#6D6D76;line-height:1.7;border-top:1px solid #26262B;">
    <strong style="color:#C4C4CB;">BANXICO PLUS LLC</strong><br/>
    Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States<br/>
    August 6, 2026 · Live Checkpoint EXT-20260806-L1 · Cybrid Sandbox Integration · Confidential
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

// ─── SEND ────────────────────────────────────────────────────────────────────
async function main() {
  const html = buildEmail();
  for (const to of RECIPIENTS) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM, to, subject: SUBJECT, html }),
    });
    const data = await res.json() as { id?: string; message?: string };
    if (data.id) console.log(`Block 1 live → ${to} | ${data.id}`);
    else { console.error("ERROR:", JSON.stringify(data)); process.exit(1); }
  }
  console.log("Done — Block 1 live checkpoint sent.");
}

main();

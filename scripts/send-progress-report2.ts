/**
 * PROGRESS REPORT #2 — Extended Validation Window · Overnight Run
 * Scope +14h (smoke tests + verifiable validations vs Cybrid fintech base)
 * 30h base → 44h total · 28h consumed · ETA Friday Aug 7 · 1:00 PM CT (margin +2h)
 *
 * Usage: npx tsx scripts/send-progress-report2.ts
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = [
  "jose.barrientos@banxicoplusllc.org",
  "emiliano.maldonado@banxicoplusllc.org",
];

const SUBJECT = "Progress Report #2 — Extended Validation Window: Overnight Run vs Cybrid Fintech Base · ETA Fri 1:00 PM CT";

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

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function sectionH2(label: string): string {
  return `<h2 class="${a(1)}" style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:24px 0 14px;display:flex;align-items:center;gap:8px;">
    <span style="width:3px;height:12px;background:#E8332B;border-radius:2px;display:inline-block;flex-shrink:0;"></span>
    ${label}
  </h2>`;
}

function kvTable(rows: [string, string, string?][]): string {
  return `<div style="border:1px solid #26262B;border-radius:12px;overflow:hidden;">
    ${rows.map(([k, v, color], i) => `
    <div class="${a()}" style="display:flex;${i > 0 ? "border-top:1px solid #26262B;" : ""}background:${i % 2 === 0 ? "#0F0F12" : "#141417"};">
      <div style="width:150px;flex-shrink:0;padding:10px 14px;font-size:9px;font-weight:800;color:#6D6D76;text-transform:uppercase;letter-spacing:.05em;line-height:1.5;">${k}</div>
      <div style="flex:1;padding:10px 14px;font-size:12px;color:${color || "#9A9AA2"};line-height:1.6;">${v}</div>
    </div>`).join("")}
  </div>`;
}

function terminal(title: string, lines: { t: string; msg: string; c?: string }[]): string {
  return `<div class="${a(1)}" style="background:#0A0A0C;border:1px solid #26262B;border-radius:12px;overflow:hidden;margin-top:14px;">
    <div style="display:flex;align-items:center;gap:6px;padding:9px 14px;border-bottom:1px solid #1C1C21;">
      <span style="width:8px;height:8px;border-radius:50%;background:#E8332B;display:inline-block;"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:#FBBF24;display:inline-block;"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:#3DDC84;display:inline-block;"></span>
      <span style="margin-left:8px;font-size:10px;color:#6D6D76;font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;">${title}</span>
    </div>
    <div style="padding:12px 14px;">
      ${lines.map(l => `
      <div class="${a(2)}" style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        <span style="color:#4A4A52;">[${l.t}]</span>
        <span style="color:${l.c || "#9A9AA2"};"> ${l.msg}</span>
      </div>`).join("")}
      <div class="${a(2)}" style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.9;">
        <span style="color:#4A4A52;">$</span> <span class="bx-cursor" style="color:#3DDC84;">&#9612;</span>
      </div>
    </div>
  </div>`;
}

function statTiles(tiles: { label: string; val: string; color?: string; bg?: boolean }[]): string {
  return `<div class="${a(1)}" style="display:flex;gap:8px;margin-top:14px;">
    ${tiles.map(t => `
    <div style="flex:1;background:${t.bg ? "rgba(61,220,132,.08)" : "#141417"};border:1px solid ${t.bg ? "rgba(61,220,132,.25)" : "#26262B"};border-radius:12px;padding:14px;text-align:center;">
      <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:${t.bg ? "#3DDC84" : "#6D6D76"};font-weight:700;margin-bottom:4px;white-space:nowrap;">${t.label}</div>
      <div style="font-size:20px;font-weight:800;color:${t.color || "#C4C4CB"};font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;">${t.val}</div>
    </div>`).join("")}
  </div>`;
}

// Sprint progress bar 28h of 44h
function progressBar(): string {
  return `<div class="${a(1)}" style="background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;margin-top:14px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;font-weight:800;">Sprint clock</span>
      <span style="font-size:10px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;">28h / 44h · 64%</span>
    </div>
    <div style="height:10px;background:#1C1C21;border-radius:5px;overflow:hidden;">
      <div class="${ag()}" style="height:100%;width:64%;background:linear-gradient(90deg,#B8241D,#E8332B);border-radius:5px;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;">
      <span style="font-size:9px;color:#6D6D76;">28h consumed — P1→P4 + pre-audit</span>
      <span style="font-size:9px;color:#6D6D76;">16h remaining — validation window + Phase 5</span>
    </div>
  </div>`;
}

// Phase strip P1..P4 done · EXT running · P5 queued
function phaseStrip(): string {
  const cells = [
    { n: "P1 · Migration",  s: "ok" }, { n: "P2 · HMAC+Idem", s: "ok" },
    { n: "P3 · OAuth+Audit", s: "ok" }, { n: "P4 · Load+Mon",  s: "ok" },
    { n: "EXT · Validation", s: "run" }, { n: "P5 · Sign-off",  s: "q" },
  ];
  const st = (s: string) =>
    s === "ok"  ? { bg:"rgba(61,220,132,.1)",  bc:"rgba(61,220,132,.3)",  c:"#3DDC84", l:"DONE"  } :
    s === "run" ? { bg:"rgba(251,191,36,.08)", bc:"rgba(251,191,36,.3)",  c:"#FBBF24", l:"RUN"   } :
                  { bg:"#1C1C21",              bc:"#26262B",               c:"#6D6D76", l:"QUEUE" };
  return `<div style="display:flex;gap:6px;">
    ${cells.map(cell => {
      const s = st(cell.s);
      return `<div class="${a()}" style="flex:1;background:${s.bg};border:1px solid ${s.bc};border-radius:8px;padding:8px 4px;text-align:center;">
        <div style="font-size:7.5px;letter-spacing:.04em;text-transform:uppercase;color:#6D6D76;margin-bottom:3px;white-space:nowrap;">${cell.n}</div>
        <div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${s.c};">${s.l}</div>
      </div>`;
    }).join("")}
  </div>`;
}

// Schedule timeline with block kinds: work / night / pause / eta
function scheduleTimeline(items: { window: string; name: string; desc: string; kind: "work" | "night" | "pause" | "eta" }[]): string {
  const dot = (kind: string) => {
    if (kind === "eta") return `<div style="width:18px;height:18px;border-radius:50%;background:rgba(61,220,132,.12);border:1px solid rgba(61,220,132,.35);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5.5L4 8L8.5 2" stroke="#3DDC84" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
    const c = kind === "night" ? "#FBBF24" : kind === "pause" ? "#4A4A52" : "#E8332B";
    return `<div style="width:18px;height:18px;border-radius:50%;background:#1C1C21;border:1px solid #26262B;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <span style="width:6px;height:6px;border-radius:50%;background:${c};display:inline-block;"></span></div>`;
  };
  return `<div style="margin-top:2px;">
    ${items.map((it, i) => `
    <div class="${a(1)}" style="display:flex;gap:12px;">
      <div style="display:flex;flex-direction:column;align-items:center;width:20px;flex-shrink:0;">
        ${dot(it.kind)}
        ${i < items.length - 1 ? `<div style="width:2px;flex:1;background:#26262B;margin-top:4px;min-height:18px;"></div>` : ""}
      </div>
      <div style="padding-bottom:${i < items.length - 1 ? "14px" : "0"};min-width:0;flex:1;">
        <div style="font-size:12.5px;font-weight:700;color:${it.kind === "pause" ? "#6D6D76" : it.kind === "eta" ? "#3DDC84" : "#fff"};margin-bottom:2px;">${it.name}
          <span style="background:${it.kind === "night" ? "rgba(251,191,36,.08)" : "#1C1C21"};border:1px solid ${it.kind === "night" ? "rgba(251,191,36,.3)" : "#26262B"};color:${it.kind === "night" ? "#FBBF24" : "#9A9AA2"};font-size:9px;font-weight:800;letter-spacing:.05em;padding:2px 7px;border-radius:10px;margin-left:6px;font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;">${it.window}</span>
        </div>
        ${it.desc ? `<div style="font-size:11.5px;color:#9A9AA2;line-height:1.5;">${it.desc}</div>` : ""}
      </div>
    </div>`).join("")}
  </div>`;
}

// Smoke flow checklist — 2-col grid
function smokeGrid(flows: string[]): string {
  return `<div class="${a(1)}" style="display:flex;flex-wrap:wrap;gap:8px;">
    ${flows.map(f => `
    <div class="${a()}" style="width:calc(50% - 4px);box-sizing:border-box;display:flex;align-items:center;gap:9px;background:#141417;border:1px solid #26262B;border-radius:10px;padding:10px 12px;">
      <span style="width:16px;height:16px;border-radius:50%;background:#1C1C21;border:1px solid #26262B;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="width:5px;height:5px;border-radius:50%;background:#6D6D76;display:inline-block;"></span>
      </span>
      <span style="font-size:11px;color:#C4C4CB;line-height:1.4;">${f}</span>
    </div>`).join("")}
  </div>`;
}

// ─── EMAIL ───────────────────────────────────────────────────────────────────

function buildEmail(): string {
  D = 0;
  const header = `
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
        Period ongoing
      </div>
    </div>

    <div class="${a()}" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9AA2;font-weight:700;margin-bottom:10px;">
      Progress Report #2 · Cybrid Sandbox Integration
    </div>
    <h1 class="${a()}" style="font-size:27px;line-height:1.1;margin:0 0 12px;font-weight:800;letter-spacing:-.02em;">
      Scope extended — <span style="color:#E8332B;">overnight verifiable validations.</span>
    </h1>
    <p class="${a()}" style="font-size:13.5px;line-height:1.6;color:#C4C4CB;margin:0 0 20px;max-width:54ch;">
      Phase 4 closed 5/5. The final stretch now runs through the night: a smoke-test suite plus
      validations checkable against Cybrid's own sandbox records — not self-reported. The projection
      lands <strong style="color:#fff;">Friday 1:00 PM CT</strong>, two hours ahead of the 3:00 PM commitment.
    </p>

    <div class="${a()}" style="display:flex;background:#141417;border:1px solid #26262B;border-radius:12px;overflow:hidden;margin-bottom:14px;">
      ${[["Run ID","SR-20260806-02","#C4C4CB"],["Environment","cybrid-sandbox-v2.4","#C4C4CB"],["Window","OVERNIGHT-CONT.","#FBBF24"],["ETA","FRI · 1:00 PM CT","#3DDC84"]].map(([l, v, c], i) => `
      <div style="flex:1;padding:11px 12px;${i < 3 ? "border-right:1px solid #26262B;" : ""}">
        <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;margin-bottom:4px;font-weight:700;">${l}</div>
        <div style="font-size:11px;font-weight:700;color:${c};font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;letter-spacing:.01em;white-space:nowrap;">${v}</div>
      </div>`).join("")}
    </div>
    ${phaseStrip()}`;

  const body = `
    ${sectionH2("Why the added hours — smoke tests & verifiable validations")}
    ${kvTable([
      ["Smoke suite · 4h",      "8 end-to-end flows re-run on a clean environment before any evidence is captured"],
      ["Night block 1 · 3h",    `Verifiable validations, batch 1 — every settlement cross-checked against Cybrid's sandbox ledger, with <span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">customer / account / trade / transfer</span> GUIDs cited so anyone with sandbox access can pull the record`],
      ["Night block 2 · 3h",    "Unattended overnight soak + evidence capture — Phase 4 alert rules stand watch"],
      ["Morning block · 4h",    "Validation batch 2 · final reconciliation · signed evidence bundle (request/response captures + hashes)"],
      ["Extension",             `<strong style="color:#fff;">+14h</strong> — added on top of the 30h base`, "#3DDC84"],
    ])}

    ${sectionH2("Budget math — 44h total")}
    ${progressBar()}
    ${statTiles([
      { label: "Base budget", val: "30h" },
      { label: "Extension",   val: "+14h", color: "#FBBF24" },
      { label: "New total",   val: "44h", color: "#3DDC84", bg: true },
    ])}
    <div class="${a()}" style="display:flex;gap:10px;background:#141417;border:1px solid #26262B;border-radius:10px;padding:12px 14px;margin-top:10px;align-items:center;">
      <span style="width:3px;height:24px;background:#3DDC84;border-radius:2px;flex-shrink:0;display:inline-block;"></span>
      <span style="font-size:11.5px;color:#9A9AA2;line-height:1.5;">The overnight compute (soak + validation replays) is exactly what the requested <strong style="color:#C4C4CB;">$1,200 injection</strong> was sized for — no new ask.</span>
    </div>

    ${sectionH2("Schedule — tonight through Friday 1:00 PM CT")}
    ${scheduleTimeline([
      { window: "THU 7:00–11:00 PM", name: "Smoke suite",                 desc: "8 end-to-end flows on clean environment", kind: "work" },
      { window: "THU 11:00 PM",      name: "Pause — handoff to night block", desc: "", kind: "pause" },
      { window: "FRI 12:00–3:00 AM", name: "Night block 1 · validations vs Cybrid base", desc: "Settlement-by-settlement cross-check · GUID citations", kind: "night" },
      { window: "FRI 3:00–6:00 AM",  name: "Night block 2 · unattended soak + evidence", desc: "Monitors armed · pages on any threshold breach", kind: "night" },
      { window: "FRI 6:00–7:00 AM",  name: "Pause — overnight alert review", desc: "", kind: "pause" },
      { window: "FRI 7:00–11:00 AM", name: "Batch 2 + reconciliation + signed bundle", desc: "Zero-diff target across both rails", kind: "work" },
      { window: "FRI 11:00–1:00 PM", name: "Phase 5 · docs + sign-off",   desc: "Runbook, API docs, go-live checklist", kind: "work" },
      { window: "FRI 1:00 PM CT",    name: "Delivery — 2h ahead of the 3:00 PM commitment", desc: "", kind: "eta" },
    ])}

    ${sectionH2("Smoke flows — 8 end-to-end")}
    ${smokeGrid([
      "Auth handshake · OAuth2 client credentials",
      "Customer + account fetch · GUID mapping",
      "Quote → trade → settlement · full lifecycle",
      "Fiat → crypto transfer · both rails",
      "Webhook receipt · HMAC verification",
      "Idempotent replay · same key, one execution",
      "Audit chain verify · linear, no gaps",
      "Reconciliation · zero-diff across rails",
    ])}

    ${terminal("report — SR-20260806-02", [
      { t:"18:41:07", msg:"report: progress report #2 compiled" },
      { t:"18:41:07", msg:"scope: +14h smoke & verifiable validations · overnight window", c:"#FBBF24" },
      { t:"18:41:08", msg:"eta: FRI 13:00 CT · margin +2h vs 15:00 commitment", c:"#3DDC84" },
      { t:"18:41:08", msg:"compute: night blocks sized within $1,200 injection", c:"#60A5FA" },
      { t:"18:41:09", msg:"period: ONGOING · next checkpoint FRI 07:00 CT", c:"#3DDC84" },
    ])}

    <div class="${a(2)}" style="display:flex;gap:14px;background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;margin-top:14px;">
      <div style="flex-shrink:0;width:38px;height:38px;border-radius:10px;background:rgba(232,51,43,.12);display:flex;align-items:center;justify-content:center;font-size:16px;">&#9654;</div>
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:3px;">ETA — Friday, Aug 7 · 1:00 PM CT</div>
        <div style="font-size:12px;color:#9A9AA2;line-height:1.5;">
          The overnight window opens tonight at 7:00 PM. Next checkpoint email lands
          <strong style="color:#fff;">Friday 7:00 AM CT</strong>, after the night blocks close.
        </div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${styleBlock()}</head>
<body style="margin:0;background:#1A1A1E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;padding:32px 12px 60px;">
<div style="max-width:640px;margin:0 auto;">
<div style="background:#0F0F12;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.4),0 20px 50px rgba(0,0,0,.5);">

  <div style="padding:26px 24px 0;border-top:3px solid #3DDC84;">
    ${header}
  </div>

  <div style="padding:24px;">
    ${body}
  </div>

  <div style="background:#0A0A0C;padding:20px 24px;font-size:11px;color:#6D6D76;line-height:1.7;border-top:1px solid #26262B;">
    <strong style="color:#C4C4CB;">BANXICO PLUS LLC</strong><br/>
    Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States<br/>
    August 6, 2026 · Progress Report SR-20260806-02 · Cybrid Sandbox Integration · Confidential
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
      ${["EMV","PCI DSS","AES-256","TRC-20"].map(b =>
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
    if (data.id) console.log(`Report #2 → ${to} | ${data.id}`);
    else { console.error("ERROR:", JSON.stringify(data)); process.exit(1); }
  }
  console.log("Done — Progress Report #2 sent.");
}

main();

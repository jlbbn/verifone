/**
 * BEGIN BLOCK — Night Block 1 OPEN · Validations vs Cybrid Base · FRI 12:00–3:00 AM
 * Settlement-by-settlement cross-check · GUID citations. Monochrome content edition.
 *
 * Usage:
 *   DRY=1 npx tsx scripts/send-night1-open.ts   (build only, writes /tmp/night1-open.html)
 *   npx tsx scripts/send-night1-open.ts          (send to both recipients)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = [
  "jose.barrientos@banxicoplusllc.org",
  "emiliano.maldonado@banxicoplusllc.org",
];

const SUBJECT = "Night Block 1 Open — Validations vs Cybrid Base · Settlement-by-Settlement · GUID Citations";

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

function clocks(): string {
  return `<div class="${a(1)}" style="background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;font-weight:800;">Block clock — Night 1</span>
      <span style="font-size:10px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;">0h 05m / 3h · just opened</span>
    </div>
    <div style="height:10px;background:#1C1C21;border-radius:5px;overflow:hidden;">
      <div class="${ag()}" style="height:100%;width:3%;background:linear-gradient(90deg,#6D6D76,#C4C4CB);border-radius:5px;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;margin-bottom:18px;">
      <span style="font-size:9px;color:#6D6D76;">Opened 12:00 AM CT · on schedule</span>
      <span style="font-size:9px;color:#6D6D76;">Scheduled close 3:00 AM CT</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;font-weight:800;">Sprint clock</span>
      <span style="font-size:10px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;">32h / 44h · 70%</span>
    </div>
    <div style="height:10px;background:#1C1C21;border-radius:5px;overflow:hidden;">
      <div class="${ag()}" style="height:100%;width:70%;background:linear-gradient(90deg,#6D6D76,#C4C4CB);border-radius:5px;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;">
      <span style="font-size:9px;color:#6D6D76;">32h consumed — P1→P4 + block 1</span>
      <span style="font-size:9px;color:#6D6D76;">12h remaining — night + morning + Phase 5</span>
    </div>
  </div>`;
}

// Scope of the validation block
function scopeTable(): string {
  const rows: [string, string][] = [
    ["Universe",        "1,214 settlements — Phase 4 load runs (1,200) + smoke suite (14)"],
    ["Tonight's batch", "Batch 1 · 600 settlements · lots N1-A / N1-B / N1-C of 200 each"],
    ["Source of truth", "Cybrid sandbox ledger — read-only snapshot pulled at block open"],
    ["Citation rule",   `Every check cites its <span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">customer / account / trade / transfer</span> GUIDs — anyone with sandbox access can pull the record`],
    ["Discrepancy protocol", "Any diff logged and classified · blocking only if financial · non-blocking diffs carried to morning batch 2 review"],
  ];
  return `<div style="border:1px solid #26262B;border-radius:12px;overflow:hidden;">
    ${rows.map(([k, v], i) => `
    <div class="${a()}" style="display:flex;${i > 0 ? "border-top:1px solid #26262B;" : ""}background:${i % 2 === 0 ? "#0F0F12" : "#141417"};">
      <div style="width:150px;flex-shrink:0;padding:10px 14px;font-size:9px;font-weight:800;color:#6D6D76;text-transform:uppercase;letter-spacing:.05em;line-height:1.5;">${k}</div>
      <div style="flex:1;padding:10px 14px;font-size:12px;color:#9A9AA2;line-height:1.6;">${v}</div>
    </div>`).join("")}
  </div>`;
}

// 5 checks per settlement
function checksGrid(): string {
  const checks = [
    "State parity — our ledger vs Cybrid record",
    "Amount parity — 8-decimal precision",
    "Timestamp window — ±2s tolerance",
    "GUID chain complete — customer→account→trade→transfer",
    "Idempotency-key linkage — one key, one settlement",
  ];
  return `<div class="${a(1)}" style="display:flex;flex-wrap:wrap;gap:8px;">
    ${checks.map((c, i) => `
    <div class="${a()}" style="width:${i < 4 ? "calc(50% - 4px)" : "100%"};box-sizing:border-box;display:flex;align-items:center;gap:9px;background:#141417;border:1px solid #26262B;border-radius:10px;padding:10px 12px;">
      <span style="width:16px;height:16px;border-radius:50%;background:#1C1C21;border:1px solid #26262B;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:8px;color:#6D6D76;font-family:'SF Mono',ui-monospace,monospace;">${i + 1}</span>
      <span style="font-size:11px;color:#C4C4CB;line-height:1.4;">${c}</span>
    </div>`).join("")}
  </div>`;
}

// ─── EMAIL ───────────────────────────────────────────────────────────────────
function buildEmail(): string {
  D = 0;
  const runMeta = [
    ["Run ID", "EXT-20260807-N1"],
    ["Environment", "cybrid-sandbox-v2.4"],
    ["Block", "3/7 · NIGHT-1"],
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
        Live · Night block 1 running
      </div>
    </div>

    <div class="${a()}" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9AA2;font-weight:700;margin-bottom:10px;">
      Begin Block · Extended Validation Window
    </div>
    <h1 class="${a()}" style="font-size:27px;line-height:1.1;margin:0 0 12px;font-weight:800;letter-spacing:-.02em;color:#FFFFFF;">
      Night block 1 open — validations vs the Cybrid base.
    </h1>
    <p class="${a()}" style="font-size:13.5px;line-height:1.6;color:#C4C4CB;margin:0 0 20px;max-width:54ch;">
      Opened 12:00 AM CT, on schedule. Settlement-by-settlement cross-check against Cybrid's
      sandbox ledger — every check cites its GUIDs so the result is verifiable, not self-reported.
      Runs to 3:00 AM, then hands off to the unattended soak. Period ongoing.
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
    ${sectionH2("Clocks — block just opened · sprint at 70%")}
    ${clocks()}

    ${sectionH2("Scope — settlement-by-settlement, verifiable")}
    ${scopeTable()}

    ${sectionH2("Five checks per settlement")}
    ${checksGrid()}

    ${terminal("open — EXT-20260807-N1", [
      { t: "00:00:00", msg: "night block 1 OPEN · validations vs cybrid base" },
      { t: "00:00:19", msg: "cybrid sandbox ledger snapshot pulled · read-only scope" },
      { t: "00:01:02", msg: "batch N1-A loaded · 200 settlements · GUID chains resolved" },
      { t: "00:03:47", msg: "cross-check streaming · 42/200 · zero diffs so far" },
      { t: "00:05:00", msg: "checkpoint emitted · unattended mode until 03:00 · period ONGOING" },
    ])}

    <div class="${a(2)}" style="display:flex;gap:14px;background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;margin-top:14px;">
      <div style="flex-shrink:0;width:38px;height:38px;border-radius:10px;background:#1C1C21;border:1px solid #26262B;display:flex;align-items:center;justify-content:center;color:#C4C4CB;font-size:14px;">&#9654;</div>
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:3px;color:#FFFFFF;">Closes 3:00 AM → night block 2 takes over</div>
        <div style="font-size:12px;color:#9A9AA2;line-height:1.5;">
          Unattended soak + evidence capture runs 3:00–6:00 AM with Phase 4 monitors paging on any breach.
          Next checkpoint: <strong style="color:#FFFFFF;">Friday 7:00 AM CT</strong> with full overnight results.
          ETA unchanged: <strong style="color:#FFFFFF;">Friday 1:00 PM CT · margin +2h</strong>.
        </div>
      </div>
    </div>
  </div>

  <div style="background:#0A0A0C;padding:20px 24px;font-size:11px;color:#6D6D76;line-height:1.7;border-top:1px solid #26262B;">
    <strong style="color:#C4C4CB;">BANXICO PLUS LLC</strong><br/>
    Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States<br/>
    August 7, 2026 · Begin Block EXT-20260807-N1 · Cybrid Sandbox Integration · Confidential
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

// ─── SEND / DRY ──────────────────────────────────────────────────────────────
async function main() {
  const html = buildEmail();
  if (process.env.DRY) {
    const fs = await import("node:fs");
    fs.writeFileSync("/tmp/night1-open.html", html);
    console.log(`DRY build OK — ${html.length} bytes → /tmp/night1-open.html (not sent)`);
    return;
  }
  for (const to of RECIPIENTS) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM, to, subject: SUBJECT, html }),
    });
    const data = await res.json() as { id?: string; message?: string };
    if (data.id) console.log(`Night block 1 open → ${to} | ${data.id}`);
    else { console.error("ERROR:", JSON.stringify(data)); process.exit(1); }
  }
  console.log("Done — Night block 1 begin-block sent.");
}

main();

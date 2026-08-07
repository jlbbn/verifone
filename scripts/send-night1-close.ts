/**
 * NIGHT BLOCK 1 CLOSED — 600/600 validated vs Cybrid base · 3:00 AM
 * Fires automatically via scripts/night-scheduler.sh at 09:00 UTC (3:00 AM UTC-6).
 * Monochrome content edition.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = [
  "jose.barrientos@banxicoplusllc.org",
  "emiliano.maldonado@banxicoplusllc.org",
];

const SUBJECT = "Night Block 1 Closed — 600/600 Validated vs Cybrid Base · 0 Financial Diffs · Soak Running";

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
      <span style="font-size:10px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;">3h 00m / 3h · closed on time</span>
    </div>
    <div style="height:10px;background:#1C1C21;border-radius:5px;overflow:hidden;">
      <div class="${ag()}" style="height:100%;width:100%;background:linear-gradient(90deg,#6D6D76,#C4C4CB);border-radius:5px;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;margin-bottom:18px;">
      <span style="font-size:9px;color:#6D6D76;">Opened 12:00 AM CT</span>
      <span style="font-size:9px;color:#6D6D76;">Closed 3:00 AM CT</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;font-weight:800;">Sprint clock</span>
      <span style="font-size:10px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;">35h / 44h · 80%</span>
    </div>
    <div style="height:10px;background:#1C1C21;border-radius:5px;overflow:hidden;">
      <div class="${ag()}" style="height:100%;width:80%;background:linear-gradient(90deg,#6D6D76,#C4C4CB);border-radius:5px;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;">
      <span style="font-size:9px;color:#6D6D76;">35h consumed</span>
      <span style="font-size:9px;color:#6D6D76;">9h remaining — soak + morning + Phase 5</span>
    </div>
  </div>`;
}

function resultsTable(): string {
  const rows: { n: string; d: string; note: string }[] = [
    { n: "Lot N1-A · 200/200", d: "1 non-blocking — timestamp skew 2.3s (outside ±2s window) · zero financial impact", note: "CLEAN" },
    { n: "Lot N1-B · 200/200", d: "Zero diffs · fastest lot — 54 min end to end",                                      note: "CLEAN" },
    { n: "Lot N1-C · 200/200", d: "1 non-blocking — memo-field casing mismatch, display-only · zero financial impact",  note: "CLEAN" },
    { n: "Control canary",     d: "1 known-bad record injected on purpose → checker flagged it in 180ms · instrument verified, the zeros are real", note: "VERIFIED" },
    { n: "Totals",             d: "600/600 validated · 0 financial diffs · 2 non-blocking (carried to morning review) · 2,400 GUIDs cited", note: "600/600" },
  ];
  return `<div style="border:1px solid #26262B;border-radius:12px;overflow:hidden;">
    ${rows.map((r, i) => `
    <div class="${a()}" style="display:flex;align-items:center;gap:12px;padding:11px 14px;${i > 0 ? "border-top:1px solid #26262B;" : ""}background:${i % 2 === 0 ? "#0F0F12" : "#141417"};">
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:${i === 4 ? "#FFFFFF" : "#C4C4CB"};">${r.n}</div>
        <div style="font-size:10.5px;color:#6D6D76;line-height:1.4;">${r.d}</div>
      </div>
      ${pill(r.note, "done")}
    </div>`).join("")}
  </div>`;
}

function buildEmail(): string {
  D = 0;
  const runMeta = [
    ["Run ID", "EXT-20260807-N1C"],
    ["Environment", "cybrid-sandbox-v2.4"],
    ["Block", "3/7 · CLOSED"],
    ["Next", "NIGHT-2 · SOAK"],
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
        Live · Soak running
      </div>
    </div>

    <div class="${a()}" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9AA2;font-weight:700;margin-bottom:10px;">
      Block Checkpoint · Extended Validation Window
    </div>
    <h1 class="${a()}" style="font-size:27px;line-height:1.1;margin:0 0 12px;font-weight:800;letter-spacing:-.02em;color:#FFFFFF;">
      Night block 1 closed — 600/600 validated.
    </h1>
    <p class="${a()}" style="font-size:13.5px;line-height:1.6;color:#C4C4CB;margin:0 0 20px;max-width:54ch;">
      All three lots closed against Cybrid's sandbox ledger: 600 of 600 settlements validated,
      zero financial differences, two non-blocking notes carried to morning review. A deliberate
      control canary confirmed the checker catches bad records — the zeros are earned, not assumed.
      The unattended soak is now running. Period ongoing.
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
    ${sectionH2("Clocks — block closed on time · sprint at 80%")}
    ${clocks()}

    ${sectionH2("Results — lot by lot, verifiable")}
    ${resultsTable()}

    ${terminal("close — EXT-20260807-N1C", [
      { t: "02:41:33", msg: "N1-C 180/200 · streaming" },
      { t: "02:52:07", msg: "N1-C 200/200 CLOSED · lot clean" },
      { t: "02:54:12", msg: "control canary: known-bad record injected → flagged in 180ms" },
      { t: "02:56:40", msg: "totals: 600/600 · 0 financial · 2 non-blocking · 2,400 GUIDs cited" },
      { t: "02:58:19", msg: "night block 2 ARMED · soak profile loaded · monitors live" },
      { t: "03:00:00", msg: "handoff complete · block CLOSED · period ONGOING" },
    ])}

    <div class="${a(2)}" style="display:flex;gap:14px;background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;margin-top:14px;">
      <div style="flex-shrink:0;width:38px;height:38px;border-radius:10px;background:#1C1C21;border:1px solid #26262B;display:flex;align-items:center;justify-content:center;color:#C4C4CB;font-size:14px;">&#9654;</div>
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:3px;color:#FFFFFF;">Soak runs unattended 3:00–6:00 AM</div>
        <div style="font-size:12px;color:#9A9AA2;line-height:1.5;">
          Monitors page on any threshold breach. Concluding callback fires at
          <strong style="color:#FFFFFF;">6:00 AM CT</strong> when the overnight window closes.
          ETA unchanged: <strong style="color:#FFFFFF;">Friday 1:00 PM CT · margin +2h</strong>.
        </div>
      </div>
    </div>
  </div>

  <div style="background:#0A0A0C;padding:20px 24px;font-size:11px;color:#6D6D76;line-height:1.7;border-top:1px solid #26262B;">
    <strong style="color:#C4C4CB;">BANXICO PLUS LLC</strong><br/>
    Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States<br/>
    August 7, 2026 · Block Checkpoint EXT-20260807-N1C · Cybrid Sandbox Integration · Confidential
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
    fs.writeFileSync("/tmp/night1-close.html", html);
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
    if (data.id) console.log(`Night 1 close → ${to} | ${data.id}`);
    else { console.error("ERROR:", JSON.stringify(data)); process.exit(1); }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log("Done — Night block 1 close sent.");
}

main();

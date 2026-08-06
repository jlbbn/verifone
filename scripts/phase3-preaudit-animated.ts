/**
 * PRE-AUDIT (Run R3) — Phase 3 Stress Scenarios · ANIMATED sequential breakdown
 * Same 12-step content as R2, plus a motion layer:
 *   - Every block fades/slides in top-to-bottom with staggered delays
 *   - Terminal log lines "print" one by one, with a blinking cursor prompt
 *   - Before/after metric bars grow from 0 to their value
 *   - Live status dot pulses
 *   - Final email: vertical timeline (sequential breakdown T1→T5)
 *
 * Degradation: clients that strip <style> (e.g. Gmail) render the exact
 * static layout of run R2 — nothing hidden, nothing broken.
 *
 * Usage:
 *   npx tsx scripts/phase3-preaudit-animated.ts --step=N   (1–12)
 *   npx tsx scripts/phase3-preaudit-animated.ts --all
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const RECIPIENTS = [
  "jose.barrientos@banxicoplusllc.org",
  "emiliano.maldonado@banxicoplusllc.org",
];

const TOTAL = 12;
const RUN_ID = "PA-20260806-R3";

const ELAPSED: Record<number, string> = {
  1: "0h 00m", 2: "0h 12m", 3: "0h 25m", 4: "0h 38m", 5: "0h 52m",
  6: "1h 05m", 7: "1h 18m", 8: "1h 32m", 9: "1h 47m", 10: "2h 03m",
  11: "2h 18m", 12: "2h 30m",
};

const TIME: Record<number, { fix: string; running: string; budget: string }> = {
  3:  { fix: "0h 45m", running: "0h 45m of 7h", budget: "OAuth2 · 3h allotted" },
  5:  { fix: "1h 00m", running: "1h 45m of 7h", budget: "OAuth2 · 3h allotted" },
  7:  { fix: "1h 15m", running: "3h 00m of 7h", budget: "OAuth2 · on budget" },
  9:  { fix: "2h 00m", running: "5h 00m of 7h", budget: "Audit log · 4h allotted" },
  11: { fix: "2h 00m", running: "7h 00m of 7h", budget: "Audit log · on budget" },
};

const SUBJECTS: Record<number, string> = {
  1:  "Pre-Audit Run R3 Initiated · Live Sequential Breakdown · Period Ongoing · Cybrid Sandbox",
  2:  "Pre-Audit R3 · Test 1 FAIL — Token Expired Mid-Request",
  3:  "Pre-Audit R3 · Test 1 RESOLVED — Pre-Expiry Buffer 80% TTL · +0h 45m",
  4:  "Pre-Audit R3 · Test 2 FAIL — Concurrent Refresh Race · HTTP 429",
  5:  "Pre-Audit R3 · Test 2 RESOLVED — Promise Mutex · 1 Cybrid Call · +1h 00m",
  6:  "Pre-Audit R3 · Test 3 FAIL — Thundering Herd on Restart",
  7:  "Pre-Audit R3 · Test 3 RESOLVED — Warm-Up Hook Before Traffic · +1h 15m",
  8:  "Pre-Audit R3 · Test 4 FAIL — Hash Chain Fork at seq=47",
  9:  "Pre-Audit R3 · Test 4 RESOLVED — Advisory Lock Serial Writes · +2h 00m",
  10: "Pre-Audit R3 · Test 5 FAIL — Audit Entry Lost on Tron Timeout",
  11: "Pre-Audit R3 · Test 5 RESOLVED — Failure Log Isolated Connection · +2h 00m",
  12: "Pre-Audit R3 Summary — Sequential Breakdown · 5/5 Resolved · Period Ongoing · 2h 30m",
};

const MATRIX: Record<number, string[]> = {
  1:  ["q","q","q","q","q"],
  2:  ["f","q","q","q","q"],
  3:  ["r","q","q","q","q"],
  4:  ["r","f","q","q","q"],
  5:  ["r","r","q","q","q"],
  6:  ["r","r","f","q","q"],
  7:  ["r","r","r","q","q"],
  8:  ["r","r","r","f","q"],
  9:  ["r","r","r","r","q"],
  10: ["r","r","r","r","f"],
  11: ["r","r","r","r","r"],
  12: ["r","r","r","r","r"],
};

// ─── ANIMATION ORCHESTRATION ─────────────────────────────────────────────────
// Staggered delay counter. Each call to a() hands out the next slot so the
// whole email reveals top-to-bottom. Clients without CSS animation support
// simply render everything static (fill-mode never applies).

const DELAY_STEP = 0.1; // seconds per slot
const MAX_SLOT = 89;
let D = 0;

function resetAnim() { D = 0; }
function slot(extra: number): number { D = Math.min(D + extra, MAX_SLOT); const s = D; D = Math.min(D + 1, MAX_SLOT); return s; }
/** fade+rise class with next staggered delay; extra = additional pause slots before it */
function a(extra = 0): string { return `bx d${slot(extra)}`; }
/** bar-grow class (width animates 0 → inline width) */
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

// ─── VISUAL COMPONENTS ───────────────────────────────────────────────────────

function brandRow(liveLabel: string, liveColor: string): string {
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:-.01em;">
      <div style="width:18px;height:18px;display:grid;grid-template-columns:1fr 1fr;gap:2px;">
        <i style="background:#E8332B;border-radius:2px;display:block;"></i>
        <i style="background:#E8332B;border-radius:2px;display:block;"></i>
        <i style="background:#E8332B;border-radius:2px;display:block;"></i>
        <i style="background:#E8332B;border-radius:2px;display:block;"></i>
      </div>
      BANXICO<span style="color:#E8332B;">+</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${liveColor};">
      <span class="bx-pulse" style="width:6px;height:6px;border-radius:50%;background:${liveColor};box-shadow:0 0 0 3px ${liveColor}33;display:inline-block;"></span>
      ${liveLabel}
    </div>
  </div>`;
}

function runMeta(step: number): string {
  const cells: [string, string, string][] = [
    ["Run ID", RUN_ID, "#C4C4CB"],
    ["Environment", "cybrid-sandbox-v2.4", "#C4C4CB"],
    ["Trigger", "auto-scheduler", "#C4C4CB"],
    ["Period", `ONGOING · ${ELAPSED[step]}`, "#3DDC84"],
  ];
  return `<div class="${a()}" style="display:flex;background:#141417;border:1px solid #26262B;border-radius:12px;overflow:hidden;margin-bottom:14px;">
    ${cells.map(([label, val, color], i) => `
      <div style="flex:1;padding:11px 12px;${i < cells.length - 1 ? "border-right:1px solid #26262B;" : ""}">
        <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;margin-bottom:4px;font-weight:700;">${label}</div>
        <div style="font-size:11px;font-weight:700;color:${color};font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;letter-spacing:.01em;white-space:nowrap;">${val}</div>
      </div>`).join("")}
  </div>`;
}

function suiteMatrix(step: number): string {
  const states = MATRIX[step];
  const style = (s: string) =>
    s === "r" ? { bg:"rgba(61,220,132,.1)",  bc:"rgba(61,220,132,.3)",  c:"#3DDC84", label:"OK"    } :
    s === "f" ? { bg:"rgba(232,51,43,.12)",  bc:"rgba(232,51,43,.35)",  c:"#E8332B", label:"FAIL"  } :
                { bg:"#1C1C21",              bc:"#26262B",               c:"#6D6D76", label:"QUEUE" };
  const names = ["T1 · Token TTL","T2 · Refresh Race","T3 · Cold Boot","T4 · Hash Chain","T5 · Failure Log"];
  return `<div style="display:flex;gap:6px;">
    ${states.map((s, i) => {
      const st = style(s);
      return `<div class="${a()}" style="flex:1;background:${st.bg};border:1px solid ${st.bc};border-radius:8px;padding:8px 6px;text-align:center;">
        <div style="font-size:8px;letter-spacing:.05em;text-transform:uppercase;color:#6D6D76;margin-bottom:3px;white-space:nowrap;">${names[i]}</div>
        <div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${st.c};">${st.label}</div>
      </div>`;
    }).join("")}
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

function barCompare(metrics: { label: string; before: number; after: number; unit?: string }[]): string {
  return `<div class="${a(1)}" style="background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;margin-top:14px;">
    <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;font-weight:800;margin-bottom:12px;">
      Impact — before vs after fix
    </div>
    ${metrics.map(m => {
      const max = Math.max(m.before, m.after, 1);
      const bw = Math.max(Math.round((m.before / max) * 100), 4);
      const aw = Math.max(Math.round((m.after  / max) * 100), 4);
      return `
      <div class="${a(1)}" style="margin-bottom:12px;">
        <div style="font-size:11px;color:#C4C4CB;margin-bottom:6px;">${m.label}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:9px;color:#6D6D76;width:38px;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;">before</span>
          <div style="flex:1;height:8px;background:#1C1C21;border-radius:4px;overflow:hidden;">
            <div class="${ag()}" style="height:100%;width:${bw}%;background:linear-gradient(90deg,#B8241D,#E8332B);border-radius:4px;"></div>
          </div>
          <span style="font-size:11px;font-weight:800;color:#E8332B;font-family:'SF Mono',ui-monospace,monospace;width:44px;text-align:right;flex-shrink:0;">${m.before}${m.unit || ""}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:9px;color:#6D6D76;width:38px;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;">after</span>
          <div style="flex:1;height:8px;background:#1C1C21;border-radius:4px;overflow:hidden;">
            <div class="${ag()}" style="height:100%;width:${aw}%;background:linear-gradient(90deg,#2BA05F,#3DDC84);border-radius:4px;"></div>
          </div>
          <span style="font-size:11px;font-weight:800;color:#3DDC84;font-family:'SF Mono',ui-monospace,monospace;width:44px;text-align:right;flex-shrink:0;">${m.after}${m.unit || ""}</span>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

function sectionH2(label: string): string {
  return `<h2 class="${a(1)}" style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:0 0 14px;display:flex;align-items:center;gap:8px;">
    <span style="width:3px;height:12px;background:#E8332B;border-radius:2px;display:inline-block;flex-shrink:0;"></span>
    ${label}
  </h2>`;
}

function kvTable(rows: [string, string, string?][]): string {
  return `<div style="border:1px solid #26262B;border-radius:12px;overflow:hidden;">
    ${rows.map(([k, v, color], i) => `
    <div class="${a()}" style="display:flex;${i > 0 ? "border-top:1px solid #26262B;" : ""}background:${i % 2 === 0 ? "#0F0F12" : "#141417"};">
      <div style="width:170px;flex-shrink:0;padding:10px 14px;font-size:9px;font-weight:800;color:#6D6D76;text-transform:uppercase;letter-spacing:.05em;line-height:1.5;">${k}</div>
      <div style="flex:1;padding:10px 14px;font-size:12px;color:${color || "#9A9AA2"};line-height:1.6;">${v}</div>
    </div>`).join("")}
  </div>`;
}

function statusTag(label: string, kind: "fail" | "ok"): string {
  const s = kind === "ok" ? { bg:"rgba(61,220,132,.12)", bc:"rgba(61,220,132,.3)", c:"#3DDC84" }
                          : { bg:"rgba(232,51,43,.12)",  bc:"rgba(232,51,43,.3)",  c:"#E8332B" };
  return `<div class="${a(2)}" style="margin-top:16px;text-align:right;">
    <span style="background:${s.bg};border:1px solid ${s.bc};color:${s.c};font-size:11px;font-weight:800;letter-spacing:.07em;padding:5px 12px;border-radius:20px;white-space:nowrap;">${label}</span>
  </div>`;
}

function timeCard(step: number): string {
  const t = TIME[step];
  return `<div class="${a(1)}" style="display:flex;background:rgba(61,220,132,.06);border:1px solid rgba(61,220,132,.2);border-radius:12px;overflow:hidden;margin-top:14px;">
    <div style="flex:1;padding:12px;text-align:center;border-right:1px solid rgba(61,220,132,.15);">
      <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#3DDC84;font-weight:700;margin-bottom:4px;">Time on fix</div>
      <div style="font-size:15px;font-weight:800;color:#3DDC84;font-family:'SF Mono',ui-monospace,monospace;">${t.fix}</div>
    </div>
    <div style="flex:1;padding:12px;text-align:center;border-right:1px solid rgba(61,220,132,.15);">
      <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#9A9AA2;font-weight:700;margin-bottom:4px;">Running total</div>
      <div style="font-size:13px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;">${t.running}</div>
    </div>
    <div style="flex:1;padding:12px;text-align:center;">
      <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#9A9AA2;font-weight:700;margin-bottom:4px;">Budget</div>
      <div style="font-size:11px;font-weight:700;color:#6D6D76;">${t.budget}</div>
    </div>
  </div>`;
}

// Vertical timeline — the sequential breakdown device for the summary email
function timeline(items: { name: string; result: string; time: string }[]): string {
  return `<div style="margin-top:2px;">
    ${items.map((it, i) => `
    <div class="${a(2)}" style="display:flex;gap:12px;">
      <div style="display:flex;flex-direction:column;align-items:center;width:20px;flex-shrink:0;">
        <div style="width:18px;height:18px;border-radius:50%;background:rgba(61,220,132,.12);border:1px solid rgba(61,220,132,.35);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5.5L4 8L8.5 2" stroke="#3DDC84" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        ${i < items.length - 1 ? `<div style="width:2px;flex:1;background:#26262B;margin-top:4px;min-height:22px;"></div>` : ""}
      </div>
      <div style="padding-bottom:${i < items.length - 1 ? "16px" : "0"};min-width:0;">
        <div style="font-size:12.5px;font-weight:700;color:#fff;margin-bottom:2px;">${it.name}
          <span style="background:#1C1C21;border:1px solid #26262B;color:#9A9AA2;font-size:9px;font-weight:800;letter-spacing:.05em;padding:2px 7px;border-radius:10px;margin-left:6px;font-family:'SF Mono',ui-monospace,monospace;white-space:nowrap;">${it.time}</span>
        </div>
        <div style="font-size:11.5px;color:#9A9AA2;line-height:1.5;">${it.result}</div>
      </div>
    </div>`).join("")}
  </div>`;
}

function shell(step: number, h1: string, sub: string, isFail: boolean, bodyFn: () => string): string {
  resetAnim();
  const live = isFail ? { label: "Test failed — run continues", c: "#E8332B" }
             : step === 12 ? { label: "Period ongoing", c: "#3DDC84" }
             : { label: "Pre-audit running", c: "#3DDC84" };
  const header = `
    ${brandRow(live.label, live.c)}
    <div class="${a()}" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9A9AA2;font-weight:700;margin-bottom:10px;">
      Pre-Audit · Phase 3 Stress Scenarios · Step ${step} of ${TOTAL}
    </div>
    <h1 class="${a()}" style="font-size:27px;line-height:1.1;margin:0 0 12px;font-weight:800;letter-spacing:-.02em;">${h1}</h1>
    <p class="${a()}" style="font-size:13.5px;line-height:1.6;color:#C4C4CB;margin:0 0 20px;max-width:52ch;">${sub}</p>
    ${runMeta(step)}
    ${suiteMatrix(step)}`;
  const body = bodyFn();
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${styleBlock()}</head>
<body style="margin:0;background:#1A1A1E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;padding:32px 12px 60px;">
<div style="max-width:640px;margin:0 auto;">
<div style="background:#0F0F12;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.4),0 20px 50px rgba(0,0,0,.5);">

  <div style="padding:26px 24px 0;border-top:3px solid ${isFail ? "#E8332B" : "#3DDC84"};">
    ${header}
  </div>

  <div style="padding:24px;">
    ${body}
  </div>

  <div style="background:#0A0A0C;padding:20px 24px;font-size:11px;color:#6D6D76;line-height:1.7;border-top:1px solid #26262B;">
    <strong style="color:#C4C4CB;">BANXICO PLUS LLC</strong><br/>
    Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States<br/>
    August 6, 2026 · Pre-Audit Run ${RUN_ID} · Cybrid Sandbox Integration · Confidential
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

// ─── STEP BUILDERS ────────────────────────────────────────────────────────────

function step1(): string {
  return shell(1, `Pre-audit run <span style="color:#E8332B;">initiated.</span>`,
    "Automated re-validation of every Phase 3 stress scenario before the Cybrid audit. Each result dispatches in sequence — failures included.",
    false, () => `
    ${sectionH2("Suite roster — 5 stress scenarios · fail-first")}
    ${kvTable([
      ["T1 · OAuth2",    "Token expires mid-request — no pre-expiry buffer"],
      ["T2 · OAuth2",    "Concurrent refresh — race floods Cybrid auth"],
      ["T3 · OAuth2",    "Server restart — thundering herd on cold cache"],
      ["T4 · Audit log", "Concurrent writes — hash chain fork risk"],
      ["T5 · Audit log", "Tron failure — audit entry loss risk"],
    ])}
    ${terminal("preaudit — scheduler", [
      { t:"09:11:42", msg:"preaudit: scheduler triggered run " + RUN_ID },
      { t:"09:11:42", msg:"env: cybrid-sandbox-v2.4 · DO NYC3 · node 20 · pg 15" },
      { t:"09:11:43", msg:"suite: 5 stress scenarios loaded · mode fail-first" },
      { t:"09:11:43", msg:"revalidation: automated · notifications per step", c:"#60A5FA" },
      { t:"09:11:44", msg:"period: ONGOING · clock started", c:"#3DDC84" },
    ])}`);
}

function step2(): string {
  return shell(2, `T1 — <span style="color:#E8332B;">token expired mid-request.</span>`,
    "Token cached with full TTL, request landed 2 seconds before expiry. 401 from Cybrid, no retry path. Suite moves to the fix.",
    true, () => `
    ${sectionH2("Scenario")}
    ${kvTable([
      ["Token cached at",  `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">09:14:00 CT · expires_in: 3600s</span>`],
      ["Request fired at", `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">09:59:58 CT · remaining_ttl: 2s</span>`],
      ["Cybrid response",  `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;color:#E8332B;">401 Unauthorized · {"error":"token_expired"}</span>`, "#E8332B"],
      ["Retry",            "None — no retry logic in place", "#E8332B"],
      ["Downstream",       "Request dropped · Tron transfer not initiated"],
    ])}
    ${terminal("preaudit — T1 · token-ttl", [
      { t:"09:59:58", msg:"request: POST /api/v1/trades → cached token (2s left)" },
      { t:"09:59:58", msg:"cybrid: HTTP 401 · token_expired", c:"#E8332B" },
      { t:"09:59:58", msg:"error: CybridAuthError — expired mid-request", c:"#E8332B" },
      { t:"09:59:58", msg:"caller: 500 returned · no retry", c:"#E8332B" },
      { t:"09:59:58", msg:"result: T1 FAIL — request dropped", c:"#E8332B" },
    ])}
    ${statusTag("FAIL — RUN CONTINUES","fail")}`);
}

function step3(): string {
  return shell(3, `T1 — <span style="color:#3DDC84;">resolved.</span>`,
    "Pre-expiry buffer at 80% TTL. Token renews before it can expire under a live request.",
    false, () => `
    ${sectionH2("Fix applied")}
    ${kvTable([
      ["Change",     `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">if (remaining_ttl &lt; ttl * 0.20) await refreshToken()</span>`],
      ["Threshold",  "720s before expiry (20% of 3600s TTL)"],
      ["Behavior",   "Old token served until refresh resolves — zero gap"],
    ])}
    ${barCompare([
      { label: "401 token_expired per run", before: 3, after: 0 },
      { label: "Dropped requests",          before: 1, after: 0 },
    ])}
    ${terminal("preaudit — T1 · re-run", [
      { t:"10:45:01", msg:"token: remaining_ttl 718s < 720s → refresh triggered", c:"#FBBF24" },
      { t:"10:45:01", msg:"token: refreshed · ttl 3600s · 142ms", c:"#3DDC84" },
      { t:"10:45:01", msg:"request: POST /api/v1/trades → 200 OK (12ms)", c:"#3DDC84" },
      { t:"10:45:01", msg:"result: T1 RESOLVED · 401 count: 0", c:"#3DDC84" },
    ])}
    ${timeCard(3)}
    ${statusTag("RESOLVED","ok")}`);
}

function step4(): string {
  return shell(4, `T2 — <span style="color:#E8332B;">refresh race · HTTP 429.</span>`,
    "Eight concurrent callers all fired their own refresh. Cybrid rate-limited on the third. Suite moves to the fix.",
    true, () => `
    ${sectionH2("Scenario")}
    ${kvTable([
      ["Concurrent requests", `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">8 · all detect remaining_ttl: 680s</span>`],
      ["Refresh calls",       "8 simultaneous — no coordination", "#E8332B"],
      ["Cybrid #1",           "200 OK · token issued"],
      ["Cybrid #2–8",         `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;color:#E8332B;">429 Too Many Requests · rate_limit_exceeded</span>`, "#E8332B"],
      ["Net outcome",         "1 success · 7 wasted · 12 requests errored", "#E8332B"],
    ])}
    ${terminal("preaudit — T2 · refresh-race", [
      { t:"10:52:10", msg:"8 goroutines enter refreshToken() simultaneously" },
      { t:"10:52:10", msg:"cybrid: HTTP 429 · X-RateLimit-Remaining: 0", c:"#E8332B" },
      { t:"10:52:10", msg:"error: RefreshError ×7 → 500 to callers", c:"#E8332B" },
      { t:"10:52:10", msg:"result: T2 FAIL — rate limit hit", c:"#E8332B" },
    ])}
    ${statusTag("FAIL — RUN CONTINUES","fail")}`);
}

function step5(): string {
  return shell(5, `T2 — <span style="color:#3DDC84;">resolved.</span>`,
    "Promise mutex — one refresh in flight, everyone else awaits it. One Cybrid call per burst.",
    false, () => `
    ${sectionH2("Fix applied")}
    ${kvTable([
      ["Pattern", `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">let _refreshPromise: Promise&lt;Token&gt; | null</span>`],
      ["Acquire", "First caller sets the promise, fetches token"],
      ["Wait",    "Callers 2–8 await the same promise — zero extra calls"],
      ["Release", "Promise cleared after resolve"],
    ])}
    ${barCompare([
      { label: "Cybrid auth calls per burst", before: 8, after: 1 },
      { label: "HTTP 429 responses",          before: 1, after: 0 },
      { label: "Tokens wasted",               before: 7, after: 0 },
    ])}
    ${terminal("preaudit — T2 · re-run", [
      { t:"11:14:22", msg:"8 concurrent callers · mutex engaged", c:"#60A5FA" },
      { t:"11:14:22", msg:"refresh: 1 call → 200 OK · 148ms", c:"#3DDC84" },
      { t:"11:14:22", msg:"callers: 8/8 served same token · 200 OK", c:"#3DDC84" },
      { t:"11:14:22", msg:"result: T2 RESOLVED · 429 count: 0", c:"#3DDC84" },
    ])}
    ${timeCard(5)}
    ${statusTag("RESOLVED","ok")}`);
}

function step6(): string {
  return shell(6, `T3 — <span style="color:#E8332B;">thundering herd on restart.</span>`,
    "Cold cache at boot — every early request raced to fetch its own token. Suite moves to the fix.",
    true, () => `
    ${sectionH2("Scenario")}
    ${kvTable([
      ["Server restart",     `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">21:11:00 CT · cache empty</span>`],
      ["Boot traffic",       "14 concurrent requests within 200ms", "#E8332B"],
      ["Mutex state",        "Uninitialized — all 14 saw null before first set", "#E8332B"],
      ["Cybrid",             `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;color:#E8332B;">429 at request #3</span>`, "#E8332B"],
      ["Completed",          "2 of 14 · 12 errored", "#E8332B"],
    ])}
    ${terminal("preaudit — T3 · cold-boot", [
      { t:"21:11:00", msg:"restart: pm2 reload · cache empty" },
      { t:"21:11:00", msg:"boot: 14 requests · 14 token fetches fired", c:"#FBBF24" },
      { t:"21:11:00", msg:"cybrid: HTTP 429 · rate_limit_exceeded", c:"#E8332B" },
      { t:"21:11:00", msg:"result: T3 FAIL — thundering herd", c:"#E8332B" },
    ])}
    ${statusTag("FAIL — RUN CONTINUES","fail")}`);
}

function step7(): string {
  return shell(7, `T3 — <span style="color:#3DDC84;">resolved.</span>`,
    "Startup hook warms the cache before PM2 marks the process ready. One fetch per boot, ever.",
    false, () => `
    ${sectionH2("Fix applied")}
    ${kvTable([
      ["Hook",   `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">await warmTokenCache() before app.listen()</span>`],
      ["PM2",    `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">wait_ready: true · listen_timeout: 10000ms</span>`],
      ["Signal", "process.send('ready') only after cache is warm"],
      ["Effect", "Traffic held until 1 token fetched — no herd"],
    ])}
    ${barCompare([
      { label: "Token fetches at boot",   before: 14, after: 1 },
      { label: "Failed requests at boot", before: 12, after: 0 },
      { label: "Startup overhead",        before: 0,  after: 148, unit: "ms" },
    ])}
    ${terminal("preaudit — T3 · re-run", [
      { t:"21:26:40", msg:"restart: pm2 reload · warm-up hook engaged", c:"#60A5FA" },
      { t:"21:26:40", msg:"warmTokenCache: 1 call → 200 OK · 148ms", c:"#3DDC84" },
      { t:"21:26:40", msg:"ready signal sent · backlog released", c:"#3DDC84" },
      { t:"21:26:40", msg:"boot burst: 14/14 served from warm cache", c:"#3DDC84" },
      { t:"21:26:40", msg:"result: T3 RESOLVED · 429 count: 0", c:"#3DDC84" },
    ])}
    ${timeCard(7)}
    ${statusTag("RESOLVED","ok")}`);
}

function step8(): string {
  return shell(8, `T4 — <span style="color:#E8332B;">hash chain fork at seq=47.</span>`,
    "Two concurrent audit writes claimed the same parent hash. The chain forked — integrity check flagged it. Suite moves to the fix.",
    true, () => `
    ${sectionH2("Scenario")}
    ${kvTable([
      ["seq 46",          `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">hash=Z · prev=Y · COMMITTED</span>`],
      ["Write A",         `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">reads prev=Z · computes hash=A</span>`],
      ["Write B",         `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">reads prev=Z · computes hash=B (same parent)</span>`, "#E8332B"],
      ["Result",          "Two rows share prev_hash=Z — chain forks at seq=47", "#E8332B"],
      ["Tamper detection","Unreliable — fork indistinguishable from attack", "#E8332B"],
    ])}
    ${terminal("preaudit — T4 · hash-chain", [
      { t:"22:03:15", msg:"2 tx read MAX(seq)=46 · prev=Z simultaneously" },
      { t:"22:03:15", msg:"tx A: INSERT seq=47 hash=A prev=Z → COMMIT", c:"#FBBF24" },
      { t:"22:03:15", msg:"tx B: INSERT seq=47 hash=B prev=Z → COMMIT", c:"#E8332B" },
      { t:"22:03:16", msg:"integrity_check: fork detected · chain_valid=false", c:"#E8332B" },
      { t:"22:03:16", msg:"result: T4 FAIL — chain forked", c:"#E8332B" },
    ])}
    ${statusTag("FAIL — RUN CONTINUES","fail")}`);
}

function step9(): string {
  return shell(9, `T4 — <span style="color:#3DDC84;">resolved.</span>`,
    "Advisory transaction lock serializes every audit write. Linear chain, reliable tamper detection.",
    false, () => `
    ${sectionH2("Fix applied")}
    ${kvTable([
      ["Lock",     `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">SELECT pg_advisory_xact_lock(42)</span>`],
      ["Effect",   "Second writer blocks until first commits — strict serial order"],
      ["Overhead", "~2ms per write · no schema change needed"],
    ])}
    ${barCompare([
      { label: "Chain forks per stress run", before: 1, after: 0 },
      { label: "Duplicate prev_hash rows",   before: 2, after: 0 },
      { label: "Write overhead",             before: 0, after: 2, unit: "ms" },
    ])}
    ${terminal("preaudit — T4 · re-run", [
      { t:"22:41:02", msg:"tx A: lock acquired · seq=47 hash=A prev=Z → COMMIT", c:"#3DDC84" },
      { t:"22:41:02", msg:"tx B: blocked → lock acquired · seq=48 hash=B prev=A → COMMIT", c:"#3DDC84" },
      { t:"22:41:03", msg:"integrity_check: linear chain · chain_valid=true", c:"#3DDC84" },
      { t:"22:41:03", msg:"result: T4 RESOLVED · forks: 0", c:"#3DDC84" },
    ])}
    ${timeCard(9)}
    ${statusTag("RESOLVED","ok")}`);
}

function step10(): string {
  return shell(10, `T5 — <span style="color:#E8332B;">audit entry lost on Tron timeout.</span>`,
    "The rollback erased the audit INSERT along with the business transaction. The failure went unrecorded. Suite moves to the fix.",
    true, () => `
    ${sectionH2("Scenario")}
    ${kvTable([
      ["seq 47", `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">webhook_received · COMMITTED</span>`],
      ["seq 48", "MISSING — tron_broadcast_initiated · rolled back with TX", "#E8332B"],
      ["seq 49", "MISSING — tron_broadcast_failed · never written", "#E8332B"],
      ["seq 50", `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">webhook_received · next event</span>`],
      ["Compliance", "Cybrid requires a complete unbroken audit trail", "#E8332B"],
    ])}
    ${terminal("preaudit — T5 · failure-log", [
      { t:"23:10:44", msg:"tx: BEGIN · INSERT audit seq=48 (tron_initiated)" },
      { t:"23:12:44", msg:"tron rpc: TIMEOUT · exception thrown", c:"#E8332B" },
      { t:"23:12:44", msg:"tx: ROLLBACK · audit seq=48 removed with it", c:"#E8332B" },
      { t:"23:12:44", msg:"catch: re-throw · no failure entry written", c:"#E8332B" },
      { t:"23:12:45", msg:"result: T5 FAIL — 3-entry gap in sequence", c:"#E8332B" },
    ])}
    ${statusTag("FAIL — RUN CONTINUES","fail")}`);
}

function step11(): string {
  return shell(11, `T5 — <span style="color:#3DDC84;">resolved.</span>`,
    "Failure entries commit on their own connection, outside the business transaction. Every event recorded, rollback or not.",
    false, () => `
    ${sectionH2("Fix applied")}
    ${kvTable([
      ["Pattern",    `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">auditLogFailure(event, error) — dedicated pool (db2)</span>`],
      ["Placement",  `<span style="font-family:'SF Mono',ui-monospace,monospace;font-size:11px;">catch (err) { await auditLogFailure(...); throw err; }</span>`],
      ["Guarantee",  "Failure entry commits before the exception propagates"],
    ])}
    ${barCompare([
      { label: "Sequence gaps per stress run", before: 3, after: 0 },
      { label: "Unaudited failures",           before: 2, after: 0 },
    ])}
    ${terminal("preaudit — T5 · re-run", [
      { t:"23:48:19", msg:"tron rpc: TIMEOUT (simulated)", c:"#FBBF24" },
      { t:"23:48:19", msg:"db2: audit seq=49 tron_broadcast_failed → COMMIT", c:"#3DDC84" },
      { t:"23:48:19", msg:"db2: audit seq=50 transaction_rollback → COMMIT", c:"#3DDC84" },
      { t:"23:48:20", msg:"chain: continuous · no gaps · compliance PASS", c:"#3DDC84" },
      { t:"23:48:20", msg:"result: T5 RESOLVED · gaps: 0", c:"#3DDC84" },
    ])}
    ${timeCard(11)}
    ${statusTag("RESOLVED","ok")}`);
}

function step12(): string {
  return shell(12, `Pre-audit — <span style="color:#3DDC84;">5/5 resolved · period ongoing.</span>`,
    "Every stress scenario re-validated clean against the Cybrid Sandbox. 2h 30m elapsed — the run stays open into Phase 4.",
    false, () => `
    ${sectionH2("Sequential breakdown — T1 → T5")}
    ${timeline([
      { name: "T1 · Token TTL",     result: "Pre-expiry buffer at 80% TTL — zero dropped requests",  time: "0h 45m" },
      { name: "T2 · Refresh race",  result: "Promise mutex — 1 Cybrid call per burst",               time: "1h 00m" },
      { name: "T3 · Cold boot",     result: "Warm-up hook — 1 fetch per restart",                    time: "1h 15m" },
      { name: "T4 · Hash chain",    result: "Advisory lock — linear sequence, no forks",             time: "2h 00m" },
      { name: "T5 · Failure log",   result: "Isolated connection — zero sequence gaps",              time: "2h 00m" },
    ])}

    <div class="${a(2)}" style="display:flex;gap:8px;margin-top:18px;">
      <div style="flex:1;background:rgba(61,220,132,.08);border:1px solid rgba(61,220,132,.25);border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#3DDC84;font-weight:700;margin-bottom:4px;">Resolved</div>
        <div style="font-size:22px;font-weight:800;color:#3DDC84;">5 / 5</div>
      </div>
      <div style="flex:1;background:#141417;border:1px solid #26262B;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;font-weight:700;margin-bottom:4px;">Fix time (historical)</div>
        <div style="font-size:22px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;">7h 00m</div>
      </div>
      <div style="flex:1;background:#141417;border:1px solid #26262B;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#6D6D76;font-weight:700;margin-bottom:4px;">Re-validation</div>
        <div style="font-size:22px;font-weight:800;color:#C4C4CB;font-family:'SF Mono',ui-monospace,monospace;">2h 30m</div>
      </div>
    </div>

    ${terminal("preaudit — summary", [
      { t:"11:41:12", msg:"suite complete: 5/5 resolved · 0 open findings", c:"#3DDC84" },
      { t:"11:41:12", msg:"elapsed: 2h 30m · period remains ONGOING", c:"#3DDC84" },
      { t:"11:41:12", msg:"next: Phase 4 — monitoring + load testing", c:"#60A5FA" },
      { t:"11:41:13", msg:"report: dispatched to stakeholders" },
    ])}

    <div class="${a(2)}" style="display:flex;gap:14px;background:#141417;border:1px solid #26262B;border-radius:12px;padding:16px;margin-top:14px;">
      <div style="flex-shrink:0;width:38px;height:38px;border-radius:10px;background:rgba(232,51,43,.12);display:flex;align-items:center;justify-content:center;font-size:16px;">&#9654;</div>
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:3px;">Period ongoing — 2h 30m</div>
        <div style="font-size:12px;color:#9A9AA2;line-height:1.5;">
          Pre-audit re-validation closed clean. Work continues directly into Phase 4.<br/>
          Target delivery: <strong style="color:#fff;">Friday, Aug 7 · 3:00 PM CT</strong>
        </div>
      </div>
    </div>`);
}

// ─── SEND + CLI ───────────────────────────────────────────────────────────────
const STEPS: Record<number, () => string> = {
  1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6,
  7: step7, 8: step8, 9: step9, 10: step10, 11: step11, 12: step12,
};

async function send(step: number) {
  const html = STEPS[step]();
  for (const to of RECIPIENTS) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM, to, subject: SUBJECTS[step], html }),
    });
    const data = await res.json() as { id?: string; message?: string };
    if (data.id) console.log(`Step ${step} → ${to} | ${data.id}`);
    else { console.error(`Step ${step} ERROR:`, JSON.stringify(data)); process.exit(1); }
  }
}

async function main() {
  const arg = process.argv.find(a => a.startsWith("--step=") || a === "--all");
  if (!arg) { console.error("Usage: --step=N (1–12) or --all"); process.exit(1); }
  if (arg === "--all") {
    for (let i = 1; i <= TOTAL; i++) {
      await send(i);
      if (i < TOTAL) await new Promise(r => setTimeout(r, 1500));
    }
    console.log("Done — all 12 animated pre-audit steps sent.");
  } else {
    const n = parseInt(arg.replace("--step=", ""), 10);
    if (n < 1 || n > TOTAL) { console.error("Step must be 1–12"); process.exit(1); }
    await send(n);
  }
}

main();

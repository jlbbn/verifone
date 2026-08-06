/**
 * Capital Injection Point Analysis
 * Shows at exactly which phase / day the $800 outstanding balance is needed.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM           = "Banxico Plus <noreply@banxicoplusllc.org>";
const TO             = "jose.barrientos@banxicoplusllc.org";

// ─── Phase data ──────────────────────────────────────────────────────────────
const RATE = 48.47; // $/h

interface Phase {
  id: number;
  label: string;
  tasks: string;
  hours: number;
  startDay: string;   // calendar date
  endDay: string;
  status: "in_progress" | "pending" | "audit";
}

const PHASES: Phase[] = [
  {
    id: 1,
    label: "Migrate Replit → DigitalOcean",
    tasks: "Nginx, SSL, PM2, env variables, DNS cutover",
    hours: 8,
    startDay: "Aug 5 (Wed)",
    endDay: "Aug 6 (Thu)",
    status: "in_progress",
  },
  {
    id: 2,
    label: "Cybrid webhook hardening",
    tasks: "HMAC raw-bytes fix + idempotency guard (double-pay prevention)",
    hours: 8,
    startDay: "Aug 6 (Thu)",
    endDay: "Aug 7 (Fri)",
    status: "pending",
  },
  {
    id: 3,
    label: "OAuth2 cache + audit log",
    tasks: "Token pre-expiry refresh + immutable tamper-evident audit trail",
    hours: 7,
    startDay: "Aug 7 (Fri)",
    endDay: "Aug 10 (Mon)",
    status: "pending",
  },
  {
    id: 4,
    label: "Monitoring, alerts & load testing",
    tasks: "DO + Cloudflare uptime dashboards, stress test, performance tuning",
    hours: 5,
    startDay: "Aug 10 (Mon)",
    endDay: "Aug 11 (Tue)",
    status: "pending",
  },
  {
    id: 5,
    label: "Documentation + Cybrid sign-off",
    tasks: "Technical write-up, evidence package, call with Cybrid team",
    hours: 2,
    startDay: "Aug 11 (Tue)",
    endDay: "Aug 11 (Tue)",
    status: "pending",
  },
  {
    id: 6,
    label: "Audit cycle closure",
    tasks: "Compliance review, penetration test, final certification",
    hours: 0,
    startDay: "Aug 12 (Wed)",
    endDay: "Aug 12 (Wed)",
    status: "audit",
  },
];

// ─── Capital math ─────────────────────────────────────────────────────────────
//  Dev cost per phase (hours × RATE):
//   Ph1: 8h  = $387.76   cumulative: $387.76
//   Ph2: 8h  = $387.76   cumulative: $775.52
//   Ph3: 7h  = $339.29   cumulative: $1,114.81
//   Ph4: 5h  = $242.35   cumulative: $1,357.16  ← credits exhausted here ($1,354)
//   Ph5: 2h  = $96.94    cumulative: $1,454.10
//   Audit:    = $700.00   cumulative: $2,154.10
//
//  Total credits: $1,354  →  exhausted at hour ~27.9 (mid Phase 4 — 4.9 / 5h in)
//  Injection point: START of Phase 4 (Aug 10) — need $800 available by Aug 7 EOD

const phaseDevCost = (h: number) => (h * RATE).toFixed(2);

function creditBar(phase: Phase, cumulativeAfter: number, credits: number): string {
  const covered = Math.min(cumulativeAfter, credits);
  const pct = Math.round((covered / 2154) * 100);
  return pct + "%";
}

function buildHtml(): string {
  let cumulativeCost = 0;
  const CREDITS = 1354;
  const DEV_TOTAL = 1454;
  const AUDIT = 700;
  const TOTAL = 2154;
  const NET = 800;

  // per-phase row builder
  function phaseRow(p: Phase, idx: number): string {
    const devCost = p.hours * RATE;
    const prevCum = cumulativeCost;
    cumulativeCost += devCost + (p.status === "audit" ? AUDIT : 0);
    const cum = cumulativeCost;

    const isCovered   = prevCum < CREDITS && cum <= CREDITS;
    const isTransition = prevCum < CREDITS && cum > CREDITS; // crosses the line
    const isInjection = p.id === 4;
    const isAudit     = p.status === "audit";
    const isActive    = p.status === "in_progress";

    let statusBadge = "";
    if (isActive)     statusBadge = `<span style="background:#1E40AF;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;font-family:Arial,sans-serif;">IN PROGRESS</span>`;
    else if (isAudit) statusBadge = `<span style="background:#7C3AED;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;font-family:Arial,sans-serif;">AUDIT</span>`;
    else               statusBadge = `<span style="background:#E5E7EB;color:#6B7280;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;font-family:Arial,sans-serif;">PENDING</span>`;

    const rowBg = isInjection ? "#FFF7ED" : idx % 2 === 0 ? "#ffffff" : "#F9FAFB";
    const borderLeft = isInjection ? "border-left:4px solid #F59E0B;" : "border-left:4px solid transparent;";

    const costStr = isAudit
      ? `<span style="font-size:10px;color:#6B7280;">flat fee</span><br/>$700.00`
      : `$${devCost.toFixed(2)}`;

    const cumStr = isAudit
      ? `$${cum.toFixed(2)}`
      : `$${cum.toFixed(2)}`;

    // credit status indicator
    let creditCell = "";
    if (isCovered)    creditCell = `<span style="color:#166534;font-size:11px;font-weight:700;">✓ Covered</span>`;
    else if (isTransition) creditCell = `<span style="color:#D97706;font-size:11px;font-weight:700;">⚡ Credit ends here</span>`;
    else if (isInjection)  creditCell = `<span style="color:#B45309;font-size:11px;font-weight:700;">← $800 needed</span>`;
    else               creditCell = `<span style="color:#B45309;font-size:11px;font-weight:700;">$800 active</span>`;

    const phaseLabel = isAudit
      ? `<strong style="font-size:12px;color:#111;">${p.label}</strong><br/><span style="font-size:10px;color:#9CA3AF;">${p.tasks}</span>`
      : `<strong style="font-size:12px;color:#111;">Phase ${p.id}: ${p.label}</strong><br/><span style="font-size:10px;color:#9CA3AF;">${p.tasks}</span>`;

    return `
    <tr style="background:${rowBg};${borderLeft}">
      <td style="padding:12px 10px;vertical-align:top;width:32px;text-align:center;">
        <span style="font-size:12px;font-weight:900;color:${isInjection ? '#F59E0B' : isActive ? '#1E40AF' : '#9CA3AF'};">${isAudit ? '★' : `P${p.id}`}</span>
      </td>
      <td style="padding:12px 10px;vertical-align:top;">
        ${phaseLabel}
        <div style="margin-top:4px;">${statusBadge}</div>
      </td>
      <td style="padding:12px 10px;vertical-align:top;text-align:center;white-space:nowrap;">
        <span style="font-size:11px;color:#6B7280;">${p.hours > 0 ? p.hours + "h" : "—"}</span><br/>
        <span style="font-size:9px;color:#9CA3AF;">${p.startDay}</span>
      </td>
      <td style="padding:12px 10px;vertical-align:top;text-align:right;white-space:nowrap;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#111;">
        ${costStr}
      </td>
      <td style="padding:12px 10px;vertical-align:top;text-align:right;white-space:nowrap;font-family:Arial,sans-serif;font-size:12px;color:#6B7280;">
        $${cum.toFixed(2)}
      </td>
      <td style="padding:12px 10px;vertical-align:middle;white-space:nowrap;">
        ${creditCell}
      </td>
    </tr>
    ${isInjection ? `
    <tr style="background:#FEF3C7;">
      <td colspan="6" style="padding:10px 14px 10px 50px;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
          <tr>
            <td>
              <span style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#92400E;">
                ⚡ INJECTION POINT — $800.00 USD must be available by Friday, Aug 7 (EOD)
              </span><br/>
              <span style="font-family:Arial,sans-serif;font-size:10px;color:#A16207;">
                Credits ($1,354) are exhausted at hour ~28 of 30 — mid Phase 4. Capital needed before Aug 10 start to avoid blocking Phase 4 through the audit closure.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ""}`;
  }

  // burn timeline bar
  function burnBar(): string {
    const phases = [
      { pct: 27, color: "#1E40AF", label: "Ph1–2 (covered)" },
      { pct: 25, color: "#3B82F6", label: "Ph3 (covered)" },
      { pct: 16, color: "#F59E0B", label: "Ph4 ← $800" },
      { pct: 6,  color: "#EF4444", label: "Ph5" },
      { pct: 26, color: "#7C3AED", label: "Audit" },
    ];
    return phases.map(p =>
      `<td style="width:${p.pct}%;background:${p.color};height:18px;"></td>`
    ).join("");
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:#F3F4F6;"><tr><td align="center" style="padding:24px 12px;">

<!-- container -->
<table cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- hero -->
  <tr><td style="background:#0a0a0a;padding:28px 28px 20px;">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;color:#6B7280;text-transform:uppercase;">Banxico Plus LLC · Internal Finance</p>
    <h1 style="margin:8px 0 4px;font-size:22px;font-weight:900;color:#ffffff;line-height:1.2;">Capital Injection Analysis</h1>
    <p style="margin:0;font-size:13px;color:#9CA3AF;">Identifies the exact point in execution when <strong style="color:#F59E0B;">$800 USD</strong> must be available</p>
    <p style="margin:12px 0 0;font-size:10px;color:#4B5563;">August 5, 2026 · Cybrid Audit — Development Phase</p>
  </td></tr>

  <!-- summary cards -->
  <tr><td style="padding:20px 24px 4px;">
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px;">
      <tr>
        <td style="background:#EFF6FF;border-radius:8px;padding:14px;text-align:center;width:25%;">
          <p style="margin:0;font-size:10px;color:#3B82F6;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Total Project</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:900;color:#1E3A8A;font-family:Arial,sans-serif;">$2,154</p>
        </td>
        <td style="background:#F0FDF4;border-radius:8px;padding:14px;text-align:center;width:25%;">
          <p style="margin:0;font-size:10px;color:#16A34A;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Credits Applied</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:900;color:#166534;font-family:Arial,sans-serif;">$1,354</p>
        </td>
        <td style="background:#FFF7ED;border-radius:8px;padding:14px;text-align:center;width:25%;border:2px solid #F59E0B;">
          <p style="margin:0;font-size:10px;color:#D97706;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Inject by</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:900;color:#92400E;font-family:Arial,sans-serif;">Aug 7</p>
        </td>
        <td style="background:#FEF2F2;border-radius:8px;padding:14px;text-align:center;width:25%;">
          <p style="margin:0;font-size:10px;color:#EF4444;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Outstanding</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:900;color:#991B1B;font-family:Arial,sans-serif;">$800</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- burn bar -->
  <tr><td style="padding:20px 24px 4px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Capital Burn Timeline</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-radius:6px;overflow:hidden;">
      <tr>${burnBar()}</tr>
    </table>
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-top:6px;">
      <tr>
        <td style="width:52%;font-size:9px;color:#3B82F6;">■ Phases 1–3 (covered by credits)</td>
        <td style="width:16%;font-size:9px;color:#F59E0B;">■ Phase 4 (injection point)</td>
        <td style="width:6%;font-size:9px;color:#EF4444;">■ Ph5</td>
        <td style="width:26%;font-size:9px;color:#7C3AED;text-align:right;">■ Audit closure</td>
      </tr>
    </table>
  </td></tr>

  <!-- phases table -->
  <tr><td style="padding:20px 24px 4px;">
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Execution Breakdown</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <!-- header -->
      <tr style="background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
        <th style="padding:8px 10px;font-size:9px;font-weight:700;color:#6B7280;text-align:left;text-transform:uppercase;"></th>
        <th style="padding:8px 10px;font-size:9px;font-weight:700;color:#6B7280;text-align:left;text-transform:uppercase;">Phase</th>
        <th style="padding:8px 10px;font-size:9px;font-weight:700;color:#6B7280;text-align:center;text-transform:uppercase;">Hours / Date</th>
        <th style="padding:8px 10px;font-size:9px;font-weight:700;color:#6B7280;text-align:right;text-transform:uppercase;">Phase Cost</th>
        <th style="padding:8px 10px;font-size:9px;font-weight:700;color:#6B7280;text-align:right;text-transform:uppercase;">Cumulative</th>
        <th style="padding:8px 10px;font-size:9px;font-weight:700;color:#6B7280;text-align:left;text-transform:uppercase;">Capital</th>
      </tr>
      ${PHASES.map((p, i) => phaseRow(p, i)).join("")}
    </table>
  </td></tr>

  <!-- math breakdown -->
  <tr><td style="padding:20px 24px 4px;">
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">How the $800 was calculated</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      ${[
        ["Development work — 30h × $48.47/h",           "+$1,454.00", "#111111"],
        ["Audit cycle closure (flat fee)",               "+$700.00",   "#111111"],
        ["Subtotal outstanding",                         "$2,154.00",  "#1E3A8A"],
        ["Prior payments & credits applied",             "−$1,354.00", "#166534"],
      ].map(([label, val, color], i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#F9FAFB"};border-top:${i > 0 ? "1px solid #E5E7EB" : "none"};">
        <td style="padding:10px 14px;font-size:12px;color:#374151;font-family:Arial,sans-serif;">${label}</td>
        <td style="padding:10px 14px;font-size:13px;font-weight:700;color:${color};font-family:Arial,sans-serif;text-align:right;white-space:nowrap;">${val}</td>
      </tr>`).join("")}
      <tr style="background:#0a0a0a;border-top:2px solid #F59E0B;">
        <td style="padding:14px;font-size:13px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;">NET INJECTION NEEDED</td>
        <td style="padding:14px;font-size:22px;font-weight:900;color:#F59E0B;font-family:Arial,Helvetica,sans-serif;text-align:right;">$800.00 USD</td>
      </tr>
    </table>
  </td></tr>

  <!-- when exactly -->
  <tr><td style="padding:20px 24px;">
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:#FFF7ED;border:2px solid #F59E0B;border-radius:8px;padding:0;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D97706;text-transform:uppercase;letter-spacing:1px;">When exactly?</p>
        <p style="margin:0 0 10px;font-size:15px;font-weight:900;color:#92400E;font-family:Arial,sans-serif;">
          Credits run out at hour 27.9 of 30 — mid Phase 4 (Monitoring &amp; Load Testing)
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#78350F;">📅 Phase 4 starts</td>
            <td style="padding:4px 0;font-size:12px;font-weight:700;color:#92400E;text-align:right;">Monday, Aug 10, 2026</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#78350F;">⚡ Funds must be available by</td>
            <td style="padding:4px 0;font-size:12px;font-weight:700;color:#92400E;text-align:right;">Friday, Aug 7, 2026 (EOD)</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#78350F;">🏁 Audit closure date</td>
            <td style="padding:4px 0;font-size:12px;font-weight:700;color:#92400E;text-align:right;">Wednesday, Aug 12, 2026</td>
          </tr>
        </table>
        <p style="margin:10px 0 0;font-size:10px;color:#A16207;">
          Injecting before Aug 7 EOD eliminates any gap between credit exhaustion and continued execution. Delay beyond Aug 10 would pause Phase 4, push audit closure, and risk the Cybrid compliance window.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- footer -->
  <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 24px;">
    <p style="margin:0;font-size:10px;color:#9CA3AF;text-align:center;">
      Banxico Plus LLC · Internal Finance · August 5, 2026<br/>
      Generated by Replit Agent · Confidential
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

async function main() {
  const html = buildHtml();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      subject: "Capital Injection Point — $800 USD needed by Aug 7 · Banxico Plus LLC",
      html,
    }),
  });

  const data = await res.json() as { id?: string; message?: string };
  if (data.id) {
    console.log(`SENT → ${TO} | id: ${data.id}`);
  } else {
    console.error("ERROR:", JSON.stringify(data));
    process.exit(1);
  }
}

main();

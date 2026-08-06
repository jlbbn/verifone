/**
 * Shared dark email template — Banxico Plus LLC
 * Use this for every outbound internal/ops email.
 *
 * Import:
 *   import { shell, sec, row, tag, mono, fp } from "./email-template";
 */

// ─── Brand mark (2×2 red squares, email-safe — no CSS pseudo-elements) ───────
export function brandMark(): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation"
          style="display:inline-table;vertical-align:middle;margin-right:8px;">
    <tr>
      <td style="width:8px;height:8px;background:#E8332B;border-radius:2px;"></td>
      <td style="width:3px;"></td>
      <td style="width:8px;height:8px;background:#E8332B;border-radius:2px;"></td>
    </tr>
    <tr><td colspan="3" style="height:3px;"></td></tr>
    <tr>
      <td style="width:8px;height:8px;background:#E8332B;border-radius:2px;"></td>
      <td style="width:3px;"></td>
      <td style="width:8px;height:8px;background:#E8332B;border-radius:2px;"></td>
    </tr>
  </table>`;
}

// ─── Live dot ─────────────────────────────────────────────────────────────────
export function liveDot(label = "Execution active"): string {
  return `<span style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
                        color:#9A9AA2;display:inline-flex;align-items:center;gap:6px;">
    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;
                 background:#E8332B;box-shadow:0 0 0 3px rgba(232,51,43,.25);"></span>
    ${label}
  </span>`;
}

// ─── Progress bar (email-safe table cells) ────────────────────────────────────
export function progressBar(current: number, total: number): string {
  const cells = Array.from({ length: total }, (_, i) => {
    const done   = i < current - 1;
    const active = i === current - 1;
    const bg = done ? "#E8332B" : active ? "#B8241D" : "#26262B";
    return `<td style="height:4px;background:${bg};"></td>`;
  }).join("");
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
    <tr>${cells}</tr>
  </table>`;
}

// ─── Section heading (red left-bar, no CSS ::before needed) ──────────────────
export function heading(label: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px;">
    <tr>
      <td style="width:3px;background:#E8332B;border-radius:2px;">&nbsp;</td>
      <td style="width:8px;"></td>
      <td style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;
                 color:#9A9AA2;font-family:Arial,Helvetica,sans-serif;">${label}</td>
    </tr>
  </table>`;
}

// ─── Icon cell (unicode char in a styled dark circle) ────────────────────────
// Works in Gmail, Apple Mail, Outlook — no image load required.
export function icon(char: string, bg = "#232328"): string {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;
                        width:28px;height:28px;border-radius:50%;background:${bg};
                        font-size:13px;font-style:normal;font-family:Arial,Helvetica,sans-serif;
                        color:#fff;vertical-align:middle;">${char}</span>`;
}

// ─── Check icon (green circle + unicode tick) ─────────────────────────────────
export function check(): string {
  return icon("&#10003;", "rgba(61,220,132,.15)");
  // renders as ✓ in a semi-transparent green circle — identical to Cloudflare pattern
}

// ─── Status badges ────────────────────────────────────────────────────────────
export function tag(
  label: string,
  variant: "pass" | "fail" | "running" | "queued" | "warn" | "info" = "info"
): string {
  const map = {
    pass:    { bg: "rgba(61,220,132,.15)",  border: "rgba(61,220,132,.3)",  color: "#3DDC84" },
    fail:    { bg: "rgba(232,51,43,.15)",   border: "rgba(232,51,43,.3)",   color: "#E8332B" },
    running: { bg: "rgba(59,130,246,.15)",  border: "rgba(59,130,246,.3)",  color: "#60A5FA" },
    queued:  { bg: "#1C1C21",               border: "#26262B",               color: "#6D6D76" },
    warn:    { bg: "rgba(245,158,11,.12)",  border: "rgba(245,158,11,.3)",  color: "#FBBF24" },
    info:    { bg: "rgba(255,255,255,.06)", border: "#26262B",               color: "#9A9AA2" },
  };
  const s = map[variant];
  return `<span style="display:inline-block;background:${s.bg};border:1px solid ${s.border};
                        color:${s.color};font-size:10px;font-weight:800;letter-spacing:.07em;
                        padding:4px 10px;border-radius:20px;
                        font-family:Arial,Helvetica,sans-serif;">${label}</span>`;
}

// ─── Monospace value ──────────────────────────────────────────────────────────
export function mono(val: string): string {
  return `<span style="font-family:'Courier New',Courier,monospace;font-size:11px;
                        color:#C4C4CB;letter-spacing:.02em;">${val}</span>`;
}

// ─── Failure-point anchor ─────────────────────────────────────────────────────
export function fp(num: string, desc: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:14px;">
    <tr>
      <td style="background:#E8332B;color:#fff;font-size:9px;font-weight:800;
                 padding:3px 8px;border-radius:3px 0 0 3px;white-space:nowrap;
                 font-family:Arial,Helvetica,sans-serif;letter-spacing:.05em;">
        FAILURE POINT ${num}
      </td>
      <td style="background:#1C1C21;color:#9A9AA2;font-size:11px;
                 padding:3px 12px;border-radius:0 3px 3px 0;
                 font-family:Arial,Helvetica,sans-serif;border:1px solid #26262B;
                 border-left:none;">
        ${desc}
      </td>
    </tr>
  </table>`;
}

// ─── Table row (label | value) — dark ────────────────────────────────────────
export function row(
  label: string,
  value: string,
  valueColor = "#C4C4CB",
  alt = false
): string {
  return `<tr style="border-top:1px solid #26262B;background:${alt ? "#141417" : "#0F0F12"};">
    <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#6D6D76;
               white-space:nowrap;vertical-align:top;width:150px;
               font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;
               letter-spacing:.05em;">${label}</td>
    <td style="padding:9px 14px;font-size:12px;color:${valueColor};
               font-family:Arial,Helvetica,sans-serif;line-height:1.55;">${value}</td>
  </tr>`;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
export function sec(title: string, rowsHtml: string): string {
  return `
  <tr><td style="padding:20px 28px 0;">
    ${heading(title)}
    <table cellpadding="0" cellspacing="0" role="presentation"
           style="width:100%;border:1px solid #26262B;border-radius:8px;overflow:hidden;">
      ${rowsHtml}
    </table>
  </td></tr>`;
}

// ─── Info box (blue-tinted) ───────────────────────────────────────────────────
export function infoBox(label: string, content: string): string {
  return `<tr><td style="padding:16px 28px 20px;">
    <table cellpadding="0" cellspacing="0" role="presentation"
           style="width:100%;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:8px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 4px;font-size:9px;font-weight:800;color:#60A5FA;
                  text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">${label}</p>
        <p style="margin:0;font-size:12px;color:#C4C4CB;line-height:1.6;
                  font-family:Arial,Helvetica,sans-serif;">${content}</p>
      </td></tr>
    </table>
  </td></tr>`;
}

// ─── Urgency box (red-tinted) ─────────────────────────────────────────────────
export function urgencyBox(label: string, content: string): string {
  return `<tr><td style="padding:16px 28px 20px;">
    <table cellpadding="0" cellspacing="0" role="presentation"
           style="width:100%;background:rgba(232,51,43,.08);border:1px solid rgba(232,51,43,.25);border-radius:8px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 4px;font-size:9px;font-weight:800;color:#E8332B;
                  text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">${label}</p>
        <p style="margin:0;font-size:12px;color:#C4C4CB;line-height:1.6;
                  font-family:Arial,Helvetica,sans-serif;">${content}</p>
      </td></tr>
    </table>
  </td></tr>`;
}

// ─── CTA button ───────────────────────────────────────────────────────────────
export function cta(label: string, href = "#"): string {
  return `<tr><td style="padding:20px 28px;">
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr><td style="background:#E8332B;border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:13px;
                                  font-weight:800;color:#fff;text-decoration:none;
                                  font-family:Arial,Helvetica,sans-serif;letter-spacing:-.01em;">
          ${label}
        </a>
      </td></tr>
    </table>
  </td></tr>`;
}

// ─── MAIN SHELL ───────────────────────────────────────────────────────────────
export interface ShellOpts {
  kicker?: string;         // small uppercase label above h1
  title: string;           // h1 — use <span style="color:#E8332B"> for accent
  subtitle?: string;       // h1 subline
  liveLabel?: string;      // text next to the live dot (default "Execution active")
  step?: number;           // current step
  totalSteps?: number;     // total steps (shows progress bar if set)
  date?: string;           // shown in footer + hero meta
  body: string;            // inner <tr> blocks
  footerNote?: string;     // replaces default footer text
  badges?: string[];       // compliance badges (default: EMV, PCI DSS, AES-256)
}

export function shell(opts: ShellOpts): string {
  const {
    kicker = "Banxico Plus LLC — Internal",
    title,
    subtitle = "",
    liveLabel = "Execution active",
    step,
    totalSteps,
    date = "August 6, 2026",
    body,
    footerNote,
    badges = ["PCI DSS", "AES-256", "TRC-20"],
  } = opts;

  const progress = step && totalSteps
    ? progressBar(step, totalSteps)
    : "";

  const badgeCells = badges
    .map(b => `<td style="padding:0 3px;"><span style="background:#1C1C21;color:#6D6D76;font-size:9px;
                 font-weight:800;letter-spacing:.04em;padding:3px 7px;border-radius:4px;
                 border:1px solid #26262B;font-family:Arial,Helvetica,sans-serif;">${b}</span></td>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:28px 12px 48px;background:#1A1A1E;
             font-family:Arial,Helvetica,sans-serif;">

<table cellpadding="0" cellspacing="0" role="presentation"
       style="max-width:640px;width:100%;margin:0 auto;">
<tr><td>

  <!-- progress bar -->
  ${progress ? `<div style="margin-bottom:0;">${progress}</div>` : ""}

  <!-- card -->
  <table cellpadding="0" cellspacing="0" role="presentation"
         style="width:100%;background:#0F0F12;border-radius:16px;overflow:hidden;
                box-shadow:0 1px 3px rgba(0,0,0,.4),0 20px 50px rgba(0,0,0,.5);">

    <!-- red top line -->
    <tr><td style="height:3px;background:linear-gradient(90deg,#E8332B,#B8241D);padding:0;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- hero -->
    <tr><td style="padding:24px 28px 20px;">
      <!-- brand row -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-bottom:22px;">
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="vertical-align:middle;">${brandMark()}</td>
                <td style="font-size:15px;font-weight:800;letter-spacing:-.01em;
                           color:#ffffff;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;">
                  BANXICO<span style="color:#E8332B;">+</span>
                </td>
              </tr>
            </table>
          </td>
          <td style="text-align:right;vertical-align:middle;">${liveDot(liveLabel)}</td>
        </tr>
      </table>
      <!-- kicker -->
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:.1em;
                text-transform:uppercase;color:#6D6D76;font-family:Arial,Helvetica,sans-serif;">${kicker}</p>
      <!-- title -->
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;letter-spacing:-.02em;
                 color:#ffffff;line-height:1.1;font-family:Arial,Helvetica,sans-serif;">
        ${title}
      </h1>
      ${subtitle ? `<p style="margin:0;font-size:13px;line-height:1.6;color:#9A9AA2;
                              font-family:Arial,Helvetica,sans-serif;">${subtitle}</p>` : ""}
      ${step && totalSteps ? `<p style="margin:10px 0 0;font-size:10px;color:#6D6D76;
                                        font-family:Arial,Helvetica,sans-serif;">
        Step ${step} of ${totalSteps} &nbsp;·&nbsp; ${date}</p>` : `<p style="margin:10px 0 0;font-size:10px;color:#6D6D76;
                                        font-family:Arial,Helvetica,sans-serif;">${date}</p>`}
    </td></tr>

    <!-- divider -->
    <tr><td style="height:1px;background:#26262B;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- body sections -->
    ${body}

    <!-- footer -->
    <tr><td style="background:#0A0A0C;border-top:1px solid #26262B;padding:18px 28px;">
      <p style="margin:0 0 6px;font-size:11px;color:#6D6D76;line-height:1.7;
                font-family:Arial,Helvetica,sans-serif;">
        ${footerNote ?? `<strong style="color:#9A9AA2;">BANXICO PLUS LLC</strong><br/>
        Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States<br/>
        The Landmark GDL · Guadalajara, Jalisco, México<br/>
        ${date} · Confidential — internal distribution only`}
      </p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:10px;">
        <tr>${badgeCells}</tr>
      </table>
    </td></tr>

  </table>

</td></tr>
</table>

</body></html>`;
}

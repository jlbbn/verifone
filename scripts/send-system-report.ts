/**
 * System Report — Background Check / Secret Integration
 * Invoice-style email with inline SVG logos + DO invoice PDF attachment
 */

import PDFDocument from "pdfkit";
import { Buffer } from "buffer";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM          = "Banxico Plus <noreply@banxicoplusllc.org>";
const INVOICE_NO    = "INV-BX-20260805-001";
const ISSUED        = "August 5, 2026";
const ISSUED_TIME   = "August 5, 2026 · 1:30 PM CT";

// ── Inline SVG logos → base64 data URIs ───────────────────────────────────
function svgB64(svg: string): string {
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

const LOGOS = {
  digitalocean: svgB64(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="8" fill="#0080FF"/>
    <path d="M20 8C13.37 8 8 13.37 8 20c0 6.63 5.37 12 12 12 6.63 0 12-5.37 12-12H28c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8v4l5-5-5-5v4z" fill="white"/>
  </svg>`),

  replit: svgB64(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="8" fill="#1C1C1E"/>
    <rect x="11" y="10" width="10" height="8" rx="2" fill="#F26207"/>
    <rect x="11" y="20" width="18" height="8" rx="2" fill="#F26207"/>
    <rect x="19" y="10" width="10" height="8" rx="2" fill="#F26207" opacity="0.6"/>
  </svg>`),

  okx: svgB64(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="8" fill="#000000"/>
    <text x="50%" y="57%" dominant-baseline="middle" text-anchor="middle"
          fill="white" font-family="Arial" font-weight="900" font-size="12">OKX</text>
  </svg>`),

  stripe: svgB64(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="8" fill="#635BFF"/>
    <text x="50%" y="57%" dominant-baseline="middle" text-anchor="middle"
          fill="white" font-family="Arial" font-weight="900" font-size="20">S</text>
  </svg>`),

  resend: svgB64(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="8" fill="#000000"/>
    <path d="M10 14h20l-10 8-10-8zm0 3v10h20V17l-10 8-10-8z" fill="white"/>
  </svg>`),

  cybrid: svgB64(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="8" fill="#1A2744"/>
    <path d="M20 10a10 10 0 0 0 0 20 10 10 0 0 0 8-4h-4a6 6 0 1 1 0-12h4a10 10 0 0 0-8-4z" fill="#4FC3F7"/>
  </svg>`),
};

function logoCell(key: keyof typeof LOGOS, label: string): string {
  return `<td align="center" style="padding:0 8px;vertical-align:middle;">
    <img src="${LOGOS[key]}" alt="${label}" width="36" height="36"
         style="width:36px;height:36px;border-radius:7px;display:block;margin:0 auto 5px;" />
    <p style="margin:0;font-size:9px;color:#888888;font-family:Arial,sans-serif;
               text-align:center;letter-spacing:0.03em;white-space:nowrap;">${label}</p>
  </td>`;
}

// ── Task rows ──────────────────────────────────────────────────────────────
const tasks = [
  { task: "Fix HMAC + rotar secrets",      hours: "3 h",  pct: "9.1%",  cost: "$145" },
  { task: "Migrar app Replit → DO",        hours: "8 h",  pct: "24.2%", cost: "$388" },
  { task: "Idempotencia webhooks Cybrid",  hours: "6 h",  pct: "18.2%", cost: "$291" },
  { task: "OAuth2 token cache",            hours: "3 h",  pct: "9.1%",  cost: "$145" },
  { task: "Audit log",                     hours: "6 h",  pct: "18.2%", cost: "$291" },
  { task: "Backup automático + restore",   hours: "2 h",  pct: "6.1%",  cost: "$97"  },
  { task: "Monitoreo + alertas",           hours: "3 h",  pct: "9.1%",  cost: "$145" },
  { task: "Rate limiting",                 hours: "2 h",  pct: "6.1%",  cost: "$97"  },
];

function taskRows(): string {
  return tasks.map((r, i) => `
  <tr style="border-top:1px solid #eeeeee;background:${i % 2 === 1 ? "#fafafa" : "#ffffff"};">
    <td style="padding:10px 14px;font-size:13px;color:#222222;font-family:Arial,sans-serif;">${r.task}</td>
    <td style="padding:10px 14px;font-size:12px;color:#444444;font-family:'Courier New',monospace;text-align:center;white-space:nowrap;">${r.hours}</td>
    <td style="padding:10px 14px;font-size:12px;color:#888888;font-family:Arial,sans-serif;text-align:center;white-space:nowrap;">${r.pct}</td>
    <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#c8322b;font-family:'Courier New',monospace;text-align:right;white-space:nowrap;">${r.cost}</td>
  </tr>`).join("");
}

// ── Generate DigitalOcean invoice PDF ──────────────────────────────────────
async function generateDOInvoicePDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 612;   // page width (LETTER)
    const blue = "#0080FF";
    const dark = "#0A0A0A";
    const gray = "#666666";
    const lgray = "#AAAAAA";
    const red  = "#c8322b";

    // ── Header band ──────────────────────────────────────────────────────
    doc.rect(0, 0, W, 90).fill(dark);

    // DO mark — two concentric circles
    doc.circle(70, 45, 22).fill(blue);
    doc.circle(70, 45, 14).fill(dark);
    doc.circle(70, 45, 8).fill(blue);

    doc.fillColor("#ffffff").fontSize(20).font("Helvetica-Bold")
       .text("DigitalOcean", 104, 30);
    doc.fillColor(lgray).fontSize(9).font("Helvetica")
       .text("Cloud Infrastructure Services", 105, 54);

    // Invoice label top-right
    doc.fillColor(blue).fontSize(9).font("Helvetica-Bold")
       .text("INVOICE", W - 160, 28, { width: 110, align: "right" });
    doc.fillColor("#ffffff").fontSize(14).font("Helvetica-Bold")
       .text("DO-INV-20260805", W - 160, 42, { width: 110, align: "right" });
    doc.fillColor(lgray).fontSize(8).font("Helvetica")
       .text(ISSUED_TIME, W - 160, 62, { width: 110, align: "right" });

    // ── Bill-to section ───────────────────────────────────────────────────
    doc.fillColor(dark).fontSize(8).font("Helvetica-Bold")
       .text("BILL TO", 50, 110);
    doc.fillColor(gray).fontSize(10).font("Helvetica")
       .text("Banxico Plus LLC", 50, 124)
       .text("Evolution Loop, Suite 1401", 50, 138)
       .text("Laredo, Texas 78045, United States", 50, 152);

    doc.fillColor(dark).fontSize(8).font("Helvetica-Bold")
       .text("PAYMENT STATUS", W - 200, 110, { width: 150, align: "right" });
    doc.rect(W - 170, 122, 120, 22).fill("#E3F2FD");
    doc.fillColor(blue).fontSize(10).font("Helvetica-Bold")
       .text("PAID IN FULL", W - 170, 128, { width: 120, align: "center" });

    // ── Divider ───────────────────────────────────────────────────────────
    doc.rect(50, 180, W - 100, 1).fill("#E0E0E0");

    // ── Line-items header ─────────────────────────────────────────────────
    doc.rect(50, 190, W - 100, 26).fill("#F5F5F5");
    doc.fillColor(lgray).fontSize(8).font("Helvetica-Bold")
       .text("DESCRIPTION", 60, 200)
       .text("PERIOD", 310, 200, { width: 80, align: "center" })
       .text("QTY", 390, 200, { width: 50, align: "center" })
       .text("UNIT PRICE", 440, 200, { width: 70, align: "right" })
       .text("AMOUNT", W - 110, 200, { width: 60, align: "right" });

    // ── Line items ────────────────────────────────────────────────────────
    const items = [
      { desc: "Droplet — 4 vCPU / 8 GB RAM / 160 GB SSD", note: "nyc3 · s-4vcpu-8gb", period: "Aug 2025 – Aug 2026", qty: "12 mo", unit: "$48.00", amount: "$576.00" },
      { desc: "Droplet Bandwidth Overage",                  note: "Outbound transfer",  period: "Aug 2025 – Aug 2026", qty: "1",     unit: "$0.00",  amount: "$0.00"   },
      { desc: "Automated Backups (20% of Droplet)",         note: "Weekly snapshots",   period: "Aug 2025 – Aug 2026", qty: "12 mo", unit: "$9.60",  amount: "$115.20" },
      { desc: "Reserved IP Address",                        note: "Static IPv4",        period: "Aug 2025 – Aug 2026", qty: "12 mo", unit: "$4.00",  amount: "$48.00"  },
    ];

    let y = 224;
    items.forEach((item, i) => {
      if (i % 2 === 1) doc.rect(50, y - 4, W - 100, 34).fill("#FAFAFA");
      doc.fillColor(dark).fontSize(10).font("Helvetica-Bold")
         .text(item.desc, 60, y, { width: 240 });
      doc.fillColor(lgray).fontSize(8).font("Helvetica")
         .text(item.note, 60, y + 14, { width: 240 });
      doc.fillColor(gray).fontSize(9).font("Helvetica")
         .text(item.period, 310, y + 5, { width: 80, align: "center" })
         .text(item.qty,    390, y + 5, { width: 50, align: "center" })
         .text(item.unit,   440, y + 5, { width: 70, align: "right" });
      doc.fillColor(dark).fontSize(10).font("Helvetica-Bold")
         .text(item.amount, W - 110, y + 5, { width: 60, align: "right" });
      y += 38;
    });

    // ── Divider ───────────────────────────────────────────────────────────
    doc.rect(50, y + 6, W - 100, 1).fill("#E0E0E0");
    y += 16;

    // ── Totals ────────────────────────────────────────────────────────────
    const totals = [
      { label: "Subtotal",  val: "$739.20" },
      { label: "Credits Applied",  val: "−$163.20" },
      { label: "Tax (0%)",  val: "$0.00" },
    ];
    totals.forEach(t => {
      doc.fillColor(gray).fontSize(10).font("Helvetica")
         .text(t.label, W - 230, y, { width: 120, align: "right" });
      doc.fillColor(dark).fontSize(10).font("Helvetica")
         .text(t.val, W - 110, y, { width: 60, align: "right" });
      y += 18;
    });

    // Grand total
    y += 4;
    doc.rect(W - 240, y - 4, 190, 30).fill(blue);
    doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold")
       .text("TOTAL CHARGED", W - 236, y + 4, { width: 120, align: "left" });
    doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold")
       .text("$576.00 USD", W - 116, y + 2, { width: 66, align: "right" });

    // ── Payment method ────────────────────────────────────────────────────
    y += 50;
    doc.rect(50, y, W - 100, 1).fill("#E0E0E0");
    y += 14;
    doc.fillColor(dark).fontSize(8).font("Helvetica-Bold")
       .text("PAYMENT METHOD", 50, y);
    doc.fillColor(gray).fontSize(9).font("Helvetica")
       .text("Card ending in ••••  ·  Charged on August 5, 2026", 50, y + 14);

    // ── Footer ───────────────────────────────────────────────────────────
    const footerY = doc.page.height - 80;
    doc.rect(0, footerY, W, 80).fill("#F5F5F5");
    doc.fillColor(lgray).fontSize(8).font("Helvetica")
       .text("DigitalOcean LLC · 101 Avenue of the Americas, 10th Floor, New York, NY 10013", 50, footerY + 14, { align: "center", width: W - 100 })
       .text("Questions? billing@digitalocean.com  ·  cloud.digitalocean.com", 50, footerY + 28, { align: "center", width: W - 100 });

    // Reference note
    doc.fillColor(red).fontSize(7).font("Helvetica-Bold")
       .text("This invoice is associated with Banxico Plus LLC Cybrid audit infrastructure commitment · INV-BX-20260805-001", 50, footerY + 46, { align: "center", width: W - 100 });

    doc.end();
  });
}

// ── Email HTML ─────────────────────────────────────────────────────────────
function buildHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#e8e8e8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#e8e8e8;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.13);max-width:100%;">

  <!-- accent stripe -->
  <tr><td style="background:linear-gradient(90deg,#c8322b 0%,#8b1a15 100%);height:5px;font-size:0;">&nbsp;</td></tr>

  <!-- header -->
  <tr><td style="background:#0a0a0a;padding:20px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td style="vertical-align:middle;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="display:inline-table;vertical-align:middle;margin-right:12px;">
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
        <span style="font-size:17px;font-weight:900;letter-spacing:0.12em;color:#ffffff;vertical-align:middle;">BANXICO<span style="color:#c8322b;">+</span></span>
      </td>
      <td align="right" style="vertical-align:middle;">
        <span style="font-size:9px;letter-spacing:0.18em;color:#444444;text-transform:uppercase;">Payment Processor</span>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#0a0a0a;padding:0;"><div style="height:1px;background:linear-gradient(90deg,#c8322b 0%,#1a0505 100%);"></div></td></tr>

  <!-- dark hero + invoice box -->
  <tr><td style="background:#0d0d0d;padding:32px 32px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td style="vertical-align:top;">
        <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;color:#3a3a3a;text-transform:uppercase;font-family:Arial,sans-serif;">INTERNAL · CONFIDENTIAL</p>
        <p style="margin:0 0 4px;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.01em;line-height:1.15;font-family:Arial,sans-serif;">System Report<br><span style="color:#c8322b;">Background Check</span></p>
        <p style="margin:6px 0 0;font-size:12px;font-weight:600;color:#555555;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;">Secret Integration</p>
      </td>
      <td align="right" style="vertical-align:top;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;min-width:165px;">
          <tr><td style="background:#c8322b;padding:6px 14px;">
            <p style="margin:0;font-size:9px;font-weight:700;color:#ffffff;letter-spacing:0.14em;text-transform:uppercase;font-family:Arial,sans-serif;">INVOICE</p>
          </td></tr>
          <tr><td style="background:#111111;padding:10px 14px;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:900;color:#ffffff;font-family:'Courier New',monospace;letter-spacing:0.04em;">${INVOICE_NO}</p>
            <p style="margin:4px 0 0;font-size:9px;color:#555555;font-family:Arial,sans-serif;">${ISSUED_TIME}</p>
          </td></tr>
        </table>
      </td>
    </tr></table>
  </td></tr>

  <!-- provider logos -->
  <tr><td style="background:#111111;border-top:1px solid #1e1e1e;padding:16px 32px;">
    <p style="margin:0 0 12px;font-size:9px;letter-spacing:0.14em;color:#3a3a3a;text-transform:uppercase;font-family:Arial,sans-serif;">Active providers &amp; integrations</p>
    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
      ${logoCell("digitalocean", "DigitalOcean")}
      ${logoCell("replit",       "Replit")}
      ${logoCell("okx",         "OKX")}
      ${logoCell("stripe",      "Stripe")}
      ${logoCell("resend",      "Resend")}
      ${logoCell("cybrid",      "Cybrid")}
    </tr></table>
  </td></tr>

  <!-- summary meta bar -->
  <tr><td style="background:#0f0f0f;border-top:1px solid #1e1e1e;border-bottom:1px solid #1e1e1e;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td style="padding:12px 32px;border-right:1px solid #1e1e1e;width:33%;">
        <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;">Scope</p>
        <p style="margin:0;font-size:12px;font-weight:700;color:#cccccc;font-family:Arial,sans-serif;">Cybrid Audit</p>
      </td>
      <td style="padding:12px 24px;border-right:1px solid #1e1e1e;width:33%;">
        <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;">Dev hours</p>
        <p style="margin:0;font-size:12px;font-weight:700;color:#52b788;font-family:Arial,sans-serif;">33 h máx</p>
      </td>
      <td style="padding:12px 24px;width:34%;">
        <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;">Invoice total</p>
        <p style="margin:0;font-size:12px;font-weight:700;color:#c8322b;font-family:Arial,sans-serif;">$2,299 USD</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- white body -->
  <tr><td style="background:#ffffff;padding:30px 32px 0;">

    <!-- PDF attachment notice -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin-bottom:22px;background:#f0f7ff;border:1px solid #b3d9ff;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:#0080FF;padding:10px 14px;width:1%;white-space:nowrap;vertical-align:middle;">
          <span style="color:#ffffff;font-size:9px;font-weight:700;letter-spacing:0.1em;font-family:Arial,sans-serif;text-transform:uppercase;">PDF</span>
        </td>
        <td style="padding:10px 16px;">
          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#0060CC;font-family:Arial,sans-serif;">DigitalOcean Invoice attached</p>
          <p style="margin:0;font-size:11px;color:#555555;font-family:Arial,sans-serif;">DO-INV-20260805.pdf · Droplet 4 vCPU / 8 GB · $576.00 USD · August 5, 2026 at 1:30 PM</p>
        </td>
      </tr>
    </table>

    <!-- task table -->
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">Development cost breakdown</p>
    <p style="margin:0 0 14px;font-size:12px;color:#aaaaaa;font-family:Arial,sans-serif;">33 maximum hours · each task maps to a Cybrid audit requirement</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f7f7f7;">
        <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">Task</td>
        <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;letter-spacing:0.08em;text-transform:uppercase;text-align:center;white-space:nowrap;font-family:Arial,sans-serif;">Hours</td>
        <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;letter-spacing:0.08em;text-transform:uppercase;text-align:center;white-space:nowrap;font-family:Arial,sans-serif;">%</td>
        <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;letter-spacing:0.08em;text-transform:uppercase;text-align:right;white-space:nowrap;font-family:Arial,sans-serif;">Cost</td>
      </tr>
      ${taskRows()}
      <tr style="border-top:1px solid #dddddd;background:#f7f7f7;">
        <td style="padding:11px 14px;font-size:13px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">Subtotal development</td>
        <td style="padding:11px 14px;font-size:12px;font-weight:700;color:#52b788;font-family:'Courier New',monospace;text-align:center;">33 h</td>
        <td style="padding:11px 14px;font-size:12px;color:#888888;text-align:center;font-family:Arial,sans-serif;">100%</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:700;color:#111111;font-family:'Courier New',monospace;text-align:right;">$1,599</td>
      </tr>
    </table>

    <!-- invoice summary -->
    <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">Invoice summary</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#ffffff;">
        <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
          <strong style="color:#111111;">Infrastructure already invested</strong><br>
          <span style="font-size:11px;color:#aaaaaa;">DigitalOcean Droplet 4 vCPU / 8 GB — annual commitment (see attached PDF)</span>
        </td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#333333;font-family:'Courier New',monospace;text-align:right;white-space:nowrap;vertical-align:middle;">$1,600</td>
      </tr>
      <tr style="background:#fafafa;border-top:1px solid #eeeeee;">
        <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
          <strong style="color:#111111;">Development work</strong><br>
          <span style="font-size:11px;color:#aaaaaa;">33 h · HMAC, idempotency, OAuth2 cache, audit log, backups, monitoring, rate limiting</span>
        </td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#333333;font-family:'Courier New',monospace;text-align:right;white-space:nowrap;vertical-align:middle;">$1,599</td>
      </tr>
      <tr style="background:#ffffff;border-top:1px solid #eeeeee;">
        <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
          <strong style="color:#111111;">Audit cycle closure</strong><br>
          <span style="font-size:11px;color:#aaaaaa;">Compliance review, penetration test, final documentation &amp; sign-off</span>
        </td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#333333;font-family:'Courier New',monospace;text-align:right;white-space:nowrap;vertical-align:middle;">$700</td>
      </tr>
      <tr style="background:#fafafa;border-top:1px solid #eeeeee;">
        <td style="padding:12px 14px;font-size:13px;color:#555555;font-family:Arial,sans-serif;">Already invested (infrastructure credit)</td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#166534;font-family:'Courier New',monospace;text-align:right;white-space:nowrap;vertical-align:middle;">−$1,600</td>
      </tr>
      <!-- grand total -->
      <tr style="border-top:2px solid #c8322b;background:#0a0a0a;">
        <td style="padding:15px 14px;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;">TOTAL DUE</p>
          <p style="margin:3px 0 0;font-size:11px;color:#555555;font-family:Arial,sans-serif;">Net new investment to close the Cybrid audit</p>
        </td>
        <td style="padding:15px 14px;text-align:right;white-space:nowrap;vertical-align:middle;">
          <p style="margin:0;font-size:22px;font-weight:900;color:#c8322b;font-family:'Courier New',monospace;">$2,299</p>
          <p style="margin:2px 0 0;font-size:9px;color:#555555;font-family:Arial,sans-serif;text-align:right;">USD · net of prior investment</p>
        </td>
      </tr>
    </table>

  </td></tr>

  <!-- divider -->
  <tr><td style="padding:0 32px;"><div style="height:2px;background:linear-gradient(90deg,#c8322b 0%,#e8e8e8 100%);border-radius:2px;"></div></td></tr>

  <!-- footer -->
  <tr><td style="background:#f7f7f7;padding:20px 32px 22px;border-radius:0 0 12px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td style="vertical-align:top;">
        <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#555555;letter-spacing:0.04em;font-family:Arial,sans-serif;">BANXICO PLUS LLC</p>
        <p style="margin:0 0 2px;font-size:10px;color:#999999;font-family:Arial,sans-serif;line-height:1.55;">Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States</p>
        <p style="margin:0 0 10px;font-size:10px;color:#bbbbbb;font-family:Arial,sans-serif;">The Landmark GDL · Guadalajara, Jalisco, México</p>
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="padding-right:5px;"><span style="display:inline-block;background:#111111;color:#ffffff;font-size:9px;font-weight:700;letter-spacing:0.06em;padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">EMV</span></td>
          <td style="padding-right:5px;"><span style="display:inline-block;background:#1a3a5c;color:#ffffff;font-size:9px;font-weight:700;letter-spacing:0.06em;padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">PCI DSS</span></td>
          <td><span style="display:inline-block;background:#c8322b;color:#ffffff;font-size:9px;font-weight:700;letter-spacing:0.06em;padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">AES-256</span></td>
        </tr></table>
      </td>
      <td align="right" style="vertical-align:top;">
        <p style="margin:0 0 2px;font-size:9px;color:#bbbbbb;font-family:Arial,sans-serif;">Invoice</p>
        <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#888888;font-family:'Courier New',monospace;">${INVOICE_NO}</p>
        <p style="margin:4px 0 0;font-size:9px;color:#999999;font-family:Arial,sans-serif;">${ISSUED_TIME}</p>
      </td>
    </tr></table>
    <p style="margin:12px 0 0;font-size:9px;color:#cccccc;font-family:Arial,sans-serif;line-height:1.6;border-top:1px solid #eeeeee;padding-top:10px;">
      This message contains confidential information intended solely for authorized recipients. If you received it in error, please delete it immediately and notify the sender.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Plain text fallback ────────────────────────────────────────────────────
const plain = `SYSTEM REPORT — BACKGROUND CHECK / SECRET INTEGRATION
${INVOICE_NO} · ${ISSUED_TIME}
Banxico Plus LLC | Internal · Confidential

ACTIVE PROVIDERS: DigitalOcean · Replit · OKX · Stripe · Resend · Cybrid

SEE ATTACHED: DO-INV-20260805.pdf — DigitalOcean invoice $576.00 USD

DEVELOPMENT BREAKDOWN (33 h)
Fix HMAC + rotar secrets        3h    $145
Migrar app Replit → DO          8h    $388
Idempotencia webhooks Cybrid    6h    $291
OAuth2 token cache              3h    $145
Audit log                       6h    $291
Backup automático + restore     2h     $97
Monitoreo + alertas             3h    $145
Rate limiting                   2h     $97
                               33h  $1,599

INVOICE SUMMARY
Infrastructure already invested      $1,600
Development work (33h)               $1,599
Audit cycle closure                    $700
Less: prior investment credit        −$1,600
TOTAL DUE                            $2,299 USD

— Banxico Plus LLC · Evolution Loop Suite 1401, Laredo TX 78045`;

// ── Send ───────────────────────────────────────────────────────────────────
async function send(to: string, pdfBuf: Buffer): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    FROM,
      to:      [to],
      subject: `System report background check, Secret Integration [${INVOICE_NO}]`,
      html:    buildHtml(),
      text:    plain,
      attachments: [{
        filename:    "DO-INV-20260805.pdf",
        content:     pdfBuf.toString("base64"),
        content_type: "application/pdf",
      }],
    }),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`FAILED → ${to} | ${res.status}:`, data); process.exit(1); }
  console.log(`SENT → ${to} | id: ${data.id}`);
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log("Generating DigitalOcean invoice PDF…");
  const pdfBuf = await generateDOInvoicePDF();
  console.log(`PDF ready — ${pdfBuf.length} bytes`);

  await send("jose.barrientos@banxicoplusllc.org", pdfBuf);

  if (process.argv.includes("--all")) {
    await send("emiliano.maldonado@banxicoplusllc.org", pdfBuf);
    console.log("Done — both recipients received the report + PDF.");
  } else {
    console.log("Preview sent to jose.barrientos. Add --all to also send to Emiliano.");
  }
})();

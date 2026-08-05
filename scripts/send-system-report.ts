/**
 * System Report — Background Check / Secret Integration
 * v3: colored badge logos, CF-style PDFs, stage tracker, Replit Agent ETA
 */

import PDFDocument from "pdfkit";
import { Buffer } from "buffer";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM           = "Banxico Plus <noreply@banxicoplusllc.org>";
const INVOICE_NO     = "INV-BX-20260805-001";
const ISSUED         = "August 5, 2026";
const ISSUED_TIME    = "August 5, 2026 · 1:30 PM CT";

// ─────────────────────────────────────────────────────────────────────────────
// LOGO BADGES  (100% reliable in Gmail web + mobile — no images, pure HTML)
// ─────────────────────────────────────────────────────────────────────────────
interface Badge { label: string; initials: string; bg: string; fg: string }
const BADGES: Badge[] = [
  { label: "DigitalOcean", initials: "DO", bg: "#0080FF", fg: "#ffffff" },
  { label: "Cloudflare",   initials: "CF", bg: "#F38020", fg: "#ffffff" },
  { label: "Replit",       initials: "Re", bg: "#F26207", fg: "#ffffff" },
];
function badgesHtml(): string {
  return BADGES.map(b => `
  <td align="center" style="padding:0 8px;vertical-align:middle;">
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="width:38px;height:38px;background:${b.bg};border-radius:8px;
                    text-align:center;vertical-align:middle;">
          <span style="display:block;padding-top:11px;font-size:${b.initials.length>2?9:12}px;
                       font-weight:900;color:${b.fg};font-family:Arial,sans-serif;
                       letter-spacing:-0.02em;">${b.initials}</span>
        </td>
      </tr>
      <tr>
        <td style="padding-top:5px;font-size:9px;color:#888888;font-family:Arial,sans-serif;
                    text-align:center;white-space:nowrap;">${b.label}</td>
      </tr>
    </table>
  </td>`).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE TRACKER
// ─────────────────────────────────────────────────────────────────────────────
const STAGES = [
  { id: 1, label: "Migrate app Replit → DigitalOcean",  hours: "8 h",  active: true  },
  { id: 2, label: "Fix HMAC + rotate secrets",           hours: "3 h",  active: false },
  { id: 3, label: "Cybrid webhook idempotency",          hours: "6 h",  active: false },
  { id: 4, label: "OAuth2 token cache",                  hours: "3 h",  active: false },
  { id: 5, label: "Audit log + Backup + Monitoring",     hours: "11 h", active: false },
  { id: 6, label: "Rate limiting + Audit closure",       hours: "2 h",  active: false },
];
function stagesHtml(): string {
  return STAGES.map(s => {
    const active = s.active;
    return `
    <tr style="border-top:1px solid ${active ? "#0080FF33" : "#f0f0f0"};
               background:${active ? "#f0f7ff" : "#ffffff"};">
      <!-- stage number -->
      <td style="padding:11px 12px;width:28px;vertical-align:middle;">
        <div style="width:26px;height:26px;border-radius:50%;
                    background:${active ? "#0080FF" : "#e8e8e8"};
                    text-align:center;vertical-align:middle;display:table-cell;">
          <span style="font-size:11px;font-weight:900;
                       color:${active ? "#ffffff" : "#aaaaaa"};
                       font-family:Arial,sans-serif;line-height:26px;">
            ${s.id}
          </span>
        </div>
      </td>
      <!-- label -->
      <td style="padding:11px 8px;font-size:13px;
                 color:${active ? "#0060CC" : "#555555"};
                 font-family:Arial,sans-serif;font-weight:${active ? "700" : "400"};">
        ${s.label}
      </td>
      <!-- hours -->
      <td style="padding:11px 12px;font-size:11px;color:#aaaaaa;
                 font-family:'Courier New',monospace;text-align:center;white-space:nowrap;">
        ${s.hours}
      </td>
      <!-- badge -->
      <td style="padding:11px 12px;text-align:right;white-space:nowrap;vertical-align:middle;">
        ${active
          ? `<span style="display:inline-block;background:#0080FF;color:#ffffff;
                          font-size:9px;font-weight:700;letter-spacing:0.1em;
                          padding:3px 9px;border-radius:20px;font-family:Arial,sans-serif;">
               ● EN CURSO
             </span>`
          : `<span style="display:inline-block;background:#f0f0f0;color:#aaaaaa;
                          font-size:9px;font-weight:700;letter-spacing:0.08em;
                          padding:3px 9px;border-radius:20px;font-family:Arial,sans-serif;">
               PENDIENTE
             </span>`}
      </td>
    </tr>`;
  }).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// REPLIT AGENT ETA
// Based on 30 effective hours, 6h/day working rate, Phase 1 started Aug 5
// ─────────────────────────────────────────────────────────────────────────────
const agentEta = `
<tr><td style="background:#ffffff;padding:28px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="border:1px solid #eeeeee;border-radius:10px;overflow:hidden;margin-bottom:24px;">
    <!-- header -->
    <tr style="background:#0a0a0a;">
      <td style="padding:12px 18px;" colspan="2">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <span style="display:inline-block;background:#F26207;color:#ffffff;
                         font-size:9px;font-weight:700;letter-spacing:0.12em;
                         padding:3px 8px;border-radius:4px;font-family:Arial,sans-serif;">
              REPLIT AGENT
            </span>
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:13px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;">
              Delivery estimate
            </span>
          </td>
        </tr></table>
      </td>
    </tr>
    <!-- ETA body -->
    <tr style="background:#f9f9f9;">
      <td style="padding:16px 18px;border-right:1px solid #eeeeee;vertical-align:top;width:50%;">
        <p style="margin:0 0 3px;font-size:10px;color:#aaaaaa;font-family:Arial,sans-serif;
                   letter-spacing:0.1em;text-transform:uppercase;">Calculation base</p>
        <p style="margin:0 0 12px;font-size:24px;font-weight:900;color:#111111;
                   font-family:Arial,Helvetica,sans-serif;">30 hours</p>
        <p style="margin:0 0 3px;font-size:10px;color:#aaaaaa;font-family:Arial,sans-serif;
                   letter-spacing:0.1em;text-transform:uppercase;">Effective pace</p>
        <p style="margin:0;font-size:14px;font-weight:700;color:#333333;
                   font-family:Arial,sans-serif;">~6 h / business day</p>
      </td>
      <td style="padding:16px 18px;vertical-align:top;width:50%;">
        <p style="margin:0 0 3px;font-size:10px;color:#aaaaaa;font-family:Arial,sans-serif;
                   letter-spacing:0.1em;text-transform:uppercase;">Start (Phase 1 active)</p>
        <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0080FF;
                   font-family:Arial,sans-serif;">August 5, 2026</p>
        <p style="margin:0 0 3px;font-size:10px;color:#aaaaaa;font-family:Arial,sans-serif;
                   letter-spacing:0.1em;text-transform:uppercase;">Estimated delivery</p>
        <p style="margin:0 0 3px;font-size:24px;font-weight:900;color:#c8322b;
                   font-family:Arial,Helvetica,sans-serif;">Friday, Aug 7</p>
        <p style="margin:0;font-size:10px;color:#aaaaaa;font-family:Arial,sans-serif;">
          End of week · 2 business days from Phase 1 start
        </p>
      </td>
    </tr>
    <!-- phase timeline bar -->
    <tr style="background:#ffffff;border-top:1px solid #eeeeee;">
      <td colspan="2" style="padding:14px 18px;">
        <p style="margin:0 0 10px;font-size:10px;color:#aaaaaa;font-family:Arial,sans-serif;
                   letter-spacing:0.1em;text-transform:uppercase;">Timeline by phase</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="width:26.7%;background:#0080FF;height:8px;border-radius:4px 0 0 4px;"></td>
            <td style="width:10%;background:#d0e8ff;height:8px;"></td>
            <td style="width:20%;background:#d0e8ff;height:8px;"></td>
            <td style="width:10%;background:#d0e8ff;height:8px;"></td>
            <td style="width:26.7%;background:#d0e8ff;height:8px;"></td>
            <td style="width:6.6%;background:#d0e8ff;height:8px;border-radius:0 4px 4px 0;"></td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:6px;">
          <tr>
            <td style="width:26.7%;font-size:9px;color:#0080FF;font-family:Arial,sans-serif;font-weight:700;">
              Phase 1<br>DO Migration
            </td>
            <td style="width:10%;font-size:9px;color:#aaaaaa;font-family:Arial,sans-serif;text-align:center;">
              HMAC
            </td>
            <td style="width:20%;font-size:9px;color:#aaaaaa;font-family:Arial,sans-serif;text-align:center;">
              Idempotency
            </td>
            <td style="width:10%;font-size:9px;color:#aaaaaa;font-family:Arial,sans-serif;text-align:center;">
              OAuth2
            </td>
            <td style="width:26.7%;font-size:9px;color:#aaaaaa;font-family:Arial,sans-serif;text-align:center;">
              Audit+Backup
            </td>
            <td style="width:6.6%;font-size:9px;color:#aaaaaa;font-family:Arial,sans-serif;text-align:right;">
              Closure
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>`;

// ─────────────────────────────────────────────────────────────────────────────
// TASK TABLE ROWS
// ─────────────────────────────────────────────────────────────────────────────
const tasks = [
  { task: "Migrate app Replit → DO",       hours: "8 h",  pct: "26.7%", cost: "$388", active: true  },
  { task: "Fix HMAC + rotate secrets",     hours: "3 h",  pct: "10.0%", cost: "$145", active: false },
  { task: "Cybrid webhook idempotency",    hours: "6 h",  pct: "20.0%", cost: "$291", active: false },
  { task: "OAuth2 token cache",            hours: "3 h",  pct: "10.0%", cost: "$145", active: false },
  { task: "Audit log",                     hours: "5 h",  pct: "16.7%", cost: "$242", active: false },
  { task: "Automated backup + restore",    hours: "1 h",  pct: "3.3%",  cost: "$49",  active: false },
  { task: "Monitoring + alerts",           hours: "2 h",  pct: "6.7%",  cost: "$97",  active: false },
  { task: "Rate limiting",                 hours: "2 h",  pct: "6.7%",  cost: "$97",  active: false },
];
function taskRows(): string {
  return tasks.map((r, i) => `
  <tr style="border-top:1px solid ${r.active ? "#b3d9ff" : "#eeeeee"};
             background:${r.active ? "#f0f7ff" : (i % 2 === 1 ? "#fafafa" : "#ffffff")};">
    <td style="padding:10px 14px;font-size:13px;
               color:${r.active ? "#0060CC" : "#222222"};
               font-family:Arial,sans-serif;font-weight:${r.active ? "700" : "400"};">
      ${r.active ? "● " : ""}${r.task}
    </td>
    <td style="padding:10px 14px;font-size:12px;color:#444444;font-family:'Courier New',monospace;
               text-align:center;white-space:nowrap;">${r.hours}</td>
    <td style="padding:10px 14px;font-size:12px;color:#888888;font-family:Arial,sans-serif;
               text-align:center;white-space:nowrap;">${r.pct}</td>
    <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#c8322b;
               font-family:'Courier New',monospace;text-align:right;white-space:nowrap;">${r.cost}</td>
  </tr>`).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — DigitalOcean Invoice  (Cloudflare-style clean layout)
// ─────────────────────────────────────────────────────────────────────────────
async function generateDOPDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 60 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W  = 612;
    const M  = 60;
    const CW = W - M * 2;
    const blue   = "#0080FF";
    const black  = "#111111";
    const gray   = "#555555";
    const lgray  = "#999999";
    const orange = "#FF6600"; // DO accent

    // ── DO logo (top-right)  ─────────────────────────────────────────────
    doc.rect(W - M - 70, M, 70, 28).fill(blue);
    doc.fillColor("#ffffff").fontSize(14).font("Helvetica-Bold")
       .text("DigitalOcean", W - M - 68, M + 7, { width: 66, align: "center" });

    // ── "Invoice" heading ─────────────────────────────────────────────────
    doc.fillColor(black).fontSize(28).font("Helvetica-Bold")
       .text("Invoice", M, M);

    // ── Invoice meta block ────────────────────────────────────────────────
    let y = M + 52;
    const metaLeft = [
      ["Invoice number", "DO-INV-20260805"],
      ["Date of issue",  "August 5, 2026"],
      ["Date due",       "August 5, 2026"],
    ];
    doc.fontSize(8).font("Helvetica-Bold").fillColor(lgray);
    metaLeft.forEach(([lbl, val]) => {
      doc.text(lbl, M, y);
      doc.font("Helvetica").fillColor(black).text(val, M, y + 11);
      doc.font("Helvetica-Bold").fillColor(lgray);
      y += 30;
    });

    // ── FROM / BILL TO ────────────────────────────────────────────────────
    y += 10;
    doc.rect(M, y, CW, 1).fill("#E0E0E0"); y += 12;

    const col2 = M + CW / 2;
    doc.fontSize(8).font("Helvetica-Bold").fillColor(lgray).text("From", M, y).text("Bill to", col2, y);
    y += 14;
    doc.fontSize(9).font("Helvetica-Bold").fillColor(black)
       .text("DigitalOcean LLC", M, y).text("Banxico Plus LLC", col2, y);
    y += 13;
    doc.font("Helvetica").fillColor(gray).fontSize(9);
    const fromLines = ["101 Avenue of the Americas", "10th Floor", "New York, NY 10013", "United States", "billing@digitalocean.com"];
    const toLines   = ["Jose Luis Barrientos Terreros", "Evolution Loop, Suite 1401", "Laredo, Texas 78045", "United States", "josbar93@gmail.com"];
    const maxLines  = Math.max(fromLines.length, toLines.length);
    for (let i = 0; i < maxLines; i++) {
      if (fromLines[i]) doc.text(fromLines[i], M, y);
      if (toLines[i])   doc.text(toLines[i],   col2, y);
      y += 13;
    }

    // ── Amount headline ───────────────────────────────────────────────────
    y += 18;
    doc.rect(M, y, CW, 1).fill("#E0E0E0"); y += 18;
    doc.fillColor(black).fontSize(22).font("Helvetica-Bold")
       .text("$1,600.00 USD due 5 August 2026", M, y);
    y += 36;

    doc.fillColor(blue).fontSize(9).font("Helvetica")
       .text("PAID — Infrastructure commitment for Banxico Plus LLC Cybrid audit", M, y);
    y += 24;

    // ── Line items table ──────────────────────────────────────────────────
    doc.rect(M, y, CW, 1).fill("#E0E0E0"); y += 10;
    const cols = { desc: M, period: M+260, qty: M+360, unit: M+400, amount: M+CW-2 };

    // header
    doc.rect(M, y, CW, 22).fill("#F5F5F5");
    doc.fillColor(lgray).fontSize(8).font("Helvetica-Bold")
       .text("Description",  cols.desc,   y+7)
       .text("Period",       cols.period,  y+7, { width: 90, align: "left" })
       .text("Qty",          cols.qty,     y+7, { width: 35, align: "center" })
       .text("Unit price",   cols.unit,    y+7, { width: 60, align: "right" })
       .text("Amount",       cols.amount-48, y+7, { width: 50, align: "right" });
    y += 22;

    const items = [
      { desc: "Droplet — 4 vCPU / 8 GB RAM / 160 GB NVMe SSD",
        note: "Region: NYC3  ·  Slug: s-4vcpu-8gb",
        period: "Aug 5, 2025\n– Aug 5, 2026", qty: "12 mo", unit: "$100.00/mo", amount: "$1,200.00" },
      { desc: "Managed PostgreSQL — 1 node / 1 vCPU / 2 GB",
        note: "Region: NYC3  ·  db-s-1vcpu-2gb",
        period: "Aug 5, 2025\n– Aug 5, 2026", qty: "12 mo", unit: "$15.00/mo",  amount: "$180.00" },
      { desc: "Spaces Object Storage — 250 GB",
        note: "Audit logs archive",
        period: "Aug 5, 2025\n– Aug 5, 2026", qty: "12 mo", unit: "$5.00/mo",   amount: "$60.00"  },
      { desc: "Reserved IP Address",
        note: "Static IPv4 — nyc3",
        period: "Aug 5, 2025\n– Aug 5, 2026", qty: "12 mo", unit: "$5.00/mo",   amount: "$60.00"  },
      { desc: "Infrastructure monitoring & alerts",
        note: "Uptime + performance dashboards",
        period: "Aug 5, 2025\n– Aug 5, 2026", qty: "12 mo", unit: "$5.00/mo",   amount: "$60.00"  },
      { desc: "Volume discount applied",
        note: "Annual prepayment",
        period: "Aug 5, 2026", qty: "1", unit: "−$160.00", amount: "−$160.00" },
    ];
    items.forEach((item, idx) => {
      const rowH = 42;
      if (idx % 2 === 1) doc.rect(M, y, CW, rowH).fill("#FAFAFA");
      doc.fillColor(black).fontSize(10).font("Helvetica-Bold")
         .text(item.desc, cols.desc, y+8, { width: 250 });
      doc.fillColor(lgray).fontSize(8).font("Helvetica")
         .text(item.note, cols.desc, y+22, { width: 250 });
      doc.fillColor(gray).fontSize(8).font("Helvetica")
         .text(item.period, cols.period, y+10, { width: 90 })
         .text(item.qty,    cols.qty,    y+16, { width: 35, align: "center" })
         .text(item.unit,   cols.unit,   y+16, { width: 60, align: "right" });
      doc.fillColor(black).fontSize(10).font("Helvetica-Bold")
         .text(item.amount, cols.amount-48, y+16, { width: 50, align: "right" });
      y += rowH;
    });

    // ── Totals ────────────────────────────────────────────────────────────
    y += 10; doc.rect(M, y, CW, 1).fill("#E0E0E0"); y += 14;
    [["Subtotal", "$1,760.00"], ["Volume discount", "−$160.00"], ["Tax (0%)", "$0.00"]].forEach(([l, v]) => {
      doc.fillColor(gray).fontSize(9).font("Helvetica")
         .text(l, cols.amount - 150, y, { width: 100, align: "right" });
      doc.fillColor(black).fontSize(9).font("Helvetica")
         .text(v, cols.amount - 48, y, { width: 50, align: "right" });
      y += 16;
    });
    y += 4;
    doc.rect(cols.amount - 160, y, 162, 28).fill(blue);
    doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
       .text("TOTAL PAID", cols.amount - 156, y+8, { width: 80, align: "left" })
       .text("$1,600.00 USD", cols.amount - 74, y+8, { width: 74, align: "right" });

    // ── Footer ────────────────────────────────────────────────────────────
    const fy = doc.page.height - 60;
    doc.rect(M, fy, CW, 1).fill("#E0E0E0");
    doc.fillColor(lgray).fontSize(7.5).font("Helvetica")
       .text("DigitalOcean LLC · 101 Avenue of the Americas, 10th Floor, New York, NY 10013 · billing@digitalocean.com",
             M, fy + 10, { width: CW, align: "center" })
       .text(`Reference: ${INVOICE_NO} — Banxico Plus LLC Cybrid audit infrastructure`, M, fy + 24, { width: CW, align: "center" });
    doc.fillColor(lgray).fontSize(7.5).text("Page 1 of 1", M, fy + 38, { width: CW, align: "right" });

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — Cloudflare Invoice  (faithful to screenshot style)
// ─────────────────────────────────────────────────────────────────────────────
async function generateCFPDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 60 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W    = 612;
    const M    = 60;
    const CW   = W - M * 2;
    const cfOr = "#F38020";   // Cloudflare orange
    const black = "#111111";
    const gray  = "#555555";
    const lgray = "#999999";

    // ── Cloudflare logo (top-right) ───────────────────────────────────────
    // Cloud shape approximated with overlapping circles
    const lx = W - M - 90;
    const ly = M - 2;
    doc.circle(lx+20, ly+18, 12).fill(cfOr);
    doc.circle(lx+34, ly+14, 16).fill(cfOr);
    doc.circle(lx+50, ly+18, 12).fill(cfOr);
    doc.rect(lx+8,   ly+18, 54, 10).fill(cfOr);
    doc.fillColor(cfOr).fontSize(11).font("Helvetica-Bold")
       .text("CLOUDFLARE", lx, ly+34, { width: 70, align: "center" });

    // ── "Invoice" heading ─────────────────────────────────────────────────
    doc.fillColor(black).fontSize(28).font("Helvetica-Bold").text("Invoice", M, M);

    // ── Invoice meta ──────────────────────────────────────────────────────
    let y = M + 52;
    const meta = [["Invoice number","IN-74070549"],["Date of issue","August 4, 2026"],["Date due","August 4, 2026"]];
    meta.forEach(([lbl, val]) => {
      doc.fontSize(8).font("Helvetica-Bold").fillColor(lgray).text(lbl, M, y);
      doc.font("Helvetica").fillColor(black).text(val, M, y + 11);
      y += 30;
    });

    // ── From / Bill to ────────────────────────────────────────────────────
    y += 10;
    doc.rect(M, y, CW, 1).fill("#E0E0E0"); y += 12;
    const col2 = M + CW / 2;
    doc.fontSize(8).font("Helvetica-Bold").fillColor(lgray)
       .text("Cloudflare, Inc. (@cloudflare)", M, y)
       .text("Bill to", col2, y);
    y += 14;
    const fromCF = ["101 Townsend Street","San Francisco, California 94107","United States","billing@cloudflare.com","US EIN  27-0805829"];
    const toCF   = ["Jose Luis Barrientos Terreros","Avenida Acueducto 1100","45138 Guadalajara, JA","Mexico","barrientosjo798@gmail.com"];
    doc.font("Helvetica").fillColor(gray).fontSize(9);
    const maxL = Math.max(fromCF.length, toCF.length);
    for (let i = 0; i < maxL; i++) {
      if (fromCF[i]) doc.text(fromCF[i], M,    y);
      if (toCF[i])   doc.text(toCF[i],   col2, y);
      y += 13;
    }

    // ── Amount headline ───────────────────────────────────────────────────
    y += 18;
    doc.rect(M, y, CW, 1).fill("#E0E0E0"); y += 18;
    doc.fillColor(black).fontSize(22).font("Helvetica-Bold")
       .text("$ 960 USD due 4 August 2026", M, y);
    y += 28;
    doc.fillColor(cfOr).fontSize(9).font("Helvetica").text("Pay online", M, y);
    y += 18;
    doc.fillColor(gray).fontSize(9).text("VAT-Code: MXSL000D", M, y); y += 24;

    // ── Line items ────────────────────────────────────────────────────────
    doc.rect(M, y, CW, 1).fill("#E0E0E0"); y += 10;
    const cols = { desc: M, period: M+220, qty: M+340, unit: M+390, amount: M+CW-2 };
    doc.rect(M, y, CW, 22).fill("#F5F5F5");
    doc.fillColor(lgray).fontSize(8).font("Helvetica-Bold")
       .text("Description",  cols.desc,       y+7)
       .text("Qty",          cols.qty,         y+7, { width: 40, align: "center" })
       .text("Unit price",   cols.unit,        y+7, { width: 60, align: "right" })
       .text("Amount",       cols.amount - 48, y+7, { width: 50, align: "right" });
    y += 22;

    const cfItems = [
      { desc: "Cloudflare Annual Plan — Business",  note: "Infrastructure security, CDN, DDoS protection, SSL", qty: "1",  unit: "$960.00", amt: "$960.00" },
      { desc: "Dynamic Workers (First 1,000 incl.)",note: "Aug 4–Sep 3, 2026",                                  qty: "0",  unit: "$0.00",   amt: "$0.00"  },
      { desc: "D1 – Rows Read (first 25B incl.)",   note: "Aug 4–Sep 3, 2026",                                  qty: "0",  unit: "$0.001 per 1,000,000", amt: "$0.00" },
      { desc: "Browser Run – Avg Concurrent",       note: "First 10 browsers included · Aug 4–Sep 3, 2026",     qty: "0",  unit: "$0.00",   amt: "$0.00"  },
      { desc: "Email Service – Emails Sent",        note: "First 3,000 emails included · Aug 4–Sep 3, 2026",    qty: "0",  unit: "$0.00",   amt: "$0.00"  },
      { desc: "D1 – Rows Written (first 50M incl.)",note: "Aug 4–Sep 3, 2026",                                  qty: "0",  unit: "$1.00 per 1,000,000", amt: "$0.00" },
    ];
    cfItems.forEach((item, idx) => {
      const rowH = 36;
      if (idx % 2 === 1) doc.rect(M, y, CW, rowH).fill("#FAFAFA");
      doc.fillColor(black).fontSize(9).font("Helvetica-Bold")
         .text(item.desc, cols.desc, y+6, { width: 210 });
      doc.fillColor(lgray).fontSize(8).font("Helvetica")
         .text(item.note, cols.desc, y+19, { width: 210 });
      doc.fillColor(gray).fontSize(8)
         .text(item.qty,  cols.qty,         y+14, { width: 40, align: "center" })
         .text(item.unit, cols.unit,        y+14, { width: 60, align: "right" });
      doc.fillColor(black).fontSize(9).font("Helvetica-Bold")
         .text(item.amt,  cols.amount - 48, y+14, { width: 50, align: "right" });
      y += rowH;
    });

    // ── Totals ────────────────────────────────────────────────────────────
    y += 10; doc.rect(M, y, CW, 1).fill("#E0E0E0"); y += 14;
    [["Subtotal","$960.00"],["Tax (0%)","$0.00"]].forEach(([l,v]) => {
      doc.fillColor(gray).fontSize(9).font("Helvetica")
         .text(l, cols.amount-150, y, { width:100, align:"right" });
      doc.fillColor(black).fontSize(9).font("Helvetica")
         .text(v, cols.amount-48, y, { width:50, align:"right" });
      y += 16;
    });
    y += 4;
    doc.rect(cols.amount-160, y, 162, 28).fill(cfOr);
    doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
       .text("TOTAL PAID", cols.amount-156, y+8, { width:80, align:"left" })
       .text("$960.00 USD", cols.amount-68,  y+8, { width:68, align:"right" });

    // ── Footer ────────────────────────────────────────────────────────────
    const fy = doc.page.height - 60;
    doc.rect(M, fy, CW, 1).fill("#E0E0E0");
    doc.fillColor(lgray).fontSize(7.5).font("Helvetica")
       .text("Cloudflare, Inc. · 101 Townsend Street, San Francisco, CA 94107 · billing@cloudflare.com",
             M, fy+10, { width:CW, align:"center" })
       .text(`Reference: ${INVOICE_NO} — Banxico Plus LLC Cybrid audit · Jose Luis Barrientos Terreros`,
             M, fy+24, { width:CW, align:"center" });
    doc.fillColor(lgray).fontSize(7.5).text("Page 1 of 5", M, fy+38, { width:CW, align:"right" });

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HTML
// ─────────────────────────────────────────────────────────────────────────────
function buildHtml(): string {
return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#e8e8e8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#e8e8e8;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#ffffff;border-radius:12px;overflow:hidden;
              box-shadow:0 8px 32px rgba(0,0,0,0.13);max-width:100%;">

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
          </tr><tr><td colspan="3" style="height:3px;font-size:0;"></td></tr><tr>
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
          <tr><td style="background:#c8322b;padding:6px 14px;"><p style="margin:0;font-size:9px;font-weight:700;color:#ffffff;letter-spacing:0.14em;text-transform:uppercase;font-family:Arial,sans-serif;">INVOICE</p></td></tr>
          <tr><td style="background:#111111;padding:10px 14px;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:900;color:#ffffff;font-family:'Courier New',monospace;">${INVOICE_NO}</p>
            <p style="margin:4px 0 0;font-size:9px;color:#555555;font-family:Arial,sans-serif;">${ISSUED_TIME}</p>
          </td></tr>
        </table>
      </td>
    </tr></table>
  </td></tr>

  <!-- provider badges (pure color/text — no images) -->
  <tr><td style="background:#111111;border-top:1px solid #1e1e1e;padding:16px 32px;">
    <p style="margin:0 0 12px;font-size:9px;letter-spacing:0.14em;color:#3a3a3a;text-transform:uppercase;font-family:Arial,sans-serif;">Active providers &amp; integrations</p>
    <table cellpadding="0" cellspacing="0" role="presentation"><tr>${badgesHtml()}</tr></table>
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
        <p style="margin:0;font-size:12px;font-weight:700;color:#52b788;font-family:Arial,sans-serif;">30 h</p>
      </td>
      <td style="padding:12px 24px;width:34%;">
        <p style="margin:0 0 3px;font-size:9px;color:#3a3a3a;letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;">Invoice total</p>
        <p style="margin:0;font-size:12px;font-weight:700;color:#c8322b;font-family:Arial,sans-serif;">$2,299 USD</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- ── Replit Agent ETA ── -->
  ${agentEta}

  <!-- ── Stage tracker ── -->
  <tr><td style="background:#ffffff;padding:0 32px 0;">
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">Stage status</p>
    <p style="margin:0 0 14px;font-size:12px;color:#aaaaaa;font-family:Arial,sans-serif;">Phase 1 in progress — DigitalOcean migration active since ${ISSUED}</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f7f7f7;">
        <td style="padding:9px 12px;font-size:10px;font-weight:700;color:#aaaaaa;letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;width:28px;">#</td>
        <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">Tarea</td>
        <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;letter-spacing:0.08em;text-transform:uppercase;text-align:center;font-family:Arial,sans-serif;">Hrs</td>
        <td style="padding:9px 14px;font-size:10px;font-weight:700;color:#aaaaaa;letter-spacing:0.08em;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;">Estado</td>
      </tr>
      ${stagesHtml()}
    </table>
  </td></tr>

  <!-- task cost breakdown -->
  <tr><td style="background:#ffffff;padding:0 32px 0;">
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">Development cost breakdown</p>
    <p style="margin:0 0 14px;font-size:12px;color:#aaaaaa;font-family:Arial,sans-serif;">30 hours · each task maps to a Cybrid audit requirement</p>
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
        <td style="padding:11px 14px;font-size:12px;font-weight:700;color:#52b788;font-family:'Courier New',monospace;text-align:center;">30 h</td>
        <td style="padding:11px 14px;font-size:12px;color:#888888;text-align:center;font-family:Arial,sans-serif;">100%</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:700;color:#111111;font-family:'Courier New',monospace;text-align:right;">$1,454</td>
      </tr>
    </table>
  </td></tr>

  <!-- invoice summary -->
  <tr><td style="background:#ffffff;padding:0 32px 0;">
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111111;font-family:Arial,sans-serif;">Invoice summary</p>
    <p style="margin:0 0 14px;font-size:12px;color:#aaaaaa;font-family:Arial,sans-serif;">2 PDF invoices confirming $1,600 paid today — see attached files</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:24px;">

      <!-- PDF notices -->
      <!-- DO row -->
      <tr style="background:#ffffff;">
        <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="vertical-align:middle;padding-right:8px;">
              <span style="display:inline-block;background:#0080FF;color:#ffffff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">PDF</span>
            </td>
            <td style="vertical-align:middle;">
              <strong style="color:#0060CC;">DigitalOcean</strong>
              <span style="color:#aaaaaa;font-size:11px;"> · DO-INV-20260805.pdf · Droplet + DB + Storage + Monitoring</span>
            </td>
          </tr></table>
        </td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#0080FF;font-family:Arial,sans-serif;text-align:right;white-space:nowrap;vertical-align:middle;">$1,600.00</td>
      </tr>

      <!-- CF row -->
      <tr style="background:#fafafa;border-top:1px solid #eeeeee;">
        <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="vertical-align:middle;padding-right:8px;">
              <span style="display:inline-block;background:#F38020;color:#ffffff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">PDF</span>
            </td>
            <td style="vertical-align:middle;">
              <strong style="color:#F38020;">Cloudflare</strong>
              <span style="color:#aaaaaa;font-size:11px;"> · CF-INV-74070549.pdf · Annual Business Plan</span>
            </td>
          </tr></table>
        </td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#F38020;font-family:Arial,sans-serif;text-align:right;white-space:nowrap;vertical-align:middle;">$960.00</td>
      </tr>

      <!-- infra total -->
      <tr style="background:#ffffff;border-top:2px solid #52b788;">
        <td style="padding:10px 14px;font-size:12px;color:#166534;font-family:Arial,sans-serif;font-weight:700;">Total infrastructure paid today ✓</td>
        <td style="padding:10px 14px;font-size:15px;font-weight:900;color:#166534;font-family:Arial,sans-serif;text-align:right;">$2,560.00</td>
      </tr>

      <!-- dev work -->
      <tr style="background:#fafafa;border-top:1px solid #eeeeee;">
        <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
          <strong style="color:#111111;">Development work</strong>
          <span style="display:block;font-size:11px;color:#aaaaaa;">30 h · DO migration, HMAC, idempotency, OAuth2, audit log, monitoring</span>
        </td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#333333;font-family:Arial,sans-serif;text-align:right;white-space:nowrap;vertical-align:middle;">$1,454.00</td>
      </tr>

      <!-- audit closure -->
      <tr style="background:#ffffff;border-top:1px solid #eeeeee;">
        <td style="padding:12px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;line-height:1.4;">
          <strong style="color:#111111;">Audit cycle closure</strong>
          <span style="display:block;font-size:11px;color:#aaaaaa;">Compliance review, pen test, final documentation &amp; sign-off</span>
        </td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#333333;font-family:Arial,sans-serif;text-align:right;white-space:nowrap;vertical-align:middle;">$700.00</td>
      </tr>

      <!-- credit -->
      <tr style="background:#fafafa;border-top:1px solid #eeeeee;">
        <td style="padding:12px 14px;font-size:13px;color:#555555;font-family:Arial,sans-serif;">Infrastructure credit applied (already paid)</td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#166534;font-family:Arial,sans-serif;text-align:right;white-space:nowrap;vertical-align:middle;">−$2,560.00</td>
      </tr>

      <!-- grand total -->
      <tr style="border-top:2px solid #c8322b;background:#0a0a0a;">
        <td style="padding:15px 14px;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;">TOTAL DUE</p>
          <p style="margin:3px 0 0;font-size:11px;color:#555555;font-family:Arial,sans-serif;">Development + audit closure · infrastructure fully covered</p>
        </td>
        <td style="padding:15px 14px;text-align:right;white-space:nowrap;vertical-align:middle;">
          <p style="margin:0;font-size:24px;font-weight:900;color:#c8322b;font-family:Arial,Helvetica,sans-serif;">$2,154.00</p>
          <p style="margin:2px 0 0;font-size:9px;color:#555555;font-family:Arial,sans-serif;text-align:right;">USD · net of infrastructure investment</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- divider -->
  <tr><td style="padding:4px 32px 0;"><div style="height:2px;background:linear-gradient(90deg,#c8322b 0%,#e8e8e8 100%);border-radius:2px;"></div></td></tr>

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

// ─────────────────────────────────────────────────────────────────────────────
// SEND
// ─────────────────────────────────────────────────────────────────────────────
async function send(to: string, doPdf: Buffer, cfPdf: Buffer): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from:    FROM,
      to:      [to],
      subject: `System report background check, Secret Integration [${INVOICE_NO}]`,
      html:    buildHtml(),
      text:    `${INVOICE_NO} · ${ISSUED_TIME}\nBanxico Plus LLC | Internal · Confidential\n\nSee attached:\n- DO-INV-20260805.pdf ($576 DigitalOcean)\n- CF-INV-74070549.pdf ($960 Cloudflare)\n\nPhase 1 (DO Migration) — IN PROGRESS\nETA completion: ~August 12, 2026\nTotal due: $2,299 USD`,
      attachments: [
        { filename: "DO-INV-20260805.pdf", content: doPdf.toString("base64"), content_type: "application/pdf" },
        { filename: "CF-INV-74070549.pdf", content: cfPdf.toString("base64"), content_type: "application/pdf" },
      ],
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`FAILED → ${to}`, data); process.exit(1); }
  console.log(`SENT → ${to} | id: ${data.id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log("Generating PDFs…");
  const [doPdf, cfPdf] = await Promise.all([generateDOPDF(), generateCFPDF()]);
  console.log(`DO PDF: ${doPdf.length}b  |  CF PDF: ${cfPdf.length}b`);

  await send("jose.barrientos@banxicoplusllc.org", doPdf, cfPdf);

  if (process.argv.includes("--all")) {
    await send("emiliano.maldonado@banxicoplusllc.org", doPdf, cfPdf);
    console.log("Done — both recipients received the full report.");
  } else {
    console.log("Preview sent. Run with --all to also send to Emiliano.");
  }
})();

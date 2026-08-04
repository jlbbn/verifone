/**
 * Banxico Plus LLC — Email Service (Resend)
 *
 * Priority:
 *   1. RESEND_API_KEY env var → direct Resend REST API (supports custom domains)
 *   2. Replit Connectors SDK  → fallback (only works with onboarding@resend.dev)
 *
 * Required env vars:
 *   RESEND_API_KEY — API key from resend.com (dashboard → API Keys)
 *   RESEND_FROM    — verified sender, e.g. "Banxico Plus <noreply@banxicoplusllc.org>"
 */

import { ReplitConnectors } from "@replit/connectors-sdk";

const RESEND_FROM = process.env.RESEND_FROM ?? "Banxico Plus <onboarding@resend.dev>";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

let connectors: ReplitConnectors | null = null;

function getConnectors(): ReplitConnectors {
  if (!connectors) connectors = new ReplitConnectors();
  return connectors;
}

/** Unified send — uses direct API key if available, falls back to connector */
async function resendSend(payload: object): Promise<Response> {
  if (RESEND_API_KEY) {
    return fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  }
  return getConnectors().proxy("resend", "/emails", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
}

// ── Banxico+ SVG logo (inline, white on dark) ──────────────────────────────
const LOGO_SVG = `
<svg viewBox="0 0 52 60" width="36" height="44" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="0"  width="5" height="8" rx="1" fill="#c8322b"/>
  <rect x="30" y="0"  width="5" height="8" rx="1" fill="#c8322b"/>
  <rect x="20" y="52" width="5" height="8" rx="1" fill="#c8322b"/>
  <rect x="30" y="52" width="5" height="8" rx="1" fill="#c8322b"/>
  <path d="M12 4h22c6 0 10 3.5 10 9 0 3.5-1.8 6.2-4.5 7.8C43.5 22.8 46 26 46 30.5c0 6.5-4.5 10.5-11.5 10.5H12V4z" fill="#c8322b"/>
  <path d="M18 10h14c3 0 5 1.5 5 4.5S35 19 32 19H18V10z" fill="white"/>
  <path d="M18 24h15c3.5 0 5.5 1.8 5.5 5s-2 5-5.5 5H18V24z" fill="white"/>
</svg>`;

// ── Shared email shell builders ────────────────────────────────────────────

/**
 * Wraps content in the standard Banxico+ email chrome.
 * @param body   The inner HTML content (between header and footer)
 * @param lang   "es" | "en"
 */
function buildEmailHtml(body: string, lang: "es" | "en" = "es"): string {
  const sentLabel  = lang === "en" ? "Sent"    : "Enviado";
  const sentAt     = new Date().toLocaleString(lang === "en" ? "en-US" : "es-MX", {
    dateStyle: "long", timeStyle: "short",
  });
  const restricted = lang === "en"
    ? "Restricted access · Authorized personnel only"
    : "Acceso restringido · Solo personal autorizado";
  const confidential = lang === "en"
    ? "This message contains confidential information. If you received it in error, please delete it immediately."
    : "Este mensaje contiene información confidencial. Si lo recibiste por error, elimínalo de inmediato.";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#e8e8e8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#e8e8e8;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 8px 32px rgba(0,0,0,0.13);max-width:100%;">

        <!-- ── Top accent stripe ── -->
        <tr>
          <td style="background:linear-gradient(90deg,#c8322b 0%,#8b1a15 100%);
                     height:5px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- ── Header ── -->
        <tr>
          <td style="background:#111111;padding:26px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="vertical-align:middle;">
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="vertical-align:middle;padding-right:14px;">${LOGO_SVG}</td>
                      <td style="vertical-align:middle;">
                        <div style="font-size:22px;font-weight:900;letter-spacing:0.16em;
                                    color:#ffffff;font-family:Arial,sans-serif;line-height:1;">
                          BANXICO<span style="color:#c8322b;">+</span>
                        </div>
                        <div style="font-size:9px;letter-spacing:0.22em;color:#777777;
                                    margin-top:3px;text-transform:uppercase;font-family:Arial,sans-serif;">
                          Secure Financial Platform
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <div style="width:38px;height:38px;border-radius:50%;
                              background:rgba(200,50,43,0.18);
                              border:1px solid rgba(200,50,43,0.35);
                              display:table-cell;vertical-align:middle;text-align:center;">
                    <span style="color:#c8322b;font-size:15px;font-weight:900;
                                 font-family:Arial,sans-serif;">B+</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Body (injected) ── -->
        ${body}

        <!-- ── Red divider ── -->
        <tr>
          <td style="padding:0 36px;">
            <div style="height:2px;background:linear-gradient(90deg,#c8322b 0%,#e8e8e8 100%);
                        border-radius:2px;"></div>
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#f7f7f7;padding:20px 36px 22px;border-radius:0 0 12px 12px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="vertical-align:top;">
                  <!-- Company name + address -->
                  <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#555555;
                             font-family:Arial,sans-serif;letter-spacing:0.04em;">
                    BANXICO PLUS LLC
                  </p>
                  <p style="margin:0 0 2px;font-size:10px;color:#999999;font-family:Arial,sans-serif;line-height:1.55;">
                    Evolution Loop, Suite 1401 · Laredo, Texas 78045 · United States
                  </p>
                  <p style="margin:0 0 10px;font-size:10px;color:#bbbbbb;font-family:Arial,sans-serif;line-height:1.55;">
                    The Landmark GDL · Guadalajara, Jalisco, México
                  </p>
                  <!-- Compliance badges -->
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding-right:5px;">
                        <span style="display:inline-block;background:#111111;color:#ffffff;
                                     font-size:9px;font-weight:700;letter-spacing:0.06em;
                                     padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">
                          EMV
                        </span>
                      </td>
                      <td style="padding-right:5px;">
                        <span style="display:inline-block;background:#1a3a5c;color:#ffffff;
                                     font-size:9px;font-weight:700;letter-spacing:0.06em;
                                     padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">
                          PCI DSS
                        </span>
                      </td>
                      <td>
                        <span style="display:inline-block;background:#c8322b;color:#ffffff;
                                     font-size:9px;font-weight:700;letter-spacing:0.06em;
                                     padding:2px 7px;border-radius:3px;font-family:Arial,sans-serif;">
                          AES-256
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right" style="vertical-align:top;">
                  <p style="margin:0 0 3px;font-size:9px;color:#bbbbbb;
                             font-family:Arial,sans-serif;white-space:nowrap;">
                    ${sentLabel}
                  </p>
                  <p style="margin:0;font-size:9px;color:#999999;
                             font-family:Arial,sans-serif;text-align:right;white-space:nowrap;">
                    ${sentAt}
                  </p>
                </td>
              </tr>
            </table>
            <!-- Confidentiality notice -->
            <p style="margin:12px 0 0;font-size:9px;color:#cccccc;font-family:Arial,sans-serif;
                       line-height:1.6;border-top:1px solid #eeeeee;padding-top:10px;">
              ${confidential}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── OTP Email ──────────────────────────────────────────────────────────────

function buildOtpHtml(fullName: string, code: string): string {
  // Split code into individual digit cells
  const digits = code.split("").map(d =>
    `<td style="padding:0 4px;">
       <div style="width:42px;height:54px;background:#f7f7f7;
                   border:2px solid #e0e0e0;border-radius:8px;
                   display:table-cell;vertical-align:middle;text-align:center;">
         <span style="font-family:'Courier New',Courier,monospace;
                      font-size:28px;font-weight:bold;color:#c8322b;
                      line-height:54px;display:block;">
           ${d}
         </span>
       </div>
     </td>`
  ).join("");

  const body = `
    <tr>
      <td style="padding:36px 36px 28px;">
        <p style="margin:0 0 5px;color:#111111;font-size:19px;font-weight:700;
                   font-family:Arial,sans-serif;">
          Hello, ${fullName}
        </p>
        <p style="margin:0 0 28px;color:#666666;font-size:14px;line-height:1.75;
                   font-family:Arial,sans-serif;">
          We received a sign-in request for your Banxico Plus account.
          Use the verification code below — it's valid for
          <strong style="color:#111111;">10 minutes</strong> and can only be used once.
        </p>

        <!-- Individual digit boxes -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center" style="padding-bottom:10px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>${digits}</tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Helper label -->
        <p style="margin:0 0 28px;color:#aaaaaa;font-size:11px;text-align:center;
                   font-family:Arial,sans-serif;letter-spacing:0.05em;">
          VERIFICATION CODE
        </p>

        <!-- Security notice -->
        <div style="background:#fff8f8;border:1px solid #f5c5c2;border-radius:8px;
                    padding:14px 18px;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="vertical-align:top;padding-right:10px;">
              <span style="display:inline-block;background:#c8322b;color:#ffffff;
                           font-size:9px;font-weight:700;letter-spacing:0.08em;
                           padding:2px 6px;border-radius:3px;font-family:Arial,sans-serif;
                           white-space:nowrap;">
                SECURITY
              </span>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0;font-size:12px;color:#7a2520;line-height:1.65;
                         font-family:Arial,sans-serif;">
                <strong>Never share this code.</strong>
                Banxico Plus will never ask for your verification code by phone, chat, or email.
                If you did not request this, your account may be at risk — contact support immediately.
              </p>
            </td>
          </tr></table>
        </div>
      </td>
    </tr>`;

  return buildEmailHtml(body, "en");
}

// ── Password Reset Email ───────────────────────────────────────────────────

export async function sendPasswordResetEmail(params: {
  toEmail:  string;
  fullName: string;
  resetUrl: string;
}): Promise<{ sent: boolean }> {
  const { toEmail, fullName, resetUrl } = params;

  const body = `
    <tr>
      <td style="padding:36px 36px 28px;">
        <p style="margin:0 0 5px;color:#111111;font-size:19px;font-weight:700;
                   font-family:Arial,sans-serif;">
          Hola, ${fullName}
        </p>
        <p style="margin:0 0 24px;color:#666666;font-size:14px;line-height:1.75;
                   font-family:Arial,sans-serif;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta
          <strong style="color:#111111;">Banxico Plus</strong>.<br>
          Este enlace es válido por <strong style="color:#111111;">1 hora</strong>.
          Si no lo solicitaste, puedes ignorar este correo con seguridad.
        </p>

        <!-- CTA button -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr><td align="center" style="padding-bottom:24px;">
            <a href="${resetUrl}"
               style="display:inline-block;background:#c8322b;color:#ffffff;
                      font-size:14px;font-weight:700;text-decoration:none;
                      padding:15px 42px;border-radius:8px;letter-spacing:0.06em;
                      text-transform:uppercase;
                      box-shadow:0 4px 14px rgba(200,50,43,0.35);
                      font-family:Arial,sans-serif;">
              Restablecer contraseña
            </a>
          </td></tr>
        </table>

        <!-- Fallback URL -->
        <div style="background:#f7f7f7;border-radius:6px;padding:12px 16px;
                    border:1px solid #e8e8e8;">
          <p style="margin:0 0 4px;font-size:10px;color:#aaaaaa;font-family:Arial,sans-serif;
                     letter-spacing:0.05em;text-transform:uppercase;">
            O copia este enlace:
          </p>
          <p style="margin:0;font-size:11px;color:#666666;word-break:break-all;
                     font-family:'Courier New',Courier,monospace;line-height:1.55;">
            ${resetUrl}
          </p>
        </div>

        <!-- Security warning -->
        <div style="margin-top:20px;background:#fff8f8;border:1px solid #f5c5c2;
                    border-radius:8px;padding:14px 18px;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="vertical-align:top;padding-right:10px;">
              <span style="display:inline-block;background:#c8322b;color:#ffffff;
                           font-size:9px;font-weight:700;letter-spacing:0.08em;
                           padding:2px 6px;border-radius:3px;font-family:Arial,sans-serif;
                           white-space:nowrap;">
                AVISO
              </span>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0;font-size:12px;color:#7a2520;line-height:1.65;
                         font-family:Arial,sans-serif;">
                <strong>¿No solicitaste esto?</strong>
                Alguien pudo haber ingresado tu correo por error. Tu contraseña actual no cambia
                hasta que uses este enlace. Puedes ignorar este correo.
              </p>
            </td>
          </tr></table>
        </div>
      </td>
    </tr>`;

  const html = buildEmailHtml(body, "es");

  const response = await resendSend({
    from:    RESEND_FROM,
    to:      [toEmail],
    subject: "Restablecer contraseña — Banxico Plus",
    html,
    text: `Hola ${fullName},\n\nRestablece tu contraseña aquí:\n${resetUrl}\n\nEste enlace expira en 1 hora.\n\n— Banxico Plus LLC · Evolution Loop Suite 1401, Laredo TX`,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend returned ${response.status}: ${body}`);
  }
  return { sent: true };
}

// ── Cybrid Announcement Email ──────────────────────────────────────────────

export async function sendCybridAnnouncementEmail(params: {
  toEmail:   string;
  fullName:  string;
  isApprovalRequest?: boolean;
}): Promise<{ sent: boolean }> {
  const { toEmail, fullName, isApprovalRequest = false } = params;

  const subjectTag   = isApprovalRequest ? " [REQUIERE APROBACIÓN]" : "";
  const subject      = `Integración Cybrid — Desglose y Adquisición de Licencia${subjectTag}`;

  const approvalNote = isApprovalRequest
    ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="margin-bottom:24px;background:#fff8e1;border:1px solid #f9a825;
                     border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#f9a825;padding:8px 14px;width:1%;white-space:nowrap;
                      vertical-align:top;">
            <span style="color:#ffffff;font-size:10px;font-weight:700;
                         letter-spacing:0.1em;font-family:Arial,sans-serif;">
              PENDIENTE
            </span>
          </td>
          <td style="padding:10px 14px;">
            <p style="margin:0 0 4px;color:#e65100;font-size:13px;font-weight:700;
                       font-family:Arial,sans-serif;">
              Este correo requiere tu aprobación antes de enviarse a los socios.
            </p>
            <p style="margin:0;color:#6d4c00;font-size:12px;line-height:1.6;
                       font-family:Arial,sans-serif;">
              Revisa el contenido. Si deseas ajustarlo, edita el anuncio en
              <strong>Configuración → Anuncios</strong> y usa el botón "Enviar correo"
              para mandarlo a Socemro.
            </p>
          </td>
        </tr>
      </table>`
    : "";

  const body = `
    <tr>
      <td style="padding:40px 40px 36px;font-family:Arial,Helvetica,sans-serif;">

        ${approvalNote}

        <!-- Intro -->
        <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111111;line-height:1.3;">
          Integración Cybrid
        </p>
        <p style="margin:0 0 32px;font-size:14px;color:#666666;line-height:1.7;">
          Banxico Plus LLC ha completado la adquisición de licencia e inicia la integración
          técnica con <strong style="color:#111111;">Cybrid</strong> como proveedor de
          infraestructura bancaria.
        </p>

        <!-- Partner badge — CYBRID × Banxico Plus LLC -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-bottom:32px;border:1px solid #e0e0e0;border-radius:8px;
                      overflow:hidden;">
          <tr>
            <td style="padding:16px 20px;background:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle;">
                    <!-- CYBRID wordmark -->
                    <span style="font-size:16px;font-weight:900;color:#111111;
                                 letter-spacing:0.04em;font-family:Arial,sans-serif;">
                      CYBRID
                    </span>
                    <!-- × separator -->
                    <span style="font-size:14px;color:#aaaaaa;margin:0 10px;
                                 font-family:Arial,sans-serif;">
                      &times;
                    </span>
                    <!-- Banxico Plus -->
                    <span style="font-size:14px;font-weight:700;color:#1a56db;
                                 font-family:Arial,sans-serif;">
                      Banxico Plus LLC
                    </span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <!-- Verification badge -->
                    <span style="display:inline-block;background:#ecfdf5;
                                 border:1px solid #6ee7b7;border-radius:20px;
                                 padding:4px 12px;font-size:11px;font-weight:700;
                                 color:#065f46;font-family:Arial,sans-serif;
                                 white-space:nowrap;">
                      &#10003;&nbsp; Licencia Activa
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f8f9ff;padding:10px 20px;
                        border-top:1px solid #e0e0e0;">
              <span style="font-size:11px;color:#6b7280;font-family:Arial,sans-serif;">
                Banking-as-a-Service (BaaS) &nbsp;&middot;&nbsp; Regulado EE.UU. / Canadá
                &nbsp;&middot;&nbsp; KYC/AML &nbsp;&middot;&nbsp; ACH/Wire &nbsp;&middot;&nbsp; fiat&#8596;crypto
              </span>
            </td>
          </tr>
        </table>

        <!-- License status — step list -->
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#888888;
                   letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;">
          Estado de la licencia
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-bottom:32px;border:1px solid #e0e0e0;border-radius:8px;
                      overflow:hidden;">

          <!-- Step 1 — COMPLETED -->
          <tr style="border-bottom:1px solid #e0e0e0;">
            <td style="padding:12px 16px;background:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="90" style="vertical-align:middle;padding-right:12px;">
                    <span style="display:inline-block;background:#dcfce7;border:1px solid #86efac;
                                 border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;
                                 color:#166534;letter-spacing:0.06em;font-family:Arial,sans-serif;
                                 white-space:nowrap;">
                      COMPLETADO
                    </span>
                  </td>
                  <td style="font-size:13px;color:#333333;font-family:Arial,sans-serif;">
                    Registro de Banxico Plus LLC como <em>Business Customer</em>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Step 2 — PENDING -->
          <tr style="border-bottom:1px solid #e0e0e0;">
            <td style="padding:12px 16px;background:#fafafa;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="90" style="vertical-align:middle;padding-right:12px;">
                    <span style="display:inline-block;background:#f9fafb;border:1px solid #d1d5db;
                                 border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;
                                 color:#6b7280;letter-spacing:0.06em;font-family:Arial,sans-serif;
                                 white-space:nowrap;">
                      PENDIENTE
                    </span>
                  </td>
                  <td style="font-size:13px;color:#9ca3af;font-family:Arial,sans-serif;">
                    Proceso AML/KYB aprobado — documentación corporativa verificada
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Step 3 — PENDING -->
          <tr style="border-bottom:1px solid #e0e0e0;">
            <td style="padding:12px 16px;background:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="90" style="vertical-align:middle;padding-right:12px;">
                    <span style="display:inline-block;background:#f9fafb;border:1px solid #d1d5db;
                                 border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;
                                 color:#6b7280;letter-spacing:0.06em;font-family:Arial,sans-serif;
                                 white-space:nowrap;">
                      PENDIENTE
                    </span>
                  </td>
                  <td style="font-size:13px;color:#9ca3af;font-family:Arial,sans-serif;">
                    Acuerdo de servicios y Addendum de Compliance firmados
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Step 4 — PENDING -->
          <tr style="border-bottom:1px solid #e0e0e0;">
            <td style="padding:12px 16px;background:#fafafa;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="90" style="vertical-align:middle;padding-right:12px;">
                    <span style="display:inline-block;background:#f9fafb;border:1px solid #d1d5db;
                                 border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;
                                 color:#6b7280;letter-spacing:0.06em;font-family:Arial,sans-serif;
                                 white-space:nowrap;">
                      PENDIENTE
                    </span>
                  </td>
                  <td style="font-size:13px;color:#9ca3af;font-family:Arial,sans-serif;">
                    Credenciales de producción activas
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Step 5 — PENDING -->
          <tr>
            <td style="padding:12px 16px;background:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="90" style="vertical-align:middle;padding-right:12px;">
                    <span style="display:inline-block;background:#f9fafb;border:1px solid #d1d5db;
                                 border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;
                                 color:#6b7280;letter-spacing:0.06em;font-family:Arial,sans-serif;
                                 white-space:nowrap;">
                      PENDIENTE
                    </span>
                  </td>
                  <td style="font-size:13px;color:#9ca3af;font-family:Arial,sans-serif;">
                    Integración técnica — ETA: 24–36 hrs por fase
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Divider with label -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-bottom:24px;">
          <tr>
            <td style="border-top:1px solid #e0e0e0;padding-top:24px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#888888;
                         letter-spacing:0.1em;text-transform:uppercase;">
                Descripcion del proveedor
              </p>
              <p style="margin:0;font-size:13px;color:#444444;line-height:1.8;">
                Cybrid es una plataforma regulada de <strong>Banking-as-a-Service (BaaS)</strong>
                que provee cuentas bancarias virtuales, KYC/AML automatizado, transferencias
                ACH/Wire, y un puente fiat&#8596;crypto certificado bajo marcos regulatorios de
                EE.UU. y Canadá. Es la pieza que permite ofrecer
                <strong>cuentas reales con routing number</strong> a los socios de Banxico Plus.
              </p>
            </td>
          </tr>
        </table>

        <!-- Implementation table -->
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#888888;
                   letter-spacing:0.1em;text-transform:uppercase;">
          Desglose de implementacion
        </p>
        <p style="margin:0 0 14px;font-size:12px;color:#999999;line-height:1.6;">
          Estimated Transit Time from Provider — cada fase se activa desde los servidores
          de Cybrid al recibir la señal de despliegue.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-bottom:32px;">
          <tr style="background:#f7f7f7;">
            <td style="padding:9px 12px;font-size:11px;font-weight:700;color:#888888;
                        letter-spacing:0.06em;text-transform:uppercase;width:12%;">
              Fase
            </td>
            <td style="padding:9px 12px;font-size:11px;font-weight:700;color:#888888;
                        letter-spacing:0.06em;text-transform:uppercase;">
              Alcance
            </td>
            <td style="padding:9px 12px;font-size:11px;font-weight:700;color:#888888;
                        letter-spacing:0.06em;text-transform:uppercase;
                        width:18%;text-align:right;">
              ETA
            </td>
          </tr>
          <tr style="border-top:1px solid #eeeeee;">
            <td style="padding:11px 12px;font-size:13px;font-weight:700;color:#c8322b;">01</td>
            <td style="padding:11px 12px;font-size:13px;color:#333333;line-height:1.5;">
              Activación de credenciales y conexión OAuth2
            </td>
            <td style="padding:11px 12px;font-size:12px;font-weight:700;color:#1a7340;
                        text-align:right;white-space:nowrap;">24–36 hrs</td>
          </tr>
          <tr style="border-top:1px solid #eeeeee;background:#fafafa;">
            <td style="padding:11px 12px;font-size:13px;font-weight:700;color:#c8322b;">02</td>
            <td style="padding:11px 12px;font-size:13px;color:#333333;line-height:1.5;">
              KYC/AML automático integrado al onboarding
            </td>
            <td style="padding:11px 12px;font-size:12px;font-weight:700;color:#1a7340;
                        text-align:right;white-space:nowrap;">24–36 hrs</td>
          </tr>
          <tr style="border-top:1px solid #eeeeee;">
            <td style="padding:11px 12px;font-size:13px;font-weight:700;color:#c8322b;">03</td>
            <td style="padding:11px 12px;font-size:13px;color:#333333;line-height:1.5;">
              Emisión de cuentas con routing/account number real por usuario
            </td>
            <td style="padding:11px 12px;font-size:12px;font-weight:700;color:#1a7340;
                        text-align:right;white-space:nowrap;">24–36 hrs</td>
          </tr>
          <tr style="border-top:1px solid #eeeeee;background:#fafafa;">
            <td style="padding:11px 12px;font-size:13px;font-weight:700;color:#c8322b;">04</td>
            <td style="padding:11px 12px;font-size:13px;color:#333333;line-height:1.5;">
              Puente fiat&#8596;USDT: depósitos ACH&#8594;USDT y retiros USDT&#8594;ACH
            </td>
            <td style="padding:11px 12px;font-size:12px;font-weight:700;color:#1a7340;
                        text-align:right;white-space:nowrap;">24–36 hrs</td>
          </tr>
          <tr style="border-top:1px solid #eeeeee;">
            <td style="padding:11px 12px;font-size:13px;font-weight:700;color:#c8322b;">05</td>
            <td style="padding:11px 12px;font-size:13px;color:#333333;line-height:1.5;">
              Go-live producción: compliance activo y soporte 24/7
            </td>
            <td style="padding:11px 12px;font-size:12px;font-weight:700;color:#1a7340;
                        text-align:right;white-space:nowrap;">24–36 hrs</td>
          </tr>
        </table>

        <!-- Closing -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="border-top:1px solid #e0e0e0;padding-top:24px;margin-top:8px;">
          <tr>
            <td>
              <p style="margin:0 0 16px;font-size:13px;color:#666666;line-height:1.7;">
                Para consultas sobre esta integración, comuníquese con el equipo
                de operaciones a través de los canales internos.
              </p>
              <p style="margin:0;font-size:13px;font-weight:700;color:#111111;
                         letter-spacing:0.02em;">
                Banxico Plus System
              </p>
              <p style="margin:3px 0 0;font-size:11px;color:#aaaaaa;">
                Notificación automática — no responder a este correo
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>`;

  const html = buildEmailHtml(body, "es");

  const response = await resendSend({
    from:    RESEND_FROM,
    to:      [toEmail],
    subject,
    html,
    text: `Hola ${fullName},\n\nIntegración Cybrid — Licencia adquirida.\n\nFases 1–5: 24–36 hrs ETA por fase (Estimated Transit Time from Provider)\n\nEstado: [OK] KYB/AML aprobado · [OK] Contrato firmado · [OK] Credenciales activas · [EN CURSO] Integración técnica\n\n— Banxico Plus System · Evolution Loop Suite 1401, Laredo TX`,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend returned ${response.status}: ${body}`);
  }
  return { sent: true };
}

// ── OTP / 2FA Email ────────────────────────────────────────────────────────

export async function sendOtpEmail(params: {
  toEmail:  string;
  fullName: string;
  code:     string;
}): Promise<{ sent: boolean; devCode?: string }> {
  const { toEmail, fullName, code } = params;

  let response: Response;
  try {
    response = await resendSend({
      from:    RESEND_FROM,
      to:      [toEmail],
      subject: `${code} — Tu código de verificación Banxico Plus`,
      html:    buildOtpHtml(fullName, code),
      text:    `Tu código de verificación Banxico Plus es: ${code}\n\nExpira en 10 minutos. Nunca compartas este código.\n\n— Banxico Plus LLC · Evolution Loop Suite 1401, Laredo TX`,
    });
  } catch (err: any) {
    console.error("[Email 2FA] Connector proxy error:", err?.message ?? err);
    throw err;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[Email 2FA] Resend API ${response.status}:`, body);
    throw new Error(`Resend returned ${response.status}: ${body}`);
  }

  const data = await response.json().catch(() => ({}));
  const masked = toEmail.replace(/(.{2}).+(@.+)/, "$1***$2");
  console.log("[Email 2FA] Sent OK →", data?.id ?? "no-id", "to", masked);
  return { sent: true };
}

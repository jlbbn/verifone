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
      <td style="padding:36px 36px 28px;">
        ${approvalNote}

        <p style="margin:0 0 5px;color:#111111;font-size:19px;font-weight:700;
                   font-family:Arial,sans-serif;">
          Hola, ${fullName}
        </p>
        <p style="margin:0 0 24px;color:#666666;font-size:14px;line-height:1.75;
                   font-family:Arial,sans-serif;">
          Te compartimos el resumen ejecutivo sobre la integración de
          <strong style="color:#111111;">Cybrid</strong> como proveedor de infraestructura
          bancaria para <strong style="color:#111111;">Banxico Plus LLC</strong>.
        </p>

        <!-- Cybrid logo + license acquired -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-bottom:24px;border:1px solid #c7d7f5;border-radius:8px;
                      overflow:hidden;">
          <!-- Cybrid brand bar — light blue bg so dark logo renders correctly -->
          <tr>
            <td style="background:#eef3ff;padding:18px 20px;
                        border-left:4px solid #1a56db;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle;padding-right:18px;">
                    <img src="https://cdn.prod.website-files.com/691c3ed36cbe630ffe6844b3/691c658f10165e6e706920c3_Cybrid-Logo.svg"
                         alt="Cybrid" width="116" height="30"
                         style="display:block;border:0;outline:none;" />
                  </td>
                  <td style="vertical-align:middle;border-left:1px solid #c7d7f5;
                              padding-left:18px;">
                    <p style="margin:0 0 2px;color:#1a56db;font-size:10px;font-weight:700;
                               letter-spacing:0.14em;text-transform:uppercase;
                               font-family:Arial,sans-serif;">
                      Official Integration Partner
                    </p>
                    <p style="margin:0;color:#6b7fa3;font-size:10px;
                               font-family:Arial,sans-serif;">
                      Banxico Plus LLC
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Status row -->
          <tr>
            <td style="background:#f0faf0;padding:14px 20px;
                        border-top:1px solid #c3e6c3;">
              <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <div style="width:20px;height:20px;background:#2e7d32;border-radius:50%;
                               text-align:center;line-height:20px;">
                    <span style="color:#ffffff;font-size:12px;font-weight:700;
                                 font-family:Arial,sans-serif;">&#10003;</span>
                  </div>
                </td>
                <td style="vertical-align:middle;">
                  <p style="margin:0;color:#1b5e20;font-size:13px;font-weight:700;
                             font-family:Arial,sans-serif;">
                    Licencia adquirida — Credenciales de producción activas
                  </p>
                  <p style="margin:3px 0 0;color:#388e3c;font-size:11px;
                             font-family:Arial,sans-serif;">
                    Proceso KYB/AML aprobado · Contrato firmado · API lista
                  </p>
                </td>
              </tr></table>
            </td>
          </tr>
        </table>

        <!-- What is Cybrid -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-bottom:22px;">
          <tr><td style="border-left:3px solid #c8322b;padding:0 0 0 14px;">
            <p style="margin:0 0 5px;color:#111111;font-size:14px;font-weight:700;
                       font-family:Arial,sans-serif;">
              ¿Qué es Cybrid?
            </p>
            <p style="margin:0;color:#555555;font-size:13px;line-height:1.75;
                       font-family:Arial,sans-serif;">
              Cybrid es una plataforma regulada de
              <strong>Banking-as-a-Service (BaaS)</strong> que provee cuentas bancarias
              virtuales, KYC/AML automatizado, transferencias ACH/Wire, y un puente
              fiat↔crypto certificado bajo marcos regulatorios de EE.UU. y Canadá.
              Habilita <em>cuentas reales con routing number</em> para nuestros usuarios.
            </p>
          </td></tr>
        </table>

        <!-- Implementation breakdown -->
        <p style="margin:0 0 6px;color:#111111;font-size:14px;font-weight:700;
                   font-family:Arial,sans-serif;">
          Desglose de implementación
        </p>
        <p style="margin:0 0 12px;color:#999999;font-size:11px;line-height:1.6;
                   font-family:Arial,sans-serif;letter-spacing:0.02em;">
          Estimated Transit Time from Provider — cada fase se activa desde los servidores
          de Cybrid una vez confirmada la señal de despliegue.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-bottom:22px;border-radius:8px;overflow:hidden;
                      border:1px solid #eeeeee;">
          <!-- Header row -->
          <tr style="background:#f2f2f2;">
            <td style="padding:9px 14px;font-size:11px;font-weight:700;color:#888888;
                        text-transform:uppercase;letter-spacing:0.06em;
                        font-family:Arial,sans-serif;width:18%;">Fase</td>
            <td style="padding:9px 14px;font-size:11px;font-weight:700;color:#888888;
                        text-transform:uppercase;letter-spacing:0.06em;
                        font-family:Arial,sans-serif;">Alcance</td>
            <td style="padding:9px 14px;font-size:11px;font-weight:700;color:#888888;
                        text-transform:uppercase;letter-spacing:0.06em;
                        font-family:Arial,sans-serif;width:20%;text-align:center;">
              ETA
            </td>
          </tr>
          <!-- Rows -->
          <tr style="border-top:1px solid #eeeeee;">
            <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#c8322b;
                        font-family:Arial,sans-serif;">1</td>
            <td style="padding:10px 14px;font-size:12px;color:#333333;line-height:1.55;
                        font-family:Arial,sans-serif;">
              Activación de credenciales de producción y conexión OAuth2
            </td>
            <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#2e7d32;
                        text-align:center;font-family:Arial,sans-serif;">24–36 hrs</td>
          </tr>
          <tr style="border-top:1px solid #eeeeee;background:#fafafa;">
            <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#c8322b;
                        font-family:Arial,sans-serif;">2</td>
            <td style="padding:10px 14px;font-size:12px;color:#333333;line-height:1.55;
                        font-family:Arial,sans-serif;">
              KYC/AML automático integrado al onboarding de Banxico+
            </td>
            <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#2e7d32;
                        text-align:center;font-family:Arial,sans-serif;">24–36 hrs</td>
          </tr>
          <tr style="border-top:1px solid #eeeeee;">
            <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#c8322b;
                        font-family:Arial,sans-serif;">3</td>
            <td style="padding:10px 14px;font-size:12px;color:#333333;line-height:1.55;
                        font-family:Arial,sans-serif;">
              Emisión de cuentas virtuales con routing/account number real por usuario
            </td>
            <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#2e7d32;
                        text-align:center;font-family:Arial,sans-serif;">24–36 hrs</td>
          </tr>
          <tr style="border-top:1px solid #eeeeee;background:#fafafa;">
            <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#c8322b;
                        font-family:Arial,sans-serif;">4</td>
            <td style="padding:10px 14px;font-size:12px;color:#333333;line-height:1.55;
                        font-family:Arial,sans-serif;">
              Puente fiat↔USDT: depósitos ACH → USDT y retiros USDT → ACH en tiempo real
            </td>
            <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#2e7d32;
                        text-align:center;font-family:Arial,sans-serif;">24–36 hrs</td>
          </tr>
          <tr style="border-top:1px solid #eeeeee;">
            <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#c8322b;
                        font-family:Arial,sans-serif;">5</td>
            <td style="padding:10px 14px;font-size:12px;color:#333333;line-height:1.55;
                        font-family:Arial,sans-serif;">
              Go-live producción completa: compliance activo y soporte 24/7
            </td>
            <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#2e7d32;
                        text-align:center;font-family:Arial,sans-serif;">24–36 hrs</td>
          </tr>
        </table>

        <!-- License status -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-bottom:22px;">
          <tr><td style="border-left:3px solid #1565c0;padding:0 0 0 14px;">
            <p style="margin:0 0 8px;color:#111111;font-size:14px;font-weight:700;
                       font-family:Arial,sans-serif;">
              Estado de la licencia Cybrid
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="vertical-align:middle;padding:4px 10px 4px 0;">
                  <span style="display:inline-block;width:16px;height:16px;background:#2e7d32;
                               border-radius:50%;text-align:center;line-height:16px;">
                    <span style="color:#fff;font-size:10px;font-weight:700;">&#10003;</span>
                  </span>
                </td>
                <td style="font-size:12px;color:#444444;padding:4px 0;font-family:Arial,sans-serif;">
                  Registro de Banxico Plus LLC como <em>Business Customer</em>
                </td>
              </tr>
              <tr>
                <td style="vertical-align:middle;padding:4px 10px 4px 0;">
                  <span style="display:inline-block;width:16px;height:16px;background:#2e7d32;
                               border-radius:50%;text-align:center;line-height:16px;">
                    <span style="color:#fff;font-size:10px;font-weight:700;">&#10003;</span>
                  </span>
                </td>
                <td style="font-size:12px;color:#444444;padding:4px 0;font-family:Arial,sans-serif;">
                  Proceso AML/KYB aprobado — documentación corporativa verificada
                </td>
              </tr>
              <tr>
                <td style="vertical-align:middle;padding:4px 10px 4px 0;">
                  <span style="display:inline-block;width:16px;height:16px;background:#2e7d32;
                               border-radius:50%;text-align:center;line-height:16px;">
                    <span style="color:#fff;font-size:10px;font-weight:700;">&#10003;</span>
                  </span>
                </td>
                <td style="font-size:12px;color:#444444;padding:4px 0;font-family:Arial,sans-serif;">
                  Acuerdo de servicios y Addendum de Compliance firmados
                </td>
              </tr>
              <tr>
                <td style="vertical-align:middle;padding:4px 10px 4px 0;">
                  <span style="display:inline-block;width:16px;height:16px;background:#2e7d32;
                               border-radius:50%;text-align:center;line-height:16px;">
                    <span style="color:#fff;font-size:10px;font-weight:700;">&#10003;</span>
                  </span>
                </td>
                <td style="font-size:12px;color:#444444;padding:4px 0;font-family:Arial,sans-serif;">
                  Credenciales de producción activas
                </td>
              </tr>
              <tr>
                <td style="vertical-align:middle;padding:4px 10px 4px 0;">
                  <span style="display:inline-block;width:16px;height:16px;
                               background:#1565c0;border-radius:50%;
                               text-align:center;line-height:16px;">
                    <span style="color:#fff;font-size:9px;font-weight:700;">→</span>
                  </span>
                </td>
                <td style="font-size:12px;color:#1565c0;font-weight:700;
                            padding:4px 0;font-family:Arial,sans-serif;">
                  Integración técnica en curso — ETA: <strong>24–36 hrs por fase</strong>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- System announcement preview -->
        <div style="background:#e3f2fd;border-radius:8px;padding:16px 18px;">
          <p style="margin:0 0 6px;color:#0d47a1;font-size:13px;font-weight:700;
                     font-family:Arial,sans-serif;">
            Aviso del sistema — preview del banner
          </p>
          <p style="margin:0;color:#1565c0;font-size:12px;line-height:1.75;
                     font-family:Arial,sans-serif;">
            <em>"Banxico Plus LLC se encuentra en proceso de integración con Cybrid, plataforma
            regulada de Banking-as-a-Service. Esta mejora habilitará cuentas bancarias reales,
            transferencias ACH/Wire y un puente directo fiat↔USDT para todos los socios."</em>
          </p>
        </div>

        <!-- Closing -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-top:24px;border-top:1px solid #eeeeee;padding-top:20px;">
          <tr>
            <td>
              <p style="margin:0 0 12px;color:#666666;font-size:13px;line-height:1.7;
                         font-family:Arial,sans-serif;">
                Para cualquier consulta sobre esta integración, contacta al equipo
                de operaciones a través de los canales internos habituales.
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-left:3px solid #c8322b;padding:6px 0 6px 14px;">
                    <p style="margin:0;font-size:13px;font-weight:700;color:#111111;
                               font-family:Arial,sans-serif;letter-spacing:0.04em;">
                      Banxico Plus System
                    </p>
                    <p style="margin:2px 0 0;font-size:11px;color:#999999;
                               font-family:Arial,sans-serif;">
                      Notificación automática del sistema · No responder directamente
                    </p>
                  </td>
                </tr>
              </table>
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

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

// ── Banxico+ SVG logo (inline, white on dark) ─────────────────────────────────
const LOGO_SVG = `
<svg viewBox="0 0 52 60" width="40" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="0"  width="5" height="8" rx="1" fill="#c8322b"/>
  <rect x="30" y="0"  width="5" height="8" rx="1" fill="#c8322b"/>
  <rect x="20" y="52" width="5" height="8" rx="1" fill="#c8322b"/>
  <rect x="30" y="52" width="5" height="8" rx="1" fill="#c8322b"/>
  <path d="M12 4h22c6 0 10 3.5 10 9 0 3.5-1.8 6.2-4.5 7.8C43.5 22.8 46 26 46 30.5c0 6.5-4.5 10.5-11.5 10.5H12V4z" fill="#c8322b"/>
  <path d="M18 10h14c3 0 5 1.5 5 4.5S35 19 32 19H18V10z" fill="white"/>
  <path d="M18 24h15c3.5 0 5.5 1.8 5.5 5s-2 5-5.5 5H18V24z" fill="white"/>
</svg>`;

function buildOtpHtml(fullName: string, code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Banxico Plus Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#f2f2f2;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:10px;overflow:hidden;
                    box-shadow:0 4px 16px rgba(0,0,0,0.10);max-width:100%;">

        <!-- ── Header ── -->
        <tr>
          <td style="background:#111111;padding:28px 36px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  ${LOGO_SVG}
                </td>
                <td style="vertical-align:middle;">
                  <span style="color:#ffffff;font-size:22px;font-weight:bold;
                               letter-spacing:0.18em;font-family:Arial,sans-serif;">
                    BANXICO
                  </span><span style="color:#c8322b;font-size:22px;font-weight:900;">+</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Body ── -->
        <tr>
          <td style="padding:36px 36px 28px;">
            <p style="margin:0 0 6px;color:#111111;font-size:18px;font-weight:700;">
              Hello, ${fullName}
            </p>
            <p style="margin:0 0 28px;color:#555555;font-size:14px;line-height:1.7;">
              We received a sign-in request for your Banxico Plus account.
              Use the verification code below to complete your login.
              This code is valid for <strong>10 minutes</strong>.
            </p>

            <!-- OTP box -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center" style="padding:0 0 28px;">
                  <div style="display:inline-block;background:#f7f7f7;
                              border:1px solid #e0e0e0;border-radius:10px;
                              padding:20px 48px;">
                    <span style="font-family:'Courier New',Courier,monospace;
                                 font-size:40px;font-weight:bold;color:#c8322b;
                                 letter-spacing:0.35em;">
                      ${code}
                    </span>
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#999999;font-size:12px;text-align:center;line-height:1.6;">
              If you did not request this code, you can safely ignore this email.<br>
              Never share this code with anyone — Banxico Plus will never ask for it.
            </p>
          </td>
        </tr>

        <!-- ── Divider ── -->
        <tr>
          <td style="padding:0 36px;">
            <div style="border-top:1px solid #eeeeee;"></div>
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 36px;border-radius:0 0 10px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td>
                  <p style="margin:0 0 4px;color:#aaaaaa;font-size:11px;">
                    <strong style="color:#888888;">Banxico Plus LLC</strong>
                  </p>
                  <p style="margin:0;color:#aaaaaa;font-size:11px;line-height:1.5;">
                    Evolution Road · Internal-use financial management platform<br>
                    Restricted access · Authorized personnel only
                  </p>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="color:#c8322b;font-size:14px;font-weight:900;
                               letter-spacing:0.1em;font-family:Arial,sans-serif;">
                    B+
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(params: {
  toEmail:  string;
  fullName: string;
  resetUrl: string;
}): Promise<{ sent: boolean }> {
  const { toEmail, fullName, resetUrl } = params;
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Restablecer contraseña — Banxico Plus</title></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.10);max-width:100%;">
        <tr>
          <td style="background:#111111;padding:28px 36px;">
            <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.18em;">BANXICO</span><span style="color:#c8322b;font-size:22px;font-weight:900;">+</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 28px;">
            <p style="margin:0 0 6px;color:#111111;font-size:18px;font-weight:700;">Hola, ${fullName}</p>
            <p style="margin:0 0 24px;color:#555555;font-size:14px;line-height:1.7;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta Banxico Plus.<br>
              Este enlace es válido por <strong>1 hora</strong>. Si no lo solicitaste, ignora este correo.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:0 0 28px;">
                <a href="${resetUrl}"
                   style="display:inline-block;background:#c8322b;color:#ffffff;font-size:15px;font-weight:bold;
                          text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.04em;">
                  Restablecer contraseña
                </a>
              </td></tr>
            </table>
            <p style="margin:0;color:#999999;font-size:11px;text-align:center;line-height:1.6;word-break:break-all;">
              O copia este enlace en tu navegador:<br>${resetUrl}
            </p>
          </td>
        </tr>
        <tr><td style="padding:0 36px;"><div style="border-top:1px solid #eeeeee;"></div></td></tr>
        <tr>
          <td style="background:#f8f8f8;padding:16px 36px;border-radius:0 0 10px 10px;">
            <p style="margin:0;color:#aaaaaa;font-size:11px;">
              <strong style="color:#888888;">Banxico Plus LLC</strong> · Acceso restringido · Solo personal autorizado
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const response = await resendSend({
    from:    RESEND_FROM,
    to:      [toEmail],
    subject: "Restablecer contraseña — Banxico Plus",
    html,
    text: `Hola ${fullName},\n\nRestablece tu contraseña aquí:\n${resetUrl}\n\nEste enlace expira en 1 hora.\n\n— Banxico Plus LLC`,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend returned ${response.status}: ${body}`);
  }
  return { sent: true };
}

export async function sendCybridAnnouncementEmail(params: {
  toEmail:   string;
  fullName:  string;
  isApprovalRequest?: boolean;
}): Promise<{ sent: boolean }> {
  const { toEmail, fullName, isApprovalRequest = false } = params;

  const subjectTag   = isApprovalRequest ? " [REQUIERE APROBACIÓN]" : "";
  const subject      = `Integración Cybrid — Desglose y Adquisición de Licencia${subjectTag}`;
  const approvalNote = isApprovalRequest
    ? `<div style="background:#fff8e1;border:1px solid #f9a825;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;color:#e65100;font-size:13px;font-weight:700;">⚠ Este correo requiere tu aprobación antes de enviarse a los socios.</p>
        <p style="margin:6px 0 0;color:#6d4c00;font-size:12px;line-height:1.6;">
          Revisa el contenido. Si deseas ajustarlo, edita el anuncio en <strong>Configuración → Anuncios</strong> y luego usa el botón "Enviar correo" para enviarlo a Socemro.
        </p>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.10);max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#111111;padding:28px 36px;">
            <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.18em;">BANXICO</span><span style="color:#c8322b;font-size:22px;font-weight:900;">+</span>
            <span style="color:#aaaaaa;font-size:12px;margin-left:16px;letter-spacing:0.08em;">COMUNICADO INTERNO</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 0;">
            ${approvalNote}
            <p style="margin:0 0 4px;color:#111111;font-size:18px;font-weight:700;">Hola, ${fullName}</p>
            <p style="margin:0 0 24px;color:#555555;font-size:14px;line-height:1.7;">
              Te compartimos el resumen ejecutivo sobre la próxima integración de <strong>Cybrid</strong> como
              proveedor de infraestructura bancaria para <strong>Banxico Plus LLC</strong>.
            </p>

            <!-- Section: Qué es Cybrid -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
              <tr><td style="border-left:3px solid #c8322b;padding:0 0 0 14px;">
                <p style="margin:0 0 6px;color:#111111;font-size:15px;font-weight:700;">¿Qué es Cybrid?</p>
                <p style="margin:0;color:#444444;font-size:13px;line-height:1.75;">
                  Cybrid es una plataforma regulada de <strong>Banking-as-a-Service (BaaS)</strong> que provee
                  cuentas bancarias virtuales, KYC/AML automatizado, transferencias ACH/Wire, y un puente
                  fiat↔crypto certificado bajo marcos regulatorios de EE.UU. y Canadá.
                  Es la pieza que nos permite ofrecer <em>cuentas reales con IBAN/routing number</em> a nuestros usuarios.
                </p>
              </td></tr>
            </table>

            <!-- Section: Desglose de implementación -->
            <p style="margin:0 0 10px;color:#111111;font-size:15px;font-weight:700;">Desglose de implementación</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
              <tr style="background:#f8f8f8;">
                <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.05em;width:22%;">Fase</td>
                <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.05em;">Alcance</td>
                <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.05em;width:20%;text-align:center;">Estimado</td>
              </tr>
              <tr style="border-top:1px solid #eeeeee;">
                <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#c8322b;">Fase 1</td>
                <td style="padding:10px 12px;font-size:13px;color:#333333;line-height:1.5;">Sandbox Cybrid: credenciales, OAuth2, prueba de endpoints de identidad y cuentas</td>
                <td style="padding:10px 12px;font-size:13px;color:#777777;text-align:center;">1–2 sem.</td>
              </tr>
              <tr style="border-top:1px solid #eeeeee;background:#fafafa;">
                <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#c8322b;">Fase 2</td>
                <td style="padding:10px 12px;font-size:13px;color:#333333;line-height:1.5;">KYC automático: verificación de identidad de usuarios al crear cuenta en Banxico+</td>
                <td style="padding:10px 12px;font-size:13px;color:#777777;text-align:center;">2–3 sem.</td>
              </tr>
              <tr style="border-top:1px solid #eeeeee;">
                <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#c8322b;">Fase 3</td>
                <td style="padding:10px 12px;font-size:13px;color:#333333;line-height:1.5;">Cuentas virtuales: emisión de cuentas con routing/account number real por usuario</td>
                <td style="padding:10px 12px;font-size:13px;color:#777777;text-align:center;">3–4 sem.</td>
              </tr>
              <tr style="border-top:1px solid #eeeeee;background:#fafafa;">
                <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#c8322b;">Fase 4</td>
                <td style="padding:10px 12px;font-size:13px;color:#333333;line-height:1.5;">Puente fiat↔USDT: depósitos ACH → USDT y retiros USDT → ACH en tiempo real</td>
                <td style="padding:10px 12px;font-size:13px;color:#777777;text-align:center;">4–6 sem.</td>
              </tr>
              <tr style="border-top:1px solid #eeeeee;">
                <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#c8322b;">Fase 5</td>
                <td style="padding:10px 12px;font-size:13px;color:#333333;line-height:1.5;">Producción completa: go-live, monitoreo de compliance y soporte 24/7</td>
                <td style="padding:10px 12px;font-size:13px;color:#777777;text-align:center;">2–4 sem.</td>
              </tr>
            </table>

            <!-- Section: Licencia -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
              <tr><td style="border-left:3px solid #1565c0;padding:0 0 0 14px;">
                <p style="margin:0 0 6px;color:#111111;font-size:15px;font-weight:700;">Adquisición de licencia Cybrid</p>
                <p style="margin:0 0 10px;color:#444444;font-size:13px;line-height:1.75;">
                  Para acceder a la API de producción es necesario completar los siguientes pasos de acreditación:
                </p>
                <ol style="margin:0;padding-left:18px;color:#444444;font-size:13px;line-height:2;">
                  <li>Registrar <strong>Banxico Plus LLC</strong> como <em>Business Customer</em> en <a href="https://cybrid.xyz" style="color:#c8322b;">cybrid.xyz</a></li>
                  <li>Pasar el proceso AML/KYB (Know Your Business) — documentación corporativa, EIN, dirección registrada</li>
                  <li>Firmar el acuerdo de servicios y Addendum de Compliance</li>
                  <li>Recibir credenciales de sandbox → pruebas → aprobación de producción</li>
                  <li>Activar contrato de licencia API (costo mensual según volumen de transacciones)</li>
                </ol>
              </td></tr>
            </table>

            <!-- Section: Anuncio del sistema -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
              <tr><td style="background:#e3f2fd;border-radius:8px;padding:16px 18px;">
                <p style="margin:0 0 6px;color:#0d47a1;font-size:14px;font-weight:700;">📢 Aviso del sistema (preview del banner)</p>
                <p style="margin:0;color:#1565c0;font-size:13px;line-height:1.75;">
                  <em>"Banxico Plus LLC se encuentra en proceso de integración con Cybrid, plataforma regulada de
                  Banking-as-a-Service. Esta mejora habilitará cuentas bancarias reales, transferencias ACH/Wire
                  y un puente directo fiat↔USDT para todos los socios. Se anticipa disponibilidad en producción
                  en los próximos 60–90 días."</em>
                </p>
              </td></tr>
            </table>

            <p style="margin:0 0 8px;color:#444444;font-size:13px;line-height:1.7;">
              Cualquier pregunta o ajuste al plan, por favor responde directamente a este correo
              o contáctame por el canal habitual.
            </p>
            <p style="margin:0;color:#444444;font-size:13px;">Saludos,<br><strong>José Barrientos</strong><br>Banxico Plus LLC</p>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:24px 36px 0;"><div style="border-top:1px solid #eeeeee;"></div></td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:16px 36px;border-radius:0 0 10px 10px;">
            <p style="margin:0;color:#aaaaaa;font-size:11px;line-height:1.6;">
              <strong style="color:#888888;">Banxico Plus LLC</strong> · Comunicado interno · Solo personal autorizado<br>
              Este correo contiene información confidencial de la empresa.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  const response = await resendSend({
    from:    RESEND_FROM,
    to:      [toEmail],
    subject,
    html,
    text: `Hola ${fullName},\n\nIntegración Cybrid — Desglose y Adquisición de Licencia\n\n¿Qué es Cybrid?\nCybrid es una plataforma regulada de Banking-as-a-Service (BaaS) que provee cuentas bancarias virtuales, KYC/AML automatizado, transferencias ACH/Wire, y un puente fiat↔crypto.\n\nFases de implementación:\n- Fase 1: Sandbox (1–2 sem.)\n- Fase 2: KYC automático (2–3 sem.)\n- Fase 3: Cuentas virtuales (3–4 sem.)\n- Fase 4: Puente fiat↔USDT (4–6 sem.)\n- Fase 5: Go-live producción (2–4 sem.)\n\nAdquisición de licencia: Registro en cybrid.xyz, proceso AML/KYB, firma de contrato, sandbox → producción.\n\n— Banxico Plus LLC`,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend returned ${response.status}: ${body}`);
  }
  return { sent: true };
}

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
      text:    `Tu código de verificación Banxico Plus es: ${code}\n\nExpira en 10 minutos.\n\n— Banxico Plus LLC`,
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

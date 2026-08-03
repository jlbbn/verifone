/**
 * Banxico Plus LLC — Email Service (Resend via Replit Connectors)
 *
 * Sends transactional emails via Resend API using the Replit Connectors SDK.
 * The SDK handles authentication automatically — no API key needed in env.
 *
 * Optional env var:
 *   RESEND_FROM — verified sender address
 *                 defaults to onboarding@resend.dev (Resend's shared test sender)
 */

import { ReplitConnectors } from "@replit/connectors-sdk";

const RESEND_FROM = process.env.RESEND_FROM ?? "Banxico Plus <onboarding@resend.dev>";

let connectors: ReplitConnectors | null = null;

function getConnectors(): ReplitConnectors {
  if (!connectors) connectors = new ReplitConnectors();
  return connectors;
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

  const response = await getConnectors().proxy("resend", "/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from:    RESEND_FROM,
      to:      [toEmail],
      subject: "Restablecer contraseña — Banxico Plus",
      html,
      text: `Hola ${fullName},\n\nRestablece tu contraseña aquí:\n${resetUrl}\n\nEste enlace expira en 1 hora.\n\n— Banxico Plus LLC`,
    }),
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
    response = await getConnectors().proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from:    RESEND_FROM,
        to:      [toEmail],
        subject: `${code} — Your Banxico Plus verification code`,
        html:    buildOtpHtml(fullName, code),
        text:    `Your Banxico Plus verification code is: ${code}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.\n\n— Banxico Plus LLC, Evolution Road`,
      }),
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

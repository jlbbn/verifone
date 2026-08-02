/**
 * Banxico Plus LLC — Email Service
 *
 * Sends transactional emails via SMTP (nodemailer).
 * In dev/no-config mode: logs the OTP to the console instead of sending.
 *
 * Required env vars (production):
 *   SMTP_HOST   — e.g. smtp.gmail.com
 *   SMTP_PORT   — e.g. 587
 *   SMTP_USER   — e.g. noreply@banxicoplus.com
 *   SMTP_PASS   — app password or SMTP password
 *   SMTP_FROM   — display name + address, e.g. "Banxico Plus <noreply@banxicoplus.com>"
 */

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
// Secrets were saved as SMT_* (without the P) — support both spellings
const SMTP_USER = process.env.SMTP_USER ?? process.env.SMT_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? process.env.SMT_PASS ?? "";
const SMTP_FROM = process.env.SMTP_FROM ?? process.env.SMT_FROM ?? `"Banxico Plus" <${SMTP_USER}>`;

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth:   { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendOtpEmail(params: {
  toEmail: string;
  fullName: string;
  code:     string;
}): Promise<{ sent: boolean; devCode?: string }> {
  const { toEmail, fullName, code } = params;

  if (!isConfigured) {
    // Development fallback — print to console, don't fail
    console.log(`\n[2FA DEV MODE] OTP para ${toEmail}: ${code}\n`);
    return { sent: false, devCode: code };
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#111111;padding:28px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.12em;">
              BANXICO<span style="color:#c8322b;">+</span>
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#111111;font-size:16px;font-weight:600;">
              Hola, ${fullName}
            </p>
            <p style="margin:0 0 24px;color:#555555;font-size:14px;line-height:1.6;">
              Alguien (esperamos que seas tú) está intentando acceder al sistema Banxico Plus.
              Usa el siguiente código para completar el inicio de sesión:
            </p>
            <!-- OTP box -->
            <div style="text-align:center;margin:0 0 24px;">
              <div style="display:inline-block;background:#f8f8f8;border:1px solid #e0e0e0;
                          border-radius:8px;padding:18px 40px;">
                <span style="font-family:monospace;font-size:36px;font-weight:bold;
                             color:#c8322b;letter-spacing:0.3em;">${code}</span>
              </div>
            </div>
            <p style="margin:0 0 8px;color:#888888;font-size:12px;text-align:center;">
              Este código expira en <strong>10 minutos</strong>.
            </p>
            <p style="margin:0;color:#888888;font-size:12px;text-align:center;">
              Si no solicitaste este código, ignora este correo.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #eeeeee;">
            <p style="margin:0;color:#aaaaaa;font-size:11px;text-align:center;">
              Banxico Plus LLC · Acceso restringido · Sistema de uso interno exclusivo
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await getTransporter().sendMail({
      from:    SMTP_FROM,
      to:      toEmail,
      subject: `${code} — Código de verificación Banxico Plus`,
      html,
      text:    `Tu código de verificación es: ${code}\nExpira en 10 minutos.`,
    });
  } catch (smtpErr: any) {
    console.error("[Email 2FA] SMTP error:", smtpErr?.message ?? smtpErr);
    console.error("[Email 2FA] Config → host:", SMTP_HOST, "port:", SMTP_PORT, "user:", SMTP_USER ? SMTP_USER.slice(0, 4) + "***" : "(empty)");
    throw smtpErr;
  }

  return { sent: true };
}

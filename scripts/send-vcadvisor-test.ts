/**
 * TEST SEND — Onboarding email for new Banxico+ user (VC Advisor LLC / Victor)
 * Sends ONLY to the internal reviewer (jose.barrientos@banxicoplusllc.org) for approval
 * before it ever reaches the real recipient. Attaches the signed-ready contract + NDA.
 */

import fs from "node:fs";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Banxico Plus <noreply@banxicoplusllc.org>";
const REVIEWER = "jose.barrientos@banxicoplusllc.org";
const FINAL_RECIPIENT = "vcadvisorllc@proton.me";

const SEND_FINAL = process.env.SEND_FINAL === "1";
const TO = SEND_FINAL ? FINAL_RECIPIENT : REVIEWER;

const SUBJECT = SEND_FINAL
  ? "Bienvenida a Banxico+ · Usuario VC Advisor LLC"
  : "[PRUEBA — revisar antes de enviar] Bienvenida Banxico+ · Usuario VC Advisor LLC (Victor)";

const CONTRACT_PATH = "attached_assets/BANXICO_PLUS_VCAdvisorLLC_Contrato_1786222488572.docx";
const NDA_PATH = "attached_assets/NDA_BanxicoPlus_VCAdvisorLLC_1786222573978.docx";
const PAYMENT_PAGE_URL = "https://banxicoplusllc.org/pay/vc-advisor";

function html(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#1A1A1E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;padding:32px 12px 60px;">
<div style="max-width:600px;margin:0 auto;">
<div style="background:#0F0F12;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.4),0 20px 50px rgba(0,0,0,.5);">

  <div style="padding:26px 24px;border-top:3px solid #26262B;">
    <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:-.01em;margin-bottom:20px;">
      <div style="width:18px;height:18px;display:grid;grid-template-columns:1fr 1fr;gap:2px;">
        <i style="background:#E8332B;border-radius:2px;display:block;"></i>
        <i style="background:#E8332B;border-radius:2px;display:block;"></i>
        <i style="background:#E8332B;border-radius:2px;display:block;"></i>
        <i style="background:#E8332B;border-radius:2px;display:block;"></i>
      </div>
      BANXICO<span style="color:#E8332B;">+</span>
    </div>

    ${SEND_FINAL ? "" : `<div style="background:#1C1C21;border:1px solid #3A3A42;border-radius:8px;padding:10px 14px;margin-bottom:20px;">
      <span style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#FFFFFF;">Vista previa interna — no enviado a Victor todavía</span>
    </div>`}

    <h1 style="font-size:22px;line-height:1.2;margin:0 0 14px;font-weight:800;color:#FFFFFF;">
      Bienvenido a Banxico+, Victor
    </h1>
    <p style="font-size:13.5px;line-height:1.6;color:#C4C4CB;margin:0 0 20px;">
      Estás por convertirte en usuario de la plataforma Banxico+ bajo la cuenta de
      <strong style="color:#FFFFFF;">VC Advisor LLC</strong>. Antes de activar tu acceso, te compartimos
      el desglose de costos, tus responsabilidades como usuario, y los documentos que necesitamos firmados.
    </p>

    <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:24px 0 10px;">Costos</h2>
    <div style="background:#141417;border:1px solid #26262B;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:#C4C4CB;margin-bottom:6px;">
        <span>Usuario Banxico+ (anual)</span><strong style="color:#FFFFFF;">$750.00 USD</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#6D6D76;">
        <span>Referencial en MXN</span><span>$13,000.00 MXN</span>
      </div>
      <div style="font-size:11px;color:#6D6D76;margin-top:8px;line-height:1.5;">
        Pago por adelantado, vigencia de 12 meses desde la fecha efectiva (08/08/2026), renovación automática
        anual con ajuste de hasta 10% salvo cancelación por escrito con 30 días de anticipación.
      </div>
    </div>

    <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:24px 0 10px;">Datos de pago</h2>
    <div style="background:#141417;border:1px solid #26262B;border-radius:10px;padding:18px 16px;margin-bottom:14px;text-align:center;">
      <p style="font-size:12.5px;color:#C4C4CB;margin:0 0 14px;line-height:1.5;">
        El código QR, la red y la dirección de la wallet de cobro (USDT · ERC20) están disponibles en tu página de pago.
      </p>
      <a href="${PAYMENT_PAGE_URL}" style="display:inline-block;background:#E8332B;color:#FFFFFF;font-size:13px;font-weight:800;letter-spacing:.02em;padding:11px 22px;border-radius:8px;text-decoration:none;">
        Ver datos de pago
      </a>
      <div style="font-size:10.5px;color:#6D6D76;margin-top:10px;word-break:break-all;">${PAYMENT_PAGE_URL}</div>
    </div>
    <p style="font-size:11.5px;color:#9A9AA2;line-height:1.6;margin:0 0 20px;">
      Al concluirse el pago, tu acceso a la plataforma y a todo el ecosistema de Banxico+ se activa
      de inmediato. Además, recibirás una notificación por correo electrónico con el recibo del pago
      confirmado.
    </p>

    <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:24px 0 10px;">Responsabilidades del usuario</h2>
    <ul style="font-size:12.5px;color:#C4C4CB;line-height:1.7;margin:0 0 20px;padding-left:18px;">
      <li>Todas las acciones realizadas con tus credenciales son responsabilidad de VC Advisor LLC.</li>
      <li>Como remitente en cualquier operación, eres responsable de la exactitud de los datos del destinatario (cuentas, montos, nombres).</li>
      <li>Cualquier disputa debe reportarse por escrito dentro de 5 días hábiles posteriores a la transacción.</li>
      <li>Cumplimiento obligatorio con normativa AML/KYC aplicable (FinCEN, BSA, LFPIORPI).</li>
      <li>Confidencialidad de la información de la plataforma conforme al NDA adjunto.</li>
    </ul>

    <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#9A9AA2;font-weight:800;margin:24px 0 10px;">Documentos adjuntos</h2>
    <div style="border:1px solid #26262B;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:#0F0F12;">
        <span style="color:#9A9AA2;">&#128196;</span>
        <span style="font-size:12.5px;color:#C4C4CB;">Contrato de Servicios — VC Advisor LLC (.docx)</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:#141417;border-top:1px solid #26262B;">
        <span style="color:#9A9AA2;">&#128196;</span>
        <span style="font-size:12.5px;color:#C4C4CB;">Acuerdo de Confidencialidad (NDA) — VC Advisor LLC (.docx)</span>
      </div>
    </div>

    <p style="font-size:12px;color:#6D6D76;line-height:1.6;margin:0;">
      Favor de firmar y devolver ambos documentos antes de la activación del acceso.
      Cualquier duda, responde directamente a este correo.
    </p>
  </div>

  <div style="background:#0A0A0C;padding:20px 24px;font-size:11px;color:#6D6D76;line-height:1.7;border-top:1px solid #26262B;">
    <strong style="color:#C4C4CB;">BANXICO PLUS LLC</strong><br/>
    7652 Sawmill Road, Suite 341 · Dublin, Ohio 43016 · United States<br/>
    The Landmark GDL · Guadalajara, Jalisco, Mexico
  </div>

</div>
</div>
</body>
</html>`;
}

async function main() {
  const contract = fs.readFileSync(CONTRACT_PATH).toString("base64");
  const nda = fs.readFileSync(NDA_PATH).toString("base64");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM,
      to: TO,
      ...(SEND_FINAL ? { cc: REVIEWER } : {}),
      subject: SUBJECT,
      html: html(),
      attachments: [
        { filename: "Contrato_VCAdvisorLLC.docx", content: contract },
        { filename: "NDA_VCAdvisorLLC.docx", content: nda },
      ],
    }),
  });
  const data = await res.json() as { id?: string; message?: string };
  if (data.id) {
    if (SEND_FINAL) {
      console.log(`ENVIADO a Victor (${FINAL_RECIPIENT}) | Resend ID: ${data.id}`);
    } else {
      console.log(`Test enviado a ${REVIEWER} | Resend ID: ${data.id}`);
      console.log(`(Destinatario final ${FINAL_RECIPIENT} NO recibió nada todavía)`);
    }
  } else {
    console.error("ERROR:", JSON.stringify(data));
    process.exit(1);
  }
}

main();

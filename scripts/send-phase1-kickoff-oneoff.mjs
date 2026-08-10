// One-off status email: kickoff of Fase 1 (VPC isolation) of the compliance
// implementation plan. Sent once manually, not part of the app's regular flow.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Banxico Plus <onboarding@resend.dev>";

const TO = ["jose.barrientos@banxicoplusllc.org", "emiliano.maldonado@banxicoplusllc.org"];

const subject = "Fase 1 — Aislamiento de red (VPC): arranque (00:12–04:00)";

const html = `
<div style="font-family: Arial, sans-serif; color:#e2e8f0; background:#0b1220; padding:24px;">
  <h2 style="color:#f8fafc; margin-bottom:4px;">Plan de Compliance — Fase 1: Aislamiento de red (VPC)</h2>
  <p style="color:#94a3b8; margin-top:0;">Correo de arranque de etapa · Banxico Plus LLC</p>

  <p><strong>Estado:</strong> En curso (arranca ahora)</p>
  <p><strong>Ventana asignada:</strong> hoy 00:12 a.m. → 04:00 a.m. (corte de fase)</p>
  <p><strong>Presupuesto asignado a esta etapa:</strong> $100 USD</p>
  <p><strong>Responsable:</strong> Jose Luis</p>

  <p>Tareas de esta etapa (según Plan por Etapas), todas parten de "No iniciado":</p>
  <ol>
    <li>Inventariar recursos actuales y accesos públicos expuestos (3h est.)</li>
    <li>Crear VPC privada en DigitalOcean y subredes (2h est.)</li>
    <li>Migrar base de datos a Managed DB dentro de la VPC (5h est.)</li>
    <li>Eliminar IP pública de la BD y validar que solo responde dentro de la VPC (2h est.)</li>
    <li>Pruebas de conectividad app-BD dentro de la red privada (3h est.)</li>
    <li>Documentar arquitectura de red para el checklist de compliance (2h est.)</li>
  </ol>

  <p>Este correo es un aviso de arranque, no un reporte de avance: ninguna tarea se ha
  ejecutado todavía. El siguiente correo de esta cadena reportará el cierre real de la
  Fase 1 a las 04:00 a.m., con el % de avance verdadero contra este plan.</p>

  <p style="color:#94a3b8; font-size:13px; margin-top:24px;">
  Cronograma restante (sujeto al avance real de cada etapa):<br/>
  Fase 2 (WAF/SSH): 04:00 a.m. → 12:50 p.m.<br/>
  Fase 3 (SAST CI/CD): 12:50 p.m. → 9:40 p.m.<br/>
  Fase 4 (SIEM inmutable): 9:40 p.m. → 10:56 a.m. (día siguiente)<br/>
  Fase 5 (Tokenización/PII): 10:56 a.m. → 00:12 a.m. (día siguiente)<br/>
  Fase 6 (Cierre y validación final): 00:12 a.m. → 01:00 a.m.
  </p>
</div>
`;

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${RESEND_API_KEY}`,
  },
  body: JSON.stringify({ from: RESEND_FROM, to: TO, subject, html }),
});

const body = await res.text();
console.log("Resend status:", res.status);
console.log("Resend body:", body);

---
name: DO account limits & token access
description: Qué significa el status "warning" de la cuenta DO, cómo se amplían límites, y cómo acceder al token desde el agente
---

- El status `warning` de la cuenta DO (verificado ago 2026) significa solo "máximo de droplets alcanzado (3/3)" — NO es problema de billing ni de verificación. `status_message` lo dice textual.
- **No existe API para subir límites de cuenta DO.** Ruta verificada (docs jul 2026): panel → menú izquierdo **Resource Limits** → botón **Request an increase** (arriba derecha) → elegir recurso, nuevo límite y razón. La ruta "Settings → Droplet Limit" es obsoleta/incorrecta.
- Alternativa rápida documentada: **prepago** en Billing (Tier 2 = $50) sube el trust tier y puede desbloquear límites al instante; el historial de facturas pagadas también los sube automáticamente con el tiempo.
- **Why:** el usuario pidió "amplíalos tú" — imposible programáticamente; hay que darle los pasos del panel + texto listo para pegar.
- **Acceso al token DO desde el agente:** `$DIGITALOCEAN_TOKEN` ya está en el env del workspace → usar ShellExec/curl. `requestSecrets` en el sandbox re-pregunta al usuario aunque el secret exista (lo rechazó y lo confundió). No volver a usarlo para secrets ya listados en available_secrets.

## Tope de volúmenes
Crear un volumen de 200GB falla con "invalid size" (tope de cuenta ~100GB por volumen); 100GB sí procede. Ampliarlo es acción del dueño en el panel. Para discos grandes usar el disco local del droplet.

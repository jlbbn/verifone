---
name: DO account limits & token access
description: Qué significa el status "warning" de la cuenta DO, cómo se amplían límites, y cómo acceder al token desde el agente
---

- El status `warning` de la cuenta DO (verificado ago 2026) significa solo "máximo de droplets alcanzado (3/3)" — NO es problema de billing ni de verificación. `status_message` lo dice textual.
- **No existe API para subir límites de cuenta DO.** Solo el dueño desde el panel: Settings → "Droplet Limit" → "Request Increase" (o el enlace que aparece al intentar crear un droplet estando al tope), o ticket de soporte.
- **Why:** el usuario pidió "amplíalos tú" — imposible programáticamente; hay que darle los pasos del panel + texto listo para pegar.
- **Acceso al token DO desde el agente:** `$DIGITALOCEAN_TOKEN` ya está en el env del workspace → usar ShellExec/curl. `requestSecrets` en el sandbox re-pregunta al usuario aunque el secret exista (lo rechazó y lo confundió). No volver a usarlo para secrets ya listados en available_secrets.

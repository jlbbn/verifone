# Pull Request — Banxico Plus

## Tipo de cambio
- [ ] Bug fix
- [ ] Nueva funcionalidad
- [ ] Refactor / Mejora de código
- [ ] Seguridad / PCI DSS
- [ ] Documentación
- [ ] CI/CD / Infraestructura

## Módulos afectados
- [ ] Frontend (React/TS)
- [ ] Backend (Express/TS)
- [ ] Schema / Base de datos
- [ ] POS / Enrutamiento
- [ ] Autenticación / Sesiones
- [ ] Integración Stripe
- [ ] Integración MercadoPago
- [ ] Crypto Exchange
- [ ] Otro: ___

## Descripción
Explica qué hace este PR y por qué.

## Issue relacionado
Closes #___

## Cambios principales
- 
- 
- 

## Checklist
- [ ] TypeScript compila sin errores (`npx tsc --noEmit`)
- [ ] No se exponen credenciales ni datos sensibles
- [ ] Los endpoints nuevos tienen validación Zod
- [ ] Los endpoints nuevos tienen `requireSession` / `requireRole`
- [ ] El schema de Drizzle está actualizado si se modificó la DB
- [ ] CVV / PIN / datos de tarjeta nunca se persisten
- [ ] La lógica POS usa `txApproved` para el estado final de transacción

## Impacto en seguridad PCI DSS / EMV
- [ ] Sin impacto
- [ ] Bajo (documentado abajo)
- [ ] Requiere revisión de seguridad

## Capturas / Videos
Si aplica, agrega evidencia visual del cambio.

## Notas para el reviewer
Cualquier contexto adicional relevante.

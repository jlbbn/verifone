---
name: Nested node:test runner pitfalls
description: Env inheritance and CLI defaults that break programmatic node:test runners (in-app test runner panels)
---

# Runner de node:test lanzado programáticamente — trampas

- **Strip NODE_TEST\* del env en spawns anidados.** node:test inyecta `NODE_TEST_CONTEXT` (y afines) en los procesos hijo de cada archivo de prueba. Si un test lanza a su vez `tsx --test`/`node --test` (p.ej. el test del propio runner), el nieto hereda esas variables, cambia de protocolo/reporter y su salida deja de ser TAP parseable — el test de integración falla solo cuando corre dentro de la suite.
  **How to apply:** en el spawn del runner, clonar `process.env` y borrar toda clave que empiece con `NODE_TEST`.
- **Nunca lanzar `tsx --test`/`node --test` sin archivos explícitos.** Sin argumentos, recorre TODO el árbol del cwd — incluido `.cache/.bun` — ejecutando cientos de tests de paquetes de terceros. Siempre pasar la lista blanca de archivos ya validada.
- **Forzar `--test-reporter=tap` si se parsea la salida.** El reporter por defecto varía según versión de Node y si stdout es TTY (spec vs tap); no forzarlo hace el parser dependiente del entorno.

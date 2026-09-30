import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { spawn } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Ejecuta un comando adb y resuelve con su stdout completo
function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn('adb', args)
    let out = ''
    p.stdout.on('data', (d) => { out += d })
    p.on('error', reject)
    p.on('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`adb ${args.join(' ')} → exit ${code}`))))
  })
}

// Espejo en vivo del POS físico: sirve el screencap de adb como PNG bajo /api/pos/screen.png.
// Antes de capturar despierta el equipo si está dormido (screencap sobre pantalla apagada = negro).
function posMirrorPlugin(): Plugin {
  const handler = async (_req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-store')
    try {
      const power = await run(['shell', 'dumpsys', 'power'])
      if (!/mWakefulness=Awake/.test(power)) {
        await run(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'])
        await new Promise((r) => setTimeout(r, 300))
      }
    } catch { /* sin wake seguimos: mejor capturar negro que no servir nada */ }
    const adb = spawn('adb', ['exec-out', 'screencap', '-p'])
    adb.stdout.pipe(res)
    adb.on('error', () => {
      if (!res.headersSent) res.statusCode = 502
      res.end()
    })
    adb.on('exit', (code) => {
      if (code !== 0 && !res.writableEnded) res.end()
    })
  }

  // Aplica el brillo configurado en el POS físico (settings nativo, 0-255).
  // Solo escribe cuando el valor cambia — no spam de settings put en cada tick.
  let lastBrightness = -1
  const brightnessHandler = (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const b = Math.min(100, Math.max(0, Math.round(Number(url.searchParams.get('b') ?? '80'))))
    res.setHeader('Content-Type', 'application/json')
    if (b === lastBrightness) {
      res.end(JSON.stringify({ ok: true, applied: false, brightness: b }))
      return
    }
    run(['shell', 'settings', 'put', 'system', 'screen_brightness', String(Math.round((b / 100) * 255))])
      .then(() => {
        lastBrightness = b
        res.end(JSON.stringify({ ok: true, applied: true, brightness: b }))
      })
      .catch(() => {
        res.statusCode = 502
        res.end(JSON.stringify({ ok: false, applied: false, brightness: b }))
      })
  }

  return {
    name: 'pos-mirror',
    configureServer(server) {
      server.middlewares.use('/api/pos/screen.png', handler)
      server.middlewares.use('/api/pos/brightness', brightnessHandler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/pos/screen.png', handler)
      server.middlewares.use('/api/pos/brightness', brightnessHandler)
    },
  }
}

// El Chrome del SUNMI V3 es v88 (sin soporte de @layer, que llegó en v99):
// un parser viejo descarta entero el bloque @layer y la app queda sin estilos.
// Se eliminan los envoltorios @layer conservando el contenido (mismo orden fuente).
function unwrapCssLayers(css: string): string {
  let result = ''
  let i = 0
  const n = css.length
  while (i < n) {
    const m = /^@layer\s+[\w.-]+(\s*,\s*[\w.-]+)*\s*\{/.exec(css.slice(i))
    if (m) {
      i += m[0].length
      let depth = 1
      const start = i
      while (i < n && depth > 0) {
        if (css[i] === '{') depth++
        else if (css[i] === '}') depth--
        i++
      }
      result += unwrapCssLayers(css.slice(start, i - 1))
    } else {
      result += css[i]
      i++
    }
  }
  return result
}

function flattenCssLayersPlugin(): Plugin {
  return {
    name: 'flatten-css-layers',
    apply: 'build',
    generateBundle(_opts, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'asset' && chunk.fileName.endsWith('.css')) {
          chunk.source = unwrapCssLayers(String(chunk.source))
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), posMirrorPlugin(), flattenCssLayersPlugin()],
})

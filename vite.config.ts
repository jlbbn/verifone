import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { spawn } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Espejo en vivo del POS físico: sirve el screencap de adb como PNG bajo /api/pos/screen.png
function posMirrorPlugin(): Plugin {
  const handler = (_req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-store')
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
  return {
    name: 'pos-mirror',
    configureServer(server) {
      server.middlewares.use('/api/pos/screen.png', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/pos/screen.png', handler)
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

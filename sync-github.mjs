/**
 * sync-github.mjs
 * Sincroniza todos los archivos fuente con github.com/jlbbn/Banxico-Plus-LLC-
 * Uso: node sync-github.mjs
 * Requiere: GITHUB_PERSONAL_ACCESS_TOKEN en el entorno
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { request } from 'https';

const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const REPO  = 'jlbbn/Banxico-Plus-LLC-';
const ROOT  = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const HDR   = {
  'Authorization': `token ${TOKEN}`,
  'User-Agent': 'BanxicoPlus-Sync',
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
};

if (!TOKEN) { console.error('❌ GITHUB_PERSONAL_ACCESS_TOKEN no configurado'); process.exit(1); }

function call(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const req  = request({
      hostname: 'api.github.com', path, method,
      headers: { ...HDR, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: {} }); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function upsert(relPath, retries = 3) {
  let content;
  try { content = readFileSync(join(ROOT, relPath)).toString('base64'); }
  catch { return; }

  const apiPath = `/repos/${REPO}/contents/${relPath}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const { status: gs, body: g } = await call('GET', apiPath);
    const sha = gs === 200 ? g.sha : undefined;

    // Skip if content is identical (compare sha of local vs remote)
    if (sha) {
      const localSha = await computeGitBlobSha(join(ROOT, relPath));
      if (localSha === sha) { process.stdout.write(`  ${relPath} — sin cambios\n`); return; }
    }

    const { status: ps, body: p } = await call('PUT', apiPath, {
      message: `sync: ${relPath.split('/').pop()}`,
      content, branch: 'main',
      ...(sha ? { sha } : {}),
    });

    if ([200, 201].includes(ps)) {
      process.stdout.write(`✅ ${ps === 201 ? 'NUEVO' : 'ACTUALIZADO'} ${relPath}\n`);
      return;
    }
    if (ps === 409 && attempt < retries) { await new Promise(r => setTimeout(r, 600 * attempt)); continue; }
    process.stdout.write(`❌ ${ps} ${relPath} — ${p.message || ''}\n`);
    return;
  }
}

async function computeGitBlobSha(filePath) {
  const { createHash } = await import('crypto');
  const data   = readFileSync(filePath);
  const header = `blob ${data.length}\0`;
  const hash   = createHash('sha1');
  hash.update(header);
  hash.update(data);
  return hash.digest('hex');
}

function walk(dir, exts = ['.ts', '.tsx', '.js', '.css', '.json', '.md']) {
  const results = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) {
      if (!['node_modules', '.git', 'dist', '.local', 'artifacts', '.agents'].includes(f))
        results.push(...walk(full, exts));
    } else if (exts.some(e => f.endsWith(e))) {
      results.push(relative(ROOT, full));
    }
  }
  return results;
}

const srcDirs = ['client/src', 'server', 'shared'].map(d => join(ROOT, d));
const srcFiles = [];
for (const d of srcDirs) srcFiles.push(...walk(d));

const rootConfigs = [
  'package.json', 'tsconfig.json', 'vite.config.ts',
  'tailwind.config.ts', 'postcss.config.js', 'drizzle.config.ts', 'components.json',
];

const githubFiles = [
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  '.github/workflows/pr-check.yml',
];

const all = [...srcFiles, ...rootConfigs, ...githubFiles];

console.log(`\n🔄 Banxico Plus — Sync → ${REPO}`);
console.log(`   Archivos a revisar: ${all.length}\n`);

let updated = 0, skipped = 0, failed = 0;
for (const f of all) {
  const before = updated;
  await upsert(f);
  updated > before ? updated : skipped++;
}

console.log(`\n✅ Sync completo: ${updated} actualizados, ${skipped} sin cambios, ${failed} errores`);

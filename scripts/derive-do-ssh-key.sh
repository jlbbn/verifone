#!/usr/bin/env bash
# Regenera la llave SSH de administración del droplet DO a partir del secreto DO_SSH_SEED.
# Determinística: la misma semilla produce siempre la misma llave. Nunca imprime la parte privada.
set -euo pipefail
OUT="${1:-/home/runner/.ssh/do_banxico_derived}"
[ -n "${DO_SSH_SEED:-}" ] || { echo "falta DO_SSH_SEED" >&2; exit 1; }
mkdir -p "$(dirname "$OUT")" && chmod 700 "$(dirname "$OUT")"
node -e '
const c=require("crypto"),fs=require("fs");
const seed=c.createHash("sha256").update(process.env.DO_SSH_SEED,"utf8").digest();
const der=Buffer.concat([Buffer.from("302e020100300506032b657004220420","hex"),seed]);
const priv=c.createPrivateKey({key:der,format:"der",type:"pkcs8"});
fs.writeFileSync(process.argv[1],priv.export({format:"pem",type:"pkcs8"}),{mode:0o600});
const pub=c.createPublicKey(priv).export({format:"der",type:"spki"}).subarray(-32);
const b=s=>{const l=Buffer.alloc(4);l.writeUInt32BE(s.length,0);return Buffer.concat([l,s])};
console.log("ssh-ed25519 "+Buffer.concat([b(Buffer.from("ssh-ed25519")),b(pub)]).toString("base64")+" banxico-plus-admin-derived");
' "$OUT"

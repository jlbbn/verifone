// Convierte una dirección TRON base58 al parámetro ABI (32 bytes hex) para balanceOf.
// Debe vivir bajo /opt/banxico-plus para resolver la dependencia tronweb.
import { TronWeb } from "tronweb";
const address = process.argv[2];
if (!TronWeb.isAddress(address || "")) {
  console.error("dirección TRON inválida");
  process.exit(2);
}
process.stdout.write(TronWeb.address.toHex(address).slice(2).padStart(64, "0"));

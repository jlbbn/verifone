// Shared private-IPv4 check for the isolated TRON signer host.
//
// Kept in its own module (rather than duplicated inline in signer.mjs) so it
// can be unit-tested directly and so the two independent copies of this logic
// that used to exist in the codebase (app-side `tron-policy.ts` and this
// signer bundle) can't drift out of sync again — see private-ip.test.mjs and
// server/crypto/tron-policy.ts's `isPrivateIpv4`.
export function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    // Tailscale CGNAT range (100.64.0.0/10) — used when the app, the node,
    // and the signer no longer share a cloud VPC and are joined by a private
    // Tailscale mesh instead.
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

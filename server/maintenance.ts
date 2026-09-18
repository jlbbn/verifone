/**
 * Global maintenance lockdown.
 *
 * Two tiers:
 *  - `maintenanceMode` (soft): frontend-only screen, ADMIN + the exempted
 *    email still work normally. Pre-existing behavior, unchanged.
 *  - `maintenanceHardLockdown` (hard): blocks every /api/* request —
 *    including ADMIN's — with a 503, except a request carrying a valid
 *    bypass cookie. The only way to get that cookie is visiting the
 *    one-time signed link produced by `buildBypassLink()`.
 *
 * `maintenanceEndsAt` (ISO datetime) is swept periodically so the lockdown
 * lifts on its own without anyone needing to remember to flip it back.
 */

import type { NextFunction, Request, Response } from "express";
import { randomBytes, createHash, timingSafeEqual } from "crypto";
import type { IStorage } from "./storage";

export const MAINTENANCE_BYPASS_COOKIE = "mnt_bypass";
const SWEEP_INTERVAL_MS = 30_000;

/** Paths that must always work, even under hard lockdown, so the frontend
 * can render the maintenance screen and the bypass link can be used. */
function isAlwaysAllowed(path: string): boolean {
  return (
    path === "/api/me"
    || path === "/api/settings"
    || path === "/api/logout"
    || path === "/api/maintenance/bypass"
    || path === "/api/admin/maintenance/activate"
    || path === "/api/admin/maintenance/deactivate"
    || !path.startsWith("/api")
  );
}

export function hashBypassToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Generates a new random bypass token. Returns both the raw token (put it
 * in the link you hand to the person who must never get locked out) and its
 * hash (the only thing ever persisted). */
export function generateBypassToken(presetRaw?: string): { raw: string; hash: string } {
  const raw = presetRaw && /^[0-9a-f]{32,64}$/.test(presetRaw) ? presetRaw : randomBytes(24).toString("hex");
  return { raw, hash: hashBypassToken(raw) };
}

function safeHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/** True when the incoming request already carries a cookie matching the
 * currently active bypass hash. */
export function requestHasValidBypass(req: Request, bypassTokenHash: string | null): boolean {
  if (!bypassTokenHash) return false;
  const cookieValue = parseCookie(req.headers.cookie, MAINTENANCE_BYPASS_COOKIE);
  if (!cookieValue) return false;
  return safeHashEquals(cookieValue, bypassTokenHash);
}

export function hardLockdownActive(settings: { maintenanceHardLockdown: boolean; maintenanceEndsAt: string | null }): boolean {
  if (!settings.maintenanceHardLockdown) return false;
  if (settings.maintenanceEndsAt && Date.parse(settings.maintenanceEndsAt) <= Date.now()) return false;
  return true;
}

/** Registered globally, before route matching. Only enforces the HARD tier —
 * the soft `maintenanceMode` screen remains a frontend-only concern in
 * App.tsx so normal users still see a friendly page instead of raw 503s. */
export function createMaintenanceGuard(storage: IStorage) {
  return async function maintenanceGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (isAlwaysAllowed(req.path)) {
      next();
      return;
    }
    let settings;
    try {
      settings = await storage.getSettings();
    } catch {
      next();
      return;
    }
    if (!hardLockdownActive(settings)) {
      next();
      return;
    }
    if (requestHasValidBypass(req, settings.maintenanceBypassTokenHash)) {
      next();
      return;
    }
    res.status(503).json({ error: "El sistema está en mantenimiento global." });
  };
}

/** Periodically clears an expired maintenance window so nobody has to
 * remember to turn it off by hand. Safe to call multiple times; it is a
 * no-op whenever there is nothing to clear. */
export function startMaintenanceAutoEndSweep(storage: IStorage): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const settings = await storage.getSettings();
      if (!settings.maintenanceEndsAt) return;
      if (Date.parse(settings.maintenanceEndsAt) > Date.now()) return;
      if (!settings.maintenanceMode && !settings.maintenanceHardLockdown) return;
      await storage.updateSettings({
        maintenanceMode: false,
        maintenanceHardLockdown: false,
        maintenanceEndsAt: null,
        maintenanceBypassTokenHash: null,
      });
      console.log("[maintenance] Ventana de mantenimiento vencida — desactivada automáticamente.");
    } catch (err) {
      console.error("[maintenance] Error en el barrido de auto-fin:", (err as Error).message);
    }
  }, SWEEP_INTERVAL_MS);
}

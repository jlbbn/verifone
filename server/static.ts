import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { looksLikeApiPath } from "./path-guard";

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      // Hashed build assets (e.g. /assets/index-<hash>.js) are safe to cache
      // forever; index.html must never be cached, or a stale copy on the
      // client keeps referencing chunk hashes that no longer exist after a
      // new deploy, causing dynamic-import 404s and a blank page.
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-store");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // fall through to index.html if the file doesn't exist — but never for a
  // path shaped like /api/*. That case is already handled by
  // apiNotFoundGuard in index.ts (registered earlier, so this normally never
  // runs for API paths); this check is a second, independent layer so the
  // SPA catch-all can never serve HTML for an API-shaped path even if the
  // registration order ever changes.
  app.use("*", (req, res) => {
    if (looksLikeApiPath(req.path)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

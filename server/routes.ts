import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function registerRoutes(app: Express): Promise<Server> {
  // Servir archivos estáticos del ticker desde el directorio raíz
  app.use('/ticker', (req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
      res.sendFile(path.join(__dirname, '../index.html'));
    } else if (req.path === '/style.css') {
      res.sendFile(path.join(__dirname, '../style.css'));
    } else if (req.path === '/script.js') {
      res.sendFile(path.join(__dirname, '../script.js'));
    } else {
      next();
    }
  });

  // Redirigir la raíz al ticker
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
  });

  const httpServer = createServer(app);

  return httpServer;
}

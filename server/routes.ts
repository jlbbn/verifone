import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import path from "path";
import { fileURLToPath } from 'url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function registerRoutes(app: Express): Promise<Server> {
  // Servir archivos estáticos desde el directorio raíz del proyecto
  const projectRoot = path.join(__dirname, '..');
  
  // Servir CSS
  app.get('/style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(path.join(projectRoot, 'style.css'));
  });
  
  // Servir JavaScript
  app.get('/script.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(projectRoot, 'script.js'));
  });
  
  // Servir HTML en la raíz
  app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(path.join(projectRoot, 'index.html'));
  });

  const httpServer = createServer(app);

  return httpServer;
}

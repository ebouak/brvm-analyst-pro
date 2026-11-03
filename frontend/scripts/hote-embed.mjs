// Page hôte « site tiers » pour e2e/embed-csp.spec.ts : sert UNIQUEMENT
// scripts/embed-check.html sur une autre origine (port 8081) que l'application
// (port 3000), ce qui suffit pour que frame-ancestors s'applique.
//
// Lancé par playwright.config.ts (webServer). Remplace le prérequis manuel
// « python -m http.server 8081 », que rien n'automatisait : en CI la connexion
// était refusée et le test échouait sans rien dire du site (constaté le
// 2026-11-03). Aucun autre fichier n'est servi : pas de parcours de dossier.
// Écoute sur localhost seulement, jamais sur le réseau.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.EMBED_HOST_PORT ?? 8081);
const PAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'embed-check.html');

http
  .createServer((req, res) => {
    if (req.url === '/embed-check.html' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      fs.createReadStream(PAGE).pipe(res);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('introuvable');
  })
  .listen(PORT, 'localhost', () => console.log(`hôte embed : http://localhost:${PORT}/embed-check.html`));

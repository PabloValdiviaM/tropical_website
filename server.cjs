const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.resolve(__dirname, 'dist');

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos generados en dist/ con configuración de caché óptima
app.use(
  express.static(DIST_DIR, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      // Evitar cachear index.html para que el navegador siempre cargue la versión más reciente
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// Health check para orquestadores y monitoreo (Dokploy, Docker, etc.)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Soporte para enrutamiento SPA: cualquier ruta no estática redirige a index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Express escuchando en http://0.0.0.0:${PORT}`);
  console.log(`📁 Sirviendo archivos estáticos desde: ${DIST_DIR}`);
});

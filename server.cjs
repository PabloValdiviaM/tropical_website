const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint proxy para Gemini (ejemplo básico)
app.post('/api/gemini', async (req, res) => {
  const { prompt } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  // Aquí harías la llamada real a Gemini usando el SDK o fetch
  // y devolverías el resultado
  res.json({ response: 'Respuesta simulada' });
});

// Servir el frontend construido
app.use(express.static(path.join(__dirname, 'web/dist')));

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
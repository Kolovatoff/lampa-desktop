// // proxy.js
// const corsAnywhere = require("cors-anywhere");
//
// // Configure proxy settings
// const PORT = 8081; // Proxy port (choose an unused port)
// const ALLOWED_ORIGINS = [
//   "http://lampa.mx",
// ];
//
// // Start the proxy server
// const server = corsAnywhere.createServer({
//   originWhitelist: ALLOWED_ORIGINS, // Restrict origins to your app
// });
//
// // Listen for requests
// server.listen(PORT, () => {
//   console.log(`CORS proxy running on http://localhost:${PORT}`);
// });
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 4000; // Порт для прокси

// Разрешаем CORS для всех запросов
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Разрешаем только определенные домены
  const allowedOrigins = ['http://lampa.mx'];
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Прокси для VLC
app.use('/vlc', createProxyMiddleware({
  target: 'http://localhost:3999',
  changeOrigin: true
}));

app.listen(PORT, () => {
  console.log(`CORS proxy running on http://localhost:${PORT}`);
});

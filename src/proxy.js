const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = 4000; // Порт для прокси
const HOSTNAME = "localhost"; // Явно указываем hostname

// Разрешаем CORS для всех запросов
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Разрешаем только определенные домены
  const allowedOrigins = ["http://lampa.mx"];
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Прокси для VLC
app.use(
  "/vlc",
  createProxyMiddleware({
    target: "http://localhost:3999",
    changeOrigin: true,
  }),
);

// Указываем hostname при запуске сервера
app.listen(PORT, HOSTNAME, () => {
  console.log(`CORS proxy running on http://${HOSTNAME}:${PORT}`);
});

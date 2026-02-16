const http = require("http");
const httpProxy = require("http-proxy");

class ProxyServerManager {
  constructor() {
    this.server = null;
    this.isClosed = false;
    this.closePromise = null;
  }

  setup() {
    const proxy = httpProxy.createProxyServer({
      target: "http://localhost:3999",
      changeOrigin: true,
      secure: false,
    });

    proxy.on("error", (err, req, res) => {
      if (!res.finished) {
        res.destroy();
      } else {
        res.socket?.destroy();
      }
    });

    const server = http.createServer((req, res) => {
      if (req.url.startsWith("/vlc")) {
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Content-Length": "0",
          });
          res.end();
          return;
        }

        req.url = req.url.replace(/^\/vlc/, "") || "/";

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization",
        );

        proxy.web(req, res);
      } else {
        res.writeHead(404, {
          "Content-Type": "text/plain",
        });
        res.end("Not Found. Use /vlc path for VLC proxy.");
      }
    });

    this.server = server.listen(4000, "localhost", () => {
      console.log(`✅ Proxy server running on http://localhost:4000`);
    });

    return this.server;
  }

  close() {
    // Если уже закрыто или закрывается - возвращаем существующий промис
    if (this.isClosed) {
      return Promise.resolve();
    }

    if (this.closePromise) {
      return this.closePromise;
    }

    if (!this.server) {
      this.isClosed = true;
      return Promise.resolve();
    }

    this.closePromise = new Promise((resolve) => {
      this.server.close(() => {
        console.log("✅ Proxy server closed");
        this.isClosed = true;
        this.server = null;
        this.closePromise = null;
        resolve();
      });
    });

    return this.closePromise;
  }

  isRunning() {
    return this.server !== null && !this.isClosed;
  }
}

// Создаем синглтон
const proxyManager = new ProxyServerManager();

module.exports = {
  setupProxyServer: () => proxyManager.setup(),
  closeProxyServer: () => proxyManager.close(),
  isProxyRunning: () => proxyManager.isRunning(),
};

// modules/playerOptionsInterceptor.js
const { protocol } = require("electron");

class PlayerOptionsInterceptor {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Инициализация перехватчика OPTIONS запросов для внешних плееров
   */
  initialize() {
    if (this.isInitialized) return;

    protocol.handle("http", (request) => {
      const url = new URL(request.url);

      if (
        request.method === "OPTIONS" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
        url.port === "3999"
      ) {
        return new Response(null, {
          status: 200,
          statusText: "OK",
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods":
              "GET, POST, PUT, DELETE, OPTIONS, HEAD",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, Range, If-Range, X-Requested-With, Accept, Origin",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
            "Content-Length": "0",
          },
        });
      }

      return fetch(request);
    });
    this.isInitialized = true;
    console.log("✅ Перехват OPTIONS для VLC настроен через protocol.handle");
  }
}

module.exports = new PlayerOptionsInterceptor();


const http = require("http");
const WebSocket = require("ws");
const { timingSafeEqual } = require("crypto");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Sport chat is running");
});

const wss = new WebSocket.Server({ server, path: "/chat" });
let currentStream = null;

function sendToAll(packet) {
  const message = JSON.stringify(packet);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

wss.on("connection", (ws) => {
  if (currentStream) {
    ws.send(JSON.stringify(currentStream));
  }

  ws.on("message", (raw) => {
    if (raw.length > 4096) return;

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (!msg || typeof msg !== "object") return;

    if (msg.type === "stream-admin") {
      const expectedPassword = process.env.ADMIN_PASSWORD;
      const providedPassword = Buffer.from(String(msg.password || ""));
      const configuredPassword = Buffer.from(expectedPassword || "");
      const authorized = expectedPassword &&
        providedPassword.length === configuredPassword.length &&
        timingSafeEqual(providedPassword, configuredPassword);

      if (!authorized) {
        ws.send(JSON.stringify({
          type: "stream-error",
          message: expectedPassword
            ? "Неверный пароль администратора."
            : "Добавление трансляций не настроено на сервере."
        }));
        return;
      }

      const title = String(msg.title || "").trim().slice(0, 100);
      const url = String(msg.url || "").trim();

      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        parsedUrl = null;
      }

      if (!title || !parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
        ws.send(JSON.stringify({
          type: "stream-error",
          message: "Укажи название и корректную ссылку на трансляцию."
        }));
        return;
      }

      currentStream = {
        type: "stream",
        title,
        url: parsedUrl.href
      };
      sendToAll(currentStream);
      return;
    }

    if (msg.type !== "chat") return;

    const nickname = String(msg.nickname || "Гость")
      .trim().slice(0, 24);
    const content = String(msg.content || "")
      .trim().slice(0, 300);

    if (!nickname || !content) return;

    const packet = JSON.stringify({
      type: "chat",
      nickname,
      content,
      time: new Date().toISOString()
    });

    sendToAll(packet);
  });
});

server.listen(process.env.PORT || 10000, "0.0.0.0");


const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Sport chat is running");
});

const wss = new WebSocket.Server({ server, path: "/chat" });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    if (raw.length > 2048) return;

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
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

    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(packet);
      }
    }
  });
});

server.listen(process.env.PORT || 10000, "0.0.0.0");


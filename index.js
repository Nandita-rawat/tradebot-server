const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version, APCA-API-KEY-ID, APCA-API-SECRET-KEY",
    "Content-Type": "application/json",
  };
}

function proxyRequest(targetHost, targetPath, method, headers, body, res) {
  const options = {
    hostname: targetHost,
    path: targetPath,
    method: method,
    headers: { ...headers, "Content-Length": body ? Buffer.byteLength(body) : 0 },
  };

  const req = https.request(options, (proxyRes) => {
    let data = "";
    proxyRes.on("data", (chunk) => (data += chunk));
    proxyRes.on("end", () => {
      res.writeHead(proxyRes.statusCode, corsHeaders());
      res.end(data);
    });
  });

  req.on("error", (e) => {
    res.writeHead(500, corsHeaders());
    res.end(JSON.stringify({ error: e.message }));
  });

  if (body) req.write(body);
  req.end();
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const url = req.url;

    // ── Anthropic proxy ──
    if (url === "/api/chat") {
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": req.headers["x-api-key"] || "",
        "anthropic-version": "2023-06-01",
      };
      proxyRequest("api.anthropic.com", "/v1/messages", "POST", headers, body, res);
      return;
    }

    // ── Alpaca proxy ──
    if (url.startsWith("/alpaca/")) {
      const alpacaPath = url.replace("/alpaca", "");
      const headers = {
        "Content-Type": "application/json",
        "APCA-API-KEY-ID": req.headers["apca-api-key-id"] || "",
        "APCA-API-SECRET-KEY": req.headers["apca-api-secret-key"] || "",
      };
      proxyRequest("paper-api.alpaca.markets", alpacaPath, req.method, headers, body || null, res);
      return;
    }

    // ── Health check ──
    res.writeHead(200, corsHeaders());
    res.end(JSON.stringify({ status: "TradeBot server running!" }));
  });
});

server.listen(PORT, () => console.log(`TradeBot server running on port ${PORT}`));

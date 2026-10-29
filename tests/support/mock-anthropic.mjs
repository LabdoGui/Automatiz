// Servidor HTTP mínimo que imita POST /v1/messages da API da Anthropic, para
// testar a integração (sucesso, recusa, erros) sem chave real e sem custo.
// Uso: node tests/support/mock-anthropic.mjs <porta> [arquivo-de-log]
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";

const port = Number(process.argv[2] ?? 4010);
const logFile = process.argv[3];

export function startMock(listenPort = port, onRequest) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = body ? JSON.parse(body) : {};
      const record = { path: req.url, headers: { beta: req.headers["anthropic-beta"] ?? null, credential: req.headers["x-api-key"] || req.headers.authorization ? "present" : "absent" }, body: json };
      onRequest?.(record);
      if (logFile) appendFileSync(logFile, JSON.stringify(record) + "\n");
      const last = json.messages?.at(-1)?.content ?? "";
      const text = typeof last === "string" ? last : JSON.stringify(last);
      const send = (status, payload) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      if (text.includes("erro500")) return send(500, { type: "error", error: { type: "api_error", message: "mock" } });
      if (text.includes("erro429")) return send(429, { type: "error", error: { type: "rate_limit_error", message: "mock" } });
      if (text.includes("erro401")) return send(401, { type: "error", error: { type: "authentication_error", message: "mock" } });
      const base = { id: "msg_mock", type: "message", role: "assistant", model: json.model, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } };
      if (text.includes("recusa")) return send(200, { ...base, content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: null } });
      const hasContext = (json.system ?? []).some((b) => b.text?.includes("Contexto informado"));
      return send(200, {
        ...base,
        content: [{ type: "text", text: `Resposta simulada pelo servidor de teste (${hasContext ? "com" : "sem"} contexto).` }],
        stop_reason: "end_turn",
      });
    });
  });
  server.listen(listenPort, "127.0.0.1");
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) startMock();

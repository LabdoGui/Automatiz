import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startMock, type MockRequestRecord } from "../support/mock-anthropic.mjs";

let server: Server;
let baseUrl: string;
const requests: MockRequestRecord[] = [];

beforeAll(async () => {
  server = startMock(0, (r) => requests.push(r));
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function freshClaude(env: { key?: string; url?: string }) {
  vi.resetModules();
  if (env.key) process.env.ANTHROPIC_API_KEY = env.key;
  else delete process.env.ANTHROPIC_API_KEY;
  if (env.url) process.env.ANTHROPIC_BASE_URL = env.url;
  else delete process.env.ANTHROPIC_BASE_URL;
  return import("@/server/ai/claude");
}

const ask = (question: string, context: string[] = []) => ({ history: [], question, context });

describe("assistente com IA: integração e falhas", () => {
  it("sem chave configurada, não chama o provedor (nada é simulado)", async () => {
    const { askClaude, aiSettings } = await freshClaude({ url: baseUrl });
    expect(aiSettings().configured).toBe(false);
    const before = requests.length;
    await expect(askClaude(ask("Oi"))).rejects.toThrow(/Nenhum provedor de IA/);
    expect(requests.length).toBe(before);
  });

  it("envia só o contexto mínimo, com modelo, effort e fallback configurados", async () => {
    const { askClaude } = await freshClaude({ key: "test-key", url: baseUrl });
    const reply = await askClaude({
      history: [
        { role: "assistant", content: "mensagem órfã" },
        { role: "user", content: "pergunta anterior" },
        { role: "assistant", content: "resposta anterior" },
      ],
      question: "Lanche sem amendoim?",
      context: ["Alergias (evitar totalmente, inclusive traços): Amendoim"],
    });
    expect(reply).toEqual({ kind: "answer", text: expect.stringContaining("com contexto"), truncated: false });
    const req = requests.at(-1)!;
    expect(req.headers).toEqual({ beta: "server-side-fallback-2026-07-01", credential: "present" });
    expect(req.body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "medium" } });
    expect(req.body.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(req.body.system[1].text).toContain("Amendoim");
  });

  it("recusa do modelo vira resultado tratado, não erro genérico", async () => {
    const { askClaude } = await freshClaude({ key: "test-key", url: baseUrl });
    await expect(askClaude(ask("pedido de recusa"))).resolves.toEqual({ kind: "refusal" });
  });

  it.each([
    ["erro500", /instável/],
    ["erro429", /muitas solicitações/],
    ["erro401", /configuração do servidor/],
  ])("falha %s do provedor vira mensagem clara", async (trigger, message) => {
    const { askClaude, AiUnavailableError } = await freshClaude({ key: "test-key", url: baseUrl });
    const error = await askClaude(ask(`simular ${trigger}`)).catch((e) => e);
    expect(error).toBeInstanceOf(AiUnavailableError);
    expect(error.message).toMatch(message);
  });

  it("provedor fora do ar (conexão recusada) vira mensagem clara", async () => {
    const { askClaude } = await freshClaude({ key: "test-key", url: "http://127.0.0.1:9" });
    await expect(askClaude(ask("Oi"))).rejects.toThrow(/Não foi possível falar com o provedor/);
  });
});

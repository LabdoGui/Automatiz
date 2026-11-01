import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/assistente/route";

const body = JSON.stringify({ question: "Dica de lanche", includeContext: false });

describe("rota de streaming do assistente", () => {
  it("recusa chamadas de outra origem (CSRF)", async () => {
    const res = await POST(
      new Request("http://localhost:3100/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://site-malicioso.example", host: "localhost:3100" },
        body,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("recusa chamadas sem origem", async () => {
    const res = await POST(new Request("http://localhost:3100/api/assistente", { method: "POST", headers: { host: "localhost:3100" }, body }));
    expect(res.status).toBe(403);
  });

  it("exige sessão", async () => {
    const res = await POST(
      new Request("http://localhost:3100/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3100", host: "localhost:3100" },
        body,
      }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Entre na sua conta para usar o assistente." });
  });
});

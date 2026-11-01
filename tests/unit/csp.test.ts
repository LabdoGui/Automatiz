import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "@/lib/csp";

describe("Content-Security-Policy", () => {
  it("produção: scripts e estilos só com nonce, sem eval", () => {
    const csp = buildCsp("abc123", { dev: false, https: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("desenvolvimento permite eval, estilos inline e websocket do HMR", () => {
    const csp = buildCsp("x", { dev: true, https: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("connect-src 'self' ws: wss:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("nonce é único por chamada", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});

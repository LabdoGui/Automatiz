import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Ignorado pelos navegadores em HTTP; em produção (HTTPS) força conexões seguras.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // A Content-Security-Policy (com nonce por requisição) é definida em src/proxy.ts.
];

const nextConfig: NextConfig = {
  // O VIVA é quase inteiramente renderizado por usuário (sessão), então usamos o
  // modelo de renderização dinâmica clássico em vez de Cache Components.
  // Ver README → "Decisões técnicas".
  cacheComponents: false,
  partialPrefetching: false,
  poweredByHeader: false,
  // Imagem Docker: servidor mínimo autossuficiente (veja Dockerfile).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

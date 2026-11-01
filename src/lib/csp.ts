/**
 * Content-Security-Policy do VIVA (nonce por requisição, aplicado pelo proxy).
 * Scripts só rodam com o nonce da página; estilos em <style> também. Atributos
 * style="" (barras de progresso, gráficos) ficam permitidos via style-src-attr.
 */
export function buildCsp(nonce: string, opts: { dev: boolean; https: boolean }): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    opts.dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self'${opts.dev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (opts.https) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

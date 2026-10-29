/**
 * Relógio da aplicação. Isolado para deixar explícito onde o tempo real é lido
 * (renderização no servidor por requisição e handlers de evento no cliente).
 */
export function nowMs(): number {
  return Date.now();
}

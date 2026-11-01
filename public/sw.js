/*
 * Service worker do VIVA.
 * - Navegação: sempre pela rede; sem conexão, mostra a página /offline.
 * - Páginas autenticadas NÃO são guardadas em cache (dados de saúde em
 *   aparelhos compartilhados). Só arquivos estáticos versionados e a página
 *   offline ficam disponíveis sem internet.
 * - Envios (POST, Server Actions) nunca passam pelo cache.
 * - Notificações push: exibe o lembrete e, ao tocar, abre a página dele.
 */
const VERSION = "viva-v2";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Arquivos estáticos com hash no nome: cache primeiro.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "VIVA", {
      body: data.body || "",
      tag: data.tag || undefined,
      data: { url: typeof data.url === "string" ? data.url : "/inicio" },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "pt-BR",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/inicio", self.location.origin);
  if (url.origin !== self.location.origin) return; // só abre páginas do próprio VIVA
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).origin === url.origin && "focus" in w) {
          return w.navigate(url.href).then((client) => (client || w).focus());
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});


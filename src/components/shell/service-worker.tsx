"use client";

import { useEffect } from "react";

/** Registra o service worker apenas em produção (no desenvolvimento ele atrapalharia o hot reload). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sem service worker o app continua funcionando normalmente.
    });
  }, []);
  return null;
}

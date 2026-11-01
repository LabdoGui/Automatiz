"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Send } from "lucide-react";
import { Button } from "../ui/button";
import { useFeedback } from "../ui/feedback";
import { subscribePushAction, testPushAction, unsubscribePushAction } from "@/server/actions/push";

type State = "checking" | "unsupported" | "unavailable" | "off" | "on";

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentRegistration(): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // Em produção o registro acontece ao carregar o app; espera um pouco por ele.
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
}

/** Ativa/desativa notificações push neste aparelho (lembretes do VIVA). */
export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const { toast } = useFeedback();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return !cancelled && setState("unsupported");
      const reg = await currentRegistration();
      if (!reg) return !cancelled && setState("unavailable");
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setState(sub ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!publicKey) {
    return <p className="text-xs text-ink-3">Notificações no celular não estão configuradas nesta instalação; os lembretes aparecem apenas dentro do app.</p>;
  }

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast("O navegador não permitiu notificações. Libere nas configurações do site e tente de novo.", "error");
        return;
      }
      const reg = await currentRegistration();
      if (!reg) throw new Error("sem service worker");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey!) });
      const res = await subscribePushAction(sub.toJSON(), navigator.userAgent);
      if (!res.ok) {
        await sub.unsubscribe();
        toast(res.error, "error");
        return;
      }
      setState("on");
      toast(res.message ?? "Notificações ativadas.", "success");
    } catch {
      toast("Não foi possível ativar as notificações neste aparelho.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await currentRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast("Notificações desativadas neste aparelho.", "success");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const res = await testPushAction();
    setBusy(false);
    toast(res.ok ? (res.message ?? "Enviada.") : res.error, res.ok ? "success" : "error");
  }

  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="flex items-center gap-2 font-semibold">
        <BellRing className="h-4 w-4 text-lime-text" aria-hidden /> Notificações no celular
      </p>
      <p className="mt-1 text-sm text-ink-2">
        {state === "on"
          ? "Ativadas neste aparelho. Os lembretes chegam para o que estiver ligado acima, só no seu horário acordado."
          : state === "unsupported"
            ? "Este navegador não oferece notificações. No iPhone, adicione o VIVA à tela de início e abra por lá."
            : state === "unavailable"
              ? "Notificações funcionam no app publicado (build de produção), não no modo de desenvolvimento."
              : "Receba os lembretes ligados acima mesmo com o app fechado."}
      </p>
      {(state === "off" || state === "on") && (
        <div className="mt-3 flex flex-wrap gap-2">
          {state === "off" ? (
            <Button variant="secondary" size="sm" onClick={enable} disabled={busy}>
              <BellRing className="h-4 w-4" aria-hidden /> {busy ? "Ativando…" : "Ativar neste aparelho"}
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={test} disabled={busy}>
                <Send className="h-4 w-4" aria-hidden /> Enviar teste
              </Button>
              <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
                <BellOff className="h-4 w-4" aria-hidden /> Desativar
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

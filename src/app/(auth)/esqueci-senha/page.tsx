import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";
import { requestPasswordResetAction } from "@/server/actions/auth";
import { emailSettings } from "@/server/email/send";
import { RESET_TOKEN_MINUTES } from "@/server/auth";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const { enviado } = await searchParams;
  const enabled = emailSettings().configured;
  return (
    <>
      <h1 className="text-4xl font-extrabold">Esqueci minha senha</h1>
      {!enabled ? (
        <p className="mt-4 text-ink-2">
          A recuperação de senha por e-mail não está disponível nesta instalação, porque nenhum serviço de envio de e-mail foi configurado.
          Fale com quem administra o VIVA.
        </p>
      ) : enviado ? (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl bg-lime-soft p-4 text-lime-text">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Ele vale por {RESET_TOKEN_MINUTES} minutos. Confira
            também a caixa de spam.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-ink-2">Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.</p>
          <ActionForm action={requestPasswordResetAction} className="mt-8 flex flex-col gap-4" aria-label="Pedir link de redefinição de senha">
            <TextField name="email" label="E-mail" type="email" autoComplete="email" required inputMode="email" />
            <SubmitButton size="lg" block pendingLabel="Enviando…">
              Enviar link
            </SubmitButton>
          </ActionForm>
        </>
      )}
      <p className="mt-6 text-sm text-ink-2">
        <Link href="/entrar" className="font-semibold text-lime-text underline-offset-4 hover:underline">
          Voltar para entrar
        </Link>
      </p>
    </>
  );
}

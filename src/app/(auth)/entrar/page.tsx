import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";
import { signInAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/server/session";
import { emailSettings } from "@/server/email/send";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ voltar?: string; senha?: string }> }) {
  if (await getCurrentUser()) redirect("/inicio");
  const { voltar, senha } = await searchParams;
  return (
    <>
      <h1 className="text-4xl font-extrabold">Bem-vindo(a) de volta</h1>
      <p className="mt-2 text-ink-2">Entre para ver o plano de hoje.</p>
      {senha === "redefinida" && (
        <p role="status" className="mt-6 rounded-2xl bg-lime-soft px-4 py-3 text-sm text-lime-text">
          Senha redefinida. Entre com a nova senha.
        </p>
      )}
      <ActionForm action={signInAction} className="mt-8 flex flex-col gap-4" aria-label="Entrar no VIVA">
        <input type="hidden" name="voltar" value={voltar ?? ""} />
        <TextField name="email" label="E-mail" type="email" autoComplete="email" required inputMode="email" />
        <TextField name="password" label="Senha" type="password" autoComplete="current-password" required />
        <SubmitButton size="lg" block pendingLabel="Entrando…">
          Entrar
        </SubmitButton>
      </ActionForm>
      {emailSettings().configured && (
        <p className="mt-4 text-sm">
          <Link href="/esqueci-senha" className="font-semibold text-lime-text underline-offset-4 hover:underline">
            Esqueci minha senha
          </Link>
        </p>
      )}
      <p className="mt-6 text-sm text-ink-2">
        Ainda não tem conta?{" "}
        <Link href="/criar-conta" className="font-semibold text-lime-text underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </>
  );
}

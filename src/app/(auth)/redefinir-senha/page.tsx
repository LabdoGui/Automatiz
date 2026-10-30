import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";
import { resetPasswordAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Criar nova senha", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(token);
  return (
    <>
      <h1 className="text-4xl font-extrabold">Criar nova senha</h1>
      {!valid ? (
        <p className="mt-4 text-ink-2">
          Este link está incompleto.{" "}
          <Link href="/esqueci-senha" className="font-semibold text-lime-text underline">
            Peça um novo link
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="mt-2 text-ink-2">Escolha uma senha nova. Ao salvar, as sessões abertas em outros aparelhos são encerradas.</p>
          <ActionForm action={resetPasswordAction} className="mt-8 flex flex-col gap-4" aria-label="Definir nova senha">
            <input type="hidden" name="token" value={token} />
            <TextField name="password" label="Nova senha" type="password" autoComplete="new-password" required minLength={8} hint="De 8 a 128 caracteres." />
            <TextField name="confirm" label="Repita a nova senha" type="password" autoComplete="new-password" required />
            <SubmitButton size="lg" block pendingLabel="Salvando…">
              Salvar nova senha
            </SubmitButton>
          </ActionForm>
          <p className="mt-6 text-sm text-ink-2">
            Link expirado?{" "}
            <Link href="/esqueci-senha" className="font-semibold text-lime-text underline-offset-4 hover:underline">
              Peça outro
            </Link>
          </p>
        </>
      )}
    </>
  );
}

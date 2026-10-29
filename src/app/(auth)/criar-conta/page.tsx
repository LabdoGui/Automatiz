import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/forms/action-form";
import { GroupError, SubmitButton, TextField } from "@/components/forms/fields";
import { signUpAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Criar conta" };

function Consent({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm text-ink-2 has-[:checked]:border-lime">
        <input type="checkbox" name={name} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--lime)]" />
        <span>{children}</span>
      </label>
      <GroupError name={name} />
    </div>
  );
}

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/inicio");
  return (
    <>
      <h1 className="text-4xl font-extrabold">Crie sua conta</h1>
      <p className="mt-2 text-ink-2">Leva menos de um minuto. Depois, montamos seu plano juntos.</p>
      <ActionForm action={signUpAction} className="mt-8 flex flex-col gap-4" aria-label="Criar conta no VIVA">
        <TextField name="name" label="Nome ou apelido" autoComplete="nickname" required maxLength={60} />
        <TextField name="email" label="E-mail" type="email" autoComplete="email" required inputMode="email" />
        <TextField
          name="password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="Mínimo de 8 caracteres. Use uma frase fácil de lembrar e difícil de adivinhar."
        />
        <Consent name="acceptPrivacy">
          Li e aceito a{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-lime-text underline underline-offset-2">
            política de privacidade
          </Link>
          .
        </Consent>
        <Consent name="acceptHealth">
          Autorizo o VIVA a tratar dados sobre minha alimentação, treinos, medidas e restrições (dados de saúde) apenas para
          oferecer as funcionalidades do app. Posso exportar ou excluir tudo quando quiser.
        </Consent>
        <SubmitButton size="lg" block pendingLabel="Criando conta…">
          Criar conta
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-ink-2">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-lime-text underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

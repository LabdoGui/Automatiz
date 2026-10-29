import { requireUser } from "@/server/session";
import { signOutAction } from "@/server/actions/auth";

export default async function Onboarding() {
  const user = await requireUser();
  return (
    <main className="p-8">
      <h1 className="text-3xl font-extrabold">Onboarding de {user.name}</h1>
      <form action={signOutAction}><button type="submit">Sair</button></form>
    </main>
  );
}

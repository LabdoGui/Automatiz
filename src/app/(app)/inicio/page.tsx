import { requireOnboardedUser } from "@/server/session";

export default async function Home() {
  const { profile } = await requireOnboardedUser();
  return <h1 className="text-3xl font-extrabold">Olá, {profile.displayName}</h1>;
}

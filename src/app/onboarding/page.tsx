import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/profile/onboarding-flow";
import { buildProfileFormData } from "@/server/profile/form-data";
import { getProfileAndSettings, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Montando seu plano" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  if (profile?.onboardingCompletedAt) redirect("/inicio");
  const data = await buildProfileFormData(user.id, user.name);
  return (
    <main id="conteudo">
      <OnboardingFlow data={data} initialStep={profile?.onboardingStep ?? 0} />
    </main>
  );
}

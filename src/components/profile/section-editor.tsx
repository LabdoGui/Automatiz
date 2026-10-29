"use client";

import { Pencil } from "lucide-react";
import type { ProfileFormData } from "@/server/profile/form-data";
import type { StepKey } from "@/server/profile/step-keys";
import { saveProfileSectionAction } from "@/server/actions/profile";
import { Dialog } from "../ui/dialog";
import { ActionForm } from "../forms/action-form";
import { SubmitButton } from "../forms/fields";
import { STEP_COMPONENTS, STEP_META } from "./step-forms";

/** Edição de uma seção do perfil reutilizando o formulário do onboarding. */
export function SectionEditor({ step, data, label }: { step: StepKey; data: ProfileFormData; label: string }) {
  const Fields = STEP_COMPONENTS[step];
  return (
    <Dialog
      title={STEP_META[step].title}
      description={STEP_META[step].intro}
      trigger={<Pencil className="h-4 w-4" aria-hidden />}
      triggerLabel={`Editar ${label.toLowerCase()}`}
      triggerVariant="ghost"
      triggerSize="icon-sm"
      wide
    >
      <ActionForm action={saveProfileSectionAction} closeDialogOnSuccess className="flex flex-col gap-6">
        <input type="hidden" name="step" value={step} />
        <Fields d={data} />
        <SubmitButton block size="lg">
          Salvar alterações
        </SubmitButton>
      </ActionForm>
    </Dialog>
  );
}

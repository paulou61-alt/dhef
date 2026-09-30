"use client";

import { SelectField } from "@/components/ui/SelectField";

type CollaboratorOption = {
  id: string;
  name: string;
  role?: string | null;
};

const ROLE_LABELS: Record<string, string> = { vendedor: "Vendedor", cobrador: "Cobrador" };

export function CollaboratorFilterSelect({
  collaborators,
  defaultValue,
  includeUnassigned = true,
}: {
  collaborators: CollaboratorOption[];
  defaultValue: string;
  includeUnassigned?: boolean;
}) {
  return (
    <SelectField
      id="colaborador"
      name="colaborador"
      defaultValue={defaultValue}
      submitOnChange
      searchable
      searchPlaceholder="Buscar colaborador..."
      options={[
        { value: "", label: "Todos os colaboradores" },
        ...(includeUnassigned ? [{ value: "sem-colaborador", label: "Sem colaborador" }] : []),
        ...collaborators.map((collaborator) => ({
          value: collaborator.id,
          label: collaborator.name,
          description: collaborator.role ? ROLE_LABELS[collaborator.role] : undefined,
        })),
      ]}
    />
  );
}

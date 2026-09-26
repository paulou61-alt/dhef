"use client";

type CollaboratorOption = {
  id: string;
  name: string;
};

export function CollaboratorFilterSelect({
  collaborators,
  defaultValue,
}: {
  collaborators: CollaboratorOption[];
  defaultValue: string;
}) {
  return (
    <select
      id="colaborador"
      name="colaborador"
      defaultValue={defaultValue}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="input-field"
    >
      <option value="">Todos os colaboradores</option>
      <option value="sem-colaborador">Sem colaborador</option>
      {collaborators.map((collaborator) => (
        <option key={collaborator.id} value={collaborator.id}>
          {collaborator.name}
        </option>
      ))}
    </select>
  );
}

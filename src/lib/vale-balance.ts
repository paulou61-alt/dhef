type ValeMovement = {
  id: string;
  movement_type: "vale" | "abatimento";
  amount: number;
  movement_date: string;
  created_at: string;
};

/** Saldo de um colaborador após cada lançamento, incluindo os acertos sem pagamento. */
export function getValeBalancesByMovement(movements: readonly ValeMovement[]): Map<string, number> {
  const chronological = [...movements].sort((a, b) =>
    a.movement_date.localeCompare(b.movement_date)
    || Date.parse(a.created_at) - Date.parse(b.created_at)
    || a.id.localeCompare(b.id)
  );
  const balances = new Map<string, number>();
  let balanceInCents = 0;

  for (const movement of chronological) {
    const amountInCents = Math.round(Number(movement.amount) * 100);
    balanceInCents += movement.movement_type === "vale" ? -amountInCents : amountInCents;
    balances.set(movement.id, balanceInCents / 100);
  }

  return balances;
}

import {
  addOfflineOperation,
  getOfflineOperation,
  listOfflineOperations,
  notifyOfflineChange,
  removeOfflineOperation,
  updateOfflineOperation,
  type OfflineOperation,
  type OfflineOperationType,
} from "@/lib/offline/db";

export interface OfflineSubmitResult {
  queued: boolean;
  synced: boolean;
  resultId?: string | null;
  error?: string;
  needsAttention?: boolean;
}

type SyncApiResult = {
  id: string;
  success: boolean;
  resultId?: string | null;
  error?: string;
};

async function postOperations(operations: OfflineOperation[]): Promise<SyncApiResult[]> {
  const response = await fetch("/api/offline/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ operations }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Sessão expirada. Conecte-se à internet e faça login novamente.");
    throw new Error("Não foi possível sincronizar agora.");
  }

  const body = await response.json() as { results?: SyncApiResult[] };
  return body.results ?? [];
}

async function markNetworkRetry(operation: OfflineOperation, message: string): Promise<void> {
  await updateOfflineOperation({
    ...operation,
    status: "pending",
    attempts: operation.attempts + 1,
    lastError: message,
  });
}

async function applySyncResult(operation: OfflineOperation, result: SyncApiResult): Promise<OfflineSubmitResult> {
  if (result.success) {
    await removeOfflineOperation(operation.id);
    return { queued: false, synced: true, resultId: result.resultId ?? null };
  }

  await updateOfflineOperation({
    ...operation,
    status: "failed",
    attempts: operation.attempts + 1,
    lastError: result.error ?? "A operação precisa de atenção antes de ser sincronizada.",
  });
  return {
    queued: true,
    synced: false,
    needsAttention: true,
    error: result.error ?? "Não foi possível sincronizar a operação.",
  };
}

export async function syncOfflineOperation(id: string): Promise<OfflineSubmitResult> {
  const operation = await getOfflineOperation(id);
  if (!operation) return { queued: false, synced: true };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { queued: true, synced: false };
  }

  try {
    const results = await postOperations([operation]);
    const result = results.find((item) => item.id === operation.id);
    if (!result) {
      await markNetworkRetry(operation, "O servidor não confirmou a sincronização. Tentaremos novamente.");
      return { queued: true, synced: false };
    }
    return await applySyncResult(operation, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de conexão durante a sincronização.";
    await markNetworkRetry(operation, message);
    return { queued: true, synced: false, needsAttention: false, error: navigator.onLine ? message : undefined };
  } finally {
    notifyOfflineChange();
  }
}

export async function syncAllOfflineOperations(): Promise<{ synced: number; pending: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const current = await listOfflineOperations();
    return {
      synced: 0,
      pending: current.filter((op) => op.status === "pending").length,
      failed: current.filter((op) => op.status === "failed").length,
    };
  }

  const operations = (await listOfflineOperations()).filter((op) => op.status === "pending").slice(0, 50);
  if (!operations.length) {
    const current = await listOfflineOperations();
    return {
      synced: 0,
      pending: current.filter((op) => op.status === "pending").length,
      failed: current.filter((op) => op.status === "failed").length,
    };
  }

  let synced = 0;
  try {
    const results = await postOperations(operations);
    const byId = new Map(results.map((result) => [result.id, result]));

    for (const operation of operations) {
      const result = byId.get(operation.id);
      if (!result) {
        await markNetworkRetry(operation, "O servidor não confirmou esta operação. Tentaremos novamente.");
        continue;
      }
      const applied = await applySyncResult(operation, result);
      if (applied.synced) synced += 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de conexão durante a sincronização.";
    for (const operation of operations) await markNetworkRetry(operation, message);
  }

  const remaining = await listOfflineOperations();
  notifyOfflineChange();
  return {
    synced,
    pending: remaining.filter((op) => op.status === "pending").length,
    failed: remaining.filter((op) => op.status === "failed").length,
  };
}

export async function submitOfflineCapableOperation(
  type: OfflineOperationType,
  payload: Record<string, unknown>
): Promise<OfflineSubmitResult> {
  const operation = await addOfflineOperation(type, payload);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { queued: true, synced: false };
  }

  const result = await syncOfflineOperation(operation.id);

  // Se o servidor respondeu com um erro de negócio durante a operação que acabou de ser criada
  // online, mantemos o formulário como antes: não deixamos uma pendência desnecessária na fila.
  if (result.needsAttention) {
    await removeOfflineOperation(operation.id);
    return { ...result, queued: false };
  }

  return result;
}

export async function retryFailedOperation(id: string): Promise<OfflineSubmitResult> {
  const operation = await getOfflineOperation(id);
  if (!operation) return { queued: false, synced: true };
  await updateOfflineOperation({ ...operation, status: "pending", lastError: null });
  return await syncOfflineOperation(id);
}

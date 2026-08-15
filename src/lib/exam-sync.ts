/**
 * Tab-übergreifende Koordination (IndexedDB Last-Write vermeiden).
 * Nur im Browser; Server-Render ist ein No-Op.
 */

export type ExamSyncPayload =
  | { type: "saved"; examId: string; updatedAt?: string }
  | { type: "deleted"; examId: string };

export type ExamSyncMessage = ExamSyncPayload & { origin: string };

const CHANNEL = "examgrade-exam-sync";

export const examSyncOrigin =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function broadcastExamSync(msg: ExamSyncPayload): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ ...msg, origin: examSyncOrigin });
    ch.close();
  } catch {
    /* private mode / unsupported */
  }
}

export function subscribeExamSync(
  handler: (msg: ExamSyncMessage) => void
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (ev: MessageEvent<ExamSyncMessage>) => {
      const data = ev.data;
      if (!data || data.origin === examSyncOrigin) return;
      handler(data);
    };
    return () => ch.close();
  } catch {
    return () => {};
  }
}

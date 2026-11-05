import type { SessionSummary } from "@/lib/session-api";

export function selectionTutorThreadsBySourceMessage(
  sessions: SessionSummary[],
  parentSessionId: string,
): Map<number, SessionSummary[]> {
  const threadsBySourceMessage = new Map<number, SessionSummary[]>();

  for (const session of sessions) {
    const preferences = session.preferences;
    const sourceMessageId = preferences?.source_message_id;
    // Threads without a source stay discoverable through Chat history, not a message marker.
    if (
      preferences?.session_kind !== "selection_tutor" ||
      preferences.parent_session_id !== parentSessionId ||
      sourceMessageId == null
    ) {
      continue;
    }

    const threads = threadsBySourceMessage.get(sourceMessageId) ?? [];
    threads.push(session);
    threadsBySourceMessage.set(sourceMessageId, threads);
  }

  for (const threads of threadsBySourceMessage.values()) {
    threads.sort((a, b) => b.updated_at - a.updated_at);
  }

  return threadsBySourceMessage;
}

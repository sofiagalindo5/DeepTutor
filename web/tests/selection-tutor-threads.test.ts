import test from "node:test";
import assert from "node:assert/strict";

import type { SessionSummary } from "../lib/session-api";
import { selectionTutorThreadsBySourceMessage } from "../lib/selection-tutor-threads";

function session(
  id: string,
  updatedAt: number,
  preferences: SessionSummary["preferences"],
): SessionSummary {
  return {
    id,
    session_id: id,
    title: id,
    created_at: updatedAt,
    updated_at: updatedAt,
    message_count: 0,
    last_message: "",
    preferences,
  };
}

test("groups parent tutor threads by source message, newest first", () => {
  const older = session("older", 10, {
    session_kind: "selection_tutor",
    parent_session_id: "parent",
    source_message_id: 42,
  });
  const otherMessage = session("other-message", 20, {
    session_kind: "selection_tutor",
    parent_session_id: "parent",
    source_message_id: 43,
  });
  const newer = session("newer", 30, {
    session_kind: "selection_tutor",
    parent_session_id: "parent",
    source_message_id: 42,
  });

  const threads = selectionTutorThreadsBySourceMessage(
    [older, otherMessage, newer],
    "parent",
  );

  assert.deepEqual(threads.get(42), [newer, older]);
  assert.deepEqual(threads.get(43), [otherMessage]);
});

test("ignores other sessions and tutor threads without source message IDs", () => {
  const threads = selectionTutorThreadsBySourceMessage(
    [
      session("other-parent", 40, {
        session_kind: "selection_tutor",
        parent_session_id: "other",
        source_message_id: 42,
      }),
      session("other-kind", 30, {
        session_kind: "chat",
        parent_session_id: "parent",
        source_message_id: 42,
      }),
      session("no-source", 20, {
        session_kind: "selection_tutor",
        parent_session_id: "parent",
      }),
    ],
    "parent",
  );

  assert.equal(threads.size, 0);
});

test("groups fetched tutor sessions again after a reload", () => {
  const fetchedSessions = [
    session("first", 10, {
      session_kind: "selection_tutor",
      parent_session_id: "parent",
      source_message_id: 42,
    }),
    session("second", 20, {
      session_kind: "selection_tutor",
      parent_session_id: "parent",
      source_message_id: 42,
    }),
    session("third", 30, {
      session_kind: "selection_tutor",
      parent_session_id: "parent",
      source_message_id: 43,
    }),
  ];

  // A page reload loses transient tab state; persisted session summaries still rebuild the groups.
  const regrouped = selectionTutorThreadsBySourceMessage(
    fetchedSessions.map((item) => ({ ...item })),
    "parent",
  );

  assert.deepEqual(
    regrouped.get(42)?.map((item) => item.session_id),
    ["second", "first"],
  );
  assert.deepEqual(
    regrouped.get(43)?.map((item) => item.session_id),
    ["third"],
  );
});

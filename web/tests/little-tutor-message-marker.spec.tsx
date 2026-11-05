import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChatMessageList } from "@/features/chat/messages";
import { initI18n } from "@/i18n/init";
import { selectionTutorThreadsBySourceMessage } from "@/lib/selection-tutor-threads";
import type { SessionSummary } from "@/lib/session-api";

initI18n("en");

describe("Little Tutor message marker", () => {
  it("shows two threads under one source message and one under another", () => {
    const tutorSessions: SessionSummary[] = [
      tutorSession("first", "First", 42),
      tutorSession("second", "Second", 42),
      tutorSession("third", "Third", 43),
    ];
    const threadsByMessage = selectionTutorThreadsBySourceMessage(
      tutorSessions,
      "parent",
    );
    render(
      <ChatMessageList
        messages={[
          { id: 42, role: "assistant", content: "First source answer" },
          { id: 99, role: "user", content: "Next question", parentMessageId: 42 },
          {
            id: 43,
            role: "assistant",
            content: "Second source answer",
            parentMessageId: 99,
          },
        ]}
        isStreaming={false}
        tutorThreadsBySourceMessage={threadsByMessage}
        onCopyAssistantMessage={async () => undefined}
        onRegenerateMessage={() => undefined}
      />,
    );
    expect(screen.getByText("Little Tutor ×2")).toBeVisible();
    expect(screen.getByText("Little Tutor ×1")).toBeVisible();
  });

  it("does not render a marker when there are no tutor threads", () => {
    render(
      <ChatMessageList
        messages={[{ id: 42, role: "assistant", content: "Source answer" }]}
        isStreaming={false}
        tutorThreadsBySourceMessage={new Map()}
        onCopyAssistantMessage={async () => undefined}
        onRegenerateMessage={() => undefined}
      />,
    );

    expect(screen.queryByText(/Little Tutor ×/)).not.toBeInTheDocument();
  });

  it("lists threads with relative times and opens the selected thread", () => {
    const thread = tutorSession("thread-session", "Thread title", 42, {
      updated_at: Math.floor(Date.now() / 1000) - 60,
    });
    const otherThread = tutorSession("other-session", "Other title", 42);
    const onOpenTutorThread = vi.fn();
    render(
      <ChatMessageList
        messages={[{ id: 42, role: "assistant", content: "Source answer" }]}
        isStreaming={false}
        tutorThreadsBySourceMessage={new Map([[42, [thread, otherThread]]])}
        onOpenTutorThread={onOpenTutorThread}
        onCopyAssistantMessage={async () => undefined}
        onRegenerateMessage={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Little Tutor ×2" }));
    const dialog = screen.getByRole("dialog", { name: "Little Tutor" });
    expect(within(dialog).getByText("Thread title")).toBeVisible();
    expect(within(dialog).getByText("1 minute ago")).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: /Thread title/ }));

    expect(onOpenTutorThread).toHaveBeenCalledExactlyOnceWith(thread);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("regroups fetched sessions after a reload without in-memory tab state", () => {
    const fetchedSessions = [
      tutorSession("first", "First", 42),
      tutorSession("second", "Second", 42),
      tutorSession("third", "Third", 43),
    ];
    const reloadedGrouping = selectionTutorThreadsBySourceMessage(
      fetchedSessions.map((session) => ({ ...session })),
      "parent",
    );

    render(
      <ChatMessageList
        messages={[
          { id: 42, role: "assistant", content: "First source answer" },
          { id: 99, role: "user", content: "Next question", parentMessageId: 42 },
          {
            id: 43,
            role: "assistant",
            content: "Second source answer",
            parentMessageId: 99,
          },
        ]}
        isStreaming={false}
        tutorThreadsBySourceMessage={reloadedGrouping}
        onCopyAssistantMessage={async () => undefined}
        onRegenerateMessage={() => undefined}
      />,
    );

    expect(screen.getByText("Little Tutor ×2")).toBeVisible();
    expect(screen.getByText("Little Tutor ×1")).toBeVisible();
  });

  it("deletes a thread and removes its marker when the last thread is gone", async () => {
    const thread: SessionSummary = {
      id: "thread-id",
      session_id: "thread-session",
      title: "Thread title",
      created_at: 100,
      updated_at: 100,
      message_count: 2,
      last_message: "First question",
    };
    const secondThread: SessionSummary = {
      ...thread,
      id: "second-thread-id",
      session_id: "second-thread-session",
      title: "Second thread",
    };
    const onDeleteTutorThread = vi.fn(async (_session: SessionSummary) => true);
    function Harness() {
      const [threads, setThreads] = useState([thread, secondThread]);
      return (
        <ChatMessageList
          messages={[{ id: 42, role: "assistant", content: "Source answer" }]}
          isStreaming={false}
          tutorThreadsBySourceMessage={
            threads.length > 0 ? new Map([[42, threads]]) : new Map()
          }
          onDeleteTutorThread={async (session) => {
            const deleted = await onDeleteTutorThread(session);
            if (deleted) {
              setThreads((current) =>
                current.filter((item) => item.session_id !== session.session_id),
              );
            }
            return deleted;
          }}
          onCopyAssistantMessage={async () => undefined}
          onRegenerateMessage={() => undefined}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Little Tutor ×2" }));
    const dialog = screen.getByRole("dialog", { name: "Little Tutor" });
    const deleteButtons = within(dialog).getAllByRole("button", {
      name: "Delete",
    });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(onDeleteTutorThread).toHaveBeenCalledWith(thread);
      expect(screen.getByRole("button", { name: "Little Tutor ×1" })).toBeVisible();
      expect(within(dialog).queryByText("Thread title")).not.toBeInTheDocument();
      expect(within(dialog).getByText("Second thread")).toBeVisible();
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Delete",
      }),
    );
    await waitFor(() => {
      expect(onDeleteTutorThread).toHaveBeenCalledWith(secondThread);
      expect(
        screen.queryByRole("button", { name: "Little Tutor ×1" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

function tutorSession(
  sessionId: string,
  title: string,
  sourceMessageId: number,
  overrides: Partial<SessionSummary> = {},
): SessionSummary {
  return {
    id: sessionId,
    session_id: sessionId,
    title,
    created_at: 100,
    updated_at: 100,
    message_count: 2,
    last_message: title,
    preferences: {
      session_kind: "selection_tutor",
      parent_session_id: "parent",
      source_message_id: sourceMessageId,
    },
    ...overrides,
  };
}

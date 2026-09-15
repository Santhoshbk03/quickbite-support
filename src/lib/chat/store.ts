/**
 * Conversation state: persisted history, the active stream, and feedback.
 *
 * Streaming performance: events are queued and applied once per animation frame, so a fast token
 * stream causes one render per frame rather than one per token, and text lands smoothly. Persistence
 * is throttled and serialised lazily for the same reason — writing localStorage on every frame
 * would stutter the stream.
 */
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PersistStorage, StorageValue } from "zustand/middleware";

import { getChatClient, makeErrorEvent, MAX_MESSAGE_CHARS } from "@/lib/api";
import type { ChatRequest, ChatStreamEvent, FeedbackValue, HistoryMessage } from "@/lib/api";
import { ResilientChatClient } from "@/lib/api/resilient-client";
import { CONVERSATIONS_BY_ID } from "@/lib/fixtures";
import { createId } from "@/lib/ids";
import { applyStreamEvent, createAssistantTurn } from "./reducer";
import type {
  AssistantTurn,
  ChatTurn,
  Conversation,
  FeedbackMap,
  TurnSource,
  UserTurn,
} from "./types";
import { isAssistantTurn, isInFlight } from "./types";

/** Exchanges sent as context. Even, so user/assistant pairs are never split. */
const HISTORY_LIMIT = 20;
const TITLE_LIMIT = 60;
const REPLAY_PAUSE_MS = 1100;
const PERSIST_THROTTLE_MS = 600;
const STORAGE_KEY = "quickbite.chat.v1";

interface PersistedChat {
  conversations: Record<string, Conversation>;
  order: string[];
  activeId: string | null;
  feedback: FeedbackMap;
}

export interface ChatState extends PersistedChat {
  streamingTurnId: string | null;
  /** Conversation currently being auto-played from a scripted session. */
  replayingId: string | null;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  send: (text: string) => Promise<void>;
  /** Regenerate the last answer, or retry one that failed or was stopped. */
  regenerate: (assistantTurnId: string) => Promise<void>;
  stop: () => void;
  setFeedback: (turnId: string, value: FeedbackValue | null) => void;
  replay: (scriptedConversationId: string) => Promise<void>;
}

let activeController: AbortController | null = null;

const iso = () => new Date().toISOString();

/**
 * Persist writes on every change. A change made before rehydration finishes would write the empty
 * initial state over the saved history, so mutations wait for hydration.
 */
const hydrated = () => useChatStore.persist.hasHydrated();
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function currentSource(): TurnSource {
  const client = getChatClient();
  if (client instanceof ResilientChatClient && client.isFallbackActive) return "replay";
  return client.mode;
}

function titleFrom(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > TITLE_LIMIT
    ? `${singleLine.slice(0, TITLE_LIMIT - 1).trimEnd()}…`
    : singleLine;
}

/** Completed exchanges only: a failed or stopped answer is not context the model actually gave. */
function buildHistory(turns: ChatTurn[]): HistoryMessage[] {
  const history: HistoryMessage[] = [];
  turns.forEach((turn, index) => {
    if (turn.role !== "user") return;
    const reply = turns[index + 1];
    if (!reply || !isAssistantTurn(reply) || reply.status !== "complete") return;
    history.push({ role: "user", id: turn.id, content: turn.content });
    history.push({
      role: "assistant",
      id: reply.serverId,
      content: reply.content,
      tool_calls: reply.toolCalls
        .filter((call) => call.result?.status === "success")
        .map((call) => ({
          name: call.name,
          arguments: call.arguments,
          result: call.result?.result ?? null,
        })),
    });
  });
  return history.slice(-HISTORY_LIMIT);
}

function findConversationOfTurn(
  conversations: Record<string, Conversation>,
  turnId: string,
): Conversation | null {
  for (const conversation of Object.values(conversations)) {
    if (conversation.turns.some((turn) => turn.id === turnId)) return conversation;
  }
  return null;
}

function patchConversation(
  state: ChatState,
  conversationId: string,
  patch: (conversation: Conversation) => Conversation,
): Pick<ChatState, "conversations"> {
  const conversation = state.conversations[conversationId];
  if (!conversation) return { conversations: state.conversations };
  return { conversations: { ...state.conversations, [conversationId]: patch(conversation) } };
}

function patchTurn(
  state: ChatState,
  conversationId: string,
  turnId: string,
  update: (turn: AssistantTurn) => AssistantTurn,
): Pick<ChatState, "conversations"> {
  return patchConversation(state, conversationId, (conversation) => ({
    ...conversation,
    turns: conversation.turns.map((turn) =>
      turn.id === turnId && isAssistantTurn(turn) ? update(turn) : turn,
    ),
  }));
}

type SetState = (partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>)) => void;
type GetState = () => ChatState;

async function runStream(
  set: SetState,
  get: GetState,
  conversationId: string,
  turnId: string,
  request: ChatRequest,
): Promise<void> {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  set({ streamingTurnId: turnId });

  let queue: ChatStreamEvent[] = [];
  let frame: number | null = null;

  const flush = () => {
    frame = null;
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    set((state) =>
      patchTurn(state, conversationId, turnId, (turn) => batch.reduce(applyStreamEvent, turn)),
    );
  };

  const flushNow = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    flush();
  };

  try {
    for await (const event of getChatClient().streamChat(request, { signal: controller.signal })) {
      queue.push(event);
      if (event.type === "message.start") {
        flushNow();
        // Record which source answered *after* the resilient client has made its decision.
        const source = currentSource();
        set((state) => patchTurn(state, conversationId, turnId, (turn) => ({ ...turn, source })));
      } else if (event.type === "message.end" || event.type === "error") {
        flushNow();
      } else if (document.visibilityState === "hidden") {
        // requestAnimationFrame never fires in a background tab; apply now so nothing waits in the queue.
        flushNow();
      } else if (frame === null) {
        frame = requestAnimationFrame(flush);
      }
    }
  } catch (error) {
    // Clients turn every expected failure into an event, so only genuine bugs arrive here.
    queue.push(
      makeErrorEvent(
        "internal_error",
        error instanceof Error ? error.message : "Something went wrong while streaming.",
      ),
    );
  } finally {
    flushNow();

    const turn = get().conversations[conversationId]?.turns.find(
      (candidate) => candidate.id === turnId,
    );
    if (turn && isAssistantTurn(turn) && isInFlight(turn)) {
      const aborted = controller.signal.aborted;
      set((state) =>
        patchTurn(state, conversationId, turnId, (current) =>
          aborted
            ? { ...current, status: "stopped", phase: null, phaseLabel: null, completedAt: iso() }
            : applyStreamEvent(
                current,
                makeErrorEvent(
                  "stream_interrupted",
                  "The connection closed before the answer finished.",
                ),
              ),
        ),
      );
    }

    if (activeController === controller) activeController = null;
    set((state) => ({
      streamingTurnId: state.streamingTurnId === turnId ? null : state.streamingTurnId,
      ...patchConversation(state, conversationId, (conversation) => ({
        ...conversation,
        updatedAt: iso(),
      })),
    }));
  }
}

/* -----------------------------------------------------------------------------------------------
 * Throttled persistence
 * ---------------------------------------------------------------------------------------------*/

function createThrottledStorage(): PersistStorage<PersistedChat> {
  let pending: { name: string; value: StorageValue<PersistedChat> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (!pending) return;
    const { name, value } = pending;
    pending = null;
    try {
      window.localStorage.setItem(name, JSON.stringify(value));
    } catch {
      // Quota or blocked storage: the session keeps working, it just won't survive a reload.
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return {
    getItem: (name) => {
      try {
        const raw = window.localStorage.getItem(name);
        return raw ? (JSON.parse(raw) as StorageValue<PersistedChat>) : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending = { name, value };
      timer ??= setTimeout(flush, PERSIST_THROTTLE_MS);
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name);
      } catch {
        // Ignore.
      }
    },
  };
}

/** A reload mid-answer leaves a turn in flight forever; settle those as stopped. */
function settleInterruptedTurns(conversations: Record<string, Conversation>) {
  return Object.fromEntries(
    Object.entries(conversations).map(([id, conversation]) => [
      id,
      {
        ...conversation,
        turns: conversation.turns.map((turn) =>
          isAssistantTurn(turn) && isInFlight(turn)
            ? { ...turn, status: "stopped" as const, phase: null, phaseLabel: null }
            : turn,
        ),
      },
    ]),
  );
}

/* -----------------------------------------------------------------------------------------------
 * Store
 * ---------------------------------------------------------------------------------------------*/

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: {},
      order: [],
      activeId: null,
      feedback: {},
      streamingTurnId: null,
      replayingId: null,

      newConversation: () => {
        if (!hydrated()) return;
        set({ activeId: null });
      },

      selectConversation: (id) => {
        if (hydrated() && get().conversations[id]) set({ activeId: id });
      },

      deleteConversation: (id) => {
        if (!hydrated()) return;
        const conversation = get().conversations[id];
        if (!conversation) return;
        const streaming = get().streamingTurnId;
        if (streaming && conversation.turns.some((turn) => turn.id === streaming)) {
          activeController?.abort();
        }
        const turnIds = new Set(conversation.turns.map((turn) => turn.id));
        set((state) => {
          const conversations = { ...state.conversations };
          delete conversations[id];
          return {
            conversations,
            order: state.order.filter((candidate) => candidate !== id),
            activeId: state.activeId === id ? null : state.activeId,
            feedback: Object.fromEntries(
              Object.entries(state.feedback).filter(([turnId]) => !turnIds.has(turnId)),
            ),
          };
        });
      },

      send: async (text) => {
        const content = text.trim().slice(0, MAX_MESSAGE_CHARS);
        if (!hydrated() || !content || get().streamingTurnId) return;

        const now = iso();
        let conversationId = get().activeId;
        if (!conversationId || !get().conversations[conversationId]) {
          const id = createId("conv");
          conversationId = id;
          set((state) => ({
            conversations: {
              ...state.conversations,
              [id]: {
                id,
                title: titleFrom(content),
                createdAt: now,
                updatedAt: now,
                turns: [],
                replayOf: null,
              },
            },
            order: [id, ...state.order.filter((candidate) => candidate !== id)],
            activeId: id,
          }));
        }

        const targetId = conversationId;
        const history = buildHistory(get().conversations[targetId]?.turns ?? []);
        const userTurn: UserTurn = { id: createId("msg_u"), role: "user", content, createdAt: now };
        const assistantTurn = createAssistantTurn({
          id: createId("turn"),
          replyTo: userTurn.id,
          source: currentSource(),
          createdAt: now,
        });

        set((state) => ({
          ...patchConversation(state, targetId, (conversation) => ({
            ...conversation,
            updatedAt: now,
            turns: [...conversation.turns, userTurn, assistantTurn],
          })),
          order: [targetId, ...state.order.filter((candidate) => candidate !== targetId)],
        }));

        await runStream(set, get, targetId, assistantTurn.id, {
          conversation_id: targetId,
          message: { id: userTurn.id, content },
          history,
          options: null,
        });
      },

      regenerate: async (assistantTurnId) => {
        if (!hydrated() || get().streamingTurnId) return;
        const conversation = findConversationOfTurn(get().conversations, assistantTurnId);
        if (!conversation) return;

        const index = conversation.turns.findIndex((turn) => turn.id === assistantTurnId);
        const turn = conversation.turns[index];
        // Only the latest answer can be regenerated; rewriting the middle of a thread would silently
        // invalidate every later turn that depended on it.
        if (!turn || !isAssistantTurn(turn) || index !== conversation.turns.length - 1) return;

        const userIndex = conversation.turns.findIndex(
          (candidate) => candidate.id === turn.replyTo,
        );
        const userTurn = conversation.turns[userIndex];
        if (!userTurn || userTurn.role !== "user") return;

        const fresh = createAssistantTurn({
          id: createId("turn"),
          replyTo: userTurn.id,
          source: currentSource(),
          createdAt: iso(),
        });

        set((state) => {
          const feedback = { ...state.feedback };
          delete feedback[assistantTurnId];
          return {
            feedback,
            ...patchConversation(state, conversation.id, (current) => ({
              ...current,
              turns: [...current.turns.slice(0, index), fresh],
            })),
          };
        });

        await runStream(set, get, conversation.id, fresh.id, {
          conversation_id: conversation.id,
          message: { id: userTurn.id, content: userTurn.content },
          history: buildHistory(conversation.turns.slice(0, userIndex)),
          options: { regenerate_of: turn.serverId },
        });
      },

      stop: () => {
        activeController?.abort();
      },

      setFeedback: (turnId, value) => {
        if (!hydrated()) return;
        set((state) => {
          const feedback = { ...state.feedback };
          if (value === null) delete feedback[turnId];
          else feedback[turnId] = value;
          return { feedback };
        });

        const conversation = findConversationOfTurn(get().conversations, turnId);
        const turn = conversation?.turns.find((candidate) => candidate.id === turnId);
        if (!conversation || !turn || !isAssistantTurn(turn) || !turn.serverId) return;
        // Stored locally regardless; the server copy is best-effort (POST /feedback is optional).
        void getChatClient()
          .submitFeedback({
            conversation_id: conversation.id,
            message_id: turn.serverId,
            trace_id: turn.metadata?.trace_id ?? null,
            value,
            comment: null,
          })
          .catch(() => undefined);
      },

      replay: async (scriptedConversationId) => {
        const script = CONVERSATIONS_BY_ID.get(scriptedConversationId);
        if (!hydrated() || !script || get().streamingTurnId || get().replayingId) return;

        const conversationId = createId("conv");
        const now = iso();
        set((state) => ({
          conversations: {
            ...state.conversations,
            [conversationId]: {
              id: conversationId,
              title: script.title,
              createdAt: now,
              updatedAt: now,
              turns: [],
              replayOf: scriptedConversationId,
            },
          },
          order: [conversationId, ...state.order],
          activeId: conversationId,
          replayingId: conversationId,
        }));

        try {
          for (const [index, turn] of script.turns.entries()) {
            if (index > 0) await pause(REPLAY_PAUSE_MS);
            // Stop auto-playing the moment the viewer navigates elsewhere.
            if (get().activeId !== conversationId) break;
            await get().send(turn.user);
            const last = get().conversations[conversationId]?.turns.at(-1);
            if (!last || !isAssistantTurn(last) || last.status !== "complete") break;
          }
        } finally {
          set((state) => ({
            replayingId: state.replayingId === conversationId ? null : state.replayingId,
          }));
        }
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createThrottledStorage(),
      skipHydration: true,
      partialize: (state): PersistedChat => ({
        conversations: state.conversations,
        order: state.order,
        activeId: state.activeId,
        feedback: state.feedback,
      }),
      merge: (persisted, current) => {
        try {
          const saved = persisted as Partial<PersistedChat> | undefined;
          if (!saved || typeof saved !== "object") return current;
          const conversations = settleInterruptedTurns(saved.conversations ?? {});
          return {
            ...current,
            conversations,
            order: (saved.order ?? []).filter((id) => id in conversations),
            activeId: saved.activeId && saved.activeId in conversations ? saved.activeId : null,
            feedback: saved.feedback ?? {},
          };
        } catch {
          // Corrupt storage should cost the history, never the app.
          return current;
        }
      },
    },
  ),
);

export function rehydrateChat(): void {
  void useChatStore.persist.rehydrate();
}

export function useChatHydrated(): boolean {
  return useSyncExternalStore(
    (listener) => useChatStore.persist.onFinishHydration(listener),
    () => useChatStore.persist.hasHydrated(),
    () => false,
  );
}

export function useActiveConversation(): Conversation | null {
  return useChatStore((state) =>
    state.activeId ? (state.conversations[state.activeId] ?? null) : null,
  );
}

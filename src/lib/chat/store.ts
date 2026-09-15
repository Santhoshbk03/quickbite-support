/**
 * Conversations, persisted to localStorage. One request at a time: while a reply is pending the
 * composer is disabled everywhere.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { api, ApiError } from "@/lib/api";
import type { ChatTurn, Order, Source } from "@/lib/api";
import { truncate } from "@/lib/format";
import { createId } from "@/lib/ids";

const MAX_CONVERSATIONS = 30;
const MAX_HISTORY_TURNS = 20;

export type Rating = "up" | "down";

export interface UserMessage {
  id: string;
  role: "user";
  content: string;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  createdAt: string;
  status: "done" | "error";
  content: string;
  sources: Source[];
  order: Order | null;
  refused: boolean;
  suggestions: string[];
  feedback: Rating | null;
  /** Set when status is "error". */
  error: string | null;
}

export type ChatMessage = UserMessage | AssistantMessage;

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

interface ChatState {
  /** False until localStorage has been read. Actions are ignored before then. */
  hydrated: boolean;
  conversations: Conversation[];
  activeId: string | null;
  /** The conversation waiting on a reply, if any. */
  pendingId: string | null;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  send: (text: string) => Promise<void>;
  /** Open a fresh conversation with a first message, e.g. from an order page. */
  startConversation: (text: string) => Promise<void>;
  retry: (messageId: string) => Promise<void>;
  rate: (messageId: string, rating: Rating) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => {
      const updateConversation = (
        id: string,
        update: (conversation: Conversation) => Conversation,
      ) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === id ? update(conversation) : conversation,
          ),
        }));

      /** Ask the API about the conversation's last user message and append the reply. */
      async function ask(conversationId: string, text: string) {
        const conversation = get().conversations.find((item) => item.id === conversationId);
        if (!conversation) return;

        const history: ChatTurn[] = conversation.messages
          .slice(0, -1)
          .filter((message) => message.role === "user" || message.status === "done")
          .map((message) => ({ role: message.role, content: message.content }))
          .slice(-MAX_HISTORY_TURNS);

        set({ pendingId: conversationId });
        let reply: AssistantMessage;
        try {
          const response = await api.chat({ session_id: conversationId, message: text, history });
          reply = {
            id: response.message_id,
            role: "assistant",
            createdAt: new Date().toISOString(),
            status: "done",
            content: response.answer,
            sources: response.sources,
            order: response.order ?? null,
            refused: response.refused,
            suggestions: response.suggestions ?? [],
            feedback: null,
            error: null,
          };
        } catch (error) {
          reply = {
            id: createId("err"),
            role: "assistant",
            createdAt: new Date().toISOString(),
            status: "error",
            content: "",
            sources: [],
            order: null,
            refused: false,
            suggestions: [],
            feedback: null,
            error: ApiError.from(error).message,
          };
        }

        if (get().pendingId === conversationId) set({ pendingId: null });
        updateConversation(conversationId, (item) => ({
          ...item,
          updatedAt: reply.createdAt,
          messages: [...item.messages, reply],
        }));
      }

      return {
        hydrated: false,
        conversations: [],
        activeId: null,
        pendingId: null,

        newConversation: () => set({ activeId: null }),

        selectConversation: (id) => {
          if (get().conversations.some((conversation) => conversation.id === id)) {
            set({ activeId: id });
          }
        },

        deleteConversation: (id) =>
          set((state) => ({
            conversations: state.conversations.filter((conversation) => conversation.id !== id),
            activeId: state.activeId === id ? null : state.activeId,
            pendingId: state.pendingId === id ? null : state.pendingId,
          })),

        send: async (raw) => {
          const text = raw.trim();
          const state = get();
          if (!state.hydrated || !text || state.pendingId) return;

          const now = new Date().toISOString();
          const message: UserMessage = {
            id: createId("msg"),
            role: "user",
            content: text,
            createdAt: now,
          };
          const existing = state.conversations.find((item) => item.id === state.activeId);

          if (existing) {
            updateConversation(existing.id, (item) => ({
              ...item,
              updatedAt: now,
              messages: [...item.messages, message],
            }));
            await ask(existing.id, text);
            return;
          }

          const conversation: Conversation = {
            id: createId("conv"),
            title: truncate(text, 60),
            createdAt: now,
            updatedAt: now,
            messages: [message],
          };
          set((current) => ({
            activeId: conversation.id,
            conversations: [conversation, ...current.conversations].slice(0, MAX_CONVERSATIONS),
          }));
          await ask(conversation.id, text);
        },

        startConversation: async (text) => {
          if (!get().hydrated || get().pendingId) return;
          set({ activeId: null });
          await get().send(text);
        },

        retry: async (messageId) => {
          const state = get();
          if (state.pendingId) return;
          const conversation = state.conversations.find((item) =>
            item.messages.some((message) => message.id === messageId),
          );
          if (!conversation) return;
          const index = conversation.messages.findIndex((message) => message.id === messageId);
          const question = conversation.messages[index - 1];
          if (question?.role !== "user") return;

          updateConversation(conversation.id, (item) => ({
            ...item,
            messages: item.messages.filter((message) => message.id !== messageId),
          }));
          set({ activeId: conversation.id });
          await ask(conversation.id, question.content);
        },

        rate: (messageId, rating) => {
          const conversation = get().conversations.find((item) =>
            item.messages.some((message) => message.id === messageId),
          );
          const target = conversation?.messages.find((message) => message.id === messageId);
          if (!conversation || target?.role !== "assistant" || target.status !== "done") return;

          const next = target.feedback === rating ? null : rating;
          updateConversation(conversation.id, (item) => ({
            ...item,
            messages: item.messages.map((message) =>
              message.id === messageId && message.role === "assistant"
                ? { ...message, feedback: next }
                : message,
            ),
          }));
          if (next) {
            // Feedback is best-effort: a failed send never interrupts the conversation.
            api
              .sendFeedback({ session_id: conversation.id, message_id: messageId, rating: next })
              .catch(() => undefined);
          }
        },
      };
    },
    {
      name: "quickbite.chat.v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ conversations: state.conversations, activeId: state.activeId }),
      onRehydrateStorage: () => () => useChatStore.setState({ hydrated: true }),
    },
  ),
);

export function rehydrateChat(): void {
  if (!useChatStore.getState().hydrated) void useChatStore.persist.rehydrate();
}

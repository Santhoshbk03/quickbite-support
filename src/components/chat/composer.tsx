"use client";

import { ArrowUp, Square } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/primitives";
import { MAX_MESSAGE_CHARS } from "@/lib/api";
import { useChatHydrated, useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export const COMPOSER_INPUT_ID = "composer-input";
const MAX_HEIGHT_PX = 220;

export function Composer() {
  const hydrated = useChatHydrated();
  const send = useChatStore((state) => state.send);
  const stop = useChatStore((state) => state.stop);
  const streaming = useChatStore((state) => state.streamingTurnId !== null);
  const replaying = useChatStore((state) => state.replayingId !== null);
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedLength = value.trim().length;
  const overLimit = value.length > MAX_MESSAGE_CHARS;
  const canSend = hydrated && !streaming && trimmedLength > 0 && !overLimit;

  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  };

  const submit = () => {
    if (!canSend) return;
    void send(value);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-5">
      <form
        className={cn(
          "mx-auto flex max-w-3xl flex-col rounded-xl border border-line-strong bg-surface-2 shadow-2 transition-[border-color,box-shadow] duration-150",
          "focus-within:border-brand-line focus-within:shadow-[var(--elev-2),0_0_0_3px_var(--brand-soft)]",
        )}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor={COMPOSER_INPUT_ID} className="sr-only">
          Ask QuickBite Support
        </label>
        <textarea
          id={COMPOSER_INPUT_ID}
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={!hydrated}
          placeholder={
            replaying
              ? "Replaying a recorded session…"
              : "Ask about an order, a refund, or a policy…"
          }
          aria-describedby="composer-hint"
          className="max-h-[220px] min-h-[52px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[0.9375rem] leading-relaxed text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed"
          onChange={(event) => {
            setValue(event.target.value);
            resize(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex items-center gap-3 px-2.5 pb-2.5 pl-4">
          <p
            id="composer-hint"
            className="hidden min-w-0 flex-1 items-center gap-1.5 text-2xs text-fg-subtle sm:flex"
          >
            <Kbd>Enter</Kbd> to send
            <span aria-hidden className="text-line-strong">
              ·
            </span>
            <Kbd>Shift</Kbd>
            <Kbd>Enter</Kbd> new line
          </p>
          <span className="sr-only sm:hidden">
            Press Enter to send, Shift and Enter for a new line.
          </span>
          {value.length > MAX_MESSAGE_CHARS * 0.85 ? (
            <span
              className={cn(
                "ml-auto font-mono text-2xs tabular",
                overLimit ? "text-danger" : "text-fg-subtle",
              )}
              aria-live="polite"
            >
              {value.length.toLocaleString()} / {MAX_MESSAGE_CHARS.toLocaleString()}
            </span>
          ) : (
            <span className="ml-auto sm:hidden" />
          )}
          {streaming ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={stop}
              aria-label="Stop generating"
            >
              <Square className="fill-current" aria-hidden />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="icon"
              disabled={!canSend}
              aria-label="Send message"
            >
              <ArrowUp aria-hidden />
            </Button>
          )}
        </div>
      </form>
      <p className="mx-auto mt-2 max-w-3xl px-1 text-center text-2xs text-fg-subtle">
        Answers come only from QuickBite policy documents and order data. Anything else gets a
        refusal, not a guess.
      </p>
    </div>
  );
}

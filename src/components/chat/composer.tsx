"use client";

import { ArrowUp } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const MAX_LENGTH = 2000;
const MAX_HEIGHT_PX = 200;

export function Composer({
  onSend,
  disabled,
  busy,
}: {
  onSend: (text: string) => void;
  /** Not ready yet (history still loading). */
  disabled: boolean;
  /** A reply is pending. Typing is allowed; sending waits. */
  busy: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !busy && value.trim().length > 0;

  const resize = () => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  };

  const submit = () => {
    if (!canSend) return;
    onSend(value);
    setValue("");
    // Back to one line right away; the cleared value only renders on the next update.
    if (textareaRef.current) textareaRef.current.style.height = "";
  };

  return (
    <div className="shrink-0 bg-canvas px-4 pb-4 pt-2 sm:px-6">
      <form
        className="mx-auto max-w-3xl"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2 rounded-lg border border-line-strong bg-surface-2 p-2 shadow-1 transition-colors focus-within:border-brand-line">
          <label htmlFor="composer" className="sr-only">
            Message QuickBite Support
          </label>
          <textarea
            id="composer"
            ref={textareaRef}
            rows={1}
            value={value}
            maxLength={MAX_LENGTH}
            disabled={disabled}
            placeholder="Ask about an order or a policy…"
            onChange={(event) => {
              setValue(event.target.value);
              resize();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[0.9375rem] leading-6 text-fg outline-none placeholder:text-fg-subtle disabled:opacity-60"
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            aria-label="Send message"
            disabled={!canSend}
            loading={busy}
          >
            {busy ? null : <ArrowUp aria-hidden />}
          </Button>
        </div>
        <p className="mt-2 text-center text-2xs text-fg-subtle">
          Enter to send, Shift + Enter for a new line
        </p>
      </form>
    </div>
  );
}

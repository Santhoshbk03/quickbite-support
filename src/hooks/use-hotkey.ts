import { useEffect, useRef } from "react";

export interface HotkeyOptions {
  /** Require Ctrl on Windows/Linux or ⌘ on macOS. */
  mod?: boolean;
  shift?: boolean;
  /** Fire even while typing in an input or textarea. Defaults to true only for mod combos. */
  allowInInputs?: boolean;
  enabled?: boolean;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
}

export function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {},
) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const { mod = false, shift = false, enabled = true } = options;
  const allowInInputs = options.allowInInputs ?? mod;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      const modPressed = event.metaKey || event.ctrlKey;
      if (mod !== modPressed || shift !== event.shiftKey || event.altKey) return;
      if (!allowInInputs && isEditable(event.target)) return;
      event.preventDefault();
      handlerRef.current(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, mod, shift, allowInInputs, enabled]);
}

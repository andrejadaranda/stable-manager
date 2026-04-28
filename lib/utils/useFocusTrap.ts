"use client";

// Tiny focus-trap hook for modals.
//
// Why we built this instead of pulling react-aria
//   * The app already has its own dialog primitives (just a fixed div +
//     Esc/click-out handlers). We don't want to take a 60kB+ dependency
//     for one feature.
//   * Implementation is < 30 lines and has no edge cases that matter
//     for our forms (no nested dialogs, no focusable elements outside
//     the visible viewport, no async portals).
//
// Behavior
//   * On mount, focus the first focusable element (or the ref's element).
//   * Tab on the last element wraps to the first.
//   * Shift+Tab on the first element wraps to the last.
//   * Tab on elements outside the trap is intercepted and re-routed in.
//   * Returning focus to the trigger is the caller's job — they own when
//     the modal unmounts and where focus should go after.

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useFocusTrap(containerRef: RefObject<HTMLElement>, active = true) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    function focusable(): HTMLElement[] {
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("data-focus-trap-skip"));
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last  = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // Focus is outside the trap (e.g. the user clicked into the body
      // and is now Tabbing). Pull it back in.
      if (!active || !container || !container.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [containerRef, active]);
}

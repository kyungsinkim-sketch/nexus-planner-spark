/**
 * useKeyboardViewport — Shared iOS/Android on-screen-keyboard viewport tracking.
 *
 * The chronic mobile bug this solves: when the keyboard opens, iOS Safari
 * *pans* the layout viewport to keep the focused input visible. Fighting the
 * pan with `window.scrollTo(0, 0)` inside the resize handler loses the race —
 * iOS re-pans asynchronously after focus — so `position: fixed; top: 0`
 * containers end up partially above the visible area, leaving a dead gap
 * between the input and the keyboard.
 *
 * Two mechanisms work together:
 *
 * 1. PAN TRACKING — `offsetTop` is how far the visual viewport is panned
 *    inside the layout viewport. Fixed containers apply
 *    `transform: translateY(offsetTop)` so they always cover exactly the
 *    visible area, wherever iOS pans it.
 *
 * 2. FOCUS-FIRST DETECTION — on the FIRST keyboard open after page load,
 *    iOS fires visualViewport events late/mid-animation, so a breakout
 *    driven only by viewport resize loses the race (first tap broken,
 *    second tap fine — geometry is cached by then). `focusin` on an
 *    editable element fires synchronously on tap, so we flip keyboardOpen
 *    immediately and then burst-track geometry through the ~1s animation
 *    window with rAF.
 *
 * Usage:
 *   const { height, offsetTop, keyboardOpen } = useKeyboardViewport();
 *   <div
 *     className={keyboardOpen ? 'fixed top-0 left-0 right-0 z-50' : 'h-full'}
 *     style={keyboardOpen ? { height, transform: `translateY(${offsetTop}px)` } : undefined}
 *   >
 */

import { useEffect, useState } from 'react';

export interface KeyboardViewport {
  /** Visual viewport height in px (shrinks when the keyboard is shown) */
  height: number;
  /** Pan offset of the visual viewport within the layout viewport */
  offsetTop: number;
  /** True while the on-screen keyboard is (very likely) visible */
  keyboardOpen: boolean;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable
  );
}

export function useKeyboardViewport(): KeyboardViewport {
  const [state, setState] = useState<KeyboardViewport>(() => ({
    height: window.visualViewport?.height || window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop || 0,
    keyboardOpen: false,
  }));

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let editableFocused = false;
    let wasOpen = false;
    let burstRaf: number | null = null;
    let burstUntil = 0;

    const read = () => {
      // Editable focus is the primary signal (fires synchronously on tap,
      // before iOS pans). The innerHeight/vv.height gap is the fallback for
      // cases like keyboard dismissal via the OS bar without a blur.
      const heightGap = window.innerHeight - vv.height > 100;
      const keyboardOpen = editableFocused || heightGap;
      setState((prev) => {
        const next = { height: vv.height, offsetTop: vv.offsetTop, keyboardOpen };
        if (
          prev.height === next.height &&
          prev.offsetTop === next.offsetTop &&
          prev.keyboardOpen === next.keyboardOpen
        ) return prev; // avoid re-render churn during the rAF burst
        return next;
      });

      // When the keyboard closes, restore any leftover pan once.
      if (wasOpen && !keyboardOpen) window.scrollTo(0, 0);
      wasOpen = keyboardOpen;
    };

    // Track geometry continuously through the keyboard show/hide animation —
    // iOS fires resize/scroll sparsely (or late) during the FIRST animation
    // after page load, so event-driven reads alone arrive too late.
    const burst = (durationMs: number) => {
      burstUntil = performance.now() + durationMs;
      if (burstRaf !== null) return; // already running — just extended
      const tick = () => {
        read();
        if (performance.now() < burstUntil) {
          burstRaf = requestAnimationFrame(tick);
        } else {
          burstRaf = null;
        }
      };
      burstRaf = requestAnimationFrame(tick);
    };

    const onViewportChange = () => {
      read();
      burst(300); // keep tracking briefly after each event settles
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target)) return;
      editableFocused = true;
      read();       // flip keyboardOpen NOW, before iOS pans
      burst(1000);  // then follow the whole keyboard animation
    };

    const onFocusOut = () => {
      editableFocused = false;
      // Delay slightly — focus may be moving between inputs (blur→focus)
      setTimeout(read, 50);
      burst(600);
    };

    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      if (burstRaf !== null) cancelAnimationFrame(burstRaf);
      burstUntil = 0;
    };
  }, []);

  return state;
}

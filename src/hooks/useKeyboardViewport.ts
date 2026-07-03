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
 * Instead of fighting the pan, track it: `offsetTop` is how far the visual
 * viewport is panned inside the layout viewport. Fixed containers should
 * apply `transform: translateY(offsetTop)` so they always cover exactly the
 * visible area.
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

export function useKeyboardViewport(): KeyboardViewport {
  const [state, setState] = useState<KeyboardViewport>(() => ({
    height: window.visualViewport?.height || window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop || 0,
    keyboardOpen: false,
  }));

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let wasOpen = false;

    const read = () => {
      // window.innerHeight (layout viewport) does NOT shrink when the iOS
      // keyboard opens, while vv.height does — a stable signal that doesn't
      // depend on a stale "initial height" captured at mount (which broke
      // after URL-bar collapse or orientation changes).
      const keyboardOpen = window.innerHeight - vv.height > 100;
      setState({ height: vv.height, offsetTop: vv.offsetTop, keyboardOpen });

      // When the keyboard closes, restore any leftover pan once.
      if (wasOpen && !keyboardOpen) window.scrollTo(0, 0);
      wasOpen = keyboardOpen;
    };

    const update = () => {
      read();
      // iOS fires resize mid-animation; re-read after the pan settles
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(read, 250);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    // Keyboard can dismiss without a final resize event (e.g. "Done" button)
    document.addEventListener('focusout', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.removeEventListener('focusout', update);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);

  return state;
}

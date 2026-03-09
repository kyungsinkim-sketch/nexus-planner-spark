import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Detect mobile: width < 768px OR (touch device in landscape with height < 500px).
 * This prevents landscape phones from switching to desktop layout.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const check = () => {
      const narrow = window.innerWidth < MOBILE_BREAKPOINT;
      // Touch device in landscape with small height = still mobile
      const touchLandscape = isTouchDevice && window.innerHeight < 500 && window.innerWidth < 1200;
      setIsMobile(narrow || touchLandscape);
    };

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener("change", check);
    window.addEventListener("resize", check);
    // Also listen to orientation change
    window.addEventListener("orientationchange", () => setTimeout(check, 100));
    check();

    return () => {
      mql.removeEventListener("change", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return !!isMobile;
}

/**
 * useIsMobile Hook
 * Detects if the current viewport is mobile-sized
 */

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768; // matches Tailwind's 'md' breakpoint

export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
    );

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        // Set initial value
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
}

export default useIsMobile;

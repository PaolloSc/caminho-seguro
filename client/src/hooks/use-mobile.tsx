import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      const isMobileSize = window.innerWidth < MOBILE_BREAKPOINT;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      // We prioritize screen width for layout, but can consider touch for specific behaviors
      setIsMobile(isMobileSize || (isTouchDevice && window.innerWidth < 1024));
    }
    mql.addEventListener("change", onChange)
    onChange(); // Initialize correctly
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

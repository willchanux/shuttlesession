import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { releaseStuckPointerEvents } from "@/utils/releaseStuckPointerEvents";

/**
 * After moving to another page, make sure no dialog from the old page has left
 * the new one unclickable. A dialog that is still open when its page goes away
 * can leave the page-wide block behind.
 */
export function PointerEventsGuard() {
  const location = useLocation();

  useEffect(() => {
    const timers = [100, 600, 1500].map(delay => setTimeout(() => releaseStuckPointerEvents(), delay));
    return () => timers.forEach(clearTimeout);
  }, [location.pathname]);

  return null;
}

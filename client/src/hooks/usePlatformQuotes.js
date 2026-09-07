import { useCallback, useEffect, useState } from "react";

import {
  getWorkflowState,
  refreshPlatformQuotes,
  subscribeToPlatformQuotes,
} from "../utils/quoteWorkflow";

/**
 * Subscribe a component to the shared platform quote store.
 *
 * Fetches on mount and re-renders whenever any portal mutates a quote, so the
 * freight agent's approval is reflected on the customer's screen without a
 * manual reload.
 */
export function usePlatformQuotes({ autoLoad = true } = {}) {
  const [state, setState] = useState(() => getWorkflowState());

  useEffect(() => {
    const unsubscribe = subscribeToPlatformQuotes(() => setState(getWorkflowState()));
    if (autoLoad) refreshPlatformQuotes();
    return unsubscribe;
  }, [autoLoad]);

  const reload = useCallback(() => refreshPlatformQuotes(), []);

  return {
    quotes: state.quotes,
    loading: state.loading,
    error: state.error,
    reload,
  };
}

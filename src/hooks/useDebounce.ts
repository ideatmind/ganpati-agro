import { useEffect, useState } from "react";

/**
 * Debounces a value by the specified delay.
 * Returns the debounced value — only updates after the user stops
 * changing the input for `delay` ms.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

import { useEffect, useRef, useState } from 'react';

/** Values that glide to their new targets over `duration` ms (ease-out) instead of jumping. */
export function useTweened(target: Record<string, number>, duration = 450): Record<string, number> {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  const key = JSON.stringify(target);

  useEffect(() => {
    const goal: Record<string, number> = JSON.parse(key);
    const from = current.current;
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Object.fromEntries(Object.entries(goal).map(([k, v]) => [k, (from[k] ?? v) + (v - (from[k] ?? v)) * eased]));
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);

  return shown;
}

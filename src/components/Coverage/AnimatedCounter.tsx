"use client";

import { useRef, useEffect } from "react";

function animateCounter(el: HTMLSpanElement, target: number) {
  let start: number | null = null;
  function step(now: number) {
    if (start === null) start = now;
    const p = Math.min((now - start) / 1400, 1);
    el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target).toLocaleString(
      "mr-IN"
    );
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export default function AnimatedCounter({
  target,
  className = "",
}: {
  target: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      el.textContent = target.toLocaleString("mr-IN");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            animateCounter(el, target);
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}

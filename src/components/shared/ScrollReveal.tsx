"use client";

import {
  useRef,
  useEffect,
  type ReactNode,
  type HTMLAttributes,
} from "react";

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export default function ScrollReveal({ children, className = "", ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal${className ? " " + className : ""}`} {...rest}>
      {children}
    </div>
  );
}

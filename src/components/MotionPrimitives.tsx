"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const COUNT_UP_DURATION_MS = 260;

/** Curva de suavização equivalente a cubic-bezier(0.2, 0.8, 0.2, 1) para CountUp. */
function easeOutEditorial(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

/**
 * Contador numérico discreto (<= 300ms) que anima trocas de valor após a hidratação
 * e respeita `prefers-reduced-motion` estritamente dentro de `useEffect`.
 */
export function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(to);
  const [displayValue, setDisplayValue] = useState(to);

  useEffect(() => {
    const from = prevRef.current;
    if (from === to) {
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || typeof window === "undefined") {
      prevRef.current = to;
      const frame = requestAnimationFrame(() => setDisplayValue(to));
      return () => cancelAnimationFrame(frame);
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / COUNT_UP_DURATION_MS);
      const next = Math.round(from + (to - from) * easeOutEditorial(progress));
      setDisplayValue(next);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        prevRef.current = to;
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      prevRef.current = to;
    };
  }, [to]);

  return (
    <span
      ref={ref}
      className="tabular-nums [font-variant-numeric:lining-nums_tabular-nums]"
    >
      {displayValue}
    </span>
  );
}

/**
 * Container semântico de agrupamento com SSR e primeiro render cliente 100% idênticos.
 */
export function Stagger({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div aria-label={ariaLabel} className={className}>
      {children}
    </div>
  );
}

/**
 * Item semântico interno do Stagger com SSR e primeiro render cliente 100% idênticos.
 */
export function Item({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

type RevealPhase = "idle" | "hidden" | "visible";

/**
 * Revelação discreta ao rolar (apenas `opacity` e `transform`).
 *
 * Hidratação determinística:
 * - SSR e primeiro render do cliente produzem exatamente o mesmo `<div>` sem `style`
 *   e sem qualquer leitura de `window`, `matchMedia` ou `IntersectionObserver`.
 * - Toda detecção de `prefers-reduced-motion` e `IntersectionObserver` ocorre
 *   exclusivamente dentro de `useEffect`, após a hidratação.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<RevealPhase>("idle");

  useEffect(() => {
    const el = ref.current;
    if (
      !el ||
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          setPhase("visible");
          observer.disconnect();
        } else if (entry.boundingClientRect.top > 0) {
          // Elemento abaixo da dobra: oculta fora da tela para revelar ao entrar no viewport
          setPhase((current) => (current === "idle" ? "hidden" : current));
        } else {
          // Já passou acima do viewport (ex.: recarregamento no meio da página)
          setPhase("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let style: CSSProperties | undefined;
  if (phase === "hidden") {
    style = {
      opacity: 0,
      transform: "translateY(12px)",
    };
  } else if (phase === "visible") {
    const transitionDelay = delay > 0 ? ` ${delay}s` : "";
    style = {
      opacity: 1,
      transform: "translateY(0)",
      transition: `opacity var(--motion-slow, 320ms) var(--motion-ease, cubic-bezier(0.2, 0.8, 0.2, 1))${transitionDelay}, transform var(--motion-slow, 320ms) var(--motion-ease, cubic-bezier(0.2, 0.8, 0.2, 1))${transitionDelay}`,
    };
  }

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

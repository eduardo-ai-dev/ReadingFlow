"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";

const MOTION_EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * Contador numérico discreto (<= 300ms) que anima trocas de valor e respeita `prefers-reduced-motion`.
 */
export function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const prefersReduced = useReducedMotion();
  const prevRef = useRef(0);
  const [n, setN] = useState(to);

  useEffect(() => {
    if (!inView || prefersReduced) {
      prevRef.current = to;
      return;
    }
    const from = prevRef.current;
    if (from === to) {
      return;
    }
    const c = animate(from, to, {
      duration: 0.26,
      ease: MOTION_EASE,
      onUpdate: (v) => setN(Math.round(v)),
      onComplete: () => {
        prevRef.current = to;
      },
    });
    return () => {
      c.stop();
      prevRef.current = to;
    };
  }, [inView, to, prefersReduced]);

  return (
    <span
      ref={ref}
      className="tabular-nums [font-variant-numeric:lining-nums_tabular-nums]"
    >
      {prefersReduced ? to : n}
    </span>
  );
}

const ITEM = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export function Stagger({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) {
    return (
      <div aria-label={ariaLabel} className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      aria-label={ariaLabel}
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

export function Item({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      variants={ITEM}
      transition={{ duration: 0.24, ease: MOTION_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.32, delay, ease: MOTION_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

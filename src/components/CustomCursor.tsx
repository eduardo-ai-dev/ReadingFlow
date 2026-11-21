"use client";

import { useEffect, useRef, useState } from "react";

export function CustomCursor() {
  const [mounted, setMounted] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Desativa em dispositivos touch e quando o usuário solicitou redução de movimento
    if (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.motion === "reduced"
    ) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      setMounted(true);
    });

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let rafId: number;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) setVisible(true);

      // Checa se o alvo sob o cursor é clicável / interativo
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest(
          "a, button, [role='button'], input, select, textarea, .lr-book-prism, [tabindex]:not([tabindex='-1']), .interactive-card, .card"
        ) !== null
      ) {
        setHovered(true);
      } else {
        setHovered(false);
      }
    };

    const onMouseLeave = () => {
      setVisible(false);
    };

    const onMouseEnter = () => {
      setVisible(true);
    };

    // Animação contínua e suave do anel que persegue o ponto central
    const animate = () => {
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }
      if (ringRef.current) {
        ringX += (mouseX - ringX) * 0.18;
        ringY += (mouseY - ringY) * 0.18;
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      }
      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      cancelAnimationFrame(rafId);
    };
  }, [visible]);

  // Enquanto !mounted (ou touch / prefers-reduced-motion), retorna null evitando mismatch de hidratação
  if (!mounted) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
      style={{ display: visible ? "block" : "none" }}
    >
      {/* Ponto central sutil em Dourado Envelhecido */}
      <div
        ref={dotRef}
        className="pointer-events-none absolute -top-1 -left-1 h-2 w-2 rounded-[var(--rf-radius-full)] bg-[var(--rf-cursor-dot)] shadow-[var(--rf-cursor-glow)] transition-transform duration-75"
        style={{ willChange: "transform" }}
      />
      {/* Anel translúcido suave que expande levemente sobre livros e elementos interativos */}
      <div
        ref={ringRef}
        className={`pointer-events-none absolute -top-4 -left-4 rounded-[var(--rf-radius-full)] border border-[var(--rf-cursor-ring)] bg-transparent transition-transform duration-200 ease-out ${
          hovered
            ? "h-11 w-11 -top-5 -left-5 border-[var(--rf-cursor-ring-hover)] scale-110 shadow-[var(--rf-cursor-ring-glow)]"
            : "h-8 w-8 scale-100"
        }`}
        style={{ willChange: "transform" }}
      />
    </div>
  );
}

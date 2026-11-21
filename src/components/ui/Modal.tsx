"use client";

import { useId, useRef, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";

export type RfModalTone = "default" | "dark";
export type RfModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  tone?: RfModalTone;
  size?: RfModalSize;
  closeLabel?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

/**
 * Componente compartilhado Modal (100% baseado em tokens semânticos `--rf-*`).
 * Suporta fechamento por Escape e clique fora, foco inicial acessível e movimento reduzido.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  tone = "default",
  size = "md",
  closeLabel = "Fechar",
  returnFocusRef,
  className = "",
  children,
}: ModalProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useFocusTrap({
    active: open,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    returnFocusRef,
    onEscape: onClose,
    lockScroll: true,
  });

  const handleClose = () => {
    onClose();
  };

  const sizeClass =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  const surfaceClass =
    tone === "dark"
      ? "border-[var(--rf-nav-border)] bg-[var(--rf-nav-bg-marketing)] text-[var(--rf-nav-text)] shadow-[var(--rf-nav-modal-shadow)]"
      : "border-[var(--rf-border-default)] bg-[var(--rf-surface-card-solid)] text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-lg)]";

  const closeBtnClass =
    tone === "dark"
      ? "border-[var(--rf-nav-border)] bg-[var(--rf-nav-surface-alt)] text-[var(--rf-nav-text)] hover:border-[var(--rf-nav-accent)] hover:text-[var(--rf-nav-accent)]"
      : "border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-accent)] hover:text-[var(--rf-text-heading)]";

  const eyebrowClass =
    tone === "dark"
      ? "text-[var(--rf-nav-accent)]"
      : "text-[var(--rf-text-accent-secondary)]";

  const titleClass =
    tone === "dark"
      ? "text-[var(--rf-nav-text)]"
      : "text-[var(--rf-text-heading)]";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="rf-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--rf-surface-overlay)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, y: 10, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 8, scale: 0.97 }
            }
            className={`relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain ${sizeClass} rounded-[var(--rf-radius-lg)] border p-6 ${surfaceClass} ${className}`.trim()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label={closeLabel}
              onClick={handleClose}
              className={`absolute top-2.5 right-2.5 flex h-11 w-11 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-[var(--rf-radius-full)] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${closeBtnClass}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            {eyebrow ? (
              <p
                className={`font-sans text-[11px] font-semibold tracking-[0.14em] uppercase ${eyebrowClass}`}
              >
                {eyebrow}
              </p>
            ) : null}

            <h2
              id={headingId}
              className={`mt-1 pr-8 font-serif text-2xl font-semibold ${titleClass}`}
            >
              {title}
            </h2>

            <div className="mt-3">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

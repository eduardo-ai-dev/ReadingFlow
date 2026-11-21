"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";
import { signInDemoAction } from "@/features/auth/actions";

export function DemoLoginButton({
  label = "Explorar Biblioteca Demonstrativa",
  loadingLabel = "Abrindo acervo demo...",
  variant = "secondary",
  redirectTo = "/painel",
  showIcon = true,
  disabled = false,
  onBeforeStart,
  className = "",
}: {
  label?: string;
  loadingLabel?: string;
  variant?: "primary" | "secondary" | "room";
  redirectTo?: string;
  showIcon?: boolean;
  disabled?: boolean;
  onBeforeStart?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isPending || isSubmitting;

  const baseStyles =
    variant === "primary"
      ? "border border-[#C8A46E]/40 bg-[#722F3E] text-[#F4EFE6] shadow-[0_10px_24px_-8px_rgba(114,47,62,0.45)] hover:bg-[#5E2532] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2"
      : variant === "room"
        ? "border border-[#8E7B6B] bg-[#2A211C] text-[#F8F1E7] hover:bg-[#362B24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
        : "border border-[#2C221E]/35 bg-[#F4EFE6] text-[#2C221E] hover:border-[#C8A46E] hover:bg-[#EDE6DC] hover:text-[#141514] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2";

  return (
    <button
      type="button"
      formNoValidate
      disabled={isBusy || disabled}
      aria-busy={isBusy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isBusy || disabled) return;
        setIsSubmitting(true);
        onBeforeStart?.();
        startTransition(async () => {
          try {
            const res = await signInDemoAction();
            if (!res.ok) {
              router.push("/entrar");
              return;
            }
            const target = redirectTo || res.redirectTo || "/painel";
            router.push(target);
            router.refresh();
          } finally {
            setIsSubmitting(false);
          }
        });
      }}
      className={`inline-flex h-11 min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-[8px] px-5 font-sans text-sm font-semibold tracking-[0.01em] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:shadow-[0_10px_22px_-6px_rgba(44,34,30,0.18)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65 ${baseStyles} ${className}`}
    >
      {isBusy ? (
        <>
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-[#722F3E]"
            aria-hidden="true"
          />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {showIcon ? (
            <BookOpen
              className={`h-4 w-4 shrink-0 ${
                variant === "primary" ? "text-[#DFBE88]" : "text-[#722F3E]"
              }`}
              aria-hidden="true"
            />
          ) : null}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

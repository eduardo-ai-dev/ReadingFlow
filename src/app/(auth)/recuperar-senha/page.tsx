"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
} from "lucide-react";
import { resetPasswordAction } from "@/features/auth/actions";
import { evaluatePasswordStrength } from "@/features/auth/rules";
import { ExLibrisEmblem } from "@/components/ExLibrisEmblem";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rf-stagger-1 rounded-[14px] border border-[#2C221E]/15 bg-[#FAF6F0] p-6 text-[#141514] shadow-[0_20px_50px_rgba(44,34,30,0.08)] sm:p-8">
      <ExLibrisEmblem />

      <h1 className="font-serif text-2xl font-semibold text-[#141514]">
        Recuperar senha
      </h1>
      <p className="mt-1 text-sm text-[#2C221E]/85">
        Informe seu e-mail e defina uma nova senha segura para a sua biblioteca.
      </p>

      {submitted ? (
        <div
          role="status"
          className="mt-5 flex items-start gap-2.5 rounded-[10px] border border-[#3B523E]/40 bg-[#3B523E]/10 p-4 font-sans text-sm text-[#141514]"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-[#3B523E]"
            aria-hidden="true"
          />
          <span>
            Se houver uma conta associada a este endereço, sua redefinição de
            senha foi processada com segurança.
          </span>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setEmailError(null);
            setPasswordError(null);
            setFormError(null);

            const cleanEmail = email.trim();
            const passwordStrength = evaluatePasswordStrength(password);
            let hasFieldError = false;

            if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
              setEmailError("Informe um endereço de e-mail válido.");
              hasFieldError = true;
            }
            if (!passwordStrength.isValid) {
              setPasswordError(
                "A nova senha deve atender a todos os 5 requisitos abaixo."
              );
              hasFieldError = true;
            }
            if (hasFieldError) {
              return;
            }

            startTransition(async () => {
              const res = await resetPasswordAction({
                email: cleanEmail,
                password,
              });
              if (!res.ok) {
                setFormError(res.error);
                return;
              }
              setSubmitted(true);
            });
          }}
          className="mt-5 space-y-2.5"
        >
          <div>
            <label
              htmlFor="recover-email"
              className="block font-sans text-sm font-medium text-[#141514]"
            >
              E-mail cadastrado
            </label>
            <div className="rf-input-group group relative mt-1.5">
              <Mail
                className="rf-input-icon pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C221E]/55 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:text-[#C8A46E]"
                aria-hidden="true"
              />
              <input
                id="recover-email"
                type="email"
                autoComplete="email"
                required
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? "recover-email-error" : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                  if (formError) setFormError(null);
                }}
                placeholder="voce@exemplo.com"
                className={`h-11 w-full rounded-[8px] border bg-[#F4EFE6]/70 pl-10 pr-3.5 font-sans text-sm text-[#141514] placeholder:text-[#2C221E]/45 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:bg-[#FAF6F0] focus:outline-none focus:ring-4 ${
                  emailError
                    ? "border-[#9E2A2B] focus:border-[#9E2A2B] focus:ring-[#9E2A2B]/15"
                    : "border-[#2C221E]/25 focus:border-[#C8A46E] focus:ring-[#C8A46E]/15"
                }`}
              />
            </div>
            {/* Altura reservada para validação inline sem deslocar o card */}
            <div className="mt-1 min-h-[18px]" aria-live="polite">
              {emailError ? (
                <p
                  id="recover-email-error"
                  role="alert"
                  className="flex items-center gap-1 font-sans text-xs font-medium text-[#9E2A2B]"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{emailError}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <label
              htmlFor="recover-password"
              className="block font-sans text-sm font-medium text-[#141514]"
            >
              Nova senha
            </label>
            <div className="rf-input-group group relative mt-1.5">
              <input
                id="recover-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? "recover-password-error" : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                  if (formError) setFormError(null);
                }}
                placeholder="••••••••"
                className={`h-11 w-full rounded-[8px] border bg-[#F4EFE6]/70 pl-3.5 pr-10 font-sans text-sm text-[#141514] placeholder:text-[#2C221E]/45 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:bg-[#FAF6F0] focus:outline-none focus:ring-4 ${
                  passwordError
                    ? "border-[#9E2A2B] focus:border-[#9E2A2B] focus:ring-[#9E2A2B]/15"
                    : "border-[#2C221E]/25 focus:border-[#C8A46E] focus:ring-[#C8A46E]/15"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword
                    ? "Ocultar caracteres digitados"
                    : "Mostrar caracteres digitados"
                }
                aria-pressed={showPassword}
                className="rf-icon-btn absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[6px] text-[#2C221E]/65 transition-colors duration-200 group-focus-within:text-[#C8A46E] hover:bg-[#2C221E]/8 hover:text-[#141514] focus-visible:outline-2 focus-visible:outline-[#C8A46E]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            <PasswordStrengthIndicator password={password} />

            {/* Altura reservada para validação inline sem deslocar o card */}
            <div className="mt-1 min-h-[18px]" aria-live="polite">
              {passwordError ? (
                <p
                  id="recover-password-error"
                  role="alert"
                  className="flex items-center gap-1 font-sans text-xs font-medium text-[#9E2A2B]"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{passwordError}</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Altura reservada para validação geral */}
          <div className="min-h-[18px]" aria-live="polite">
            {formError ? (
              <p
                role="alert"
                className="flex items-center gap-1.5 font-sans text-xs font-medium text-[#9E2A2B]"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-[#C8A46E]/30 bg-[#722F3E] px-4 font-sans text-sm font-semibold tracking-[0.01em] text-[#F4EFE6] shadow-[0_10px_24px_-8px_rgba(114,47,62,0.45)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:bg-[#5E2532] hover:shadow-[0_12px_26px_-6px_rgba(114,47,62,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8A46E] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isPending ? (
              <>
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin text-[#C8A46E]"
                  aria-hidden="true"
                />
                <span>Redefinindo senha...</span>
              </>
            ) : (
              <span>Redefinir senha</span>
            )}
          </button>
        </form>
      )}

      <p className="mt-6 border-t border-[#2C221E]/12 pt-4 text-center font-sans text-xs text-[#2C221E]/85">
        <Link
          href="/entrar"
          className="font-semibold text-[#722F3E] underline underline-offset-2 transition-colors hover:text-[#141514]"
        >
          ← Voltar para o login
        </Link>
      </p>
    </div>
  );
}

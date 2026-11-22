"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { signUpAction } from "@/features/auth/actions";
import { evaluatePasswordStrength } from "@/features/auth/rules";
import { ExLibrisEmblem } from "@/components/ExLibrisEmblem";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmMinimumAge16, setConfirmMinimumAge16] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isPending || isSubmitting;

  return (
    <div className="rf-stagger-1 rounded-[14px] border border-[#2C221E]/25 bg-[#FAF6F0] p-6 text-[#141514] shadow-[0_20px_50px_rgba(44,34,30,0.08)] sm:p-8">
      <header>
        <ExLibrisEmblem />

        <h1 className="font-serif text-2xl font-semibold text-balance text-[#141514]">
          Criar minha biblioteca
        </h1>
        <p className="mt-1 font-sans text-sm text-[#2C221E]">
          Sua conta nasce 100% privada, solicitando exclusivamente e-mail e
          senha.
        </p>
      </header>

      <form
        noValidate
        aria-busy={isBusy}
        onSubmit={(e) => {
          e.preventDefault();
          if (isBusy) return;

          setEmailError(null);
          setPasswordError(null);
          setFormError(null);
          setFormNotice(null);

          const cleanEmail = email.trim();
          const passwordStrength = evaluatePasswordStrength(password);
          let hasFieldError = false;

          if (
            !cleanEmail ||
            !cleanEmail.includes("@") ||
            !cleanEmail.includes(".")
          ) {
            setEmailError("Informe um endereço de e-mail válido.");
            hasFieldError = true;
          }
          if (!passwordStrength.isValid) {
            setPasswordError(
              "A senha deve ter no mínimo 12 caracteres (até 72 bytes UTF-8) e não pode ser comum."
            );
            hasFieldError = true;
          }
          if (hasFieldError) {
            return;
          }
          if (!confirmMinimumAge16) {
            setFormError("É necessário confirmar ter pelo menos 16 anos.");
            return;
          }
          if (!acceptTerms) {
            setFormError(
              "É obrigatório aceitar os Termos de Uso e Política de Privacidade."
            );
            return;
          }

          setIsSubmitting(true);
          startTransition(async () => {
            try {
              const res = await signUpAction({
                email: cleanEmail,
                password,
                confirmMinimumAge16,
                acceptTerms,
              });
              if (!res.ok) {
                setFormError(res.error);
                return;
              }
              if (res.requiresConfirmation) {
                setFormNotice(res.message);
                return;
              }
              router.push("/onboarding");
              router.refresh();
            } finally {
              setIsSubmitting(false);
            }
          });
        }}
        className="mt-5 space-y-2.5"
      >
        <div>
          <label
            htmlFor="signup-email"
            className="block font-sans text-sm font-medium text-[#141514]"
          >
            E-mail
          </label>
          <div className="rf-input-group group relative mt-1.5">
            <Mail
              className="rf-input-icon pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A433C] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:text-[#C8A46E]"
              aria-hidden="true"
            />
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              enterKeyHint="next"
              required
              disabled={isBusy}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "signup-email-error" : undefined}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
                if (formError) setFormError(null);
              }}
              placeholder="voce@exemplo.com"
              className={`h-11 w-full rounded-[8px] border bg-[#F4EFE6] pl-10 pr-3.5 font-sans text-sm text-[#141514] placeholder:text-[#4A433C]/70 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#2C221E]/65 focus:bg-[#FAF6F0] focus:outline-none focus:ring-2 focus-visible:ring-2 ${
                emailError
                  ? "border-[#9E2A2B] focus:border-[#9E2A2B] focus:ring-[#9E2A2B] focus-visible:ring-[#9E2A2B]"
                  : "border-[#2C221E]/45 focus:border-[#C8A46E] focus:ring-[#C8A46E] focus-visible:ring-[#C8A46E]"
              }`}
            />
          </div>
          {/* Altura reservada para validação inline sem deslocar o card */}
          <div className="mt-1 min-h-[18px]" aria-live="polite">
            {emailError ? (
              <p
                id="signup-email-error"
                role="alert"
                className="flex items-center gap-1 font-sans text-xs font-medium text-[#9E2A2B]"
              >
                <AlertCircle
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{emailError}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label
            htmlFor="signup-password"
            className="block font-sans text-sm font-medium text-[#141514]"
          >
            Senha (mínimo de 12 caracteres)
          </label>
          <div className="rf-input-group group relative mt-1.5">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              enterKeyHint="done"
              required
              minLength={12}
              disabled={isBusy}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={
                passwordError ? "signup-password-error" : undefined
              }
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
                if (formError) setFormError(null);
              }}
              placeholder="••••••••"
              className={`h-11 w-full rounded-[8px] border bg-[#F4EFE6] pl-3.5 pr-10 font-sans text-sm text-[#141514] placeholder:text-[#4A433C]/70 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#2C221E]/65 focus:bg-[#FAF6F0] focus:outline-none focus:ring-2 focus-visible:ring-2 ${
                passwordError
                  ? "border-[#9E2A2B] focus:border-[#9E2A2B] focus:ring-[#9E2A2B] focus-visible:ring-[#9E2A2B]"
                  : "border-[#2C221E]/45 focus:border-[#C8A46E] focus:ring-[#C8A46E] focus-visible:ring-[#C8A46E]"
              }`}
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword
                  ? "Ocultar caracteres digitados"
                  : "Mostrar caracteres digitados"
              }
              aria-pressed={showPassword}
              className="rf-icon-btn absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[6px] text-[#4A433C] transition-colors duration-200 group-focus-within:text-[#722F3E] hover:bg-[#2C221E]/8 hover:text-[#141514] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
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
                id="signup-password-error"
                role="alert"
                className="flex items-center gap-1 font-sans text-xs font-medium text-[#9E2A2B]"
              >
                <AlertCircle
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{passwordError}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 pt-0.5 font-sans text-xs text-[#141514]">
          <label
            htmlFor="signup-minimum-age"
            className="flex min-h-[44px] cursor-pointer items-center gap-2.5 select-none lg:min-h-[34px] lg:items-start"
          >
            <input
              id="signup-minimum-age"
              name="confirmMinimumAge16"
              type="checkbox"
              disabled={isBusy}
              checked={confirmMinimumAge16}
              onChange={(e) => {
                setConfirmMinimumAge16(e.target.checked);
                if (formError) setFormError(null);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-[#2C221E]/50 accent-[#722F3E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2"
            />
            <span>Declaro ter pelo menos 16 anos completos.</span>
          </label>

          <label
            htmlFor="signup-accept-terms"
            className="flex min-h-[44px] cursor-pointer items-center gap-2.5 select-none lg:min-h-[34px] lg:items-start"
          >
            <input
              id="signup-accept-terms"
              name="acceptTerms"
              type="checkbox"
              disabled={isBusy}
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (formError) setFormError(null);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-[#2C221E]/50 accent-[#722F3E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2"
            />
            <span>
              Li e concordo com os{" "}
              <Link
                href="/termos"
                className="inline-flex min-h-[44px] items-center rounded-sm px-0.5 font-sans font-semibold text-[#722F3E] underline underline-offset-4 hover:text-[#141514] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] lg:inline lg:min-h-0"
              >
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link
                href="/privacidade"
                className="inline-flex min-h-[44px] items-center rounded-sm px-0.5 font-sans font-semibold text-[#722F3E] underline underline-offset-4 hover:text-[#141514] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] lg:inline lg:min-h-0"
              >
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
        </div>

        {/* Altura reservada para validação sem deslocar o card */}
        <div className="min-h-[20px]" aria-live="polite">
          {formError ? (
            <p
              id="signup-form-error"
              role="alert"
              className="flex items-center gap-1.5 font-sans text-xs font-medium text-[#9E2A2B]"
            >
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>{formError}</span>
            </p>
          ) : formNotice ? (
            <p
              id="signup-form-notice"
              role="status"
              className="font-sans text-xs font-medium text-[#3B523E]"
            >
              {formNotice}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isBusy}
          aria-busy={isBusy}
          className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-[#C8A46E]/40 bg-[#722F3E] px-4 font-sans text-sm font-semibold tracking-[0.01em] text-[#F4EFE6] shadow-[0_10px_24px_-8px_rgba(114,47,62,0.5)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:bg-[#5E2532] hover:shadow-[0_12px_26px_-6px_rgba(114,47,62,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isBusy ? (
            <>
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-[#C8A46E]"
                aria-hidden="true"
              />
              <span>Criando biblioteca...</span>
            </>
          ) : (
            <span>Criar minha biblioteca</span>
          )}
        </button>
      </form>

      {/* Microcopy discreta de privacidade */}
      <p className="mt-4 text-center font-sans text-xs text-[#4A433C]">
        Seus dados de leitura são privados e nunca são compartilhados.
      </p>

      <div className="mt-5 border-t border-[#2C221E]/15 pt-4 text-center font-sans text-xs text-[#2C221E]">
        Já tem uma biblioteca?{" "}
        <Link
          href="/entrar"
          className="inline-flex min-h-[44px] items-center rounded-sm px-2 font-sans font-semibold text-[#722F3E] underline underline-offset-4 transition-colors hover:text-[#141514] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] lg:min-h-0 lg:px-1"
        >
          Entrar
        </Link>
      </div>
    </div>
  );
}

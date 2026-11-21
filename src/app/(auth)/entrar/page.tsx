"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { signInWithEmailAction } from "@/features/auth/actions";
import { DemoLoginButton } from "@/components/DemoLoginButton";
import { ExLibrisEmblem } from "@/components/ExLibrisEmblem";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isPending || isSubmitting;

  return (
    <div className="rf-stagger-1 rounded-[14px] border border-[#2C221E]/25 bg-[#FAF6F0] p-6 text-[#141514] shadow-[0_20px_50px_rgba(44,34,30,0.08)] sm:p-8">
      <header>
        <ExLibrisEmblem />

        <h1 className="font-serif text-2xl font-semibold text-balance text-[#141514]">
          Entrar na sua biblioteca
        </h1>
        <p className="mt-1 font-sans text-sm text-[#2C221E]">
          Acesse seu acervo privado ou experimente a conta demonstrativa.
        </p>
      </header>

      {/* Botão Secundário/Editorial "Explorar Biblioteca Demonstrativa" em font-sans */}
      <div className="mt-5">
        <DemoLoginButton
          variant="secondary"
          label="Explorar Biblioteca Demonstrativa"
          loadingLabel="Abrindo acervo demo..."
          redirectTo="/painel"
          disabled={isBusy}
          onBeforeStart={() => {
            setEmailError(null);
            setPasswordError(null);
            setFormError(null);
          }}
          className="w-full"
        />
      </div>

      <div className="my-5 flex items-center gap-3 font-sans text-xs text-[#4A433C]">
        <span className="h-[1px] flex-1 bg-[#2C221E]/20" />
        <span>ou com e-mail e senha</span>
        <span className="h-[1px] flex-1 bg-[#2C221E]/20" />
      </div>

      <form
        noValidate
        aria-busy={isBusy}
        onSubmit={(e) => {
          e.preventDefault();
          if (isBusy) return;

          setEmailError(null);
          setPasswordError(null);
          setFormError(null);

          const cleanEmail = email.trim();
          let hasFieldError = false;

          if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
            setEmailError("Informe um endereço de e-mail válido.");
            hasFieldError = true;
          }
          if (!password || password.length < 6) {
            setPasswordError("A senha deve ter pelo menos 6 caracteres.");
            hasFieldError = true;
          }
          if (hasFieldError) {
            return;
          }

          setIsSubmitting(true);
          startTransition(async () => {
            try {
              const res = await signInWithEmailAction({
                email: cleanEmail,
                password,
                rememberMe,
              });
              if (!res.ok) {
                setFormError(res.error);
                return;
              }
              router.push(res.needsOnboarding ? "/onboarding" : "/painel");
              router.refresh();
            } finally {
              setIsSubmitting(false);
            }
          });
        }}
        className="space-y-2.5"
      >
        <div>
          <label
            htmlFor="login-email"
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
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isBusy}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "login-email-error" : undefined}
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
                id="login-email-error"
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
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="block font-sans text-sm font-medium text-[#141514]"
            >
              Senha
            </label>
            <Link
              href="/recuperar-senha"
              className="rounded-sm px-1 font-sans text-xs font-semibold text-[#722F3E] no-underline transition-colors duration-200 hover:text-[#141514] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
            >
              Esqueci a senha
            </Link>
          </div>
          <div className="rf-input-group group relative mt-1.5">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={isBusy}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? "login-password-error" : undefined}
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
              className="rf-icon-btn absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[6px] text-[#4A433C] transition-colors duration-200 group-focus-within:text-[#722F3E] hover:bg-[#2C221E]/8 hover:text-[#141514] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {/* Altura reservada para validação inline sem deslocar o card */}
          <div className="mt-1 min-h-[18px]" aria-live="polite">
            {passwordError ? (
              <p
                id="login-password-error"
                role="alert"
                className="flex items-center gap-1 font-sans text-xs font-medium text-[#9E2A2B]"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{passwordError}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label
            htmlFor="login-remember-me"
            className="inline-flex cursor-pointer items-center gap-2 font-sans text-xs font-medium text-[#2C221E] select-none"
          >
            <input
              id="login-remember-me"
              name="rememberMe"
              type="checkbox"
              defaultChecked={false}
              disabled={isBusy}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-[#2C221E]/50 accent-[#722F3E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2"
            />
            <span>Manter conectado</span>
          </label>
        </div>

        {/* Altura reservada para erro geral de autenticação */}
        <div className="min-h-[20px]" aria-live="polite">
          {formError ? (
            <p
              id="login-form-error"
              role="alert"
              className="flex items-center gap-1.5 font-sans text-xs font-medium text-[#9E2A2B]"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </p>
          ) : null}
        </div>

        {/* Ação Principal de Login com E-mail em font-sans */}
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
              <span>Verificando credenciais...</span>
            </>
          ) : (
            <span>Entrar com e-mail</span>
          )}
        </button>
      </form>

      {/* Microcopy discreta de privacidade */}
      <p className="mt-4 text-center font-sans text-xs text-[#4A433C]">
        Seus dados de leitura são privados e nunca são compartilhados.
      </p>

      <p className="mt-5 border-t border-[#2C221E]/15 pt-4 text-center font-sans text-xs text-[#2C221E]">
        Ainda não tem biblioteca?{" "}
        <Link
          href="/criar-conta"
          className="rounded-sm px-1 font-sans font-semibold text-[#722F3E] underline underline-offset-4 transition-colors hover:text-[#141514] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
        >
          Criar conta gratuita
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@/lib/domain";
import {
  deleteMyAccountAction,
  updateProfileAction,
} from "@/features/auth/actions";
import { updateOnboardingGuideAction } from "@/features/settings/actions";
import type { OnboardingGuideEvaluation } from "@/features/onboarding/rules";
import { restoreBackupJsonAction } from "@/features/portability/actions";
import { useTheme } from "@/components/ThemeProvider";
import { ThemeCardsPicker } from "@/components/ThemeCardsPicker";

export function SettingsClient({
  profile,
  onboardingGuide,
}: {
  profile: UserProfile;
  onboardingGuide: OnboardingGuideEvaluation;
}) {
  const router = useRouter();
  const { themePreference, fx, setFx } = useTheme();
  const [guideVisible, setGuideVisible] = useState(onboardingGuide.shouldShow);
  const [defaultCurrency, setDefaultCurrency] = useState(
    profile.defaultCurrency
  );
  const [threeD, setThreeD] = useState(profile.threeD);
  const [goalsCountRereads, setGoalsCountRereads] = useState(
    profile.goalsCountRereads
  );
  const [maxSimultaneousReadings, setMaxSimultaneousReadings] = useState(
    String(profile.maxSimultaneousReadings)
  );
  const [telemetryOptOut, setTelemetryOptOut] = useState(
    profile.telemetryOptOut
  );

  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setFeedback(null);
    let rawJson: string;
    try {
      rawJson = await file.text();
    } catch {
      setFeedback({
        tone: "error",
        text: "Não foi possível ler o arquivo de backup selecionado.",
      });
      input.value = "";
      return;
    } finally {
      input.value = "";
    }
    startTransition(async () => {
      try {
        const res = await restoreBackupJsonAction({ rawJson });
        if (!res.ok) {
          setFeedback({ tone: "error", text: res.error });
          return;
        }
        setFeedback({
          tone: "ok",
          text: `Backup restaurado com sucesso (${res.restoredWorks} obras recuperadas).`,
        });
        router.refresh();
      } catch {
        setFeedback({
          tone: "error",
          text: "Erro ao restaurar o backup. Verifique o arquivo JSON e tente novamente.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      {feedback ? (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`rounded-[8px] border p-3.5 text-sm font-medium ${
            feedback.tone === "ok"
              ? "border-[var(--status-ok)] bg-[var(--status-ok-bg)] text-[var(--status-ok)]"
              : "border-[var(--status-error)] bg-[var(--status-error-bg)] text-[var(--status-error)]"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Conta e Privacidade Estrita */}
      <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-[var(--text-heading)]">
          Conta e Identificação
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Privacidade estrita por padrão: nenhum nome completo, telefone ou fuso
          horário pessoal é compartilhado.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 py-2.5">
            <span className="block text-[11px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              E-mail cadastrado
            </span>
            <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
              {profile.email}
            </span>
          </div>
          <span className="rounded-full border border-[var(--status-ok)] bg-[var(--status-ok-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-ok)]">
            Conta privada
          </span>
        </div>
      </div>

      {/* Preferências de aparência e leitura */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setFeedback(null);
          const trimmedMax = maxSimultaneousReadings.trim();
          if (!/^\d+$/.test(trimmedMax)) {
            setFeedback({
              tone: "error",
              text: "O limite de leituras simultâneas deve ser um inteiro entre 1 e 20.",
            });
            return;
          }
          const parsedMax = Number.parseInt(trimmedMax, 10);
          if (parsedMax < 1 || parsedMax > 20) {
            setFeedback({
              tone: "error",
              text: "O limite de leituras simultâneas deve ficar entre 1 e 20.",
            });
            return;
          }
          startTransition(async () => {
            try {
              const res = await updateProfileAction({
                defaultCurrency,
                theme: themePreference,
                fx,
                threeD,
                goalsCountRereads,
                maxSimultaneousReadings: parsedMax,
                telemetryOptOut,
              });
              if (!res.ok) {
                setFeedback({ tone: "error", text: res.error });
                return;
              }
              setFeedback({
                tone: "ok",
                text: "Preferências salvas e aplicadas.",
              });
              router.refresh();
            } catch {
              setFeedback({
                tone: "error",
                text: "Não foi possível salvar suas preferências agora. Tente novamente.",
              });
            }
          });
        }}
        className="space-y-5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <h2 className="font-serif text-xl font-semibold text-[var(--text-heading)]">
          Aparência e Preferências do Acervo
        </h2>

        <ThemeCardsPicker />

        <div className="grid gap-4 border-t border-[var(--rf-divider)] pt-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="cfg-currency"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              Moeda padrão (Lista de Desejos)
            </label>
            <select
              id="cfg-currency"
              value={defaultCurrency}
              onChange={(e) =>
                setDefaultCurrency(e.target.value as "BRL" | "USD" | "EUR")
              }
              className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="BRL">Real (BRL)</option>
              <option value="USD">Dólar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cfg-max-readings"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              Limite de leituras simultâneas
            </label>
            <input
              id="cfg-max-readings"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={maxSimultaneousReadings}
              onChange={(e) => setMaxSimultaneousReadings(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label
              htmlFor="cfg-3d"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              Estante 3D (R1)
            </label>
            <select
              id="cfg-3d"
              value={threeD}
              onChange={(e) =>
                setThreeD(e.target.value as "auto" | "on" | "off")
              }
              className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="auto">Automático (ativa se WebGL rápido)</option>
              <option value="on">Sempre ativar</option>
              <option value="off">Desativar (economizar bateria/dados)</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={fx === "full"}
              onChange={(e) => setFx(e.target.checked ? "full" : "min")}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)]"
            />
            <span className="text-xs text-[var(--text-primary)]">
              <strong className="block font-semibold">
                Efeitos ambientais (textura de papel, estantes laterais,
                paralaxe e cursor)
              </strong>
              Desative para priorizar fluidez máxima e menor uso de GPU em telas
              ou notebooks mais simples (equivalente a{" "}
              <code className="font-mono">?perf=min</code>).
            </span>
          </label>

          <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={goalsCountRereads}
              onChange={(e) => setGoalsCountRereads(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)]"
            />
            <span className="text-xs text-[var(--text-primary)]">
              <strong className="block font-semibold">
                Contar releituras nas metas de leitura
              </strong>
              Quando desativado, apenas a primeira leitura da obra entra no
              cômputo anual.
            </span>
          </label>

          <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={telemetryOptOut}
              onChange={(e) => setTelemetryOptOut(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)]"
            />
            <span className="text-xs text-[var(--text-primary)]">
              <strong className="block font-semibold">
                Não enviar telemetria anônima agregada
              </strong>
              O ReadingFlow não usa cookies de rastreio nem envia dados a redes
              sociais.
            </span>
          </label>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center rounded-[8px] bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
          >
            {isPending ? "Salvando..." : "Salvar preferências"}
          </button>
        </div>
      </form>

      {/* Primeiros passos — retomar ou ocultar guia de onboarding */}
      <section
        id="primeiros-passos"
        aria-labelledby="primeiros-passos-cfg-titulo"
        className="space-y-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="primeiros-passos-cfg-titulo"
              className="font-serif text-xl font-semibold text-[var(--text-heading)]"
            >
              Primeiros passos
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Guia rápido com 3 passos para montar sua biblioteca: adicionar seu
              primeiro livro, definir uma meta anual opcional e conhecer o Canto
              de Foco ({onboardingGuide.completedCount} de{" "}
              {onboardingGuide.totalCount} concluídos).
            </p>
          </div>
          <span className="rounded-full border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
            {guideVisible ? "Visível no Painel" : "Oculto no Painel"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {guideVisible ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setFeedback(null);
                startTransition(async () => {
                  try {
                    const res = await updateOnboardingGuideAction({
                      action: "dismiss",
                    });
                    if (!res.ok) {
                      setFeedback({ tone: "error", text: res.error });
                      return;
                    }
                    setGuideVisible(false);
                    setFeedback({
                      tone: "ok",
                      text: "Guia de primeiros passos ocultado do painel.",
                    });
                    router.refresh();
                  } catch {
                    setFeedback({
                      tone: "error",
                      text: "Não foi possível atualizar o guia agora.",
                    });
                  }
                });
              }}
              className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-60"
            >
              Ocultar guia no Painel
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setFeedback(null);
                startTransition(async () => {
                  try {
                    const res = await updateOnboardingGuideAction({
                      action: "reopen",
                    });
                    if (!res.ok) {
                      setFeedback({ tone: "error", text: res.error });
                      return;
                    }
                    setGuideVisible(true);
                    setFeedback({
                      tone: "ok",
                      text: "Guia de primeiros passos reativado no Painel.",
                    });
                    router.refresh();
                  } catch {
                    setFeedback({
                      tone: "error",
                      text: "Não foi possível reativar o guia agora.",
                    });
                  }
                });
              }}
              className="inline-flex min-h-[44px] items-center rounded-[8px] bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
            >
              Retomar guia de primeiros passos
            </button>
          )}

          <Link
            href="/painel"
            className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--border-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-ui)]"
          >
            Ir para o Painel →
          </Link>
        </div>
      </section>

      {/* Portabilidade dos dados */}
      <section
        aria-labelledby="export-titulo"
        className="space-y-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <h2
          id="export-titulo"
          className="font-serif text-xl font-semibold text-[var(--text-heading)]"
        >
          Portabilidade e Backup dos Dados
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Seus dados pertencem a você. Exporte seu acervo completo em JSON
          estruturado (pronto para restaurar a qualquer momento) ou em planilhas
          CSV.
        </p>

        <div className="flex flex-wrap gap-3">
          <a
            href="/api/export?format=json"
            download
            className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            Baixar Backup Completo (.json)
          </a>
          <a
            href="/api/export?format=csv&entity=books"
            download
            className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            Exportar Livros (.csv)
          </a>
          <a
            href="/api/export?format=csv&entity=readings"
            download
            className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            Exportar Leituras (.csv)
          </a>
          <a
            href="/api/export?format=csv&entity=wishlist"
            download
            className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            Exportar Desejos (.csv)
          </a>
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-4">
          <label
            htmlFor="restore-backup-file"
            className="block text-xs font-semibold text-[var(--text-primary)]"
          >
            Restaurar a partir de backup (.json)
          </label>
          <input
            id="restore-backup-file"
            type="file"
            accept=".json,application/json"
            onChange={handleBackupFile}
            className="mt-1.5 block min-h-[44px] w-full max-w-md py-2 text-xs text-[var(--text-muted)] file:mr-3 file:min-h-[36px] file:rounded-[6px] file:border file:border-[var(--border-ui)] file:bg-[var(--bg-elevated)] file:px-3 file:text-xs file:font-semibold file:text-[var(--text-primary)]"
          />
        </div>
      </section>

      {/* Zona de Perigo — Exclusão definitiva */}
      <section
        aria-labelledby="danger-zone-titulo"
        className="space-y-4 rounded-[12px] border border-[var(--status-error)]/40 bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <h2
          id="danger-zone-titulo"
          className="font-serif text-xl font-semibold text-[var(--status-error)]"
        >
          Excluir Conta e Biblioteca Definitivamente
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Esta ação é irreversível. Todos os seus livros, histórico de leitura,
          avaliações e metas serão apagados permanentemente dos nossos
          servidores.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmationPhrase !== "EXCLUIR MINHA CONTA") return;
            setFeedback(null);
            startTransition(async () => {
              try {
                const res = await deleteMyAccountAction({
                  confirmationPhrase: "EXCLUIR MINHA CONTA",
                });
                if (!res.ok) {
                  setFeedback({ tone: "error", text: res.error });
                  return;
                }
                router.push("/");
                router.refresh();
              } catch {
                setFeedback({
                  tone: "error",
                  text: "Não foi possível excluir a conta agora. Tente novamente.",
                });
              }
            });
          }}
          className="space-y-3"
        >
          <div>
            <label
              htmlFor="confirm-delete"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              Digite exatamente{" "}
              <span className="font-mono text-[var(--rf-status-error)]">
                EXCLUIR MINHA CONTA
              </span>{" "}
              para confirmar:
            </label>
            <input
              id="confirm-delete"
              type="text"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder="EXCLUIR MINHA CONTA"
              className="mt-1 min-h-[44px] w-full max-w-md rounded-[var(--rf-radius-md)] border border-[var(--rf-border-strong)] bg-[var(--rf-surface-elevated)] px-3 text-sm font-mono text-[var(--rf-text-primary)]"
            />
          </div>

          <button
            type="submit"
            disabled={confirmationPhrase !== "EXCLUIR MINHA CONTA" || isPending}
            className="inline-flex min-h-[44px] items-center rounded-[var(--rf-radius-md)] border border-[var(--rf-status-error)] bg-[var(--rf-status-error-bg)] px-4 text-xs font-semibold text-[var(--rf-status-error)] hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? "Excluindo..." : "Confirmar exclusão definitiva"}
          </button>
        </form>
      </section>
    </div>
  );
}

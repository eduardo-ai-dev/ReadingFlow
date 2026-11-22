import Link from "next/link";
import { Plus } from "lucide-react";
import { rfButtonClassName } from "@/components/ui/ActionControls";

/**
 * Ilustração editorial de estante vazia usando exclusivamente tokens do tema ativo.
 * Leve (SVG inline sem downloads extras) e acessível em todos os temas e tamanhos de tela.
 */
export function EmptyBookshelfIllustration({
  title = "Sua estante aguarda o primeiro livro",
  description = "Escolha um título pela busca ou ISBN, selecione a edição e a capa e veja sua biblioteca ganhar vida prateleira por prateleira.",
  actionHref = "/adicionar",
  actionLabel = "Adicionar primeiro livro",
  secondaryHref,
  secondaryLabel,
}: {
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div
      data-testid="empty-bookshelf-illustration"
      className="rf-panel flex flex-col items-center px-6 py-10 text-center sm:px-10 sm:py-12"
    >
      <svg
        viewBox="0 0 320 148"
        role="img"
        aria-label="Ilustração de uma estante de madeira aguardando os primeiros livros"
        className="h-auto w-full max-w-[300px]"
      >
        {/* Moldura do móvel */}
        <rect
          x="16"
          y="10"
          width="288"
          height="128"
          rx="10"
          fill="var(--rf-surface-subtle)"
          stroke="var(--rf-border-strong)"
          strokeWidth="2"
        />
        {/* Fundo recuado da prateleira superior */}
        <rect
          x="26"
          y="20"
          width="268"
          height="48"
          rx="4"
          fill="var(--rf-surface-canvas)"
        />
        {/* Fundo recuado da prateleira inferior */}
        <rect
          x="26"
          y="78"
          width="268"
          height="48"
          rx="4"
          fill="var(--rf-surface-canvas)"
        />
        {/* Prateleira divisória de madeira */}
        <rect
          x="22"
          y="68"
          width="276"
          height="10"
          rx="2"
          fill="var(--rf-accent-primary)"
          opacity="0.72"
        />
        {/* Silhuetas pontilhadas convidando os primeiros livros na prateleira superior */}
        <rect
          x="44"
          y="30"
          width="20"
          height="38"
          rx="2"
          fill="var(--rf-accent-secondary-subtle)"
          stroke="var(--rf-border-secondary)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <rect
          x="68"
          y="26"
          width="24"
          height="42"
          rx="2"
          fill="var(--rf-accent-primary-subtle)"
          stroke="var(--rf-border-accent)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <rect
          x="96"
          y="33"
          width="18"
          height="35"
          rx="2"
          fill="var(--rf-accent-secondary-subtle)"
          stroke="var(--rf-border-secondary)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        {/* Aparador decorativo de livros à direita */}
        <path
          d="M254 68 L254 44 C254 41 256 39 259 39 L262 39 L262 68 Z"
          fill="var(--rf-accent-secondary)"
          opacity="0.75"
        />
        {/* Marcador de página / livro aberto descansando na prateleira inferior */}
        <rect
          x="124"
          y="108"
          width="72"
          height="12"
          rx="2"
          fill="var(--rf-accent-secondary)"
          opacity="0.82"
        />
        <rect
          x="130"
          y="102"
          width="60"
          height="6"
          rx="1.5"
          fill="var(--rf-accent-primary)"
          opacity="0.88"
        />
        {/* Símbolo "+" convidativo no centro da prateleira superior */}
        <circle
          cx="160"
          cy="45"
          r="13"
          fill="var(--rf-surface-elevated)"
          stroke="var(--rf-border-accent)"
          strokeWidth="1.5"
        />
        <line
          x1="154"
          y1="45"
          x2="166"
          y2="45"
          stroke="var(--rf-text-accent-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="160"
          y1="39"
          x2="160"
          y2="51"
          stroke="var(--rf-text-accent-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <h2 className="mt-5 font-serif text-xl font-semibold text-[var(--rf-text-heading)] sm:text-2xl">
        {title}
      </h2>
      <p className="mt-2 max-w-md font-sans text-xs leading-relaxed text-[var(--rf-text-secondary)] sm:text-sm">
        {description}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={actionHref}
          className={rfButtonClassName({
            variant: "primary",
            size: "md",
            pill: true,
          })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{actionLabel}</span>
        </Link>

        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className={rfButtonClassName({
              variant: "secondary",
              secondaryStyle: "outline",
              size: "md",
              pill: true,
            })}
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

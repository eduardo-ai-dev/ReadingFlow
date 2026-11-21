/**
 * Fundo arquitetônico reutilizável de estantes lineares sutis para as laterais
 * da tela de autenticação e de todas as páginas internas (widescreen >= 1024px).
 *
 * - Usa imagem vetorial estática otimizada (`public/textures/library-backdrop.svg`)
 *   como máscara CSS sobre `--rf-text-heading`, mantendo 1 único nó DOM em camada
 *   própria (`contain: strict`) e sem animação.
 * - Adapta-se automaticamente aos 4 temas curados e é desativado quando `data-fx="min"`.
 */
export function LibraryBackdrop({
  variant = "app",
}: {
  variant?: "auth" | "app";
}) {
  const isApp = variant === "app";

  return (
    <div
      aria-hidden="true"
      data-rf-library-backdrop={variant}
      className={
        isApp
          ? "rf-library-backdrop pointer-events-none fixed inset-0 z-0 hidden overflow-hidden select-none lg:block"
          : "rf-library-backdrop pointer-events-none absolute inset-0 hidden overflow-hidden select-none lg:block"
      }
    >
      <div
        className={
          isApp
            ? "rf-library-backdrop-art h-full w-full bg-[var(--rf-text-heading)] opacity-[0.06] xl:opacity-[0.085]"
            : "rf-library-backdrop-art h-full w-full bg-[var(--rf-text-heading)] opacity-[0.03]"
        }
      />
    </div>
  );
}

import { MarketingHeader } from "@/components/MarketingHeader";
import { ptBR } from "@/lib/i18n/pt-BR";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)]">
      <a href="#conteudo-marketing" className="skip-link">
        {ptBR.nav.skipToContent}
      </a>

      <MarketingHeader />

      <main id="conteudo-marketing" tabIndex={-1} className="w-full">
        {children}
      </main>
    </div>
  );
}

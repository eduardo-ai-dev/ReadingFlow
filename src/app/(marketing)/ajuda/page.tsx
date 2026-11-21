import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Ajuda e Perguntas Frequentes",
};

export default function HelpPage() {
  return (
    <>
      <article className="mx-auto max-w-3xl px-6 pt-24 pb-16 sm:px-10">
        <p className="editorial-kicker">Guia rápido do leitor</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
          Ajuda e Guia Rápido
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Como organizar obras, edições, exemplares, leituras e backups no
          ReadingFlow.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <section className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
              Qual a diferença entre Obra, Edição, Exemplar e Leitura?
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">
              <strong>Obra</strong> é a criação intelectual (ex.:{" "}
              <em>Dom Casmurro</em>). <strong>Edição</strong> é a publicação com
              ISBN, formato e páginas. <strong>Exemplar</strong> é a unidade que
              você possui na estante. <strong>Leitura</strong> registra quando
              você leu ou releu a obra — mesmo que o livro seja emprestado.
            </p>
          </section>

          <section className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
              E se o ISBN não for encontrado ou o livro for antigo?
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">
              Se o ISBN não constar nas bases externas em até 5 segundos, o
              formulário manual abre automaticamente com o ISBN preenchido para
              que você conclua o cadastro sem bloqueio. Livros de sebo ou sem ISBN
              também são aceitos normalmente.
            </p>
          </section>

          <section className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
              Como funciona o backup e a exportação dos meus dados?
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">
              Seus dados pertencem exclusivamente a você. Em <strong>Configurações</strong>,
              você pode gerar a qualquer momento uma exportação integral em JSON ou CSV,
              garantindo total portabilidade, segurança e conformidade com a LGPD.
            </p>
          </section>
        </div>

        <div className="mt-8">
          <Link
            href="/entrar"
            className="inline-flex min-h-[44px] items-center rounded-[8px] bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
          >
            Acessar minha biblioteca
          </Link>
        </div>
      </article>
      <MarketingFooter />
    </>
  );
}

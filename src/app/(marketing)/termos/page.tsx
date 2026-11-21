import type { Metadata } from "next";
import { MarketingFooter } from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Termos de Uso",
};

export default function TermsPage() {
  return (
    <>
      <article className="mx-auto max-w-3xl px-6 pt-24 pb-16 sm:px-10">
        <p className="editorial-kicker">Versão 1.0 · Vigência 2026</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[var(--text-heading)]">
          Termos de Uso do ReadingFlow
        </h1>
        <div className="prose-reading mt-6 space-y-5">
          <section>
            <h2 className="font-serif text-xl font-semibold">1. Objeto</h2>
            <p className="mt-1.5 text-[var(--text-muted)]">
              O ReadingFlow é uma aplicação de organização de biblioteca pessoal
              digital (livros físicos, e-books e audiobooks), de uso estritamente
              individual e privado, sem funcionalidades de rede social.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold">
              2. Idade mínima e cadastro
            </h2>
            <p className="mt-1.5 text-[var(--text-muted)]">
              Para criar uma conta no Release R0, a pessoa usuária declara possuir
              ao menos 16 anos completos, em conformidade com a LGPD (Lei nº
              13.709/2018) e o Estatuto Digital da Criança e do Adolescente.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold">
              3. Titularidade e portabilidade do acervo
            </h2>
            <p className="mt-1.5 text-[var(--text-muted)]">
              Todas as notas, avaliações, registros de posse, leituras e metas
              pertencem exclusivamente a você. Você pode exportar seus dados
              integralmente em JSON ou CSV a qualquer momento em Configurações,
              bem como excluir definitivamente sua conta.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold">
              4. Fontes externas de metadados
            </h2>
            <p className="mt-1.5 text-[var(--text-muted)]">
              Dados bibliográficos consultados por ISBN podem vir da BrasilAPI
              (CBL), Google Books ou Open Library, respeitando os termos e cotas
              técnicas de cada provedor.
            </p>
          </section>
        </div>
      </article>
      <MarketingFooter />
    </>
  );
}

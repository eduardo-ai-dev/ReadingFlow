import Link from "next/link";
import type { Metadata } from "next";
import { Lock, Ban, ShieldCheck, Download } from "lucide-react";

export const metadata: Metadata = {
  title: "Sobre o ReadingFlow",
  description:
    "Conheça a proposta do ReadingFlow: uma biblioteca pessoal privada, sem redes sociais, pensada para quem ama ler.",
};

export default function SobrePage() {
  const privacyCommitments = [
    {
      icon: Lock,
      title: "Acervo 100% privado",
      desc: "Seus livros, notas, citações e avaliações pertencem somente a você, sem perfil público ou exposição forçada.",
    },
    {
      icon: Ban,
      title: "Sem anúncios",
      desc: "Nenhuma publicidade, recomendação patrocinada ou rastreamento de atenção interrompe sua leitura.",
    },
    {
      icon: ShieldCheck,
      title: "Sem venda de dados",
      desc: "Seus registros literários jamais são vendidos, cedidos ou compartilhados com corretores de dados ou terceiros.",
    },
    {
      icon: Download,
      title: "Exportação livre pelo leitor",
      desc: "Portabilidade integral e imediata em JSON e CSV neutralizado a qualquer momento, sem aprisionamento (LGPD).",
    },
  ];

  return (
    <div className="rf-light-section min-h-dvh bg-[#F4EFE6] text-[#222422] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12 text-center sm:text-left">
          <p className="rf-eyebrow font-sans text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-[#722F3E] mb-2">
            Leia. Acompanhe. Evolua.
          </p>
          <h1 className="rf-title-h1 text-balance text-[#141514] tracking-tight">
            Sobre o ReadingFlow
          </h1>
          <div className="mt-4 h-0.5 w-24 bg-[#722F3E]" />
        </header>

        <article className="space-y-8 rf-body-text text-[#222422] leading-relaxed">
          <section className="space-y-4">
            <h2 className="rf-subtitle-h2 text-2xl font-serif text-balance text-[#141514]">
              O refúgio silencioso do leitor contemporâneo
            </h2>
            <p className="text-[#222422]">
              O ReadingFlow nasceu de uma inquietação: a leitura profunda exige concentração,
              mas as ferramentas modernas de catalogação transformaram o ato íntimo de ler
              em uma corrida de métricas públicas e vaidade em redes sociais.
            </p>
            <p className="text-[#222422]">
              Nossa missão é resgatar o encanto das bibliotecas clássicas particulares — estantes
              de madeira nobre, couro desgastado, iluminação quente e o silêncio necessário para a
              reflexão — combinando essa atmosfera à precisão de um acervo digital contemporâneo.
            </p>
          </section>

          <section className="space-y-4 rounded-xl border border-[#756C63]/50 bg-[#EDE6DC] p-6 sm:p-8">
            <h3 className="rf-section-h3 text-xl font-serif text-balance text-[#141514]">
              Princípios Fundamentais
            </h3>
            <ul className="space-y-3 list-disc list-inside marker:text-[#722F3E] text-[#222422]">
              <li>
                <strong className="text-[#141514]">Privacidade Integral:</strong>{" "}
                Seus livros, notas e reflexões são só seus. Não há feed social, seguidores nem algoritmos de retenção.
              </li>
              <li>
                <strong className="text-[#141514]">Todos os seus formatos:</strong>{" "}
                Livros físicos com catalogação por código de barras, e-books em porcentagem e audiobooks com minutagem exata.
              </li>
              <li>
                <strong className="text-[#141514]">Estética Editorial Imersiva:</strong>{" "}
                Tipografia Playfair Display, paleta acolhedora inspirada em madeiras nobres e estantes 3D opcionais.
              </li>
              <li>
                <strong className="text-[#141514]">Portabilidade Sem Bloqueios:</strong>{" "}
                Exporte todo o seu acervo em JSON ou CSV neutralizado a qualquer momento, em conformidade com a LGPD.
              </li>
            </ul>
          </section>

          {/* Faixa Editorial de Compromissos de Privacidade */}
          <section
            aria-labelledby="compromissos-privacidade-heading"
            className="rounded-xl border border-[#2C221E]/25 bg-[#FAF6F0] p-6 sm:p-8 shadow-xs"
          >
            <p className="rf-eyebrow font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#722F3E] mb-1">
              Compromisso Inegociável
            </p>
            <h2
              id="compromissos-privacidade-heading"
              className="font-serif text-2xl font-semibold text-balance text-[#141514]"
            >
              Soberania e Privacidade do Seu Acervo
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {privacyCommitments.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-lg border border-[#2C221E]/15 bg-[#F4EFE6] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-[#722F3E]" aria-hidden="true" />
                      <h3 className="font-sans text-sm font-semibold text-balance text-[#141514]">
                        {item.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 font-sans text-xs leading-relaxed text-[#222422]">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/criar-conta"
              aria-label="Criar Minha Biblioteca Grátis"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-[#C8A46E] px-8 py-3.5 font-sans text-base font-semibold text-[#141514] shadow-md hover:bg-[#DFBE88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2 transition-colors"
            >
              Criar Minha Biblioteca Grátis
            </Link>
            <Link
              href="/funcionalidades"
              aria-label="Explorar Funcionalidades"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-[#2C221E] px-8 py-3.5 font-sans text-base font-semibold text-[#141514] hover:bg-[#2C221E] hover:text-[#F4EFE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2 transition-colors"
            >
              Explorar Funcionalidades ➔
            </Link>
          </section>
        </article>
      </div>
    </div>
  );
}

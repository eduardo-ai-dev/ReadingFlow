import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Compass, Clock, Award, Shield, Library } from "lucide-react";

export const metadata: Metadata = {
  title: "Funcionalidades — ReadingFlow",
  description:
    "Descubra as funcionalidades do ReadingFlow: Estante Virtual 3D, Cronômetro de Leitura e Foco, Metas e Evolução Literária.",
};

export default function FuncionalidadesPage() {
  const features = [
    {
      icon: Library,
      title: "Estante Virtual 3D & 2D",
      desc: "Visualize sua biblioteca em um ambiente clássico tridimensional ou em listas e grades ágeis. Três estantes dedicadas para livros físicos, e-books e audiobooks.",
    },
    {
      icon: Clock,
      title: "Canto de Foco & Cronômetro de Leitura",
      desc: "Sessões de leitura imersivas com cronômetro sem distrações, sons suaves de ambiente (lareira, chuva e biblioteca) e registro rápido do progresso em páginas ou minutos.",
    },
    {
      icon: Award,
      title: "Metas & Evolução Literária",
      desc: "Acompanhe seu ritmo de leitura com metas anuais e mensais calculadas no seu fuso horário. Análise neutra e acolhedora, sem pressões desnecessárias.",
    },
    {
      icon: Compass,
      title: "Catalogação Ágil por ISBN e Câmera",
      desc: "Aponte a câmera do celular para o código de barras ou digite o ISBN. Metadados oficiais via BrasilAPI, Google Books e Open Library com capas em alta resolução.",
    },
    {
      icon: BookOpen,
      title: "Ficha do Livro & Avaliação Detalhada",
      desc: "Histórico completo com notas de 0,5 a 5,0 estrelas, avaliação específica de narração para audiobooks, histórico de releituras e notas pessoais preservadas.",
    },
    {
      icon: Shield,
      title: "Privacidade Absoluta & Portabilidade",
      desc: "Zero rede social. Importe seus dados do Goodreads ou planilhas CSV com pré-visualização e rollback, e exporte seu acervo integral a qualquer momento.",
    },
  ];

  return (
    <div className="rf-light-section min-h-dvh bg-[#F4EFE6] text-[#222422] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-14 text-center">
          <p className="rf-eyebrow font-sans text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-[#722F3E] mb-2">
            Leia. Acompanhe. Evolua.
          </p>
          <h1 className="rf-title-h1 text-balance text-[#141514] tracking-tight">
            Funcionalidades Feitas para Leitores
          </h1>
          <p className="mt-4 rf-body-text max-w-2xl mx-auto text-[#222422]">
            Tudo o que você precisa para cultivar uma vida literária rica, organizada e livre de ruídos.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-xl border border-[#756C63]/50 bg-[#EDE6DC] p-6 sm:p-7 flex flex-col justify-between shadow-sm hover:border-[#722F3E] transition-colors"
              >
                <div>
                  <div className="inline-flex p-3 rounded-lg bg-[#722F3E]/12 text-[#722F3E] mb-4">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h2 className="rf-section-h3 text-xl font-serif text-balance text-[#141514] mb-2">
                    {feat.title}
                  </h2>
                  <p className="text-sm sm:text-base text-[#222422] leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center rounded-2xl border border-[#756C63]/50 bg-[#EDE6DC] p-8 sm:p-12">
          <h2 className="rf-subtitle-h2 text-2xl sm:text-3xl font-serif text-balance text-[#141514] mb-4">
            Pronto para transformar sua experiência de leitura?
          </h2>
          <p className="rf-body-text text-[#222422] max-w-xl mx-auto mb-8">
            Abra sua estante hoje mesmo e organize seus livros físicos, e-books e audiobooks no seu ritmo.
          </p>
          <Link
            href="/criar-conta"
            className="inline-flex items-center justify-center rounded-full bg-[#C8A46E] px-8 py-3.5 font-sans text-base font-semibold text-[#141514] shadow-md hover:bg-[#DFBE88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:ring-offset-2 transition-colors"
          >
            Começar a Organizar Minha Estante
          </Link>
        </div>
      </div>
    </div>
  );
}

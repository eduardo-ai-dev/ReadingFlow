import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Perguntas Frequentes (FAQ) — ReadingFlow",
  description:
    "Tire suas dúvidas sobre o ReadingFlow: importação de dados, privacidade, 3D, suporte a múltiplos formatos e funcionamento.",
};

export default function FaqPage() {
  const faqs = [
    {
      q: "O ReadingFlow é uma rede social como o Goodreads ou Skoob?",
      a: "Não. O ReadingFlow é deliberadamente individual e privado. Não existem feeds, perfis públicos, seguidores nem contadores de curtidas. Seus livros, anotações e reflexões pertencem exclusivamente a você.",
    },
    {
      q: "Posso importar meus livros do Goodreads ou de uma planilha?",
      a: "Sim. Oferecemos importação facilitada tanto de arquivos CSV exportados do Goodreads quanto do nosso modelo próprio em planilha. O sistema exibe um relatório com pré-visualização e oferece rollback integral do lote se desejar desfazer.",
    },
    {
      q: "Como funciona a estante 3D? Funciona bem no celular?",
      a: "Nossa estante 3D foi projetada com alta otimização gráfica em Three.js, com iluminação cinematográfica e carregamento sob demanda. Em dispositivos móveis ou com economia de energia ativada, o sistema prioriza o modo 2D fluído e responsivo, garantindo total conforto visual.",
    },
    {
      q: "Como o ReadingFlow lida com livros físicos, e-books e audiobooks?",
      a: "Cada formato tem tratamento próprio. Livros físicos são acompanhados por páginas, e-books podem ser monitorados por porcentagem ou páginas, e audiobooks têm acompanhamento preciso em horas e minutos ouvidos, além de avaliação separada para a qualidade da narração.",
    },
    {
      q: "Como é calculado o progresso e o ritmo das metas de leitura?",
      a: "Todas as datas e viradas de mês/ano são calculadas com precisão no fuso horário do seu perfil (ex: America/Sao_Paulo). A análise de ritmo é neutra e acolhedora, com tolerância de 5%, sem julgamentos ou alertas intrusivos.",
    },
    {
      q: "O que acontece se eu quiser parar de usar o ReadingFlow?",
      a: "Você tem posse integral dos seus dados conforme a LGPD. Pode exportar todo o seu acervo em JSON ou CSV neutralizado com um clique, ou solicitar a exclusão definitiva e irreversível da sua conta a qualquer momento.",
    },
  ];

  return (
    <div className="rf-light-section min-h-dvh bg-[#F4EFE6] text-[#222422] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12 text-center">
          <p className="rf-eyebrow font-sans text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-[#722F3E] mb-2">
            Esclarecimentos & Transparência
          </p>
          <h1 className="rf-title-h1 text-balance text-[#141514] tracking-tight">
            Perguntas Frequentes
          </h1>
          <p className="mt-4 rf-body-text text-[#222422]">
            Tudo o que você precisa saber sobre a experiência no ReadingFlow.
          </p>
        </header>

        <div className="space-y-6">
          {faqs.map((item, idx) => (
            <details
              key={idx}
              className="group rounded-xl border border-[#A6A29A]/60 bg-[#EDE6DC] p-6 transition-colors open:border-[#722F3E]"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between font-serif text-lg sm:text-xl font-semibold text-[#141514]">
                <span>{item.q}</span>
                <span className="ml-4 text-[#722F3E] transition-transform group-open:rotate-45 text-2xl font-light">
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-[#222422] leading-relaxed pt-2 border-t border-[#A6A29A]/40">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-14 text-center">
          <p className="text-sm text-[#222422] mb-4">
            Ainda tem dúvidas? Consulte nossa central de ajuda completa.
          </p>
          <Link
            href="/ajuda"
            className="inline-flex items-center text-[#722F3E] hover:text-[#2C221E] hover:underline font-semibold text-sm"
          >
            Ir para Central de Ajuda & Portabilidade ➔
          </Link>
        </div>
      </div>
    </div>
  );
}

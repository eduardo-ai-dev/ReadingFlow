import type { Metadata } from "next";
import { MarketingFooter } from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Política de Privacidade",
};

export default function PrivacyPage() {
  return (
    <>
      <article className="mx-auto max-w-3xl px-6 pt-24 pb-16 sm:px-10">
        <p className="editorial-kicker">LGPD · Lei nº 13.709/2018</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[var(--text-heading)]">
          Política de Privacidade
        </h1>
        <div className="prose-reading mt-6 space-y-5">
          <section>
            <h2 className="font-serif text-xl font-semibold">
              1. Privacidade máxima por padrão
            </h2>
            <p className="mt-1.5 text-[var(--text-muted)]">
              Toda conta nasce 100% privada. Não há perfil público, feed social ou
              compartilhamento de histórico de leitura com terceiros ou
              anunciantes.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold">
              2. Dados tratados e finalidade
            </h2>
            <p className="mt-1.5 text-[var(--text-muted)]">
              Coletamos apenas o necessário para operar sua biblioteca: nome de
              exibição, endereço de e-mail para autenticação, preferências de fuso
              horário/tema e os registros bibliográficos que você cadastra ou
              importa.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold">
              3. Direitos do titular (Art. 18 da LGPD)
            </h2>
            <p className="mt-1.5 text-[var(--text-muted)]">
              Na página de Configurações, você exerce diretamente a portabilidade
              (exportação em JSON reimportável e planilha CSV segura) e a
              eliminação imediata da conta e do acervo. Cópias de segurança
              criptografadas expiram em até 30 dias.
            </p>
          </section>
        </div>
      </article>
      <MarketingFooter />
    </>
  );
}

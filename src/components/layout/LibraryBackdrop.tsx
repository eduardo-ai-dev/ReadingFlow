/**
 * Fundo arquitetônico reutilizável de estantes lineares sutis para as laterais
 * da tela de autenticação e de todas as páginas internas (widescreen >= 1280px).
 *
 * - Usa 100% `currentColor` via tokens semânticos (`--rf-text-heading`), adaptando-se
 *   automaticamente aos 4 temas curados (Caderno, Dark Academia, Escandinavo e Gótico).
 * - Oculto em mobile/tablet (< 1024px) para preservar 100% da área útil.
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
          ? "pointer-events-none fixed inset-0 z-0 hidden overflow-hidden select-none lg:block"
          : "pointer-events-none absolute inset-0 overflow-hidden select-none"
      }
      style={
        isApp
          ? {
              /* theme-exempt: máscara alfa CSS (controla apenas transparência, não cor) */
              maskImage: "radial-gradient(ellipse 96% 92% at 50% 45%, rgba(0,0,0,0.45) 0%, rgba(0,0,0,1) 62%, rgba(0,0,0,0.65) 100%)",
              /* theme-exempt: máscara alfa CSS (controla apenas transparência, não cor) */
              WebkitMaskImage: "radial-gradient(ellipse 96% 92% at 50% 45%, rgba(0,0,0,0.45) 0%, rgba(0,0,0,1) 62%, rgba(0,0,0,0.65) 100%)",
            }
          : undefined
      }
    >
      <svg
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className={
          isApp
            ? "h-full w-full text-[var(--rf-text-heading)] opacity-[0.06] xl:opacity-[0.085]"
            : "hidden h-full w-full text-[var(--rf-text-heading)] opacity-[0.03] lg:block"
        }
      >
        {/* Ala Esquerda: Estante arquitetônica em arco clássico com volumes lineares */}
        <g stroke="currentColor" strokeWidth="1.8">
          <rect x="28" y="48" width="332" height="984" rx="4" />
          <path d="M46 218 V142 C46 78 342 78 342 142 V218" />
          <line x1="28" y1="218" x2="360" y2="218" strokeWidth="2.8" />
          <line x1="28" y1="364" x2="360" y2="364" strokeWidth="2.8" />
          <line x1="28" y1="510" x2="360" y2="510" strokeWidth="2.8" />
          <line x1="28" y1="656" x2="360" y2="656" strokeWidth="2.8" />
          <line x1="28" y1="802" x2="360" y2="802" strokeWidth="2.8" />
          <line x1="28" y1="948" x2="360" y2="948" strokeWidth="2.8" />

          {/* Prateleira 1 esquerda */}
          <rect x="52" y="246" width="20" height="118" />
          <rect x="76" y="260" width="24" height="104" />
          <rect x="104" y="238" width="18" height="126" />
          <rect x="126" y="252" width="26" height="112" />
          <rect x="156" y="266" width="18" height="98" />
          <rect x="230" y="248" width="22" height="116" />
          <rect x="256" y="240" width="20" height="124" />
          <rect x="280" y="258" width="28" height="106" />
          <rect x="312" y="246" width="22" height="118" />

          {/* Prateleira 2 esquerda */}
          <rect x="48" y="392" width="24" height="118" />
          <rect x="76" y="402" width="20" height="108" />
          <rect x="100" y="384" width="26" height="126" />
          <rect x="130" y="396" width="20" height="114" />
          <rect x="154" y="388" width="24" height="122" />
          <rect x="182" y="404" width="18" height="106" />
          <rect x="262" y="394" width="22" height="116" />
          <rect x="288" y="384" width="26" height="126" />
          <rect x="318" y="398" width="20" height="112" />

          {/* Prateleira 3 esquerda */}
          <rect x="56" y="538" width="22" height="118" />
          <rect x="82" y="530" width="26" height="126" />
          <rect x="112" y="544" width="20" height="112" />
          <rect x="136" y="536" width="22" height="120" />
          <rect x="220" y="536" width="24" height="120" />
          <rect x="248" y="528" width="28" height="128" />
          <rect x="280" y="542" width="20" height="114" />
          <rect x="304" y="534" width="26" height="122" />

          {/* Prateleira 4 esquerda */}
          <rect x="50" y="684" width="24" height="118" />
          <rect x="78" y="676" width="20" height="126" />
          <rect x="102" y="690" width="28" height="112" />
          <rect x="134" y="680" width="22" height="122" />
          <rect x="234" y="682" width="24" height="120" />
          <rect x="262" y="674" width="22" height="128" />
          <rect x="288" y="688" width="26" height="114" />
          <rect x="318" y="680" width="20" height="122" />

          {/* Prateleira 5 esquerda */}
          <rect x="54" y="830" width="22" height="118" />
          <rect x="80" y="822" width="26" height="126" />
          <rect x="110" y="836" width="18" height="112" />
          <rect x="132" y="826" width="24" height="122" />
          <rect x="244" y="828" width="22" height="120" />
          <rect x="270" y="820" width="26" height="128" />
          <rect x="300" y="834" width="24" height="114" />
        </g>

        {/* Ala Direita: Estante arquitetônica em arco clássico espelhada */}
        <g stroke="currentColor" strokeWidth="1.8">
          <rect x="1560" y="48" width="332" height="984" rx="4" />
          <path d="M1578 218 V142 C1578 78 1874 78 1874 142 V218" />
          <line x1="1560" y1="218" x2="1892" y2="218" strokeWidth="2.8" />
          <line x1="1560" y1="364" x2="1892" y2="364" strokeWidth="2.8" />
          <line x1="1560" y1="510" x2="1892" y2="510" strokeWidth="2.8" />
          <line x1="1560" y1="656" x2="1892" y2="656" strokeWidth="2.8" />
          <line x1="1560" y1="802" x2="1892" y2="802" strokeWidth="2.8" />
          <line x1="1560" y1="948" x2="1892" y2="948" strokeWidth="2.8" />

          {/* Prateleira 1 direita */}
          <rect x="1584" y="246" width="24" height="118" />
          <rect x="1612" y="238" width="20" height="126" />
          <rect x="1636" y="254" width="26" height="110" />
          <rect x="1666" y="244" width="22" height="120" />
          <rect x="1760" y="242" width="22" height="122" />
          <rect x="1786" y="252" width="24" height="112" />
          <rect x="1814" y="236" width="20" height="128" />
          <rect x="1838" y="250" width="26" height="114" />

          {/* Prateleira 2 direita */}
          <rect x="1588" y="390" width="22" height="120" />
          <rect x="1614" y="382" width="26" height="128" />
          <rect x="1644" y="396" width="20" height="114" />
          <rect x="1736" y="392" width="24" height="118" />
          <rect x="1764" y="384" width="20" height="126" />
          <rect x="1788" y="394" width="26" height="116" />
          <rect x="1818" y="386" width="22" height="124" />
          <rect x="1844" y="398" width="24" height="112" />

          {/* Prateleira 3 direita */}
          <rect x="1582" y="540" width="26" height="116" />
          <rect x="1612" y="530" width="22" height="126" />
          <rect x="1638" y="544" width="20" height="112" />
          <rect x="1662" y="534" width="24" height="122" />
          <rect x="1772" y="538" width="26" height="118" />
          <rect x="1802" y="528" width="22" height="128" />
          <rect x="1828" y="540" width="24" height="116" />

          {/* Prateleira 4 direita */}
          <rect x="1586" y="684" width="22" height="118" />
          <rect x="1612" y="676" width="26" height="126" />
          <rect x="1642" y="690" width="20" height="112" />
          <rect x="1748" y="682" width="24" height="120" />
          <rect x="1776" y="674" width="22" height="128" />
          <rect x="1802" y="686" width="28" height="116" />
          <rect x="1834" y="678" width="24" height="124" />

          {/* Prateleira 5 direita */}
          <rect x="1584" y="830" width="24" height="118" />
          <rect x="1612" y="820" width="22" height="128" />
          <rect x="1638" y="834" width="26" height="114" />
          <rect x="1760" y="828" width="22" height="120" />
          <rect x="1786" y="822" width="26" height="126" />
          <rect x="1816" y="836" width="20" height="112" />
          <rect x="1840" y="826" width="24" height="122" />
        </g>
      </svg>
    </div>
  );
}

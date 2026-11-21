"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const STARS = [
  { x: 18, y: 22, r: 1.1, o: 0.85 },
  { x: 34, y: 14, r: 0.8, o: 0.6 },
  { x: 52, y: 34, r: 1.2, o: 0.9 },
  { x: 24, y: 48, r: 0.9, o: 0.7 },
  { x: 76, y: 44, r: 1.0, o: 0.75 },
  { x: 15, y: 66, r: 0.8, o: 0.55 },
  { x: 44, y: 58, r: 1.1, o: 0.8 },
  { x: 68, y: 63, r: 0.9, o: 0.65 },
  { x: 85, y: 19, r: 0.85, o: 0.7 },
  { x: 31, y: 74, r: 0.75, o: 0.5 },
  { x: 61, y: 74, r: 1.0, o: 0.75 },
  { x: 83, y: 54, r: 0.8, o: 0.6 },
] as const;

const DISTANT_LIGHTS = [
  { x: 16, y: 91 },
  { x: 24, y: 93 },
  { x: 39, y: 90 },
  { x: 47, y: 92 },
  { x: 63, y: 94 },
  { x: 74, y: 91 },
  { x: 82, y: 93 },
] as const;

/**
 * Janela retangular noturna à esquerda da estante: céu estrelado, lua brilhante,
 * silhueta distante, caixilhos de madeira e luar sutil.
 */
export function NightWindow({ isLightOn }: { isLightOn: boolean }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="relative select-none"
    >
      {/* Halo externo de luar frio na parede (ganha força quando a lâmpada apaga) */}
      <div
        className="pointer-events-none absolute -inset-10 rounded-full transition-opacity duration-500"
        style={{
          opacity: isLightOn ? 0.25 : 0.65,
          background:
            "radial-gradient(ellipse at 55% 42%, rgba(154, 184, 245, 0.22) 0%, rgba(110, 145, 220, 0.06) 52%, transparent 75%)",
        }}
      />

      {/* Moldura arquitetônica retangular de madeira escura */}
      <div className="relative h-[190px] w-[78px] sm:h-[270px] sm:w-[112px] lg:h-[336px] lg:w-[138px] xl:h-[364px] xl:w-[150px] rounded-t-[3px] border-[6px] sm:border-[8px] border-[#161110] bg-[#060a1c] shadow-[0_18px_38px_rgba(0,0,0,0.75),inset_0_0_16px_rgba(0,0,0,0.85)]">
        {/* Céu noturno em SVG nítido */}
        <svg
          viewBox="0 0 100 240"
          preserveAspectRatio="none"
          className="h-full w-full block"
        >
          <defs>
            <linearGradient id="nightSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#050919" />
              <stop offset="58%" stopColor="#0C1736" />
              <stop offset="86%" stopColor="#122147" />
              <stop offset="100%" stopColor="#070B18" />
            </linearGradient>
            <radialGradient id="moonHalo" cx="66%" cy="23%" r="36%">
              <stop offset="0%" stopColor="rgba(215, 230, 255, 0.55)" />
              <stop offset="45%" stopColor="rgba(165, 195, 255, 0.18)" />
              <stop offset="100%" stopColor="rgba(165, 195, 255, 0)" />
            </radialGradient>
          </defs>

          <rect width="100" height="240" fill="url(#nightSkyGrad)" />
          <rect width="100" height="240" fill="url(#moonHalo)" />

          {/* Estrelas */}
          {STARS.map((s, idx) => (
            <circle
              key={idx}
              cx={s.x}
              cy={s.y * 1.9}
              r={s.r}
              fill="#F4F7FF"
              opacity={s.o}
              className={
                !prefersReducedMotion && idx % 3 === 0 ? "animate-pulse" : undefined
              }
            />
          ))}

          {/* Lua brilhante */}
          <circle cx="66" cy="54" r="10.5" fill="#F7F9FF" />
          <circle cx="63.5" cy="51.5" r="2.1" fill="#DCE4F7" opacity="0.45" />
          <circle cx="69" cy="56.5" r="1.5" fill="#DCE4F7" opacity="0.38" />

          {/* Silhueta de colinas noturnas ao fundo */}
          <path
            d="M0 240 L0 198 Q24 187 48 195 T100 190 L100 240 Z"
            fill="#050711"
          />
          <path
            d="M0 240 L0 210 Q35 203 68 211 T100 206 L100 240 Z"
            fill="#03040A"
          />

          {/* Pequenas luzes distantes âmbar no horizonte */}
          {DISTANT_LIGHTS.map((l, idx) => (
            <rect
              key={idx}
              x={l.x}
              y={l.y * 2.35}
              width="1.6"
              height="1.6"
              rx="0.5"
              fill="#FFC778"
              opacity="0.82"
            />
          ))}
        </svg>

        {/* Reflexo diagonal sutil no vidro */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(125deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 34%, transparent 36%, transparent 68%, rgba(190,215,255,0.04) 100%)",
          }}
        />

        {/* Caixilhos internos de madeira (muntins) */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[4px] -translate-x-1/2 bg-[#161110] shadow-[1px_0_3px_rgba(0,0,0,0.7)]" />
        <div className="pointer-events-none absolute inset-x-0 top-1/3 h-[4px] -translate-y-1/2 bg-[#161110] shadow-[0_2px_3px_rgba(0,0,0,0.7)]" />
        <div className="pointer-events-none absolute inset-x-0 top-2/3 h-[4px] -translate-y-1/2 bg-[#161110] shadow-[0_2px_3px_rgba(0,0,0,0.7)]" />
      </div>

      {/* Peitoril projetado (windowsill) */}
      <div className="relative -left-[7px] sm:-left-[10px] h-[8px] sm:h-[10px] w-[calc(100%+14px)] sm:w-[calc(100%+20px)] rounded-[2px] border-t border-[#3B2E2A]/60 bg-gradient-to-b from-[#251C19] to-[#110D0C] shadow-[0_8px_16px_rgba(0,0,0,0.8)]" />
    </div>
  );
}

/**
 * Móbile escultural minimalista no topo esquerdo da estante com balanço pendular suave.
 */
export function ShelfMobile() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="relative h-[54px] w-[72px] sm:h-[68px] sm:w-[92px] select-none"
    >
      {/* Pedestal cônico e haste base */}
      <svg
        viewBox="0 0 92 68"
        className="h-full w-full overflow-visible"
      >
        {/* Base apoiada na madeira */}
        <ellipse cx="42" cy="66" rx="13" ry="2.5" fill="rgba(0,0,0,0.55)" />
        <path d="M33 66 L42 54 L51 66 Z" fill="#1C1918" stroke="#473D35" strokeWidth="0.7" />
        <line x1="42" y1="54" x2="42" y2="14" stroke="#8F7956" strokeWidth="1.3" />
      </svg>

      {/* Braço suspenso em balanço suave */}
      <motion.div
        className="absolute inset-0 origin-[45.6%_20.5%]"
        animate={
          prefersReducedMotion
            ? { rotate: 0 }
            : { rotate: [-3.8, 3.8, -3.8] }
        }
        transition={{
          duration: 6.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <svg viewBox="0 0 92 68" className="h-full w-full overflow-visible">
          {/* Haste curva principal */}
          <path
            d="M12 20 Q42 10 76 18"
            fill="none"
            stroke="#B89B6C"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* Contrapeso esquerdo (disco marfim) */}
          <line x1="12" y1="20" x2="12" y2="30" stroke="#9B8259" strokeWidth="0.9" />
          <circle cx="12" cy="34" r="5.2" fill="#EAE0CE" />

          {/* Sub-braço direito */}
          <line x1="76" y1="18" x2="76" y2="27" stroke="#9B8259" strokeWidth="0.9" />
          <path
            d="M60 29 Q76 25 88 31"
            fill="none"
            stroke="#A88C60"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <circle cx="60" cy="34" r="3.8" fill="#C96F53" />
          <circle cx="88" cy="36" r="4.2" fill="#D5B57B" />
        </svg>
      </motion.div>
    </div>
  );
}

/**
 * Relógio analógico funcional em tempo real apoiado sobre o topo da estante.
 */
export function AnalogShelfClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const initialId = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(interval);
    };
  }, []);

  const hours = now ? now.getHours() : 22;
  const minutes = now ? now.getMinutes() : 10;
  const seconds = now ? now.getSeconds() : 30;

  const hourDeg = (hours % 12) * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const secondDeg = seconds * 6;

  const timeLabel = now
    ? `Relógio analógico marcando ${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}`
    : "Relógio analógico da biblioteca";

  return (
    <div
      role="img"
      aria-label={timeLabel}
      title={timeLabel}
      className="relative flex flex-col items-center select-none"
    >
      {/* Caixa circular com aro de latão escuro e mostrador marfim/antracite */}
      <div className="relative h-[40px] w-[40px] sm:h-[48px] sm:w-[48px] rounded-full border-[2.5px] border-[#9E8256] bg-[#191615] shadow-[0_6px_14px_rgba(0,0,0,0.7),inset_0_1px_5px_rgba(255,235,195,0.16)]">
        <svg viewBox="0 0 48 48" className="h-full w-full">
          {/* Marcadores das 12 horas */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const rOuter = 19.5;
            const rInner = i % 3 === 0 ? 15.8 : 17.5;
            const x1 = 24 + Math.sin(angle) * rInner;
            const y1 = 24 - Math.cos(angle) * rInner;
            const x2 = 24 + Math.sin(angle) * rOuter;
            const y2 = 24 - Math.cos(angle) * rOuter;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i % 3 === 0 ? "#E8DAC2" : "#8F816E"}
                strokeWidth={i % 3 === 0 ? "1.4" : "0.9"}
                strokeLinecap="round"
              />
            );
          })}

          {/* Ponteiro das horas */}
          <line
            x1="24"
            y1="24"
            x2="24"
            y2="13.5"
            stroke="#F2E6D3"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${hourDeg} 24 24)`}
          />

          {/* Ponteiro dos minutos */}
          <line
            x1="24"
            y1="24"
            x2="24"
            y2="9.5"
            stroke="#DFC79C"
            strokeWidth="1.4"
            strokeLinecap="round"
            transform={`rotate(${minuteDeg} 24 24)`}
          />

          {/* Ponteiro dos segundos */}
          <line
            x1="24"
            y1="26.5"
            x2="24"
            y2="8"
            stroke="#C96F53"
            strokeWidth="0.9"
            strokeLinecap="round"
            transform={`rotate(${secondDeg} 24 24)`}
          />

          {/* Pino central de latão */}
          <circle cx="24" cy="24" r="2" fill="#D5B57B" />
        </svg>
      </div>

      {/* Base de apoio sobre a estante */}
      <div className="-mt-[2px] h-[4px] w-[24px] rounded-b-[2px] bg-[#7E6642] shadow-md" />
    </div>
  );
}

/**
 * Vaso cerâmico escuro com ramos secos orgânicos no topo direito da estante.
 */
export function DarkVaseBranches({ isLightOn }: { isLightOn: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-[64px] w-[58px] sm:h-[78px] sm:w-[68px] select-none"
    >
      <svg viewBox="0 0 68 78" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="darkCeramicVase" x1="0%" y1="0%" x2="100%" y2="10%">
            <stop offset="0%" stopColor={isLightOn ? "#34443E" : "#1C2421"} />
            <stop offset="42%" stopColor="#1B2320" />
            <stop offset="100%" stopColor="#0D1110" />
          </linearGradient>
        </defs>

        {/* Ramos secos e brotos âmbar */}
        <g stroke="#B8894A" strokeWidth="1.15" fill="none" strokeLinecap="round">
          <path d="M33 44 Q26 24 16 6" />
          <path d="M24 23 Q18 19 13 20" />
          <path d="M34 44 Q33 21 31 2" />
          <path d="M33 18 Q38 12 42 9" />
          <path d="M35 44 Q43 24 53 8" />
          <path d="M45 24 Q51 22 57 23" />
          <path d="M35 44 Q48 31 60 19" />
        </g>
        {/* Pequenas sementes secas */}
        <g fill="#D9AE6E">
          <ellipse cx="15" cy="5.5" rx="1.8" ry="2.8" transform="rotate(-28 15 5.5)" />
          <ellipse cx="12.5" cy="20" rx="1.6" ry="2.4" transform="rotate(-65 12.5 20)" />
          <ellipse cx="31" cy="2" rx="1.7" ry="2.8" />
          <ellipse cx="42.5" cy="8.5" rx="1.6" ry="2.5" transform="rotate(32 42.5 8.5)" />
          <ellipse cx="53.5" cy="7.5" rx="1.8" ry="2.7" transform="rotate(28 53.5 7.5)" />
          <ellipse cx="60.5" cy="18.5" rx="1.6" ry="2.4" transform="rotate(44 60.5 18.5)" />
        </g>

        {/* Sombra na madeira */}
        <ellipse cx="34" cy="76" rx="15" ry="2.5" fill="rgba(0,0,0,0.6)" />

        {/* Corpo cerâmico torneado */}
        <path
          d="M28 42 H40 L38 48 C46 53 48 64 43 75 H25 C20 64 22 53 30 48 Z"
          fill="url(#darkCeramicVase)"
          stroke="#3E4F48"
          strokeWidth="0.6"
        />
        {/* Brilho sutil de cerâmica esmaltada */}
        <path
          d="M28 53 Q25 62 27 71"
          stroke={isLightOn ? "rgba(255, 236, 198, 0.22)" : "rgba(180, 205, 245, 0.08)"}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

/**
 * Nicho superior direito: quadro branco pequeno apoiado + 3 livros horizontais + esfera 3D.
 */
export function UpperRightNicheDecor({ isLightOn }: { isLightOn: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-full w-full items-end justify-center px-2 pt-3 pb-[1px] select-none"
    >
      {/* Quadro branco pequeno apoiado ao fundo esquerdo */}
      <div className="relative z-10 -mr-2 mb-[1px] h-[64px] w-[48px] sm:h-[82px] sm:w-[62px] -rotate-[2deg] rounded-[2px] border-[4px] sm:border-[5px] border-[#EAE3D6] bg-[#161B24] p-1.5 shadow-[0_8px_16px_rgba(0,0,0,0.85)]">
        <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#1A2438] to-[#0E131D]">
          <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-[#F2E6D0] opacity-90" />
          <span className="absolute inset-x-0 bottom-0 h-4 bg-[#261E1B] [clip-path:polygon(0_100%,0_40%,45%_15%,100%_55%,100%_100%)]" />
        </div>
      </div>

      {/* Pilha de 3 livros na horizontal + Esfera 3D à frente */}
      <div className="relative z-20 flex flex-col items-center">
        {/* Esfera 3D apoiada/à frente */}
        <div
          className="relative z-30 -mb-1.5 h-[22px] w-[22px] sm:h-[28px] sm:w-[28px] rounded-full shadow-[0_6px_10px_rgba(0,0,0,0.75)]"
          style={{
            background: isLightOn
              ? "radial-gradient(circle at 35% 28%, #FFFDF8 0%, #E7DCC8 38%, #9B8D78 76%, #332B23 100%)"
              : "radial-gradient(circle at 35% 30%, #B8C0D0 0%, #6E7482 48%, #23262E 100%)",
          }}
        />

        {/* Livro horizontal 1 (topo — ocre dourado) */}
        <div className="h-[8px] sm:h-[10px] w-[48px] sm:w-[64px] rounded-[2px] border-r-[5px] border-r-[#EFE5D0] bg-gradient-to-r from-[#8A682E] via-[#A6803E] to-[#6E5120] shadow-[0_2px_4px_rgba(0,0,0,0.65)]" />
        {/* Livro horizontal 2 (meio — verde biblioteca) */}
        <div className="h-[9px] sm:h-[11px] w-[54px] sm:w-[72px] rounded-[2px] border-l-[5px] border-l-[#EAE0CC] bg-gradient-to-r from-[#1A312A] via-[#27463D] to-[#142620] shadow-[0_2px_5px_rgba(0,0,0,0.7)]" />
        {/* Livro horizontal 3 (base — bordô couro) */}
        <div className="h-[10px] sm:h-[12px] w-[60px] sm:w-[80px] rounded-[2px] border-r-[6px] border-r-[#EFE5D0] bg-gradient-to-r from-[#5A1C25] via-[#752632] to-[#42131A] shadow-[0_4px_8px_rgba(0,0,0,0.85)]" />
      </div>
    </div>
  );
}

/**
 * Caixa organizadora bege em linho com porta-etiqueta em couro e latão no canto inferior direito.
 */
export function BeigeOrganizerBox() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-full w-full items-end justify-center px-2.5 pb-[1px] select-none"
    >
      <div className="relative flex h-[68%] w-full max-w-[126px] flex-col items-center">
        {/* Tampa encaixada com leve borda saliente */}
        <div className="z-10 h-[11px] sm:h-[13px] w-[calc(100%+6px)] rounded-[2px] border-b border-[#8E7F69] bg-gradient-to-b from-[#E5DAC5] to-[#CBBFA8] shadow-[0_3px_6px_rgba(0,0,0,0.5)]" />

        {/* Corpo da caixa em linho bege */}
        <div className="relative flex flex-1 w-full items-center justify-center rounded-b-[2px] bg-gradient-to-b from-[#D4C7B0] via-[#C6B89F] to-[#AA9B82] shadow-[inset_0_4px_10px_rgba(0,0,0,0.22),0_4px_10px_rgba(0,0,0,0.7)]">
          {/* Porta-etiqueta central de latão e couro */}
          <div className="flex h-[16px] w-[32px] sm:h-[18px] sm:w-[38px] items-center justify-center rounded-[2px] border border-[#9E8152] bg-[#2D231C] shadow-inner">
            <span className="h-[6px] w-[20px] sm:w-[24px] rounded-[1px] bg-[#EBE1CF]" />
          </div>
        </div>
      </div>
    </div>
  );
}


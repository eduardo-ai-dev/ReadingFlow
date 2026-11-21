"use client";

import { useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { ptBR } from "@/lib/i18n/pt-BR";

const DUST_PARTICLES = [
  { id: 1, left: "44%", top: "14%", size: 2.5, dur: 7.2, delay: 0.2 },
  { id: 2, left: "53%", top: "20%", size: 2, dur: 8.4, delay: 1.1 },
  { id: 3, left: "48%", top: "28%", size: 3, dur: 9.1, delay: 2.4 },
  { id: 4, left: "39%", top: "34%", size: 2, dur: 7.8, delay: 0.7 },
  { id: 5, left: "59%", top: "32%", size: 2.5, dur: 8.9, delay: 1.8 },
  { id: 6, left: "46%", top: "44%", size: 2, dur: 10.2, delay: 3.1 },
  { id: 7, left: "55%", top: "48%", size: 3, dur: 8.6, delay: 0.5 },
  { id: 8, left: "35%", top: "54%", size: 2, dur: 9.5, delay: 2.0 },
  { id: 9, left: "63%", top: "57%", size: 2.2, dur: 7.9, delay: 1.4 },
  { id: 10, left: "50%", top: "64%", size: 2.6, dur: 9.8, delay: 2.8 },
] as const;

interface SpotlightOverlayProps {
  isLightOn: boolean;
}

/**
 * Cone volumétrico de luz quente que nasce exatamente no bocal da luminária pendente.
 * Combina feixe geométrico (clip-path: polygon) + múltiplos radial-gradients + poeira suspensa.
 */
export function SpotlightOverlay({ isLightOn }: SpotlightOverlayProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={{
        opacity: isLightOn ? 1 : 0,
      }}
      transition={{
        duration: prefersReducedMotion ? 0.01 : isLightOn ? 0.45 : 0.28,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="pointer-events-none absolute top-[66px] sm:top-[84px] left-1/2 z-30 h-[76vh] w-[540px] sm:w-[780px] lg:w-[900px] -translate-x-1/2 select-none"
    >
      {/* 1. Halo intenso imediato sob o bulbo e interior branco da cúpula */}
      <div
        className="lamp-bulb-bloom absolute -top-5 left-1/2 h-[170px] w-[260px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 18%, rgba(255, 248, 224, 0.72) 0%, rgba(255, 214, 150, 0.28) 42%, transparent 74%)",
          mixBlendMode: "screen",
        }}
      />

      {/* 2. Cone direcional recortado exatamente na largura do bocal da cúpula */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: "polygon(44.2% 0%, 55.8% 0%, 98% 100%, 2% 100%)",
          background:
            "linear-gradient(180deg, rgba(255, 239, 198, 0.36) 0%, rgba(255, 206, 140, 0.17) 34%, rgba(255, 185, 112, 0.06) 68%, transparent 96%)",
          mixBlendMode: "screen",
          filter: "blur(8px)",
        }}
      />

      {/* 3. Difusão elíptica ampla aquecendo o topo da estante e as lombadas */}
      <div className="lamp-glow" />

      {/* 4. Partículas sutis de poeira dourada flutuando no feixe */}
      {!prefersReducedMotion && isLightOn
        ? DUST_PARTICLES.map((p) => (
            <motion.span
              key={p.id}
              className="absolute rounded-full bg-[#FFE6B3]"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                boxShadow: "0 0 6px rgba(255, 225, 166, 0.8)",
              }}
              animate={{
                y: [0, -22, 0],
                x: [0, p.id % 2 === 0 ? 6 : -6, 0],
                opacity: [0.18, 0.62, 0.18],
              }}
              transition={{
                duration: p.dur,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))
        : null}
    </motion.div>
  );
}

interface PendantLampProps {
  isLightOn: boolean;
  onToggleLight: () => void;
}

/**
 * Luminária pendente preta fosca com interior branco brilhante e cordão arrastável no eixo Y.
 */
export function PendantLamp({ isLightOn, onToggleLight }: PendantLampProps) {
  const prefersReducedMotion = useReducedMotion();
  const didTriggerDuringDrag = useRef(false);

  const dragY = useMotionValue(0);
  const cordHeight = useTransform(dragY, (y) => Math.max(16, 38 + y));

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!didTriggerDuringDrag.current && info.offset.y >= 24) {
      didTriggerDuringDrag.current = true;
      onToggleLight();
    }
  };

  const handleDragEnd = () => {
    window.setTimeout(() => {
      didTriggerDuringDrag.current = false;
    }, 140);
  };

  const handleClick = () => {
    if (didTriggerDuringDrag.current) return;
    if (!prefersReducedMotion) {
      void animate(dragY, [0, 18, 0], {
        duration: 0.28,
        ease: [0.22, 1, 0.36, 1],
      });
    }
    onToggleLight();
  };

  return (
    <div className="pointer-events-none absolute top-0 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center select-none">
      {/* Roseta de teto + cabo elétrico revestido */}
      <div className="h-[6px] w-[22px] rounded-b-full bg-[#09090b] shadow-md" />
      <div className="h-[22px] sm:h-[38px] w-[3px] bg-gradient-to-r from-[#09090b] via-[#242429] to-[#09090b]" />

      {/* Bocal de latão escuro + Cúpula preta com interior branco brilhante */}
      <div className="relative flex flex-col items-center">
        {/* Colarinho metálico superior */}
        <div className="h-[9px] w-[18px] rounded-t-[3px] border-x border-t border-[#8B7147]/50 bg-gradient-to-r from-[#3A2E1E] via-[#9B7E52] to-[#2E2417]" />

        {/* Cúpula cônica SVG com interior reflexivo */}
        <svg
          width="116"
          height="42"
          viewBox="0 0 116 42"
          className="w-[96px] sm:w-[116px] h-auto overflow-visible drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="lampOuterMetal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#09090b" />
              <stop offset="28%" stopColor="#232329" />
              <stop offset="62%" stopColor="#121216" />
              <stop offset="100%" stopColor="#060608" />
            </linearGradient>
            <radialGradient id="lampInnerLit" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="58%" stopColor="#FFF2D2" />
              <stop offset="100%" stopColor="#E6C288" />
            </radialGradient>
            <radialGradient id="lampInnerOff" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#3B3940" />
              <stop offset="100%" stopColor="#1D1C21" />
            </radialGradient>
          </defs>

          {/* Corpo externo preto fosco */}
          <path
            d="M44 0 H72 L112 33 H4 Z"
            fill="url(#lampOuterMetal)"
            stroke="#2D2B32"
            strokeWidth="0.8"
          />

          {/* Interior branco brilhante da cúpula */}
          <ellipse
            cx="58"
            cy="33"
            rx="54"
            ry="7.5"
            fill={isLightOn ? "url(#lampInnerLit)" : "url(#lampInnerOff)"}
            stroke={isLightOn ? "#FFE8B8" : "#2C2A30"}
            strokeWidth="0.9"
          />

          {/* Lâmpada central visível no interior */}
          <circle
            cx="58"
            cy="32"
            r="7.5"
            fill={isLightOn ? "#FFFDF5" : "#2D2926"}
          />
          {isLightOn ? (
            <circle
              cx="58"
              cy="32"
              r="12"
              fill="rgba(255, 240, 195, 0.48)"
            />
          ) : null}
        </svg>

        {/* Cordão de puxar (pull-cord) arrastável no eixo Y */}
        <div className="pointer-events-auto absolute top-[6px] left-[calc(50%+30px)] sm:left-[calc(50%+36px)] flex w-11 -translate-x-1/2 flex-col items-center">
          {/* Fio metálico elástico ancorado no topo (acompanha o deslocamento Y sem abrir vão) */}
          <motion.div
            aria-hidden="true"
            style={{ height: cordHeight }}
            className="pointer-events-none absolute top-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-gradient-to-b from-[#7E6845] via-[#C8AD7F] to-[#9E8254] shadow-[0_0_4px_rgba(0,0,0,0.6)]"
          />

          {/* Pingente de latão arrastável / clicável com área de toque acessível (44x44) */}
          <motion.button
            type="button"
            drag={prefersReducedMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 46 }}
            dragElastic={0.22}
            dragSnapToOrigin
            style={{ y: dragY }}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            aria-pressed={isLightOn}
            aria-label={
              isLightOn
                ? ptBR.landingRoom.lampTurnOff
                : ptBR.landingRoom.lampTurnOn
            }
            title={
              isLightOn
                ? ptBR.landingRoom.lampTurnOff
                : ptBR.landingRoom.lampTurnOn
            }
            className="group relative mt-[32px] flex h-11 w-11 cursor-grab items-start justify-center pt-1.5 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5C99B]"
          >
            {/* Bolinha / ponteira cônica de latão escovado */}
            <span className="flex flex-col items-center transition-transform duration-150 group-hover:scale-110">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D9BE8E]" />
              <span className="h-3.5 w-2.5 rounded-b-full rounded-t-[2px] border border-[#F0D9AD]/50 bg-gradient-to-b from-[#E5C996] via-[#B49058] to-[#6E532D] shadow-[0_3px_8px_rgba(0,0,0,0.75)]" />
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

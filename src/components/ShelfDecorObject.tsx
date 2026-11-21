"use client";

import { X } from "lucide-react";
import {
  SHELF_DECOR_OPTIONS,
  type DecorItemType,
} from "@/features/shelves/arrange-shelves";
import styles from "./VirtualBookshelf.module.css";

export interface ShelfDecorObjectProps {
  id: string;
  decorType: DecorItemType;
  mode: "view" | "edit";
  onRemove?: (id: string) => void;
}

function getDecorLabel(decorType: DecorItemType): string {
  return (
    SHELF_DECOR_OPTIONS.find((opt) => opt.id === decorType)?.label ??
    "Objeto decorativo"
  );
}

function DecorArtwork({ decorType }: { decorType: DecorItemType }) {
  switch (decorType) {
    case "planta":
      return (
        <svg
          width="42"
          height="78"
          viewBox="0 0 42 78"
          fill="none"
          aria-hidden="true"
          className={styles.decorSvg}
        >
          {/* Folhagem botânica em camadas */}
          <path
            d="M21 48 C19 34, 11 24, 6 18 C13 18, 19 26, 21 38 Z"
            fill="#2E4C3B"
          />
          <path
            d="M21 48 C23 33, 31 22, 37 16 C30 16, 23 25, 21 38 Z"
            fill="#3B5F4A"
          />
          <path
            d="M21 46 C20 28, 17 15, 21 5 C25 15, 23 28, 21 46 Z"
            fill="#4A745B"
          />
          <path
            d="M19 48 C14 40, 7 37, 3 34 C9 32, 15 36, 20 44 Z"
            fill="#243E2F"
          />
          <path
            d="M23 48 C28 39, 34 36, 39 33 C33 31, 27 36, 22 44 Z"
            fill="#2E4C3B"
          />
          {/* Borda e corpo do vaso em terracota fosca */}
          <rect x="8" y="47" width="26" height="5" rx="2" fill="#B56E4E" />
          <path d="M10 52 H32 L29 76 H13 L10 52 Z" fill="#9E5A3E" />
          <path
            d="M11 52 H21 L19.5 76 H13 L11 52 Z"
            fill="#C27A59"
            opacity="0.38"
          />
          <line
            x1="11"
            y1="57"
            x2="31"
            y2="57"
            stroke="#7B4028"
            strokeWidth="1"
            opacity="0.55"
          />
        </svg>
      );

    case "vela":
      return (
        <svg
          width="34"
          height="68"
          viewBox="0 0 34 68"
          fill="none"
          aria-hidden="true"
          className={styles.decorSvg}
        >
          {/* Halo quente 3000K da chama */}
          <circle cx="17" cy="18" r="14" fill="#F6C87A" opacity="0.24" />
          <circle cx="17" cy="18" r="8" fill="#FFD996" opacity="0.4" />
          {/* Chama */}
          <path
            d="M17 8 C20 14, 21 19, 17 22 C13 19, 14 14, 17 8 Z"
            fill="#F4B252"
          />
          <path
            d="M17 13 C18.6 16, 18.8 19, 17 21 C15.2 19, 15.4 16, 17 13 Z"
            fill="#FFF3D1"
          />
          {/* Pavio */}
          <rect x="16.4" y="22" width="1.2" height="5" fill="#2A1F1A" />
          {/* Cera marfim */}
          <ellipse cx="17" cy="28" rx="10" ry="2.6" fill="#EFE4D2" />
          {/* Copo de vidro âmbar */}
          <rect
            x="6"
            y="27"
            width="22"
            height="39"
            rx="3"
            fill="#5C3220"
            stroke="#8E5438"
            strokeWidth="1"
          />
          <rect
            x="8"
            y="30"
            width="5"
            height="33"
            rx="1.5"
            fill="#D49A6A"
            opacity="0.28"
          />
          {/* Rótulo editorial */}
          <rect
            x="9.5"
            y="41"
            width="15"
            height="14"
            rx="1.2"
            fill="#F4EFE6"
          />
          <line
            x1="12"
            y1="46"
            x2="22"
            y2="46"
            stroke="#3E2A22"
            strokeWidth="1"
          />
          <line
            x1="13.5"
            y1="50"
            x2="20.5"
            y2="50"
            stroke="#8B6F52"
            strokeWidth="0.9"
          />
        </svg>
      );

    case "ampulheta":
      return (
        <svg
          width="36"
          height="74"
          viewBox="0 0 36 74"
          fill="none"
          aria-hidden="true"
          className={styles.decorSvg}
        >
          {/* Base e topo em latão envelhecido */}
          <rect x="5" y="6" width="26" height="4" rx="1.5" fill="#B5915A" />
          <rect x="7" y="10" width="22" height="2" fill="#7D5F35" />
          <rect x="7" y="62" width="22" height="2" fill="#7D5F35" />
          <rect x="5" y="64" width="26" height="4" rx="1.5" fill="#B5915A" />
          {/* Hastes verticais de latão */}
          <rect x="8.5" y="12" width="1.8" height="50" fill="#9E7C48" />
          <rect x="25.7" y="12" width="1.8" height="50" fill="#9E7C48" />
          {/* Bulbos de vidro */}
          <path
            d="M11 12 H25 C25 24, 19.5 34, 18 37 C16.5 34, 11 24, 11 12 Z"
            fill="#EDE6DA"
            fillOpacity="0.28"
            stroke="#C7BAA8"
            strokeWidth="1"
          />
          <path
            d="M18 37 C19.5 40, 25 50, 25 62 H11 C11 50, 16.5 40, 18 37 Z"
            fill="#EDE6DA"
            fillOpacity="0.28"
            stroke="#C7BAA8"
            strokeWidth="1"
          />
          {/* Areia dourada */}
          <path d="M13 24 H23 C22 29, 19 34, 18 36 C17 34, 14 29, 13 24 Z" fill="#D2AE73" />
          <line
            x1="18"
            y1="37"
            x2="18"
            y2="54"
            stroke="#D2AE73"
            strokeWidth="1"
            strokeDasharray="1.5 1.5"
          />
          <path d="M12 62 C13 54, 16 51, 18 51 C20 51, 23 54, 24 62 Z" fill="#C9A262" />
        </svg>
      );

    case "bookend":
      return (
        <svg
          width="26"
          height="78"
          viewBox="0 0 26 78"
          fill="none"
          aria-hidden="true"
          className={styles.decorSvg}
        >
          {/* Base horizontal */}
          <rect x="2" y="72" width="22" height="4" rx="1" fill="#2A201B" />
          {/* Corpo vertical arquitetônico com arco latão */}
          <path
            d="M5 14 C5 9, 13 9, 13 14 V72 H5 V14 Z"
            fill="#342620"
            stroke="#1A120E"
            strokeWidth="1"
          />
          <rect x="11" y="14" width="2.2" height="58" fill="#C8A46E" />
          <circle cx="9" cy="24" r="2.2" fill="#C8A46E" opacity="0.85" />
          <path
            d="M13 48 C18 48, 22 54, 22 72 H13 V48 Z"
            fill="#4B382E"
            opacity="0.9"
          />
        </svg>
      );

    case "xicara":
      return (
        <svg
          width="40"
          height="54"
          viewBox="0 0 40 54"
          fill="none"
          aria-hidden="true"
          className={styles.decorSvg}
        >
          {/* Vapor discreto */}
          <path
            d="M14 15 C12 11, 16 9, 14 5"
            stroke="#C7B8A5"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M20 14 C18 10, 22 8, 20 4"
            stroke="#C7B8A5"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.55"
          />
          {/* Alça */}
          <path
            d="M27 25 C34 25, 34 39, 27 39"
            stroke="#E8DFD1"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Corpo da xícara de porcelana */}
          <path
            d="M8 21 H28 V36 C28 42, 23.5 46, 18 46 C12.5 46, 8 42, 8 36 V21 Z"
            fill="#EFE8DC"
            stroke="#BFAF9C"
            strokeWidth="1"
          />
          {/* Filete bordô editorial */}
          <line
            x1="9"
            y1="25"
            x2="27"
            y2="25"
            stroke="#722F3E"
            strokeWidth="1.4"
          />
          {/* Café */}
          <ellipse cx="18" cy="21" rx="9.5" ry="2.2" fill="#4E2D1D" />
          {/* Pires */}
          <ellipse cx="18" cy="48.5" rx="15" ry="3" fill="#DDD2C1" />
          <ellipse cx="18" cy="47.5" rx="12" ry="1.8" fill="#EFE8DC" />
        </svg>
      );

    case "busto":
      return (
        <svg
          width="44"
          height="84"
          viewBox="0 0 44 84"
          fill="none"
          aria-hidden="true"
          className={styles.decorSvg}
        >
          {/* Pedestal */}
          <rect x="9" y="74" width="26" height="8" rx="1.5" fill="#D5CBBF" />
          <rect x="13" y="68" width="18" height="6" fill="#E3DACF" />
          {/* Ombros / busto clássico em gesso marfim */}
          <path
            d="M7 66 C7 53, 14 48, 22 48 C30 48, 37 53, 37 66 L34 68 H10 L7 66 Z"
            fill="#EDE6DB"
            stroke="#C7BBB0"
            strokeWidth="1"
          />
          {/* Pescoço */}
          <rect x="18.5" y="38" width="7" height="11" rx="2" fill="#E4DCD0" />
          {/* Cabeça clássica estilizada */}
          <ellipse
            cx="22"
            cy="26"
            rx="9.5"
            ry="13"
            fill="#F3EDE4"
            stroke="#C9BDB0"
            strokeWidth="1"
          />
          {/* Cabelos esculpidos */}
          <path
            d="M12.5 24 C12.5 15, 18 11, 23 11 C28.5 11, 32 16, 31.5 23 C28.5 19, 25 18, 21 18 C17 18, 14.5 20, 12.5 24 Z"
            fill="#DCD2C4"
          />
          {/* Sombra escultural discreta */}
          <path
            d="M22 13 C27 13, 31 18, 31 26 C31 33, 27 38, 22 39 V13 Z"
            fill="#C7BCAE"
            opacity="0.22"
          />
        </svg>
      );

    case "espacador":
      return null;
  }
}

export function ShelfDecorObject({
  id,
  decorType,
  mode,
  onRemove,
}: ShelfDecorObjectProps) {
  const isEdit = mode === "edit";
  const label = getDecorLabel(decorType);
  const option = SHELF_DECOR_OPTIONS.find((opt) => opt.id === decorType);
  const widthPx = option?.widthPx ?? 38;

  if (decorType === "espacador") {
    return (
      <li
        data-shelf-decor="espacador"
        className={`${styles.decorSlot} ${isEdit ? styles.decorSpacerEdit : styles.decorSpacerView}`}
        style={{ width: `${widthPx}px` }}
        aria-hidden={!isEdit}
      >
        {isEdit ? (
          <>
            <span className={styles.decorSpacerLabel}>Respiro</span>
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(id)}
                aria-label="Remover espaçador"
                title="Remover espaçador"
                className={styles.decorRemoveBtn}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </>
        ) : null}
      </li>
    );
  }

  return (
    <li
      data-shelf-decor={decorType}
      className={styles.decorSlot}
      style={{ width: `${widthPx}px` }}
      title={label}
    >
      <div className={styles.decorFigure}>
        <DecorArtwork decorType={decorType} />
        <span className={styles.decorShadow} aria-hidden="true" />
      </div>

      {isEdit && onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(id)}
          aria-label={`Remover ${label}`}
          title={`Remover ${label}`}
          className={styles.decorRemoveBtn}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}

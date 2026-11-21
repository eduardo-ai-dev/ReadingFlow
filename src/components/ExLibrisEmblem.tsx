export function ExLibrisEmblem() {
  return (
    <div
      className="rf-exlibris-seal mb-4 inline-flex items-center gap-3 select-none"
      aria-hidden="true"
    >
      {/* Selo vetorial Ex-Libris com moldura dupla fina em dourado envelhecido (#C8A46E) e livro estilizado ao centro */}
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-11 w-11 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* Fundo sutil em linho quente */}
        <rect
          x="2"
          y="2"
          width="40"
          height="40"
          rx="6"
          fill="#F4EFE6"
          stroke="#C8A46E"
          strokeWidth="1.2"
        />
        {/* Segunda moldura interna fina (dupla moldura Ex-Libris) */}
        <rect
          x="5.5"
          y="5.5"
          width="33"
          height="33"
          rx="3.5"
          stroke="#C8A46E"
          strokeOpacity="0.65"
          strokeWidth="0.9"
        />
        {/* Ornamentos de canto discretos */}
        <circle cx="8.5" cy="8.5" r="1" fill="#C8A46E" fillOpacity="0.75" />
        <circle cx="35.5" cy="8.5" r="1" fill="#C8A46E" fillOpacity="0.75" />
        <circle cx="8.5" cy="35.5" r="1" fill="#C8A46E" fillOpacity="0.75" />
        <circle cx="35.5" cy="35.5" r="1" fill="#C8A46E" fillOpacity="0.75" />

        {/* Livro clássico estilizado aberto ao centro */}
        <path
          d="M22 15.5C19.5 14 16 13.8 13 14.5V28.2C16 27.5 19.5 27.7 22 29.2C24.5 27.7 28 27.5 31 28.2V14.5C28 13.8 24.5 14 22 15.5Z"
          stroke="#722F3E"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 15.5V29.2"
          stroke="#C8A46E"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Linhas sutis das páginas */}
        <path
          d="M15.5 18.2C17.3 17.9 19.1 18.1 20.2 18.7M15.5 21.5C17.3 21.2 19.1 21.4 20.2 22M28.5 18.2C26.7 17.9 24.9 18.1 23.8 18.7M28.5 21.5C26.7 21.2 24.9 21.4 23.8 22"
          stroke="#C8A46E"
          strokeWidth="0.95"
          strokeLinecap="round"
        />
      </svg>

      <div className="flex flex-col">
        <span className="font-serif text-[10px] font-semibold tracking-[0.22em] text-[#722F3E] uppercase">
          EX LIBRIS · READINGFLOW
        </span>
        <span className="mt-0.5 h-[1px] w-24 bg-gradient-to-r from-[#C8A46E] to-transparent" />
      </div>
    </div>
  );
}

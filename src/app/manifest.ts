import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReadingFlow — Biblioteca Pessoal Digital",
    short_name: "ReadingFlow",
    description:
      "Biblioteca pessoal digital elegante e privada para livros físicos, e-books e audiobooks.",
    start_url: "/",
    display: "standalone",
    background_color: "#050609",
    theme_color: "#C4A77D",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}


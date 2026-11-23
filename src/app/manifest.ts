import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReadingFlow — Biblioteca Pessoal Digital",
    short_name: "ReadingFlow",
    description:
      "Biblioteca pessoal digital elegante e privada para livros físicos, e-books e audiobooks.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4EFE6",
    theme_color: "#C8A46E",
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pwa-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

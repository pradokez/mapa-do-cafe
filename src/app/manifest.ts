import type { MetadataRoute } from "next";

// Só para o ícone ao adicionar à tela inicial do Android, não é PWA:
// sem service worker nem modo offline.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mapa do Café",
    short_name: "Mapa do Café",
    start_url: "/",
    display: "browser",
    theme_color: "#B5562F", // terracotta
    background_color: "#FAF7F2", // cream
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

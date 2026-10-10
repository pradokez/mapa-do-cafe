import type { Config } from "tailwindcss";

// Tokens da identidade — PRD v2.0 › "Identidade visual".
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        espresso: "#2C1A0E",
        cream: "#FAF7F2",
        canvas: "#E7E0D6",
        terracotta: { DEFAULT: "#B5562F", hover: "#9E4824" },
        "on-terracotta": "#FFF8F1",
        "ink-2": "#5C4636",
        "ink-3": "#7A6352",
        placeholder: "#8A7563",
        line: { DEFAULT: "#EDE4D8", strong: "#E2D7C9" },
        "chip-line": "#DDD1C2",
        "card-line": "#EFE6DA",
        "price-off": "#D8CBBB",
        "hover-soft": "#F5EEE5",
        seal: { bg: "#F6E8DF", fg: "#8F3F1F" },
        open: "#3F6B3A",
        // Erro de formulário (#83): 5,97:1 sobre branco. Os erros do admin seguem em terracota.
        erro: "#B23A1E",
        // Caixa de aviso (limite de envios das sugestões): texto 8,1:1 sobre o fundo.
        aviso: { bg: "#FBEFE8", line: "#EBC9B8", fg: "#7A3216" },
        "map-bg": "#1E1B19",
        "map-control": { DEFAULT: "#2A2623", line: "#3A3430", fg: "#E9DFD3", hover: "#34302C" },
        "map-pin": "#F1E6D8",
        "map-voce": "#4C8DF6",
        // Ponto da pílula do festival (#103), sobre `espresso`. Decorativo: o texto ao lado diz o festival.
        "festival-ponto": "#E58A5F",
        // Fundo da arte ampliada (#103): opaco no mobile, translúcido no desktop (design 4a/4c).
        lightbox: "#120B06",
      },
      fontFamily: {
        logo: ["var(--font-caprasimo)", "Georgia", "serif"],
        display: ["var(--font-caprasimo)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

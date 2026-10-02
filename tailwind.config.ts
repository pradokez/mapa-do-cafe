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
        "map-bg": "#1E1B19",
        "map-control": { DEFAULT: "#2A2623", line: "#3A3430", fg: "#E9DFD3" },
      },
      fontFamily: {
        logo: ["var(--font-caprasimo)", "Georgia", "serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

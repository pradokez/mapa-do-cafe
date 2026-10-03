import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // O tsconfig usa `jsx: "preserve"` (quem compila é o Next); no teste, o esbuild transforma.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // Mesmo fuso da Vercel: código dependente de data não pode passar só por
    // rodar numa máquina em UTC−3.
    env: { TZ: "UTC" },
    // Componente (`.test.tsx`) declara `// @vitest-environment jsdom` no topo.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});

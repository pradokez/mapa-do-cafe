import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Mesmo fuso da Vercel: código dependente de data não pode passar só por
    // rodar numa máquina em UTC−3.
    env: { TZ: "UTC" },
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});

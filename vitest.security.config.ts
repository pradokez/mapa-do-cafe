import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Suíte de exploit (#59), separada do `pnpm test`: fala com um Supabase real
 * (o projeto descartável), então não roda no CI nem offline. Rode com
 * `pnpm test:security`, com um `.env.security` na raiz (gitignored). Sem as
 * envs, cada teste pula sozinho. Ver docs/security/pentest-2026-10.md.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["./security/setup.ts"],
    include: ["security/**/*.test.ts"],
    // Escrita/remoção tocam linhas compartilhadas: um arquivo por vez evita corrida.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

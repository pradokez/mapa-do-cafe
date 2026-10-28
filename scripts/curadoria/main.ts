/**
 * Robô de curadoria semanal (#185, PRD #167): pesquisa e propõe, nunca publica.
 * Roda no GitHub Actions (`.github/workflows/curadoria.yml`); localmente só com
 * as cinco envs de `.env.example` exportadas. Falha de contexto ou de registro
 * sai com código 1 (o GitHub avisa por email).
 *
 * Uso: pnpm curadoria
 */
import { fileURLToPath } from "node:url";

import { criarGemini, MODELO_PADRAO } from "./gemini";
import { PAUSA_ENTRE_CHAMADAS_MS, rodarRodada } from "./robo";
import { criarRpc } from "./rpc";
import { criarTavily } from "./tavily";

const ENVS = ["CURADORIA_SUPABASE_URL", "CURADORIA_SUPABASE_KEY", "CURADORIA_SEGREDO", "TAVILY_API_KEY", "GEMINI_API_KEY"] as const;

async function main() {
  const faltando = ENVS.filter((nome) => !process.env[nome]);
  if (faltando.length > 0) throw new Error(`Faltam as envs: ${faltando.join(", ")}.`);
  const env = (nome: (typeof ENVS)[number]) => process.env[nome] as string;

  const rpc = criarRpc(env("CURADORIA_SUPABASE_URL"), env("CURADORIA_SUPABASE_KEY"), env("CURADORIA_SEGREDO"));
  await rodarRodada({
    ...rpc,
    tavily: criarTavily(env("TAVILY_API_KEY")),
    gemini: criarGemini(env("GEMINI_API_KEY"), process.env.GEMINI_MODEL || MODELO_PADRAO),
    agora: new Date(),
    pausa: () => new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_CHAMADAS_MS)),
    log: (mensagem) => console.log(`[curadoria] ${mensagem}`),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((erro: unknown) => {
    // Só a mensagem própria (códigos e nomes de env): nunca o objeto inteiro, que pode carregar resposta de terceiros.
    console.error(`[curadoria] rodada falhou: ${erro instanceof Error ? erro.message : "erro desconhecido"}`);
    process.exit(1);
  });
}

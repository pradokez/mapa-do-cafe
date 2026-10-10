import { cache } from "react";

import { listCafesAtivos, listFestivais } from "@/lib/cafe-repository";
import { combosDaEdicao, edicaoDaPagina } from "@/lib/festival";

/**
 * A edição da página com os combos, ou `null` (→ 404). Uma vez por request,
 * dividida entre o metadata e a página — com o mesmo "agora", para os dois
 * nunca discordarem do dia. As duas leituras vêm do cache; o estado da edição
 * se decide aqui, fora dele.
 */
export const getEdicao = cache(async (festival: string, ano: string) => {
  const agora = new Date();
  const [edicoes, cafes] = await Promise.all([listFestivais(), listCafesAtivos()]);
  const pagina = edicaoDaPagina(edicoes, festival, ano, agora);
  if (!pagina) return null;
  const combos = combosDaEdicao(pagina.edicao, cafes);
  // Os dois caches viram em horas diferentes: participante de café recém-saído
  // do ar ainda pode vir na edição. Sem nenhum combo à mostra, também é 404.
  if (combos.length === 0) return null;
  return { ...pagina, combos, agora };
});

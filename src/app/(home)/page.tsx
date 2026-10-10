import type { Metadata } from "next";

import { CafeDirectory } from "@/components/cafe-directory";
import { listCafesAtivos, listFestivais } from "@/lib/cafe-repository";
import { edicoesEmVitrine, participantesNoAr } from "@/lib/festival";

// Dinâmica: o HTML já sai filtrado pelos params da URL (`?pets=true`), sem
// piscar a lista completa até a hidratação. Cafés e festivais vêm do cache de
// 1 h do `cafe-repository`, então isso não custa uma query por visita; o que
// está no ar hoje se decide aqui, fora do cache.
export const dynamic = "force-dynamic";

// Sem os params: cada combinação de filtro é a mesma página para o buscador.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const [cafes, edicoes] = await Promise.all([listCafesAtivos(), listFestivais()]);
  const agora = new Date();
  const festivais = participantesNoAr(edicoes, agora);
  const vitrines = { edicoes: edicoesEmVitrine(edicoes, agora), agora };

  return (
    <div className="flex h-dvh flex-col">
      <CafeDirectory cafes={cafes} festivais={festivais} vitrines={vitrines} />
    </div>
  );
}

import type { Metadata } from "next";

import { CafeDirectory } from "@/components/cafe-directory";
import { listCafesAtivos } from "@/lib/cafe-repository";

// Dinâmica: o HTML já sai filtrado pelos params da URL (`?pets=true`), sem
// piscar a lista completa até a hidratação. Os cafés vêm do cache de 1 h do
// `cafe-repository`, então isso não custa uma query por visita.
export const dynamic = "force-dynamic";

// Sem os params: cada combinação de filtro é a mesma página para o buscador.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const cafes = await listCafesAtivos();

  return (
    <div className="flex h-dvh flex-col">
      <CafeDirectory cafes={cafes} />
    </div>
  );
}

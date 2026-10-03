import { CafeDirectory } from "@/components/cafe-directory";
import { SiteHeader } from "@/components/site-header";
import { listCafesAtivos } from "@/lib/cafe-repository";

// Dinâmica: o HTML já sai filtrado pelos params da URL (`?pets=true`), sem
// piscar a lista completa até a hidratação. Os cafés vêm do cache de 1 h do
// `cafe-repository`, então isso não custa uma query por visita.
export const dynamic = "force-dynamic";

export default async function Home() {
  const cafes = await listCafesAtivos();

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <SiteHeader />
      <CafeDirectory cafes={cafes} />
    </div>
  );
}

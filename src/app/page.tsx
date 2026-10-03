import { CafeList } from "@/components/cafe-list";
import { HomeMap } from "@/components/home-map";
import { SiteHeader } from "@/components/site-header";
import { listCafesAtivos } from "@/lib/cafe-repository";

// ISR: o seed só muda com deploy, que já invalida o cache.
export const revalidate = 3600;

export default async function Home() {
  const cafes = await listCafesAtivos();

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <SiteHeader />
      <main className="grid min-h-0 flex-1 lg:grid-cols-[45%_55%]">
        <div className="lg:overflow-y-auto">
          <h1 className="sr-only">Cafés especiais em Recife e Olinda</h1>
          <CafeList cafes={cafes} />
        </div>
        {/* Fixo: só a coluna da lista rola. */}
        <div className="hidden bg-map-bg lg:block">
          <HomeMap cafes={cafes} />
        </div>
      </main>
    </div>
  );
}

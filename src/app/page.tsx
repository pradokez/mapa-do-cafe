import { CafeList } from "@/components/cafe-list";
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
          <CafeList cafes={cafes} />
        </div>
        {/* Espaço reservado para o <CafeMap /> (#6). */}
        <div aria-hidden="true" className="hidden bg-map-bg lg:block" />
      </main>
    </div>
  );
}

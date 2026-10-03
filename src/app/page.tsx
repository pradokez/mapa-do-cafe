import { CafeDirectory } from "@/components/cafe-directory";
import { SiteHeader } from "@/components/site-header";
import { listCafesAtivos } from "@/lib/cafe-repository";

// ISR: o seed só muda com deploy, que já invalida o cache.
export const revalidate = 3600;

export default async function Home() {
  const cafes = await listCafesAtivos();

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <SiteHeader />
      <CafeDirectory cafes={cafes} />
    </div>
  );
}

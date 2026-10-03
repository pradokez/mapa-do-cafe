import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";

// Slug inexistente, café inativo ou qualquer URL errada.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <h1 className="text-balance font-display text-[32px] font-bold leading-[1.1] text-espresso">
          Esse café não está no mapa
        </h1>
        <p className="max-w-[380px] text-pretty text-[15px] leading-[1.55] text-ink-2">
          Talvez o endereço esteja errado ou o café tenha saído do diretório.
        </p>
        <Link
          href="/"
          className="mt-3 inline-flex h-[46px] items-center gap-2 rounded-full bg-terracotta px-6 text-[14.5px] font-semibold text-on-terracotta transition-colors hover:bg-terracotta-hover"
        >
          <ArrowLeftIcon size={15} strokeWidth={2} />
          Voltar ao mapa
        </Link>
      </main>
    </div>
  );
}

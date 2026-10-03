import Link from "next/link";

import { Logo } from "@/components/logo";

/** Grid 1fr / auto / 1fr: `children` vai na coluna central (a busca, na home). */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="grid h-[72px] flex-none grid-cols-[1fr_auto_1fr] items-center border-b border-line px-7">
      <Link href="/" aria-label="Mapa do Café (Recife!) — início" className="justify-self-start">
        <Logo />
      </Link>
      {children}
    </header>
  );
}

import Link from "next/link";

import { Logo } from "@/components/logo";

type Props = {
  /** Centro do header no desktop; no mobile, linha de baixo em largura total (a busca, na home). */
  children?: React.ReactNode;
  /** Ações do header mobile, à direita do logo (o botão de filtros, na home). Somem a partir de `lg`. */
  actions?: React.ReactNode;
  /** Coluna da direita no desktop (o "Me paga um café?", na home). Some abaixo de `lg`. */
  extra?: React.ReactNode;
};

/**
 * Desktop: grid 1fr / auto / 1fr de 72 px. Na home, abaixo de `lg`, vira o
 * header mobile do design — logo e ações numa linha, a busca embaixo.
 */
export function SiteHeader({ children, actions, extra }: Props) {
  const logo = (
    <Link href="/" aria-label="Mapa do Café (Recife!) — início" className="justify-self-start">
      <Logo />
    </Link>
  );

  if (!children && !actions) {
    return (
      <header className="grid h-[72px] flex-none grid-cols-[1fr_auto_1fr] items-center border-b border-line px-7">
        {logo}
      </header>
    );
  }

  return (
    <header className="grid flex-none grid-cols-[1fr_auto] items-center gap-3 px-[18px] pb-2.5 pt-[22px] lg:h-[72px] lg:grid-cols-[1fr_auto_1fr] lg:gap-0 lg:border-b lg:border-line lg:px-7 lg:py-0">
      {logo}
      {actions && <div className="flex items-center gap-2 justify-self-end lg:hidden">{actions}</div>}
      {children && <div className="col-span-2 lg:col-span-1">{children}</div>}
      {extra && <div className="hidden items-center justify-self-end lg:flex">{extra}</div>}
    </header>
  );
}

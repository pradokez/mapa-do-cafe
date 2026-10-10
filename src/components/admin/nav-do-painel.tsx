"use client";

// Client: a seção atual vem do caminho (`usePathname`), e o header é do layout, que não sabe a página.
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECOES = [
  { href: "/admin", rotulo: "Cafés", atual: (caminho: string) => caminho === "/admin" || caminho.startsWith("/admin/cafes") },
  { href: "/admin/festivais", rotulo: "Festivais", atual: (caminho: string) => caminho.startsWith("/admin/festivais") },
];

/** Seções do painel (#102). A atual leva `aria-current="page"` e o sublinhado terracota. */
export function NavDoPainel() {
  const caminho = usePathname();

  return (
    <nav aria-label="Seções do painel">
      <ul className="flex items-center sm:gap-1">
        {SECOES.map(({ href, rotulo, atual }) => {
          const aqui = atual(caminho);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={aqui ? "page" : undefined}
                className="relative flex h-9 items-center rounded-full px-2 text-[14px] sm:px-3 font-semibold text-ink-2 transition-colors hover:bg-hover-soft hover:text-espresso aria-[current=page]:text-espresso aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 sm:aria-[current=page]:after:inset-x-3 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-terracotta"
              >
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

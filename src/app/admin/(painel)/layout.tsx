import Link from "next/link";

import { Logo } from "@/components/logo";
import { sair } from "@/lib/admin/auth-actions";
import { requireAdmin } from "@/lib/admin/require-admin";

// Toda página do painel depende da sessão: nada aqui é pré-renderizado.
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();

  return (
    <div className="min-h-dvh">
      <header className="flex h-[72px] items-center justify-between gap-4 border-b border-line px-4 sm:px-7">
        <Link href="/admin" aria-label="Mapa do Café (Recife!) — admin, início" className="flex items-end gap-5">
          <Logo />
          <span className="hidden pb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3 sm:inline">
            Admin
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-[13.5px] text-ink-3 md:inline">{email}</span>
          <form action={sair}>
            <button
              type="submit"
              className="h-9 rounded-full border border-line-strong px-4 text-[13.5px] font-semibold text-espresso transition-colors hover:bg-hover-soft"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-7">{children}</main>
    </div>
  );
}

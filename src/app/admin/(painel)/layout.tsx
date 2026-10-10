import Link from "next/link";

import { NavDoPainel } from "@/components/admin/nav-do-painel";
import { Logo } from "@/components/logo";
import { escritaDoAdmin } from "@/lib/admin-escrita";
import { sair } from "@/lib/admin/auth-actions";
import { requireAdmin } from "@/lib/admin/require-admin";

// Toda página do painel depende da sessão: nada aqui é pré-renderizado.
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();
  const escrita = escritaDoAdmin();

  return (
    <div className="min-h-dvh">
      {!escrita.liberada && (
        // No topo, antes de tudo: o aviso aparece antes de alguém preencher um formulário à toa (#75).
        <p
          role="note"
          className="bg-seal-bg px-4 py-2 text-center text-[13.5px] font-medium text-seal-fg sm:px-7"
        >
          {escrita.motivo}
        </p>
      )}
      <header className="flex h-[72px] items-center justify-between gap-4 border-b border-line px-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/admin" aria-label="Mapa do Café (Recife!) — admin, início" className="flex shrink-0 items-end gap-5">
            <Logo />
            <span className="hidden pb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3 lg:inline">
              Admin
            </span>
          </Link>
          <NavDoPainel />
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-[13.5px] text-ink-3 lg:inline">{email}</span>
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

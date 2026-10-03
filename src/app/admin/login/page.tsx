import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { destinoSeguro } from "@/lib/admin-auth";
import { etapaDaSessao } from "@/lib/admin/require-admin";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

// Depende do cookie da sessão a cada visita.
export const dynamic = "force-dynamic";

type Props = { searchParams: { next?: string | string[] } };

/** Uma tela, três etapas decididas no servidor: senha → código (ou cadastro do autenticador). */
export default async function LoginPage({ searchParams }: Props) {
  const next = destinoSeguro(searchParams.next);
  const etapa = await etapaDaSessao();
  if (etapa === "pronto") redirect(next);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px] rounded-2xl border border-card-line bg-cream px-6 py-8 shadow-[0_1px_2px_rgba(44,26,14,0.06)] sm:px-8">
        <div className="mb-7 flex items-end justify-between gap-3">
          <Logo />
          <span className="pb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            Admin
          </span>
        </div>
        <LoginForm etapa={etapa} next={next} />
      </div>
    </main>
  );
}

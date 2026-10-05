import Link from "next/link";

import { botaoCtaClass } from "@/components/admin/form";
import { ListaDeCafes } from "@/components/admin/lista-de-cafes";
import { PlusIcon } from "@/components/icons";
import { listTodosCafes } from "@/lib/cafe-repository";
import { requireAdmin } from "@/lib/admin/require-admin";

type Props = { searchParams: { q?: string | string[] } };

// O Next renderiza layout e página em paralelo: a página confere o admin por conta própria.
export default async function AdminHome({ searchParams }: Props) {
  await requireAdmin();
  const cafes = await listTodosCafes();
  const noAr = cafes.filter((cafe) => cafe.ativo).length;
  const q = [searchParams.q].flat()[0] ?? "";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-[1.1] text-espresso">Cafés</h1>
          <p className="mt-1.5 text-[14px] text-ink-3">
            {cafes.length === 1 ? "1 café" : `${cafes.length} cafés`} · {noAr} no ar ·{" "}
            {cafes.length - noAr} fora do ar
          </p>
        </div>
        <Link href="/admin/cafes/novo" className={`${botaoCtaClass} inline-flex items-center gap-1.5`}>
          <PlusIcon size={16} strokeWidth={2.2} />
          Cadastrar café
        </Link>
      </div>

      <ListaDeCafes cafes={cafes} q={q} />
    </>
  );
}

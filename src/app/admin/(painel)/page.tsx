import Link from "next/link";

import { StatusCafe, VerNoSite } from "@/components/admin/status-cafe";
import { listTodosCafes } from "@/lib/cafe-repository";
import { requireAdmin } from "@/lib/admin/require-admin";

// O Next renderiza layout e página em paralelo: a página confere o admin por conta própria.
export default async function AdminHome() {
  await requireAdmin();
  const cafes = await listTodosCafes();
  const noAr = cafes.filter((cafe) => cafe.ativo).length;

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-[30px] leading-[1.1] text-espresso">Cafés</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">
          {cafes.length === 1 ? "1 café" : `${cafes.length} cafés`} · {noAr} no ar ·{" "}
          {cafes.length - noAr} fora do ar
        </p>
      </div>

      {/* Desktop: tabela. */}
      <table className="hidden w-full border-collapse text-left text-[14px] md:table">
        <thead>
          <tr className="border-b border-line-strong text-[12px] uppercase tracking-[0.06em] text-ink-3">
            <th scope="col" className="py-2.5 pr-4 font-semibold">Nome</th>
            <th scope="col" className="py-2.5 pr-4 font-semibold">Bairro</th>
            <th scope="col" className="py-2.5 pr-4 font-semibold">Cidade</th>
            <th scope="col" className="py-2.5 pr-4 font-semibold">Status</th>
            <th scope="col" className="py-2.5 pr-4 text-right font-semibold">Fotos</th>
            <th scope="col" className="py-2.5 font-semibold"><span className="sr-only">Site</span></th>
          </tr>
        </thead>
        <tbody>
          {cafes.map((cafe) => (
            <tr key={cafe.id} className="border-b border-line">
              <td className="py-3 pr-4">
                <Link href={`/admin/cafes/${cafe.id}`} className="font-semibold text-espresso hover:text-terracotta hover:underline">
                  {cafe.nome}
                </Link>
              </td>
              <td className="py-3 pr-4 text-ink-2">{cafe.bairro}</td>
              <td className="py-3 pr-4 text-ink-2">{cafe.cidade}</td>
              <td className="py-3 pr-4"><StatusCafe ativo={cafe.ativo} /></td>
              <td className="py-3 pr-4 text-right tabular-nums text-ink-2">{cafe.fotos.length}</td>
              <td className="py-3 text-right"><VerNoSite slug={cafe.slug} ativo={cafe.ativo} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: um card por café. */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {cafes.map((cafe) => (
          <li key={cafe.id} className="rounded-xl border border-card-line bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/admin/cafes/${cafe.id}`} className="font-semibold text-espresso hover:text-terracotta hover:underline">
                {cafe.nome}
              </Link>
              <StatusCafe ativo={cafe.ativo} />
            </div>
            <p className="mt-1 text-[13.5px] text-ink-2">
              {cafe.bairro}, {cafe.cidade} · {cafe.fotos.length === 1 ? "1 foto" : `${cafe.fotos.length} fotos`}
            </p>
            <div className="mt-2">
              <VerNoSite slug={cafe.slug} ativo={cafe.ativo} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

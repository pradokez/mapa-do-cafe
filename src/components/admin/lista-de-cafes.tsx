import Link from "next/link";

import { botaoNeutroClass, inputClass } from "@/components/admin/form";
import { StatusCafe, VerNoSite } from "@/components/admin/status-cafe";
import type { Cafe } from "@/lib/cafe";
import { FILTROS_VAZIOS, filtrarCafes } from "@/lib/cafe-filter";

const limparClass = "font-semibold text-terracotta hover:underline";

/**
 * Lista do admin com a busca do site (nome ou bairro, sem caixa nem acento).
 * Filtra ao enviar: `?q=` na URL, sem JavaScript — recarregar e voltar mantêm a busca.
 */
export function ListaDeCafes({ cafes, q }: { cafes: Cafe[]; q: string }) {
  const buscando = q.trim() !== "";
  const visiveis = buscando ? filtrarCafes(cafes, { ...FILTROS_VAZIOS, q }) : cafes;

  return (
    <>
      <form method="get" action="/admin" role="search" className="mb-4 flex gap-2">
        <label htmlFor="busca" className="sr-only">
          Buscar café
        </label>
        <input
          id="busca"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Nome ou bairro"
          className={`${inputClass} max-w-[440px]`}
        />
        <button type="submit" className={`${botaoNeutroClass} shrink-0`}>
          Buscar
        </button>
      </form>

      {buscando && visiveis.length > 0 && (
        <p className="mb-3 text-[14px] text-ink-3">
          <span>{`${visiveis.length} de ${cafes.length === 1 ? "1 café" : `${cafes.length} cafés`}`}</span> ·{" "}
          <Link href="/admin" className={limparClass}>
            Limpar busca
          </Link>
        </p>
      )}

      {visiveis.length === 0 ? (
        <p className="py-6 text-[14.5px] text-ink-2">
          Nenhum café com “{q.trim()}”.{" "}
          <Link href="/admin" className={limparClass}>
            Limpar busca
          </Link>
        </p>
      ) : (
        <>
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
              {visiveis.map((cafe) => (
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
            {visiveis.map((cafe) => (
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
      )}
    </>
  );
}

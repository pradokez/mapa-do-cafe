import type { Metadata } from "next";
import Link from "next/link";

import { botaoCtaClass } from "@/components/admin/form";
import { StatusEdicao } from "@/components/admin/status-edicao";
import { PlusIcon } from "@/components/icons";
import { listEdicoes, listFestivaisCadastrados } from "@/lib/cafe-repository";
import { formatarPreco, periodoDaEdicao } from "@/lib/festival";
import { pendencias, statusNoAdmin } from "@/lib/festival-dados";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = { title: "Festivais" };

// O Next renderiza layout e página em paralelo: a página confere o admin por conta própria.
export default async function AdminFestivais() {
  await requireAdmin();
  const [festivais, edicoes] = await Promise.all([listFestivaisCadastrados(), listEdicoes()]);
  // Status no dia de Recife, a cada visita (a página é dinâmica, pelo layout).
  const agora = new Date();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-[1.1] text-espresso">Festivais</h1>
          <p className="mt-1.5 text-[14px] text-ink-3">
            Publicada, a edição já aparece no site; os combos esperam o início, e tudo sai sozinho depois do último dia.
          </p>
        </div>
        <Link href="/admin/festivais/nova" className={`${botaoCtaClass} inline-flex items-center gap-1.5`}>
          <PlusIcon size={16} strokeWidth={2.2} />
          Cadastrar edição
        </Link>
      </div>

      <div className="flex flex-col gap-8">
        {festivais.map((festival) => {
          const doFestival = edicoes.filter((e) => e.festival.slug === festival.slug);
          return (
            <section key={festival.slug} aria-labelledby={`festival-${festival.slug}`}>
              <h2 id={`festival-${festival.slug}`} className="mb-3 font-display text-[22px] text-espresso">
                {festival.nome}
              </h2>
              {doFestival.length === 0 ? (
                <p className="text-[14.5px] text-ink-2">Nenhuma edição cadastrada.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {doFestival.map((edicao) => {
                    const { semNumero, semArte } = pendencias(edicao.participacoes);
                    const n = edicao.participacoes.length;
                    return (
                      <li key={edicao.id} className="rounded-xl border border-card-line bg-white px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                          <Link
                            href={`/admin/festivais/${edicao.id}`}
                            className="text-[16px] font-semibold text-espresso hover:text-terracotta hover:underline"
                          >
                            {festival.nome} {edicao.ano}
                          </Link>
                          <StatusEdicao {...statusNoAdmin(edicao, agora)} />
                        </div>
                        <p className="mt-1 text-[13.5px] text-ink-2">
                          {periodoDaEdicao(edicao)} ·{" "}
                          {edicao.preco === null ? <span className="text-terracotta">sem preço</span> : formatarPreco(edicao.preco)}
                        </p>
                        <p className="mt-0.5 text-[13.5px] text-ink-3">
                          {n === 1 ? "1 participante" : `${n} participantes`}
                          {semNumero > 0 && <span className="text-terracotta"> · {semNumero} sem número</span>}
                          {semArte > 0 && <span className="text-terracotta"> · {semArte} sem arte</span>}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

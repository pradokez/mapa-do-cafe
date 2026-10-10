"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { CafePhotoFrame } from "@/components/cafe-photo-frame";
import { FestivalArteAmpliada, useBotoesDosCombos } from "@/components/festival-arte-ampliada";
import { fonteDaArte, resumoDaVitrine, urlDaEdicao, type Combo, type Edicao } from "@/lib/festival";

/** Artes à vista ao abrir a home (150 px cada): carregam já; as outras, ao rolar. */
const ARTES_A_VISTA = 4;

type Props = {
  edicao: Edicao;
  combos: Combo[];
  /** O "agora" do servidor: o prazo não depende do relógio de quem visita. */
  agora: Date;
};

/**
 * Vitrine do festival no topo da lista da home (design 4b): faixa `espresso`
 * que vaza até a borda direita da coluna, com "Ver todos" para a página da
 * edição e uma fileira de artes com scroll lateral. Tocar numa arte abre a
 * mesma arte ampliada da página do festival; ao fechar, o foco vai à arte do
 * combo à vista.
 */
export function FestivalVitrine({ edicao, combos, agora }: Props) {
  const titulo = useId();
  const { nome } = edicao.festival;
  const [aberto, setAberto] = useState<number | null>(null);
  const botoes = useBotoesDosCombos(combos);

  return (
    <section
      aria-labelledby={titulo}
      className="-mr-4 mb-4 flex flex-col gap-3 rounded-l-2xl bg-espresso pb-[18px] pl-[18px] pt-4 text-cream lg:-mr-7 lg:mb-5"
    >
      <div className="flex items-end justify-between gap-3 pr-4 lg:pr-7">
        <div className="flex flex-col gap-[3px]">
          <h2 id={titulo} className="font-display text-[21px] leading-[1.15]">
            Combos do {nome}
          </h2>
          <p className="text-[13px] text-sobre-espresso-2">{resumoDaVitrine(edicao, combos.length, agora)}</p>
        </div>
        <Link
          href={urlDaEdicao(edicao)}
          className="flex-none text-[13px] font-semibold underline underline-offset-[3px] focus-visible:outline-cream"
        >
          Ver todos
        </Link>
      </div>
      {/* p/-m: o anel de foco das artes (4 px para fora) não sai cortado pelo scroll. */}
      <ul className="-my-1 -ml-1 flex scroll-px-1 gap-3 overflow-x-auto py-1 pl-1 pr-4 [scrollbar-width:none] lg:pr-7 [&::-webkit-scrollbar]:hidden">
        {combos.map((combo, k) => (
          <li key={combo.participacao.id} className="flex-none">
            <button
              type="button"
              ref={botoes.ref(combo)}
              onClick={() => setAberto(k)}
              className="flex w-[150px] flex-col gap-2 rounded-[10px] text-left transition-opacity hover:opacity-90 focus-visible:outline-cream lg:cursor-zoom-in"
            >
              <CafePhotoFrame
                photo={fonteDaArte(combo)}
                alt={combo.participacao.alt ?? ""}
                carregamento={k < ARTES_A_VISTA ? "eager" : "lazy"}
                className="aspect-[4/5] w-full rounded-[10px]"
              />
              <span className="text-[13.5px] font-semibold leading-[1.25]">{combo.cafe.nome}</span>
            </button>
          </li>
        ))}
      </ul>

      <FestivalArteAmpliada
        combos={combos}
        indice={aberto}
        onIndice={setAberto}
        onFechado={botoes.focar}
        festival={nome}
        ano={edicao.ano}
        encerrada={false}
      />
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { CafePhotoFrame } from "@/components/cafe-photo-frame";
import { FestivalArteAmpliada, useBotoesDosCombos } from "@/components/festival-arte-ampliada";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { fonteDaArte, resumoDaVitrine, urlDaEdicao, type Combo, type Edicao } from "@/lib/festival";

/** Artes à vista ao abrir a home (150 px cada): carregam já; as outras, ao rolar. */
const ARTES_A_VISTA = 4;

/** Respiro do card: o mesmo nas laterais da fileira, para as artes rolarem até a borda. */
const RESPIRO = 18;

const SETA =
  "flex size-8 items-center justify-center rounded-full bg-cream/[.14] text-cream transition-colors hover:bg-cream/[.24] focus-visible:outline-cream aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:bg-cream/[.14]";

type Props = {
  edicao: Edicao;
  combos: Combo[];
  /** O "agora" do servidor: o prazo não depende do relógio de quem visita. */
  agora: Date;
};

/**
 * Vitrine do festival no topo da lista da home (design 4b): card `espresso`
 * com "Ver todos" para a página da edição e uma fileira de artes com scroll
 * lateral. Desvios do design: é um card fechado (a faixa vazada encostava no
 * mapa) e, no desktop, tem setas que passam ao próximo conjunto — sem elas, a
 * roda do mouse não rola a fileira. Tocar numa arte abre a mesma arte
 * ampliada da página do festival; ao fechar, o foco vai à arte do combo à vista.
 */
export function FestivalVitrine({ edicao, combos, agora }: Props) {
  const titulo = useId();
  const { nome } = edicao.festival;
  const [aberto, setAberto] = useState<number | null>(null);
  const botoes = useBotoesDosCombos(combos);
  const fileira = useRef<HTMLUListElement>(null);
  const [pontas, setPontas] = useState({ inicio: true, fim: false });

  // Onde a fileira está: a seta da ponta alcançada se apaga.
  const medir = () => {
    const el = fileira.current;
    if (!el) return;
    setPontas({
      inicio: el.scrollLeft <= 1,
      fim: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  };
  // Medida inicial e a cada mudança de largura (a coluna da lista muda com a janela).
  useEffect(() => {
    medir();
    const el = fileira.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // O conjunto à vista, menos o respiro; o snap encaixa a primeira arte.
  const passar = (sentido: 1 | -1) => {
    const el = fileira.current;
    if (!el || (sentido === 1 ? pontas.fim : pontas.inicio)) return;
    el.scrollBy({ left: sentido * (el.clientWidth - 2 * RESPIRO) });
  };

  return (
    <section
      aria-labelledby={titulo}
      className="mb-4 flex flex-col gap-3 overflow-hidden rounded-2xl bg-espresso px-[18px] pb-[18px] pt-4 text-cream lg:mb-5"
    >
      {/* O resumo fica embaixo, com a largura toda: na mesma linha do "Ver todos", quebraria no mobile. */}
      <div className="flex flex-col gap-[3px]">
        <div className="flex items-center gap-3">
          <h2 id={titulo} className="min-w-0 flex-1 font-display text-[19px] leading-[1.15] lg:text-[21px]">
            Combos do {nome}
          </h2>
          <Link
            href={urlDaEdicao(edicao)}
            className="flex-none text-[13px] font-semibold underline underline-offset-[3px] focus-visible:outline-cream"
          >
            Ver todos
          </Link>
          {/* aria-disabled, não disabled: a seta que chega na ponta não perde o foco. */}
          <div className="hidden flex-none gap-1.5 lg:flex">
            <button
              type="button"
              aria-label="Combos anteriores"
              aria-disabled={pontas.inicio}
              onClick={() => passar(-1)}
              className={SETA}
            >
              <ChevronLeftIcon size={16} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-label="Próximos combos"
              aria-disabled={pontas.fim}
              onClick={() => passar(1)}
              className={SETA}
            >
              <ChevronRightIcon size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>
        <p className="text-[13px] text-sobre-espresso-2">{resumoDaVitrine(edicao, combos.length, agora)}</p>
      </div>
      {/* -mx/px: as artes rolam até a borda do card e param no respiro dele;
          py/-my: o anel de foco (4 px para fora) não sai cortado pelo scroll. */}
      <ul
        ref={fileira}
        onScroll={medir}
        className="-mx-[18px] -my-1 flex snap-x snap-mandatory scroll-px-[18px] gap-3 overflow-x-auto px-[18px] py-1 [scrollbar-width:none] motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        {combos.map((combo, k) => (
          <li key={combo.participacao.id} className="flex-none snap-start">
            <button
              type="button"
              ref={botoes.ref(combo)}
              onClick={() => setAberto(k)}
              className="flex w-[150px] flex-col gap-2 rounded-[10px] text-left transition-opacity hover:opacity-90 focus-visible:outline-cream lg:cursor-zoom-in"
            >
              <CafePhotoFrame
                photo={fonteDaArte(combo, { tom: "escuro" })}
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

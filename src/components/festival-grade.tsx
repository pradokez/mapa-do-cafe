"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { CafePhotoFrame } from "@/components/cafe-photo-frame";
import { FestivalArteAmpliada, useBotoesDosCombos } from "@/components/festival-arte-ampliada";
import {
  bairroDoParam,
  bairrosDosCombos,
  fonteDaArte,
  rotuloDeCombos,
  type Combo,
} from "@/lib/festival";

const CHIP =
  "inline-flex h-9 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors lg:h-[38px] lg:px-[15px] lg:text-[13.5px]";
const CHIP_LIGADO = "border-espresso bg-espresso text-cream";
const CHIP_DESLIGADO = "border-line-strong bg-white text-espresso hover:bg-hover-soft";

type Props = {
  combos: Combo[];
  festival: string;
  ano: number;
  encerrada: boolean;
};

/**
 * Grade de artes da página do festival, com o filtro de bairro (escolha única,
 * `?bairro=`) e a arte ampliada. Como na home, a URL é a única fonte do filtro:
 * o servidor já manda o HTML filtrado, e o clique troca a grade com
 * `history.pushState`, sem ida ao servidor. Cada chip é um link de verdade —
 * sem JavaScript, o filtro funciona pela navegação.
 */
export function FestivalGrade({ combos, festival, ano, encerrada }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bairros = useMemo(() => bairrosDosCombos(combos), [combos]);
  const bairro = bairroDoParam(searchParams.get("bairro"), bairros);
  const visiveis = bairro ? combos.filter(({ cafe }) => cafe.bairro_slug === bairro) : combos;
  const botoes = useBotoesDosCombos(visiveis);

  const [aberto, setAberto] = useState<number | null>(null);

  const hrefDo = (slug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("bairro", slug);
    else params.delete("bairro");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const chip = (slug: string | null, rotulo: string) => {
    const ligado = bairro === slug;
    return (
      <li key={slug ?? ""} className="flex-none">
        <a
          href={hrefDo(slug)}
          aria-current={ligado ? "true" : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            if (!ligado) window.history.pushState(null, "", hrefDo(slug));
          }}
          className={`${CHIP} ${ligado ? CHIP_LIGADO : CHIP_DESLIGADO}`}
        >
          {rotulo}
        </a>
      </li>
    );
  };

  return (
    <>
      <div className="lg:flex lg:items-center lg:justify-between lg:gap-5">
        <nav aria-label="Filtrar por bairro" className="-mx-4 lg:mx-0">
          <ul className="flex gap-[7px] overflow-x-auto px-4 py-1 [scrollbar-width:none] lg:flex-wrap lg:gap-2 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {chip(null, "Todos")}
            {bairros.map(({ slug, nome }) => chip(slug, nome))}
          </ul>
        </nav>
        {/* Só no desktop, como no design (5b não tem contador). */}
        <p role="status" className="hidden flex-none text-[13px] text-ink-3 lg:block">
          {rotuloDeCombos(visiveis.length)}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-[18px] sm:grid-cols-3 md:grid-cols-4 lg:gap-x-[18px] lg:gap-y-6 xl:grid-cols-5">
        {visiveis.map((combo, k) => (
          <li key={combo.participacao.id}>
            <button
              type="button"
              ref={botoes.ref(combo)}
              onClick={() => setAberto(k)}
              className="flex w-full flex-col gap-2 rounded-xl text-left text-espresso transition-opacity hover:opacity-90 lg:cursor-zoom-in lg:gap-2.5"
            >
              <CafePhotoFrame
                photo={fonteDaArte(combo)}
                alt={combo.participacao.alt ?? ""}
                // As primeiras artes estão à vista ao abrir a página.
                carregamento={k < 5 ? "priority" : "lazy"}
                className={`aspect-[4/5] w-full rounded-[10px] shadow-[0_1px_2px_rgba(44,26,14,.08)] lg:rounded-xl ${encerrada ? "grayscale-[.6]" : ""}`}
              />
              <span className="flex flex-col gap-px px-0.5 lg:gap-0.5">
                <span className="font-display text-[15px] leading-[1.2] lg:text-[17px]">{combo.cafe.nome}</span>
                <span className="text-[12.5px] text-ink-3 lg:text-[13px]">{combo.cafe.bairro}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <FestivalArteAmpliada
        combos={visiveis}
        indice={aberto}
        onIndice={setAberto}
        onFechado={botoes.focar}
        festival={festival}
        ano={ano}
        encerrada={encerrada}
      />
    </>
  );
}

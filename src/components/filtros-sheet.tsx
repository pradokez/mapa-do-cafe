"use client";

import { useId } from "react";

import { ABERTO_AGORA, ATRIBUTOS, selosNoAr, type SELOS } from "@/components/cafe-atributos";
import { AtributoChip } from "@/components/filter-chip";
import { RaioOpcoes, RascunhoSheet, SheetOption, type AplicarFiltros } from "@/components/rascunho-sheet";
import { SlidersIcon } from "@/components/icons";
import { useTentativaDeLocalizacao } from "@/components/localizacao-tentativa";
import { BOTAO_HEADER_MOBILE } from "@/components/medidas";
import type { Cafe } from "@/lib/cafe";
import type { Coordenadas } from "@/lib/cafe-distance";
import { alternar, contarFiltrosAtivos, FAIXAS, type CafeFilters, type FiltroBooleano } from "@/lib/cafe-filter";
import type { FestivaisNoAr } from "@/lib/festival";
import { faixaPrecoNome } from "@/lib/format";

type Props = {
  cafes: Cafe[];
  /** Festivais no ar: só eles têm chip em "Selos"; sem nenhum, a seção some. */
  festivais: FestivaisNoAr;
  /** Posição do navegador: o raio conta para o "Ver N cafés". */
  origem: Coordenadas | null;
  filters: CafeFilters;
  onAplicar: AplicarFiltros;
};

/**
 * Botão de filtros do header mobile (com badge) + bottom sheet em seções:
 * horário com o chip "Aberto agora" (#162, no topo, como no design da #159),
 * distância em linhas de escolha única (#161, no topo, como no design da
 * #159), selos (dos festivais no ar) e comodidades em chips (como no design v2),
 * faixa de preço em linhas (o chip "$" sozinho perderia o nome). Desvio
 * consciente do design, em que o botão abria o mesmo sheet do bairro: o
 * bairro fica no próprio chip (`BairroSheet`).
 */
export function FiltrosSheet({ cafes, festivais, origem, filters, onAplicar }: Props) {
  const ativos = contarFiltrosAtivos(filters);
  const selos = selosNoAr(festivais);
  // A tentativa daqui avisa dentro do sheet, acima de "Ver N cafés".
  const { tentar, aviso } = useTentativaDeLocalizacao("absolute inset-x-[18px] bottom-[86px] z-10");

  return (
    <RascunhoSheet
      titulo="Filtros"
      cafes={cafes}
      festivais={festivais}
      origem={origem}
      filters={filters}
      onAplicar={onAplicar}
      aviso={aviso}
      trigger={
        <button
          type="button"
          aria-label={ativos === 0 ? "Filtros" : `Filtros, ${ativos} ${ativos === 1 ? "ativo" : "ativos"}`}
          className={`${BOTAO_HEADER_MOBILE} relative flex flex-none items-center justify-center border border-line-strong bg-white text-espresso transition-colors hover:bg-hover-soft`}
        >
          <SlidersIcon size={18} strokeWidth={2} />
          {ativos > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-cream bg-terracotta px-1 text-[10.5px] font-bold text-on-terracotta"
            >
              {ativos}
            </span>
          )}
        </button>
      }
    >
      {(rascunho, mudar) => {
        const alternarFiltro = (filtro: FiltroBooleano) => mudar({ ...rascunho, [filtro]: !rascunho[filtro] });
        return (
          <>
            <Secao titulo="Horário">
              <Chips opcoes={[ABERTO_AGORA]} rascunho={rascunho} onToggle={alternarFiltro} />
            </Secao>
            <Secao titulo="Distância">
              <RaioOpcoes
                raioKm={rascunho.raioKm}
                semPosicao={!origem}
                onTentar={tentar}
                onEscolher={(raioKm) => mudar({ ...rascunho, raioKm })}
              />
            </Secao>
            {selos.length > 0 && (
              <Secao titulo="Selos">
                <Chips opcoes={selos} rascunho={rascunho} onToggle={alternarFiltro} />
              </Secao>
            )}
            <Secao titulo="Comodidades">
              <Chips opcoes={ATRIBUTOS} rascunho={rascunho} onToggle={alternarFiltro} />
            </Secao>
            <Secao titulo="Faixa de preço">
              {FAIXAS.map((faixa) => (
                <SheetOption
                  key={faixa}
                  checked={rascunho.precos.includes(faixa)}
                  onToggle={() => mudar({ ...rascunho, precos: alternar(rascunho.precos, faixa) })}
                >
                  {/* "$" seria lido como "dólar": o nome da faixa é o rótulo. */}
                  <span aria-hidden="true" className="w-[30px] font-semibold tracking-[.04em]">
                    {faixa}
                  </span>{" "}
                  {faixaPrecoNome(faixa)}
                </SheetOption>
              ))}
            </Secao>
          </>
        );
      }}
    </RascunhoSheet>
  );
}

/** Seção do sheet: título de 11,5 px em caixa alta (`ink-3`), que dá nome ao grupo. */
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="mb-5 last:mb-0">
      <h3 id={id} className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-[.12em] text-ink-3">
        {titulo}
      </h3>
      {children}
    </div>
  );
}

type ChipsProps = {
  opcoes: ReadonlyArray<(typeof SELOS)[number] | (typeof ATRIBUTOS)[number] | typeof ABERTO_AGORA>;
  rascunho: CafeFilters;
  onToggle: (filtro: FiltroBooleano) => void;
};

function Chips({ opcoes, rascunho, onToggle }: ChipsProps) {
  return (
    <div className="flex flex-wrap gap-[7px]">
      {opcoes.map((opcao) => (
        <AtributoChip
          key={opcao.filtro}
          opcao={opcao}
          ativo={rascunho[opcao.filtro]}
          onToggle={() => onToggle(opcao.filtro)}
        />
      ))}
    </div>
  );
}

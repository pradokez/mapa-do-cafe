import Link from "next/link";

import {
  agruparPorCafe,
  avisoDeConfirmacao,
  formatarValor,
  ROTULO_DO_CAMPO,
  rotuloDeAtualidade,
  type Atualidade,
  type FonteDaRevisao,
  type Revisao,
} from "@/lib/revisao";
import type { Sinal } from "@/lib/revisao-proposta";
import { milhar } from "@/lib/sugestao";
import { isHttpUrl } from "@/lib/url";

import { ChevronRightIcon } from "../icons";
import { AcoesDaRevisao, DecisoesDaFila } from "./decisoes-da-fila";

type Props = { revisoes: Revisao[]; agora: Date; total: number };

// O texto da etiqueta diz tudo; a cor só reforça (`Atualizada` verde, o resto terracota).
const COR_DA_ETIQUETA: Record<Atualidade, string> = {
  atualizada: "bg-open/10 text-open",
  antiga: "bg-aviso-bg text-aviso-fg",
  sem_data: "bg-hover-soft text-ink-2",
  conflito: "bg-aviso-bg text-aviso-fg",
};

const ROTULO_DO_TIPO = { cafe_novo: "Café novo", atualizacao: "Atualização", fechamento: "Fechamento" } as const;
const STATUS_FINAL = { pendente: null, aprovada: "Aprovada", rejeitada: "Rejeitada", obsoleta: "Obsoleta" } as const;

/**
 * Fila de `/admin/revisoes` (#177), agrupada por café. Server Component: as
 * fontes são `<details>` nativos, e as decisões (#182), formulários com a
 * Server Action. Os textos vêm do robô e da web, então saem como texto puro
 * (o React escapa) e o link da fonte só vale se for http(s).
 */
export function ListaDeRevisoes({ revisoes, agora, total }: Props) {
  const grupos = agruparPorCafe(revisoes);
  // A ordem da tela, para o foco achar o vizinho de quem saiu da lista.
  const itens = grupos.flatMap((g) => g.revisoes).map(({ id, status }) => ({ id, status }));

  return (
    <DecisoesDaFila itens={itens}>
      {revisoes.length === 0 ? (
        <p
          data-vazio
          tabIndex={-1}
          className="rounded-[14px] border border-dashed border-line-strong p-14 text-center text-[14px] text-ink-3 focus:outline-none"
        >
          Nada por aqui com esse filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {grupos.map((grupo) => (
            <li key={grupo.chave} className="overflow-hidden rounded-[14px] border border-line bg-white">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-5 py-3.5">
                <h2 className="font-display text-[20px] leading-[1.2] text-espresso">
                  {grupo.cafe && grupo.revisoes[0].cafe_id ? (
                    <Link href={`/admin/cafes/${grupo.revisoes[0].cafe_id}`} className="hover:underline">
                      {grupo.titulo}
                    </Link>
                  ) : (
                    grupo.titulo
                  )}
                </h2>
                {grupo.cafe && !grupo.cafe.ativo && (
                  <span className="text-[12px] font-semibold text-ink-3">Fora do ar</span>
                )}
                {grupo.cafe?.ativo && (
                  <Link
                    href={`/cafes/${grupo.cafe.slug}`}
                    className="text-[13px] text-ink-3 underline underline-offset-2 hover:text-espresso"
                  >
                    Ver no site
                  </Link>
                )}
              </header>
              <ul>
                {grupo.revisoes.map((revisao) => (
                  <Item key={revisao.id} revisao={revisao} agora={agora} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {total > revisoes.length && (
        <p className="mt-3 text-[13px] text-ink-3">
          Mostrando as {milhar(revisoes.length)} mais recentes de {milhar(total)}.
        </p>
      )}
    </DecisoesDaFila>
  );
}

function Valor({ rotulo, linhas }: { rotulo: string; linhas: string[] }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-hover-soft px-3.5 py-2.5">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{rotulo}</p>
      <div className="mt-1 text-[14px] text-espresso [overflow-wrap:anywhere]">
        {linhas.map((linha, i) => (
          <p key={i}>{linha}</p>
        ))}
      </div>
    </div>
  );
}

function Mudanca({ revisao }: { revisao: Revisao }) {
  if (revisao.tipo === "fechamento") {
    return (
      <p className="text-[14px] text-espresso">
        O café parece ter <strong className="font-semibold">fechado de vez</strong>. Aprovar o tira do ar.
      </p>
    );
  }
  if (revisao.tipo === "cafe_novo") {
    const proposto: Record<string, unknown> =
      typeof revisao.valor_proposto === "object" && revisao.valor_proposto ? (revisao.valor_proposto as Record<string, unknown>) : {};
    const local = [proposto.endereco, proposto.bairro, proposto.cidade].filter((v) => typeof v === "string" && v).join(" · ");
    return <p className="text-[14px] text-espresso">{local || "Sem endereço na proposta."}</p>;
  }
  if (!revisao.campo) {
    return <p className="text-[14px] text-espresso">Indício sem campo para atualizar (por exemplo, fechado por um tempo).</p>;
  }
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <Valor rotulo="Atual" linhas={formatarValor(revisao.campo, revisao.valor_atual)} />
      <ChevronRightIcon size={16} className="mx-auto flex-none rotate-90 text-ink-3 sm:rotate-0" aria-hidden="true" />
      <Valor rotulo="Proposto" linhas={formatarValor(revisao.campo, revisao.valor_proposto)} />
    </div>
  );
}

function Item({ revisao, agora }: { revisao: Revisao; agora: Date }) {
  const final = STATUS_FINAL[revisao.status];
  return (
    <li data-revisao={revisao.id} className="flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0">
      <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
        <span className="inline-flex h-[22px] items-center rounded-full bg-hover-soft px-[9px] text-[12px] font-semibold text-ink-2">
          {ROTULO_DO_TIPO[revisao.tipo]}
        </span>
        {revisao.campo && <span className="font-medium text-espresso">{ROTULO_DO_CAMPO[revisao.campo]}</span>}
        <span
          className={`inline-flex h-[22px] items-center rounded-full px-[9px] text-[12px] font-semibold ${COR_DA_ETIQUETA[revisao.atualidade]}`}
        >
          {rotuloDeAtualidade(revisao.atualidade, revisao.fontes, agora)}
        </span>
        {final && <span className="font-medium text-ink-2">{final}</span>}
      </p>
      <Mudanca revisao={revisao} />
      <Fontes fontes={revisao.fontes} />
      <AcoesDaRevisao revisao={revisao} aviso={avisoDeConfirmacao(revisao, agora)} />
    </li>
  );
}

/** Título da fonte (ou do sinal) em link de nova aba, só se for http(s): o texto vem da web. */
function TituloDaFonte({ titulo, url }: { titulo: string; url: string }) {
  return (
    <p className="font-medium text-espresso [overflow-wrap:anywhere]">
      {isHttpUrl(url) ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-terracotta">
          {titulo}
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      ) : (
        titulo
      )}
    </p>
  );
}

function Trecho({ trecho }: { trecho: string }) {
  return <blockquote className="mt-1 whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">“{trecho}”</blockquote>;
}

/** As fontes de uma revisão, recolhidas: na fila e no cadastro aberto por um café novo (#187). */
export function Fontes({ fontes }: { fontes: FonteDaRevisao[] }) {
  if (fontes.length === 0) return <p className="text-[13px] text-ink-3">Sem fontes.</p>;
  return (
    <details className="group text-[13.5px]">
      <summary className="cursor-pointer select-none font-medium text-ink-2 hover:text-espresso">
        {fontes.length === 1 ? "1 fonte" : `${fontes.length} fontes`}
      </summary>
      <ul className="mt-2 flex flex-col gap-3">
        {fontes.map((fonte, i) => (
          <li key={i} className="border-l-2 border-line-strong pl-3">
            <TituloDaFonte titulo={fonte.titulo} url={fonte.url} />
            <p className="text-ink-3">{fonte.data_fonte ? `Data na página: ${fonte.data_fonte}` : "Sem data na página"}</p>
            <Trecho trecho={fonte.trecho} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Os sinais de café especial de uma proposta de café novo (#187), cada um com o trecho de onde saiu. */
export function Sinais({ sinais }: { sinais: Sinal[] }) {
  if (sinais.length === 0) return <p className="text-[13.5px] text-ink-3">Nenhum sinal na proposta.</p>;
  return (
    <ul className="flex flex-col gap-3 text-[13.5px]">
      {sinais.map((sinal, i) => (
        <li key={i} className="border-l-2 border-line-strong pl-3">
          <TituloDaFonte titulo={sinal.sinal} url={sinal.url} />
          <Trecho trecho={sinal.trecho} />
        </li>
      ))}
    </ul>
  );
}

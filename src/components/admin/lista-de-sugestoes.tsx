"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { mudarStatusSugestao } from "@/lib/admin/sugestoes-actions";
import {
  acoesDoStatus,
  formatarDataDaSugestao,
  milhar,
  origemSegura,
  ROTULO_STATUS,
  SOBRE_O_TIPO,
  type AcaoDeStatus,
  type StatusSugestao,
  type Sugestao,
  type TipoSugestao,
} from "@/lib/sugestao";

import { Erro } from "./form";

// Cores do selo do tipo (design 3b). `#F0EDE9` só aparece aqui, por isso não virou token.
const SELO_DO_TIPO: Record<TipoSugestao, string> = {
  sugestao: "bg-hover-soft text-ink-2",
  problema: "bg-aviso-bg text-terracotta-hover",
  outro: "bg-[#F0EDE9] text-ink-2",
};

function anuncioDa(de: StatusSugestao, para: StatusSugestao): string {
  if (para === "arquivada") return "Sugestão arquivada.";
  if (para === "nova") return "Sugestão de volta às novas.";
  return de === "arquivada" ? "Sugestão desarquivada." : "Sugestão marcada como lida.";
}

/** Ação enviada e ainda não refletida na lista do servidor. */
type Pendente = { id: string; indice: number; de: StatusSugestao; para: StatusSugestao };

type Props = { sugestoes: Sugestao[]; agora: string; total: number };

/**
 * Lista de `/admin/sugestoes` (#84, design 3b). A mensagem sai como texto puro
 * — o React escapa, sem `dangerouslySetInnerHTML` nem autolink: `<script>`
 * aparece escrito, não executa.
 *
 * Cada botão de status é um formulário com a Server Action (funciona sem JS).
 * Depois dela, a página volta revalidada; o sucesso se confirma pela lista nova
 * (o item mudou de status ou saiu do filtro), não pela resposta — quando o item
 * sai, o estado dele some junto. Aí o foco vai para o mesmo item, ou para o que
 * ocupou o lugar dele, e um `role="status"` anuncia.
 */
export function ListaDeSugestoes({ sugestoes, agora, total }: Props) {
  const lista = useRef<HTMLUListElement>(null);
  const vazio = useRef<HTMLParagraphElement>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [aviso, setAviso] = useState("");

  const primeiroBotao = (id: string) =>
    lista.current?.querySelector<HTMLButtonElement>(`[data-sugestao="${id}"] button`) ?? null;

  useEffect(() => {
    if (!pendente) return;
    const atual = sugestoes.find((s) => s.id === pendente.id);
    if (atual && atual.status !== pendente.para) return;
    if (atual) {
      primeiroBotao(atual.id)?.focus();
    } else {
      const vizinha = sugestoes[Math.min(pendente.indice, sugestoes.length - 1)];
      (vizinha ? primeiroBotao(vizinha.id) : vazio.current)?.focus();
    }
    setAviso(anuncioDa(pendente.de, pendente.para));
    setPendente(null);
  }, [sugestoes, pendente]);

  const agoraData = new Date(agora);

  return (
    <>
      {sugestoes.length === 0 ? (
        <p
          ref={vazio}
          tabIndex={-1}
          className="rounded-[14px] border border-dashed border-line-strong p-14 text-center text-[14px] text-ink-3 focus:outline-none"
        >
          Nada por aqui com esse filtro.
        </p>
      ) : (
        <ul ref={lista} className="overflow-hidden rounded-[14px] border border-line bg-white">
          {sugestoes.map((sugestao, indice) => (
            <Item
              key={sugestao.id}
              sugestao={sugestao}
              agora={agoraData}
              aoEnviar={(acao) => {
                setAviso("");
                setPendente({ id: sugestao.id, indice, de: sugestao.status, para: acao.para });
              }}
            />
          ))}
        </ul>
      )}

      {total > sugestoes.length && (
        <p className="mt-3 text-[13px] text-ink-3">
          Mostrando as {milhar(sugestoes.length)} mais recentes de {milhar(total)}.
        </p>
      )}

      <p role="status" className="sr-only">
        {aviso}
      </p>
    </>
  );
}

function Item({
  sugestao,
  agora,
  aoEnviar,
}: {
  sugestao: Sugestao;
  agora: Date;
  aoEnviar: (acao: AcaoDeStatus) => void;
}) {
  const [estado, acaoDoForm] = useFormState(mudarStatusSugestao, null);
  const nova = sugestao.status === "nova";
  const erro = estado && !estado.ok ? estado.erro : null;
  // O banco já só aceita `/` e `/cafes/{slug}`; conferir de novo na saída garante que nada vira `javascript:`.
  const origem = origemSegura(sugestao.origem);

  return (
    <li
      data-sugestao={sugestao.id}
      className={`grid grid-cols-[18px_minmax(0,1fr)] gap-x-3.5 gap-y-3 border-t border-line px-5 py-[18px] first:border-t-0 md:grid-cols-[18px_minmax(0,1fr)_auto] ${
        // `#FFFDFB`: o branco quente das novas, só aqui.
        nova ? "bg-[#FFFDFB]" : "bg-white"
      }`}
    >
      <span aria-hidden="true" className={`mt-[7px] size-2 rounded-full ${nova ? "bg-terracotta" : ""}`} />

      <div className="flex min-w-0 flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
          <span
            className={`inline-flex h-[22px] items-center rounded-full px-[9px] text-[12px] font-semibold ${SELO_DO_TIPO[sugestao.tipo]}`}
          >
            {SOBRE_O_TIPO[sugestao.tipo].rotulo}
          </span>
          <time dateTime={sugestao.criado_em}>{formatarDataDaSugestao(sugestao.criado_em, agora)}</time>
          <span aria-hidden="true">·</span>
          {origem ? (
            <a
              href={origem}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[12px] text-ink-2 underline underline-offset-2 hover:text-espresso"
            >
              {origem}
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          ) : (
            <span className="italic">origem desconhecida</span>
          )}
          <span className={`ml-1 font-medium ${nova ? "text-terracotta" : "text-placeholder"}`}>
            {ROTULO_STATUS[sugestao.status]}
          </span>
        </p>
        <p
          className={`whitespace-pre-wrap text-[14.5px] leading-[1.55] [overflow-wrap:anywhere] ${
            sugestao.status === "arquivada" ? "text-placeholder" : "text-espresso"
          }`}
        >
          {sugestao.mensagem}
        </p>
      </div>

      <div className="col-start-2 flex flex-col gap-2 md:col-start-3 md:row-start-1 md:items-end">
        <div className="flex flex-wrap gap-1.5">
          {acoesDoStatus(sugestao.status).map((acao) => (
            <form key={acao.para} action={acaoDoForm} onSubmit={() => aoEnviar(acao)}>
              <input type="hidden" name="id" value={sugestao.id} />
              <input type="hidden" name="status" value={acao.para} />
              <BotaoDeStatus rotulo={acao.rotulo} />
            </form>
          ))}
        </div>
        <Erro erro={erro} className="text-[13px] md:max-w-[260px] md:text-right" />
      </div>
    </li>
  );
}

function BotaoDeStatus({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 whitespace-nowrap rounded-lg border border-line-strong bg-white px-3 text-[12.5px] font-medium text-espresso transition-colors hover:bg-hover-soft disabled:opacity-60 md:h-8"
    >
      {pending ? "Salvando…" : rotulo}
    </button>
  );
}

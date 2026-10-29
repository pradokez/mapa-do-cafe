"use client";

import Link from "next/link";
import { Component, createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { aprovarRevisao, rejeitarRevisao } from "@/lib/admin/revisoes-actions";
import { acoesDaRevisao, type DecisaoDeRevisao, type Revisao, type StatusRevisao } from "@/lib/revisao";

import { Erro } from "./form";

type AcaoDoForm = (dados: FormData) => void;
type Acao = "aprovar" | "rejeitar" | "arquivar";

type Contexto = {
  aprovar: AcaoDoForm;
  rejeitar: AcaoDoForm;
  /** A resposta mais recente, de qualquer item: cada um mostra só o erro com o próprio id. */
  estado: DecisaoDeRevisao;
  aoEnviar: (id: string, acao: Acao) => void;
};

const DecisoesContexto = createContext<Contexto | null>(null);

type Enviada = { id: string; indice: number; acao: Acao };

function anuncioDo(status: StatusRevisao, acao: Acao): string {
  if (status === "obsoleta") return "O café mudou desde a coleta: a revisão ficou obsoleta e nada foi gravado.";
  if (status === "aprovada") return "Revisão aprovada.";
  return acao === "arquivar" ? "Revisão arquivada." : "Revisão rejeitada.";
}

const FOCAVEIS = ":is(button, summary, a[href])";

/**
 * As decisões da fila de revisões (#182). Um `useFormState` por ação, aqui e
 * não em cada item: o item decidido sai da lista (o filtro padrão é só
 * pendentes) junto com a resposta, e o estado dele sumiria com ele.
 *
 * Os botões são formulários com a Server Action, então funcionam sem JS. Com
 * JS, quando a lista revalidada chega, o foco vai às ações do mesmo item ou do
 * que tomou o lugar dele (ou ao aviso de lista vazia), e um `role="status"`
 * diz o que aconteceu — inclusive a revisão que ficou obsoleta.
 */
export function DecisoesDaFila(props: { itens: Pick<Revisao, "id" | "status">[]; children: ReactNode }) {
  return (
    <LimiteDeEnvio>
      <Decisoes {...props} />
    </LimiteDeEnvio>
  );
}

function Decisoes({ itens, children }: { itens: Pick<Revisao, "id" | "status">[]; children: ReactNode }) {
  const [estadoAprovar, aprovar] = useFormState(aprovarRevisao, null);
  const [estadoRejeitar, rejeitar] = useFormState(rejeitarRevisao, null);
  // Sem JS, só uma das duas respondeu: vale a que não é nula.
  const [ultimo, setUltimo] = useState<"aprovar" | "rejeitar">("aprovar");
  const estado = ultimo === "aprovar" ? (estadoAprovar ?? estadoRejeitar) : (estadoRejeitar ?? estadoAprovar);

  const caixa = useRef<HTMLDivElement>(null);
  const enviada = useRef<Enviada | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    const atual = enviada.current;
    if (!atual || !estado || !estado.ok || estado.id !== atual.id) return;
    // Espera a lista nova: até ela chegar, o item continua pendente na tela.
    const item = itens.find((r) => r.id === atual.id);
    if (item && item.status === "pendente") return;

    const alvo = item ?? itens[Math.min(atual.indice, itens.length - 1)];
    const foco = alvo
      ? caixa.current?.querySelector<HTMLElement>(`[data-revisao="${alvo.id}"] [data-acoes] ${FOCAVEIS}`)
      : caixa.current?.querySelector<HTMLElement>("[data-vazio]");
    (foco ?? caixa.current?.querySelector<HTMLElement>("[data-vazio]"))?.focus();
    setAviso(anuncioDo(estado.status, atual.acao));
    enviada.current = null;
  }, [estado, itens]);

  const contexto: Contexto = {
    aprovar,
    rejeitar,
    estado,
    aoEnviar: (id, acao) => {
      setUltimo(acao === "aprovar" ? "aprovar" : "rejeitar");
      setAviso("");
      enviada.current = { id, indice: itens.findIndex((r) => r.id === id), acao };
    },
  };

  return (
    <DecisoesContexto.Provider value={contexto}>
      <div ref={caixa}>
        {/* Erro sem id (o modo leitura recusa antes de ler o form): não tem item onde aparecer. */}
        <Erro erro={estado && !estado.ok && !estado.id ? estado.erro : null} className="mb-3" />
        <p role="status" className="mb-3 text-[14px] font-medium text-ink-2 empty:hidden">
          {aviso}
        </p>
        {children}
      </div>
    </DecisoesContexto.Provider>
  );
}

const botaoClass =
  "inline-flex h-11 items-center whitespace-nowrap rounded-lg px-3 text-[12.5px] font-medium transition-colors disabled:opacity-60 md:h-8";
const neutroClass = `${botaoClass} border border-line-strong bg-white text-espresso hover:bg-hover-soft`;
const ctaClass = `${botaoClass} bg-terracotta text-on-terracotta hover:bg-terracotta-hover`;

type Props = {
  revisao: Pick<Revisao, "id" | "tipo" | "campo" | "status" | "cafe_id">;
  /** `avisoDeConfirmacao`: com ele, aprovar pede confirmação. */
  aviso: string | null;
};

/** Os botões de uma revisão: Aprovar (direto ou com confirmação), Editar no café, Ver café, Rejeitar ou Arquivar. */
export function AcoesDaRevisao({ revisao, aviso }: Props) {
  const contexto = useContext(DecisoesContexto);
  if (!contexto) throw new Error("AcoesDaRevisao fora de DecisoesDaFila");
  const { aprovar, rejeitar, estado, aoEnviar } = contexto;
  const acoes = acoesDaRevisao(revisao);
  if (!acoes.aprovar && !acoes.descartar && !acoes.verCafe && !acoes.editar) return null;

  const erro = estado && !estado.ok && estado.id === revisao.id ? estado.erro : null;
  const campoId = <input type="hidden" name="id" value={revisao.id} />;

  return (
    <div className="flex flex-col gap-2">
      <div data-acoes className="flex flex-wrap items-start gap-1.5">
        {acoes.aprovar &&
          (aviso ? (
            <details className="open:basis-full">
              <summary className={`${ctaClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                Aprovar…
              </summary>
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-aviso-line bg-aviso-bg px-3.5 py-3 text-[13.5px] text-aviso-fg">
                <p>
                  {aviso} <span className="font-semibold">Aprovar mesmo assim?</span>
                </p>
                <form action={aprovar} onSubmit={() => aoEnviar(revisao.id, "aprovar")}>
                  {campoId}
                  <input type="hidden" name="confirmacao" value="1" />
                  <Botao className={ctaClass}>Aprovar mesmo assim</Botao>
                </form>
              </div>
            </details>
          ) : (
            <form action={aprovar} onSubmit={() => aoEnviar(revisao.id, "aprovar")}>
              {campoId}
              <Botao className={ctaClass}>Aprovar</Botao>
            </form>
          ))}
        {acoes.editar && revisao.cafe_id && (
          <Link href={`/admin/cafes/${revisao.cafe_id}?revisao=${revisao.id}`} className={neutroClass}>
            Editar no café
          </Link>
        )}
        {acoes.verCafe && revisao.cafe_id && (
          <Link href={`/admin/cafes/${revisao.cafe_id}`} className={neutroClass}>
            Ver café
          </Link>
        )}
        {acoes.descartar && (
          <form
            action={rejeitar}
            onSubmit={() => aoEnviar(revisao.id, acoes.descartar === "Arquivar" ? "arquivar" : "rejeitar")}
          >
            {campoId}
            <Botao className={neutroClass}>{acoes.descartar}</Botao>
          </form>
        )}
      </div>
      <Erro erro={erro} className="text-[13px]" />
    </div>
  );
}

function Botao({ className, children }: { className: string; children: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Salvando…" : children}
    </button>
  );
}

/**
 * A rede cai entre o clique e a resposta: o `fetch` da Server Action rejeita e o
 * React relança o erro no render (#191). Sem este limite a página inteira vira
 * "Application error". Aqui a fila é trocada por um aviso com "Tentar de novo",
 * que a remonta como estava — a revisão segue pendente, nada foi gravado. Só o
 * caminho com JS passa por aqui: sem JS o formulário é navegação comum.
 */
export class LimiteDeEnvio extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };

  static getDerivedStateFromError() {
    return { falhou: true };
  }

  render() {
    if (!this.state.falhou) return this.props.children;
    return <FalhaDeEnvio tentarDeNovo={() => this.setState({ falhou: false })} />;
  }
}

function FalhaDeEnvio({ tentarDeNovo }: { tentarDeNovo: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => caixa.current?.focus(), []);
  return (
    <div
      ref={caixa}
      role="alert"
      tabIndex={-1}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-aviso-line bg-aviso-bg px-3.5 py-3 text-[13.5px] text-aviso-fg outline-none"
    >
      <p>
        <span className="font-semibold">Não deu para enviar.</span> Confira sua conexão e tente de novo. Nada foi
        gravado.
      </p>
      <button type="button" onClick={tentarDeNovo} className={neutroClass}>
        Tentar de novo
      </button>
    </div>
  );
}

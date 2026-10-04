"use client";

// Client pelos estados das ações, pelo foco depois de mover/remover e pelo
// diálogo de confirmação.
import { useEffect, useRef, useState } from "react";

import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from "@/components/icons";
import { removerFoto, reordenarFoto } from "@/lib/admin/fotos-actions";
import type { FotoDoCafe } from "@/lib/cafe-repository";
import { moverFoto, type Movimento } from "@/lib/foto-ordem";
import { ROTULO_ORIGEM } from "@/lib/foto-upload";

import { Erro } from "./form";
import { RemoverFotoDialog } from "./remover-foto-dialog";

const ERRO_ACAO = "Não deu para salvar agora. Tente de novo em instantes.";

/** Texto alternativo da foto, igual na lista e no diálogo de remoção. */
const altDaFoto = (indice: number, total: number, nome: string) => `Foto ${indice + 1} de ${total} — ${nome}`;

/** `AAAA-MM-DD` → `DD/MM/AAAA`, sem `Date` (nada de fuso no meio). */
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

type Acao = Movimento | "remover";

/**
 * Para onde o foco vai quando a lista nova chega do servidor (o
 * `revalidatePath` da action re-renderiza a página): a foto que andou, já na
 * posição esperada, ou, depois de remover, a que ficou no lugar dela.
 */
type Foco =
  | { tipo: "mover"; id: string; posicao: number; acao: Movimento }
  | { tipo: "remover"; id: string; indice: number };

type Props = { cafeId: string; nome: string; fotos: FotoDoCafe[] };

/**
 * Fotos do café no admin (#51), na ordem do site — a primeira é a capa — com
 * a autorização de cada uma. Reordenar e remover são botões (teclado e leitor
 * de tela); não há arrastar.
 */
export function ListaDeFotos({ cafeId, nome, fotos }: Props) {
  const lista = useRef<HTMLOListElement>(null);
  const vazio = useRef<HTMLParagraphElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [foco, setFoco] = useState<Foco | null>(null);
  const [aRemover, setARemover] = useState<{ foto: FotoDoCafe; indice: number } | null>(null);
  const [erroRemocao, setErroRemocao] = useState<string | null>(null);
  // Ao cancelar, o foco volta ao "Remover" desta foto; removida, fica `null` e o efeito decide.
  const voltarPara = useRef<string | null>(null);
  const total = fotos.length;

  const botao = (id: string, acao: Acao) =>
    lista.current?.querySelector<HTMLButtonElement>(`[data-foto="${id}"] [data-acao="${acao}"]`) ?? null;
  const primeiroBotao = (id: string) =>
    lista.current?.querySelector<HTMLButtonElement>(`[data-foto="${id}"] button:not(:disabled)`) ?? null;

  // Foco é efeito de DOM: só quando a lista do servidor já reflete a ação.
  useEffect(() => {
    if (!foco) return;
    if (foco.tipo === "mover") {
      if (fotos[foco.posicao]?.id !== foco.id) return;
      // O botão usado pode ter ficado desabilitado (chegou ao topo/fim) ou sumido (virou capa).
      const alvo = botao(foco.id, foco.acao);
      (alvo && !alvo.disabled ? alvo : primeiroBotao(foco.id))?.focus();
    } else {
      if (fotos.some((f) => f.id === foco.id)) return;
      const vizinha = fotos[Math.min(foco.indice, fotos.length - 1)];
      (vizinha ? primeiroBotao(vizinha.id) : vazio.current)?.focus();
    }
    setFoco(null);
  }, [fotos, foco]);

  async function mover(foto: FotoDoCafe, movimento: Movimento) {
    const nova = moverFoto(
      fotos.map((f) => f.id),
      foto.id,
      movimento,
    );
    if (!nova || ocupado) return;

    setOcupado(true);
    setErro(null);
    setAviso("");
    try {
      const resultado = await reordenarFoto(cafeId, foto.id, movimento);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      const posicao = nova.indexOf(foto.id);
      setFoco({ tipo: "mover", id: foto.id, posicao, acao: movimento });
      setAviso(posicao === 0 ? "Foto agora é a capa." : `Foto movida para a posição ${posicao + 1} de ${total}.`);
    } catch {
      setErro(ERRO_ACAO);
    } finally {
      setOcupado(false);
    }
  }

  async function remover() {
    if (!aRemover || ocupado) return;
    const { foto, indice } = aRemover;

    setOcupado(true);
    setErroRemocao(null);
    setAviso("");
    try {
      const resultado = await removerFoto(cafeId, foto.id);
      if (!resultado.ok) {
        setErroRemocao(resultado.erro);
        return;
      }
      voltarPara.current = null;
      setFoco({ tipo: "remover", id: foto.id, indice });
      setAviso("Foto removida.");
      setARemover(null);
    } catch {
      setErroRemocao(ERRO_ACAO);
    } finally {
      setOcupado(false);
    }
  }

  const abrirRemocao = (foto: FotoDoCafe, indice: number) => {
    setErro(null);
    setErroRemocao(null);
    voltarPara.current = foto.id;
    setARemover({ foto, indice });
  };

  return (
    <div className="flex flex-col gap-3">
      {total === 0 ? (
        <p ref={vazio} tabIndex={-1} className="text-[14px] text-ink-2 focus:outline-none">
          Nenhuma foto ainda — o café aparece com o placeholder listrado.
        </p>
      ) : (
        <ol ref={lista} aria-label={`Fotos no ar (${total})`} className="flex flex-col divide-y divide-line">
          {fotos.map((foto, i) => {
            const rotulo = `foto ${i + 1} de ${total}`;
            return (
              <li key={foto.id} data-foto={foto.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:gap-4">
                <div className="relative flex-none self-start">
                  {/* eslint-disable-next-line @next/next/no-img-element -- já otimizada no upload; #52 troca por next/image */}
                  <img
                    src={foto.url}
                    alt={altDaFoto(i, total, nome)}
                    loading="lazy"
                    className="size-[112px] rounded-lg border border-card-line object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-cream px-2 py-0.5 text-[11.5px] font-semibold text-espresso">
                      Capa
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-[13.5px]">
                    <dt className="text-ink-3">Origem</dt>
                    <dd className="font-semibold text-espresso">{ROTULO_ORIGEM[foto.origem]}</dd>
                    <dt className="text-ink-3">Autorização</dt>
                    <dd className="text-ink-2">
                      {foto.autorizado_por}, em {dataBr(foto.autorizado_em)}
                    </dd>
                    {foto.observacao && (
                      <>
                        <dt className="text-ink-3">Observação</dt>
                        <dd className="whitespace-pre-line break-words text-ink-2">{foto.observacao}</dd>
                      </>
                    )}
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    <BotaoFoto
                      acao="subir"
                      rotulo={`Subir ${rotulo}`}
                      disabled={ocupado || i === 0}
                      onClick={() => mover(foto, "subir")}
                    >
                      <ArrowUpIcon size={14} strokeWidth={2} />
                      Subir
                    </BotaoFoto>
                    <BotaoFoto
                      acao="descer"
                      rotulo={`Descer ${rotulo}`}
                      disabled={ocupado || i === total - 1}
                      onClick={() => mover(foto, "descer")}
                    >
                      <ArrowDownIcon size={14} strokeWidth={2} />
                      Descer
                    </BotaoFoto>
                    {i > 0 && (
                      <BotaoFoto
                        acao="capa"
                        rotulo={`Usar ${rotulo} como capa`}
                        disabled={ocupado}
                        onClick={() => mover(foto, "capa")}
                      >
                        Usar como capa
                      </BotaoFoto>
                    )}
                    <BotaoFoto
                      acao="remover"
                      rotulo={`Remover ${rotulo}`}
                      disabled={ocupado}
                      onClick={() => abrirRemocao(foto, i)}
                      className="text-terracotta"
                    >
                      <TrashIcon size={14} strokeWidth={2} />
                      Remover
                    </BotaoFoto>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Erro erro={erro} />
      <p role="status" className="text-[13.5px] font-medium text-open empty:hidden">
        {aviso}
      </p>

      <RemoverFotoDialog
        foto={aRemover && { url: aRemover.foto.url, alt: altDaFoto(aRemover.indice, total, nome) }}
        removendo={ocupado}
        erro={erroRemocao}
        onConfirmar={remover}
        onCancelar={() => setARemover(null)}
        onCloseAutoFocus={(evento) => {
          evento.preventDefault();
          if (voltarPara.current) botao(voltarPara.current, "remover")?.focus();
        }}
      />
    </div>
  );
}

type BotaoProps = {
  acao: Acao;
  rotulo: string;
  disabled: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
};

/** O texto curto é o visível; o `aria-label` diz de qual foto se trata. */
function BotaoFoto({ acao, rotulo, disabled, onClick, className = "text-espresso", children }: BotaoProps) {
  return (
    <button
      type="button"
      data-acao={acao}
      aria-label={rotulo}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3.5 text-[13px] font-semibold transition-colors hover:bg-hover-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white ${className}`}
    >
      {children}
    </button>
  );
}

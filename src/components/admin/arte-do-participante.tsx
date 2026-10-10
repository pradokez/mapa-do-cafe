"use client";

// Client: o arquivo escolhido, a prévia e o diálogo de remoção.
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";

import { FotoDoStorage } from "@/components/foto-do-storage";
import { removerArte, type ErrosArte } from "@/lib/admin/artes-actions";
import type { ArteDoParticipante } from "@/lib/cafe-repository";
import { MAX_AUTORIZADO_POR, TIPOS_ENTRADA, type AutorizacaoDaArte } from "@/lib/foto-upload";

import { tamanho, type Convertida } from "./envio-de-imagem";
import { Erro, botaoCtaClass, botaoNeutroClass, inputClass, labelClass } from "./form";

const ERRO_REDE = "Não deu para falar com o servidor. Confira a conexão e tente de novo.";
const invalidoClass = "aria-[invalid=true]:border-terracotta";
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
/** A arte é 4:5 e vai inteira (o texto do combo está nela): sem corte também aqui. */
const MOLDURA = "h-[120px] w-[96px] flex-none rounded-lg border border-card-line bg-hover-soft object-contain";

type Props = {
  prefixo: string;
  edicaoId: string;
  participacaoId: string;
  nome: string;
  /** URL pública da arte no ar. */
  url: string | null;
  /** Quem autorizou a arte no ar (só o admin lê). */
  registro: ArteDoParticipante | undefined;
  hoje: string;
  imagem: Convertida | null;
  convertendo: boolean;
  erroArquivo: string | null;
  escolher: (evento: React.ChangeEvent<HTMLInputElement>) => void;
  autorizacao: AutorizacaoDaArte;
  mudarAutorizacao: (campo: keyof AutorizacaoDaArte, valor: string) => void;
  erros: ErrosArte;
  onRemovida: () => void;
};

/**
 * Arte do combo dentro do formulário do participante (#105): a que está no
 * ar (com a autorização e "Remover arte") e o campo para enviar ou trocar.
 * Escolhido um arquivo, pede quem autorizou e quando; o "Salvar" do
 * participante sobe a arte junto com os dados.
 */
export function CampoDaArte({
  prefixo,
  edicaoId,
  participacaoId,
  nome,
  url,
  registro,
  hoje,
  imagem,
  convertendo,
  erroArquivo,
  escolher,
  autorizacao,
  mudarAutorizacao,
  erros,
  onRemovida,
}: Props) {
  const [removendo, setRemovendo] = useState(false);
  const campo = (nomeDoCampo: keyof AutorizacaoDaArte) => ({
    id: `${prefixo}-${nomeDoCampo}`,
    "aria-invalid": erros[nomeDoCampo] ? true : undefined,
    "aria-describedby": erros[nomeDoCampo] ? `${prefixo}-${nomeDoCampo}-erro` : undefined,
  });

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className={labelClass}>Arte do combo</legend>

      <div className="flex flex-wrap items-start gap-4">
        {url && !imagem && (
          <>
            <FotoDoStorage src={url} alt={`Arte do combo de ${nome}`} width={96} height={120} className={MOLDURA} />
            <div className="flex min-w-0 flex-col gap-2 text-[13.5px]">
              {registro && (
                <p className="text-ink-2">
                  Autorizada por {registro.autorizado_por}, em {dataBr(registro.autorizado_em)}
                </p>
              )}
              <button
                type="button"
                onClick={() => setRemovendo(true)}
                className="w-fit text-[13.5px] font-semibold text-terracotta underline-offset-2 hover:underline"
              >
                Remover arte
              </button>
            </div>
          </>
        )}
        {imagem && (
          <figure className="flex items-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL local, nada a otimizar */}
            <img src={imagem.previa} alt="Prévia da arte que vai ser enviada" className={MOLDURA} />
            <figcaption className="text-[12.5px] text-ink-3">
              {imagem.largura} × {imagem.altura} · {tamanho(imagem.blob.size)}
              {url && <span className="block">Substitui a arte atual ao salvar.</span>}
            </figcaption>
          </figure>
        )}
      </div>

      <div>
        <label htmlFor={`${prefixo}-arte`} className="mb-1.5 block text-[13.5px] font-semibold text-espresso">
          {url ? "Trocar a arte" : "Enviar a arte"}
        </label>
        <input
          id={`${prefixo}-arte`}
          type="file"
          accept={TIPOS_ENTRADA.join(",")}
          onChange={escolher}
          aria-describedby={[`${prefixo}-arte-dica`, erroArquivo ? `${prefixo}-arte-erro` : ""].filter(Boolean).join(" ")}
          aria-invalid={erroArquivo ? true : undefined}
          className="block w-full text-[14px] text-ink-2 file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border file:border-line-strong file:bg-white file:px-4 file:text-[13.5px] file:font-semibold file:text-espresso hover:file:bg-hover-soft"
        />
        <p id={`${prefixo}-arte-dica`} className="mt-1.5 text-[12.5px] text-ink-3">
          A arte do post do festival, em JPEG, PNG ou WebP até 15 MB. Vai ao site inteira, sem corte. Precisa do texto
          alternativo abaixo.
        </p>
        <Erro id={`${prefixo}-arte-erro`} erro={erroArquivo} className="mt-1.5" />
        {convertendo && (
          <p role="status" className="mt-2 text-[13.5px] text-ink-2">
            Preparando a arte…
          </p>
        )}
      </div>

      {imagem && (
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <div>
            <label htmlFor={`${prefixo}-autorizado_por`} className={labelClass}>
              Quem autorizou
            </label>
            <input
              {...campo("autorizado_por")}
              maxLength={MAX_AUTORIZADO_POR}
              autoComplete="off"
              placeholder="ASCAPE, o café…"
              value={autorizacao.autorizado_por}
              onChange={(e) => mudarAutorizacao("autorizado_por", e.target.value)}
              className={`${inputClass} ${invalidoClass}`}
            />
            <Erro id={`${prefixo}-autorizado_por-erro`} erro={erros.autorizado_por} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor={`${prefixo}-autorizado_em`} className={labelClass}>
              Data da autorização
            </label>
            <input
              {...campo("autorizado_em")}
              type="date"
              max={hoje}
              value={autorizacao.autorizado_em}
              onChange={(e) => mudarAutorizacao("autorizado_em", e.target.value)}
              className={`${inputClass} ${invalidoClass}`}
            />
            <Erro id={`${prefixo}-autorizado_em-erro`} erro={erros.autorizado_em} className="mt-1.5" />
          </div>
        </div>
      )}

      <RemoverArteDialog
        aberto={removendo}
        nome={nome}
        url={url}
        edicaoId={edicaoId}
        participacaoId={participacaoId}
        onFechar={(removida) => {
          setRemovendo(false);
          if (removida) onRemovida();
        }}
      />
    </fieldset>
  );
}

/**
 * Confirmação de remover a arte: o combo segue no site, sem a imagem. Foco
 * começa em "Cancelar" — o destrutivo nunca é o padrão.
 */
function RemoverArteDialog({
  aberto,
  nome,
  url,
  edicaoId,
  participacaoId,
  onFechar,
}: {
  aberto: boolean;
  nome: string;
  url: string | null;
  edicaoId: string;
  participacaoId: string;
  onFechar: (removida: boolean) => void;
}) {
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

  async function confirmar() {
    setErro(null);
    setRemovendo(true);
    const resultado = await removerArte(edicaoId, participacaoId).catch(() => null);
    setRemovendo(false);
    if (!resultado?.ok) {
      setErro(resultado?.erro ?? ERRO_REDE);
      return;
    }
    onFechar(true);
  }

  return (
    <Dialog.Root
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir && !removendo) {
          setErro(null);
          onFechar(false);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-espresso/45" />
        <Dialog.Content
          role="alertdialog"
          onOpenAutoFocus={(evento) => {
            evento.preventDefault();
            cancelar.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-cream p-6 shadow-xl focus:outline-none"
        >
          <Dialog.Title className="font-display text-[21px] leading-[1.2] text-espresso">Remover a arte de {nome}?</Dialog.Title>
          <Dialog.Description className="mt-2.5 text-[14.5px] leading-[1.5] text-ink-2">
            O café continua na edição; o combo aparece no site sem a arte. O arquivo e o registro de autorização são
            apagados.
          </Dialog.Description>
          {url && (
            <FotoDoStorage src={url} alt="" width={96} height={120} className={`${MOLDURA} mt-4`} />
          )}
          <Erro erro={erro} className="mt-3" />
          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <button ref={cancelar} type="button" onClick={() => onFechar(false)} disabled={removendo} className={botaoNeutroClass}>
              Cancelar
            </button>
            <button type="button" onClick={confirmar} disabled={removendo} className={botaoCtaClass}>
              {removendo ? "Removendo…" : "Remover arte"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

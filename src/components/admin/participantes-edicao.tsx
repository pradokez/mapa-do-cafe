"use client";

// Client: a busca filtra a cada letra, e cada participante tem formulário, salvar e remover próprios.
import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useRef, useState } from "react";

import { ChevronDownIcon } from "@/components/icons";
import { descartarArte, prepararArte, registrarArte, type ErrosArte } from "@/lib/admin/artes-actions";
import { adicionarParticipante, removerParticipante, salvarParticipante } from "@/lib/admin/festivais-actions";
import { compararPorNome, type Cafe } from "@/lib/cafe";
import type { ArteDoParticipante } from "@/lib/cafe-repository";
import { ordenarPorNumero, type Participacao } from "@/lib/festival";
import {
  MAX_ALT,
  MAX_NOME_COMBO,
  cafesParaAdicionar,
  pendencias,
  validarParticipante,
  type CampoParticipante,
} from "@/lib/festival-dados";
import { validarAutorizacaoDaArte, type AutorizacaoDaArte } from "@/lib/foto-upload";
import { ARTE, falhaDeRede, type Falha } from "@/lib/foto-upload-erro";
import { localLabel } from "@/lib/format";

import { CampoDaArte } from "./campo-da-arte";
import { ErroDoEnvio, subirParaOStorage, useImagemConvertida } from "./envio-de-imagem";

import { botaoCtaClass, botaoNeutroClass, Erro, ERRO_REDE, inputClass, invalidoClass, labelClass } from "./form";
import { ETIQUETA } from "./status-cafe";

/** Resultados à vista na busca: o suficiente para achar, sem virar a lista inteira. */
const MAX_RESULTADOS = 8;

const etiquetaPendente = `${ETIQUETA} bg-seal-bg text-seal-fg`;
const etiquetaNeutra = `${ETIQUETA} bg-hover-soft text-ink-2`;

type Props = {
  edicaoId: string;
  participacoes: Participacao[];
  /** Todos os cafés do admin (ativos e não): nomes dos participantes e a busca para adicionar. */
  cafes: Cafe[];
  /** Quem autorizou cada arte no ar, por participação (#105). */
  artes: Record<string, ArteDoParticipante>;
  /** Hoje em Recife (`AAAA-MM-DD`): padrão e limite da data da autorização. */
  hoje: string;
};

/**
 * Participantes da edição (#102): adicionar café no ar pela busca do site,
 * número, nome curto, alt, link do post e arte (#105) de cada um, e tirar da
 * edição. Mostra quem está sem número e sem arte.
 */
export function ParticipantesEdicao({ edicaoId, participacoes, cafes, artes, hoje }: Props) {
  const [q, setQ] = useState("");
  const [anuncio, setAnuncio] = useState("");
  const [erroAdicionar, setErroAdicionar] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState<string | null>(null);
  const [remover, setRemover] = useState<Participacao | null>(null);
  const busca = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  const cafePorId = useMemo(() => new Map(cafes.map((cafe) => [cafe.id, cafe])), [cafes]);
  const nomeDo = (p: Participacao) => cafePorId.get(p.cafe_id)?.nome ?? "Café removido";
  // Sem número, em ordem alfabética depois dos numerados (`ordenarPorNumero` mantém a ordem recebida).
  const ordenados = ordenarPorNumero(
    [...participacoes].sort((a, b) => {
      const ca = cafePorId.get(a.cafe_id);
      const cb = cafePorId.get(b.cafe_id);
      return ca && cb ? compararPorNome(ca, cb) : 0;
    }),
  );
  const resultados = q.trim() ? cafesParaAdicionar(cafes, participacoes, q) : [];
  const { semNumero, semArte } = pendencias(participacoes);

  async function adicionar(cafe: Cafe) {
    setErroAdicionar(null);
    setAdicionando(cafe.id);
    const resultado = await adicionarParticipante(edicaoId, cafe.id).catch(() => null);
    setAdicionando(null);
    if (!resultado?.ok) {
      setErroAdicionar(resultado?.erro ?? ERRO_REDE);
      return;
    }
    // O botão some com o café: o foco volta à busca, pronta para o próximo.
    setQ("");
    setAnuncio(`${cafe.nome} entrou na edição.`);
    busca.current?.focus();
  }

  return (
    <div className="mt-3 flex flex-col gap-5">
      <p className="text-[14px] text-ink-2">
        {participacoes.length === 0
          ? "Nenhum café nesta edição ainda."
          : `${participacoes.length === 1 ? "1 café" : `${participacoes.length} cafés`} · ${semNumero} sem número · ${semArte} sem arte`}
      </p>

      <div>
        <label htmlFor="adicionar-cafe" className={labelClass}>
          Adicionar café
        </label>
        <input
          ref={busca}
          id="adicionar-cafe"
          type="search"
          autoComplete="off"
          placeholder="Nome ou bairro de um café no ar"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setErroAdicionar(null);
          }}
          aria-describedby="adicionar-cafe-resultado"
          className={`${inputClass} max-w-[440px]`}
        />
        <p id="adicionar-cafe-resultado" className="mt-1.5 text-[13px] text-ink-3 empty:hidden">
          {q.trim() && resultados.length === 0 ? "Nenhum café no ar fora da edição com essa busca." : ""}
        </p>
        <Erro erro={erroAdicionar} className="mt-1.5" />
        {resultados.length > 0 && (
          <ul aria-label="Cafés para adicionar" className="mt-2 max-w-[440px] divide-y divide-line rounded-lg border border-line-strong bg-white">
            {resultados.slice(0, MAX_RESULTADOS).map((cafe) => (
              <li key={cafe.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold text-espresso">{cafe.nome}</span>
                  <span className="block truncate text-[13px] text-ink-3">{localLabel(cafe)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => adicionar(cafe)}
                  disabled={adicionando !== null}
                  aria-label={`Adicionar ${cafe.nome}`}
                  className="h-9 shrink-0 rounded-full border border-line-strong px-4 text-[13.5px] font-semibold text-espresso hover:bg-hover-soft disabled:opacity-60"
                >
                  {adicionando === cafe.id ? "Adicionando…" : "Adicionar"}
                </button>
              </li>
            ))}
            {resultados.length > MAX_RESULTADOS && (
              <li className="px-3 py-2 text-[13px] text-ink-3">
                E mais {resultados.length - MAX_RESULTADOS}. Continue digitando para achar.
              </li>
            )}
          </ul>
        )}
      </div>

      {ordenados.length > 0 && (
        <div>
          <h3 ref={titulo} tabIndex={-1} className="mb-2 text-[13.5px] font-semibold text-ink-2 focus:outline-none">
            Na edição
          </h3>
          <ul className="flex flex-col gap-2">
            {ordenados.map((p) => (
              <ParticipanteItem
                key={p.id}
                edicaoId={edicaoId}
                participacao={p}
                cafe={cafePorId.get(p.cafe_id)}
                registro={artes[p.id]}
                hoje={hoje}
                onSalvo={() => setAnuncio(`${nomeDo(p)}: salvo.`)}
                onArteRemovida={() => setAnuncio(`${nomeDo(p)}: arte removida.`)}
                onRemover={() => setRemover(p)}
              />
            ))}
          </ul>
        </div>
      )}

      <RemoverDialog
        participacao={remover}
        nome={remover ? nomeDo(remover) : ""}
        edicaoId={edicaoId}
        onFechar={(removido) => {
          if (removido && remover) setAnuncio(`${nomeDo(remover)} saiu da edição.`);
          setRemover(null);
        }}
        // O item removido some: o foco vai para o título da lista (ou a busca, se ela esvaziou).
        foco={() => (participacoes.length > 1 ? titulo.current : busca.current)}
      />

      <p role="status" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
}

type EstadoParticipante = Record<CampoParticipante, string>;

const estadoDe = (p: Pick<Participacao, CampoParticipante>): EstadoParticipante => ({
  numero: p.numero === null ? "" : String(p.numero),
  nome_combo: p.nome_combo ?? "",
  alt: p.alt ?? "",
  instagram_url: p.instagram_url ?? "",
});

function ParticipanteItem({
  edicaoId,
  participacao,
  cafe,
  registro,
  hoje,
  onSalvo,
  onRemover,
  onArteRemovida,
}: {
  edicaoId: string;
  participacao: Participacao;
  cafe: Cafe | undefined;
  registro: ArteDoParticipante | undefined;
  hoje: string;
  onSalvo: () => void;
  onRemover: () => void;
  onArteRemovida: () => void;
}) {
  const [estado, setEstado] = useState(() => estadoDe(participacao));
  const [autorizacao, setAutorizacao] = useState<AutorizacaoDaArte>({ autorizado_por: "", autorizado_em: hoje });
  const { imagem, convertendo, erro: erroArquivo, escolher, limpar } = useImagemConvertida();
  const [erros, setErros] = useState<ErrosArte>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [falha, setFalha] = useState<Falha | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // Arte no ar ou escolhida agora: com ela, o alt é obrigatório.
  const temArte = participacao.arte !== null || imagem !== null;
  const prefixo = `participante-${participacao.id}`;
  const nome = cafe?.nome ?? "Café removido";

  function mudar(campo: CampoParticipante, valor: string) {
    setEstado((e) => ({ ...e, [campo]: valor }));
    setSucesso(false);
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }));
  }

  function mudarAutorizacao(campo: keyof AutorizacaoDaArte, valor: string) {
    setAutorizacao((a) => ({ ...a, [campo]: valor }));
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }));
  }

  function falhar(novos: ErrosArte, geral: string | null) {
    setErros(novos);
    setErroGeral(geral);
    // O foco vai ao primeiro campo marcado, depois de o React pintar o erro.
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
  }

  /** Sobe a arte e grava tudo junto (#105). Em toda falha, a arte convertida e os campos ficam. */
  async function enviarComArte(arte: NonNullable<typeof imagem>) {
    const dados = validarParticipante(estado, { temArte: true });
    const quem = validarAutorizacaoDaArte(autorizacao, hoje);
    if (!dados.ok || !quem.ok) {
      return falhar({ ...(dados.ok ? {} : dados.erros), ...(quem.ok ? {} : quem.erros) }, null);
    }
    if (!navigator.onLine) return setFalha({ etapa: "preparar", codigo: "offline" });

    let preparo;
    try {
      preparo = await prepararArte(edicaoId, participacao.id, quem.valores, { type: arte.blob.type, size: arte.blob.size });
    } catch (erro) {
      return setFalha(falhaDeRede("preparar", erro));
    }
    if (!preparo.ok) {
      setFalha(preparo.falha);
      return preparo.erros ? falhar(preparo.erros, null) : undefined;
    }

    const falhaDoEnvio = await subirParaOStorage(preparo.url, arte.blob);
    if (falhaDoEnvio) return setFalha(falhaDoEnvio);

    let registro;
    try {
      registro = await registrarArte(edicaoId, participacao.id, preparo.caminho, { ...estado, ...quem.valores });
    } catch (erro) {
      // O registro não respondeu: o arquivo não pode ficar no bucket sem autorização.
      await descartarArte(edicaoId, preparo.caminho).catch(() => {});
      return setFalha({ ...falhaDeRede("registrar", erro), codigo: "sem-resposta" });
    }
    if (!registro.ok) {
      setFalha(registro.falha);
      return registro.erros ? falhar(registro.erros, null) : undefined;
    }

    limpar();
    setAutorizacao({ autorizado_por: "", autorizado_em: hoje });
    const campoDoArquivo = form.current?.querySelector<HTMLInputElement>("input[type=file]");
    if (campoDoArquivo) campoDoArquivo.value = "";
    return registro.valores;
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSucesso(false);
    setErroGeral(null);
    setFalha(null);
    if (!imagem) {
      const validacao = validarParticipante(estado, { temArte });
      if (!validacao.ok) return falhar(validacao.erros, null);
    }

    setSalvando(true);
    try {
      let valores;
      if (imagem) {
        valores = await enviarComArte(imagem);
        if (!valores) return;
      } else {
        const resultado = await salvarParticipante(edicaoId, participacao.id, estado);
        if (!resultado.ok) return falhar(resultado.erros ?? {}, resultado.erro);
        valores = resultado.valores;
      }
      // O que o banco guardou (link do post limpo).
      setEstado(estadoDe(valores));
      setErros({});
      setSucesso(true);
      onSalvo();
    } catch {
      setErroGeral(ERRO_REDE);
    } finally {
      setSalvando(false);
    }
  }

  const campo = (nome: CampoParticipante) => ({
    id: `${prefixo}-${nome}`,
    "aria-invalid": erros[nome] ? true : undefined,
    "aria-describedby": erros[nome] ? `${prefixo}-${nome}-erro` : undefined,
  });

  return (
    <li>
      <details className="group rounded-xl border border-card-line bg-white">
        {/* Grade: no celular, as etiquetas descem para uma segunda linha e o nome nunca encolhe a zero. */}
        <summary className="grid cursor-pointer list-none grid-cols-[3rem_1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-xl px-4 py-3 sm:grid-cols-[3rem_1fr_auto_auto] [&::-webkit-details-marker]:hidden">
          <span className="text-[13.5px] font-semibold tabular-nums text-ink-3">
            {participacao.numero === null ? "—" : `Nº ${participacao.numero}`}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-espresso">{nome}</span>
            {participacao.nome_combo && (
              <span className="block truncate text-[13px] text-ink-3">{participacao.nome_combo}</span>
            )}
          </span>
          <span className="col-start-2 row-start-2 flex flex-wrap gap-1.5 empty:hidden sm:col-start-3 sm:row-start-1">
            {participacao.numero === null && <span className={etiquetaPendente}>Sem número</span>}
            {participacao.arte === null && <span className={etiquetaPendente}>Sem arte</span>}
            {cafe && !cafe.ativo && <span className={etiquetaNeutra}>Fora do ar</span>}
          </span>
          <ChevronDownIcon
            size={18}
            strokeWidth={2}
            className="col-start-3 row-start-1 text-ink-2 transition-transform group-open:rotate-180 sm:col-start-4"
          />
        </summary>

        <form ref={form} onSubmit={enviar} noValidate className="flex flex-col gap-4 border-t border-line px-4 pb-4 pt-4">
          {cafe && !cafe.ativo && (
            <p className="text-[13.5px] text-ink-2">
              Este café está fora do ar: não aparece no site, nem como participante.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div>
              <label htmlFor={`${prefixo}-numero`} className={labelClass}>
                Número
              </label>
              <input
                {...campo("numero")}
                inputMode="numeric"
                autoComplete="off"
                value={estado.numero}
                onChange={(e) => mudar("numero", e.target.value)}
                className={`${inputClass} ${invalidoClass}`}
              />
              <Erro id={`${prefixo}-numero-erro`} erro={erros.numero} className="mt-1.5" />
            </div>
            <div>
              <label htmlFor={`${prefixo}-nome_combo`} className={labelClass}>
                Nome curto do combo
              </label>
              <input
                {...campo("nome_combo")}
                maxLength={MAX_NOME_COMBO}
                autoComplete="off"
                placeholder="Espresso + bolo de rolo"
                value={estado.nome_combo}
                onChange={(e) => mudar("nome_combo", e.target.value)}
                className={`${inputClass} ${invalidoClass}`}
              />
              <Erro id={`${prefixo}-nome_combo-erro`} erro={erros.nome_combo} className="mt-1.5" />
            </div>
          </div>
          <CampoDaArte
            prefixo={prefixo}
            edicaoId={edicaoId}
            participacaoId={participacao.id}
            nome={nome}
            url={participacao.arte}
            registro={registro}
            hoje={hoje}
            imagem={imagem}
            convertendo={convertendo}
            erroArquivo={erroArquivo}
            escolher={(evento) => {
              setSucesso(false);
              setFalha(null);
              escolher(evento);
            }}
            autorizacao={autorizacao}
            mudarAutorizacao={mudarAutorizacao}
            erros={erros}
            onRemovida={onArteRemovida}
          />
          <div>
            <label htmlFor={`${prefixo}-alt`} className={labelClass}>
              Texto alternativo da arte{" "}
              <span className="font-normal text-ink-3">{temArte ? "(obrigatório)" : "(obrigatório quando houver arte)"}</span>
            </label>
            <textarea
              {...campo("alt")}
              rows={3}
              maxLength={MAX_ALT}
              placeholder="Transcreva o texto do combo que está na arte."
              value={estado.alt}
              onChange={(e) => mudar("alt", e.target.value)}
              className={`${inputClass} ${invalidoClass} h-auto py-2.5`}
            />
            <Erro id={`${prefixo}-alt-erro`} erro={erros.alt} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor={`${prefixo}-instagram_url`} className={labelClass}>
              Link do post no Instagram
            </label>
            <input
              {...campo("instagram_url")}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="instagram.com/p/…"
              value={estado.instagram_url}
              onChange={(e) => mudar("instagram_url", e.target.value)}
              className={`${inputClass} ${invalidoClass}`}
            />
            <Erro id={`${prefixo}-instagram_url-erro`} erro={erros.instagram_url} className="mt-1.5" />
          </div>

          <ErroDoEnvio falha={falha} voltarPara={`/admin/festivais/${edicaoId}`} objeto={ARTE} />
          <Erro erro={erroGeral} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" disabled={salvando || convertendo} className={botaoCtaClass}>
                {salvando ? (imagem ? "Enviando a arte…" : "Salvando…") : "Salvar"}
              </button>
              <p className="text-[14px] font-medium text-open empty:hidden">{sucesso ? "Salvo." : null}</p>
            </div>
            <button
              type="button"
              onClick={onRemover}
              className="text-[13.5px] font-semibold text-terracotta underline-offset-2 hover:underline"
            >
              Tirar da edição
            </button>
          </div>
        </form>
      </details>
    </li>
  );
}

/**
 * Confirmação de tirar o café da edição: some o selo, o filtro e o combo dele
 * no site. Foco começa em "Cancelar" — o destrutivo nunca é o padrão.
 */
function RemoverDialog({
  participacao,
  nome,
  edicaoId,
  onFechar,
  foco,
}: {
  participacao: Participacao | null;
  nome: string;
  edicaoId: string;
  onFechar: (removido: boolean) => void;
  foco: () => HTMLElement | null;
}) {
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const removido = useRef(false);
  const cancelar = useRef<HTMLButtonElement>(null);

  async function confirmar() {
    if (!participacao) return;
    setErro(null);
    setRemovendo(true);
    const resultado = await removerParticipante(edicaoId, participacao.id).catch(() => null);
    setRemovendo(false);
    if (!resultado?.ok) {
      setErro(resultado?.erro ?? ERRO_REDE);
      return;
    }
    removido.current = true;
    onFechar(true);
  }

  return (
    <Dialog.Root
      open={participacao !== null}
      onOpenChange={(aberto) => {
        if (!aberto && !removendo) {
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
            removido.current = false;
            cancelar.current?.focus();
          }}
          onCloseAutoFocus={(evento) => {
            // Cancelado, o foco volta a "Tirar da edição" (padrão do Radix); removido, o botão sumiu.
            if (!removido.current) return;
            evento.preventDefault();
            foco()?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-cream p-6 shadow-xl focus:outline-none"
        >
          <Dialog.Title className="font-display text-[21px] leading-[1.2] text-espresso">
            Tirar {nome} da edição?
          </Dialog.Title>
          <Dialog.Description className="mt-2.5 text-[14.5px] leading-[1.5] text-ink-2">
            O selo, o filtro e o combo dele saem do site. Número, nome do combo, texto alternativo e link do post são
            apagados.
          </Dialog.Description>
          <Erro erro={erro} className="mt-3" />
          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <button ref={cancelar} type="button" onClick={() => onFechar(false)} disabled={removendo} className={botaoNeutroClass}>
              Cancelar
            </button>
            <button type="button" onClick={confirmar} disabled={removendo} className={botaoCtaClass}>
              {removendo ? "Tirando…" : "Tirar da edição"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

"use client";

// Client: validação imediata (a mesma da Server Action), o ano que sai do início e o aviso de endereço novo.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { ResultadoCadastroEdicao, ResultadoSalvarEdicao } from "@/lib/admin/festivais-actions";
import type { FestivalCadastrado } from "@/lib/cafe-repository";
import { urlDaEdicao, type Edicao, type FestivalSlug } from "@/lib/festival";
import { MAX_DESCRICAO, validarEdicao, type CampoEdicao, type ErrosEdicao } from "@/lib/festival-dados";

import { Erro, botaoCtaClass, inputClass, labelClass } from "./form";

type Estado = { inicio: string; fim: string; preco: string; descricao: string };

/** Centavos → "34,90", o formato que o campo aceita de volta. */
const precoNoCampo = (centavos: number | null) => (centavos === null ? "" : (centavos / 100).toFixed(2).replace(".", ","));

const estadoDe = (edicao: Edicao): Estado => ({
  inicio: edicao.inicio,
  fim: edicao.fim,
  preco: precoNoCampo(edicao.preco),
  descricao: edicao.descricao ?? "",
});

const ESTADO_NOVO: Estado = { inicio: "", fim: "", preco: "", descricao: "" };

const invalidoClass = "aria-[invalid=true]:border-terracotta";
const dicaClass = "mt-1.5 text-[13px] text-ink-3";

type Props =
  | {
      /** Cadastro: escolhe o festival; o sucesso abre a edição. */
      festivais: FestivalCadastrado[];
      cadastrar: (festival: string, campos: unknown) => Promise<ResultadoCadastroEdicao>;
    }
  | {
      edicao: Edicao;
      /** Server Action já ligada à edição (`salvarEdicao.bind(null, id)`). */
      salvar: (campos: unknown) => Promise<ResultadoSalvarEdicao>;
    };

/**
 * Dados de uma edição (#102): início, fim, preço único e descrição. O ano não
 * é campo: sai do início (o banco exige). O festival só se escolhe no cadastro
 * — trocá-lo depois mudaria o endereço da página e misturaria os participantes.
 */
export function EdicaoForm(props: Props) {
  const edicao = "edicao" in props ? props.edicao : null;
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [festival, setFestival] = useState<FestivalSlug | "">("");
  const [estado, setEstado] = useState(() => (edicao ? estadoDe(edicao) : ESTADO_NOVO));
  const [erros, setErros] = useState<ErrosEdicao & { festival?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [focarErro, setFocarErro] = useState(false);

  // Depois de um envio com erro, o foco vai para o primeiro campo marcado.
  useEffect(() => {
    if (!focarErro) return;
    setFocarErro(false);
    form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [focarErro]);

  const ano = /^\d{4}-/.test(estado.inicio) ? Number(estado.inicio.slice(0, 4)) : null;
  const enderecoNovo = edicao?.publicada && ano !== null && ano !== edicao.ano ? urlDaEdicao({ ...edicao, ano }) : null;

  function mudar(campo: CampoEdicao, valor: string) {
    setEstado((e) => ({ ...e, [campo]: valor }));
    setSucesso(false);
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }));
  }

  function falhar(novos: typeof erros, geral: string | null) {
    setErros(novos);
    setErroGeral(geral);
    if (Object.keys(novos).length > 0) setFocarErro(true);
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSucesso(false);
    setErroGeral(null);

    const validacao = validarEdicao(estado);
    const semFestival = !edicao && !festival;
    if (!validacao.ok || semFestival) {
      return falhar(
        { ...(semFestival && { festival: "Escolha o festival." }), ...(validacao.ok ? {} : validacao.erros) },
        null,
      );
    }

    setSalvando(true);
    let indo = false;
    try {
      if ("cadastrar" in props) {
        const resultado = await props.cadastrar(festival, estado);
        if (!resultado.ok) return falhar(resultado.erros ?? {}, resultado.erro);
        // Fica "Salvando…" até a edição abrir: nada de cadastrar duas vezes.
        indo = true;
        router.push(`/admin/festivais/${resultado.id}?nova=1`);
        return;
      }
      const resultado = await props.salvar(estado);
      if (!resultado.ok) return falhar(resultado.erros ?? {}, resultado.erro);
      setErros({});
      setSucesso(true);
    } catch {
      setErroGeral("Não deu para falar com o servidor. Confira a conexão e tente de novo.");
    } finally {
      if (!indo) setSalvando(false);
    }
  }

  const campo = (nome: CampoEdicao) => ({
    id: `edicao-${nome}`,
    "aria-invalid": erros[nome] ? true : undefined,
    "aria-describedby": erros[nome] ? `edicao-${nome}-erro` : undefined,
  });

  return (
    <form ref={form} onSubmit={enviar} noValidate className="mt-6 flex flex-col gap-5">
      {"festivais" in props && (
        <div>
          <label htmlFor="edicao-festival" className={labelClass}>
            Festival
          </label>
          <select
            id="edicao-festival"
            value={festival}
            onChange={(e) => {
              setFestival(e.target.value as FestivalSlug);
              setErros((atual) => ({ ...atual, festival: undefined }));
            }}
            aria-invalid={erros.festival ? true : undefined}
            aria-describedby={erros.festival ? "edicao-festival-erro" : undefined}
            className={`${inputClass} ${invalidoClass} max-w-[320px]`}
          >
            <option value="">Escolha…</option>
            {props.festivais.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.nome}
              </option>
            ))}
          </select>
          <Erro id="edicao-festival-erro" erro={erros.festival} className="mt-1.5" />
        </div>
      )}

      <div>
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4 md:max-w-[560px]">
          <div>
            <label htmlFor="edicao-inicio" className={labelClass}>
              Início
            </label>
            <input
              {...campo("inicio")}
              type="date"
              value={estado.inicio}
              onChange={(e) => mudar("inicio", e.target.value)}
              className={`${inputClass} ${invalidoClass}`}
            />
            <Erro id="edicao-inicio-erro" erro={erros.inicio} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="edicao-fim" className={labelClass}>
              Fim <span className="font-normal text-ink-3">(último dia)</span>
            </label>
            <input
              {...campo("fim")}
              type="date"
              value={estado.fim}
              min={estado.inicio || undefined}
              onChange={(e) => mudar("fim", e.target.value)}
              className={`${inputClass} ${invalidoClass}`}
            />
            <Erro id="edicao-fim-erro" erro={erros.fim} className="mt-1.5" />
          </div>
        </div>
        <p className={dicaClass}>
          {ano ? `Edição ${ano} — o ano sai do início.` : "O ano da edição sai da data de início."}
          {enderecoNovo && (
            <>
              {" "}
              <strong className="font-semibold text-terracotta">
                Ao salvar, a página da edição muda para {enderecoNovo}.
              </strong>
            </>
          )}
        </p>
      </div>

      <div className="max-w-[240px]">
        <label htmlFor="edicao-preco" className={labelClass}>
          Preço único do combo
        </label>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-ink-3">
            R$
          </span>
          <input
            {...campo("preco")}
            inputMode="decimal"
            autoComplete="off"
            placeholder="34,90"
            value={estado.preco}
            onChange={(e) => mudar("preco", e.target.value)}
            className={`${inputClass} ${invalidoClass} pl-10`}
          />
        </div>
        <Erro id="edicao-preco-erro" erro={erros.preco} className="mt-1.5" />
        <p className={dicaClass}>Obrigatório para publicar.</p>
      </div>

      <div>
        <label htmlFor="edicao-descricao" className={labelClass}>
          Descrição
        </label>
        <textarea
          {...campo("descricao")}
          rows={3}
          maxLength={MAX_DESCRICAO}
          value={estado.descricao}
          onChange={(e) => mudar("descricao", e.target.value)}
          className={`${inputClass} ${invalidoClass} h-auto py-2.5`}
        />
        <Erro id="edicao-descricao-erro" erro={erros.descricao} className="mt-1.5" />
        <p className={dicaClass}>Aparece no topo da página do festival.</p>
      </div>

      <Erro erro={erroGeral} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={salvando} className={botaoCtaClass}>
          {salvando ? "Salvando…" : edicao ? "Salvar dados" : "Cadastrar edição"}
        </button>
        <p role="status" className="text-[14px] font-medium text-open empty:hidden">
          {sucesso ? (edicao?.publicada ? "Salvo. A mudança já está no site." : "Salvo.") : null}
        </p>
      </div>
    </form>
  );
}

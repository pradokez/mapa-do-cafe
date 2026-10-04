"use client";

// Client: validação imediata (a mesma da Server Action), horário estruturado,
// coordenadas do link do Maps e aviso de alterações não salvas.
import { useEffect, useMemo, useRef, useState } from "react";

import { ATRIBUTOS, SELOS } from "@/components/cafe-atributos";
import type { ResultadoCoordenadas, ResultadoSalvar } from "@/lib/admin/cafe-actions";
import type { DiaSemana } from "@/lib/cafe";
import {
  BOOLEANOS,
  CIDADES,
  FAIXAS,
  MAX_TEXTO,
  horarioDosTurnos,
  parDeCoordenadas,
  slugify,
  turnosDoHorario,
  validarDadosCafe,
  type CampoDados,
  type DadosCafe,
  type ErrosDados,
  type HorarioDia,
} from "@/lib/cafe-dados";
import { DIAS_DA_SEMANA } from "@/lib/cafe-hours";
import { faixaPrecoNome } from "@/lib/format";

import { Erro, inputClass, labelClass } from "./form";
import { HorarioEditor, type Horario } from "./horario-editor";

type Booleano = (typeof BOOLEANOS)[number];

/** O que o formulário edita: números como texto (aceita vírgula), horário em turnos. */
type Estado = Omit<DadosCafe, "lat" | "lng" | "bairro_slug" | "horario_funcionamento" | "instagram" | "telefone"> & {
  lat: string;
  lng: string;
  instagram: string;
  telefone: string;
  horario: Horario;
};

function estadoDe(cafe: DadosCafe): Estado {
  return {
    nome: cafe.nome,
    bairro: cafe.bairro,
    endereco: cafe.endereco,
    cidade: cafe.cidade,
    lat: String(cafe.lat),
    lng: String(cafe.lng),
    ...(Object.fromEntries(BOOLEANOS.map((campo) => [campo, cafe[campo]])) as Record<Booleano, boolean>),
    tem_ar_condicionado: cafe.tem_ar_condicionado,
    faixa_preco: cafe.faixa_preco,
    instagram: cafe.instagram ?? "",
    telefone: cafe.telefone ?? "",
    horario: Object.fromEntries(
      DIAS_DA_SEMANA.map((dia) => [dia, turnosDoHorario(cafe.horario_funcionamento[dia])]),
    ) as Horario,
  };
}

/** O payload da Server Action — o mesmo que `validarDadosCafe` confere aqui e lá. */
function payloadDe({ horario, ...resto }: Estado) {
  return {
    ...resto,
    horario_funcionamento: Object.fromEntries(DIAS_DA_SEMANA.map((dia) => [dia, horarioDosTurnos(horario[dia])])),
  };
}

const ROTULO_BOOLEANO = Object.fromEntries([...SELOS, ...ATRIBUTOS].map(({ key, label }) => [key, label])) as Record<
  Booleano,
  string
>;
const SELOS_KEYS: Booleano[] = ["selo_ascape", "selo_eu_amo_cafe"];
const COMODIDADES_KEYS = BOOLEANOS.filter((key) => !SELOS_KEYS.includes(key));

const AR_CONDICIONADO = [
  { valor: true, rotulo: "Tem" },
  { valor: false, rotulo: "Não tem" },
  { valor: null, rotulo: "Sem informação" },
] as const;

/** Os erros, menos os dos campos que acabaram de mudar. */
function semErros(erros: ErrosDados, tirar: (campo: string) => boolean): ErrosDados {
  return Object.fromEntries(Object.entries(erros).filter(([campo]) => !tirar(campo)));
}

const legendClass = "mb-3 text-[15px] font-semibold text-espresso";
const opcaoClass = "flex min-h-11 cursor-pointer items-center gap-2 text-[15px] text-espresso";
const marcaClass = "size-[18px] shrink-0 accent-terracotta";
const invalidoClass = "aria-[invalid=true]:border-terracotta";

type Props = {
  cafe: DadosCafe;
  /** Server Action já ligada ao café (`salvarDadosCafe.bind(null, id)`); o cadastro (#53) passa a sua. */
  salvar: (campos: unknown) => Promise<ResultadoSalvar>;
  buscarCoordenadas: (link: string) => Promise<ResultadoCoordenadas>;
  /** Café no ar: o sucesso diz que a mudança já está no site. */
  ativo: boolean;
};

export function DadosCafeForm({ cafe, salvar, buscarCoordenadas, ativo }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [salvo, setSalvo] = useState(() => estadoDe(cafe));
  const [estado, setEstado] = useState(salvo);
  const [erros, setErros] = useState<ErrosDados>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [focarErro, setFocarErro] = useState(false);

  const [link, setLink] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);

  const sujo = useMemo(() => JSON.stringify(estado) !== JSON.stringify(salvo), [estado, salvo]);

  // Sair da página (fechar a aba, recarregar) com alteração não salva pede confirmação.
  useEffect(() => {
    if (!sujo) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sujo]);

  // Depois de um envio com erro, o foco vai para o primeiro campo marcado (na ordem da tela).
  useEffect(() => {
    if (!focarErro) return;
    setFocarErro(false);
    form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [focarErro]);

  function mudar<K extends keyof Estado>(campo: K, valor: Estado[K], erro: CampoDados = campo as CampoDados) {
    setEstado((e) => ({ ...e, [campo]: valor }));
    setSucesso(false);
    if (erros[erro]) setErros((atual) => semErros(atual, (campo) => campo === erro));
  }

  function mudarHorario(dia: DiaSemana, valor: HorarioDia) {
    mudar("horario", { ...estado.horario, [dia]: valor }, `horario.${dia}`);
  }

  function repetirSegunda() {
    const segunda = estado.horario.segunda;
    const horario = Object.fromEntries(
      DIAS_DA_SEMANA.map((dia) => [dia, { fechado: segunda.fechado, turnos: segunda.turnos.map((t) => ({ ...t })) }]),
    ) as Horario;
    setEstado((e) => ({ ...e, horario }));
    setSucesso(false);
    setErros((atual) => semErros(atual, (campo) => campo.startsWith("horario.")));
  }

  function colarCoordenadas(evento: React.ClipboardEvent<HTMLInputElement>) {
    const par = parDeCoordenadas(evento.clipboardData.getData("text"));
    if (!par) return;
    evento.preventDefault();
    preencherCoordenadas(par.lat, par.lng);
  }

  function preencherCoordenadas(lat: number, lng: number) {
    setEstado((e) => ({ ...e, lat: String(lat), lng: String(lng) }));
    setSucesso(false);
    setErros((atual) => semErros(atual, (campo) => campo === "lat" || campo === "lng"));
  }

  async function buscar() {
    setErroLink(null);
    setBuscando(true);
    try {
      const resultado = await buscarCoordenadas(link);
      if (resultado.ok) {
        preencherCoordenadas(resultado.coordenadas.lat, resultado.coordenadas.lng);
        setLink("");
      } else {
        setErroLink(resultado.erro);
      }
    } catch {
      setErroLink("Não deu para buscar agora. Tente de novo ou preencha lat e lng à mão.");
    } finally {
      setBuscando(false);
    }
  }

  function falhar(novosErros: ErrosDados, geral: string | null) {
    setErros(novosErros);
    setErroGeral(geral);
    if (Object.keys(novosErros).length > 0) setFocarErro(true);
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSucesso(false);
    setErroGeral(null);

    const payload = payloadDe(estado);
    const validacao = validarDadosCafe(payload);
    if (!validacao.ok) return falhar(validacao.erros, null);

    setSalvando(true);
    try {
      const resultado = await salvar(payload);
      if (!resultado.ok) return falhar(resultado.erros ?? {}, resultado.erro);
      // O que o banco guardou, já normalizado (telefone formatado, Instagram em URL).
      const novo = estadoDe(resultado.cafe);
      setSalvo(novo);
      setEstado(novo);
      setErros({});
      setSucesso(true);
    } catch {
      setErroGeral("Não deu para salvar agora. Tente de novo em instantes.");
    } finally {
      setSalvando(false);
    }
  }

  const id = (campo: string) => `dados-${campo}`;
  const aria = (campo: CampoDados, dica?: string) => ({
    "aria-invalid": erros[campo] ? true : undefined,
    "aria-describedby": [dica, erros[campo] ? `erro-${id(campo)}` : null].filter(Boolean).join(" ") || undefined,
  });
  const erroDe = (campo: CampoDados) => <Erro id={`erro-${id(campo)}`} erro={erros[campo]} className="mt-1.5" />;

  const totalErros = Object.keys(erros).length;
  const errosHorario = Object.fromEntries(
    DIAS_DA_SEMANA.flatMap((dia) => (erros[`horario.${dia}`] ? [[dia, erros[`horario.${dia}`]]] : [])),
  );
  const bairroSlug = slugify(estado.bairro);

  const texto = (campo: "nome" | "endereco" | "bairro", rotulo: string, dica?: React.ReactNode) => (
    <div>
      <label htmlFor={id(campo)} className={labelClass}>
        {rotulo}
      </label>
      <input
        id={id(campo)}
        type="text"
        required
        maxLength={MAX_TEXTO[campo]}
        value={estado[campo]}
        onChange={(e) => mudar(campo, e.target.value)}
        {...aria(campo, dica ? `dica-${id(campo)}` : undefined)}
        className={`${inputClass} ${invalidoClass}`}
      />
      {dica && (
        <p id={`dica-${id(campo)}`} className="mt-1.5 text-[12.5px] text-ink-3">
          {dica}
        </p>
      )}
      {erroDe(campo)}
    </div>
  );

  const checkbox = (campo: Booleano) => (
    <div key={campo}>
      <label className={opcaoClass}>
        <input
          type="checkbox"
          checked={estado[campo]}
          onChange={(e) => mudar(campo, e.target.checked)}
          {...aria(campo)}
          className={marcaClass}
        />
        {ROTULO_BOOLEANO[campo]}
      </label>
      {erroDe(campo)}
    </div>
  );

  return (
    <form ref={form} onSubmit={enviar} noValidate className="mt-4 flex flex-col gap-8">
      {totalErros > 0 && (
        <p role="alert" className="rounded-lg bg-seal-bg px-4 py-3 text-[14px] font-medium text-seal-fg">
          {totalErros === 1 ? "Corrija o campo marcado." : `Corrija os ${totalErros} campos marcados.`}
        </p>
      )}

      <fieldset disabled={salvando} className="contents">
        <fieldset>
          <legend className={legendClass}>Identificação</legend>
          <div className="flex flex-col gap-5">
            {texto("nome", "Nome")}
            <div className="grid gap-5 sm:grid-cols-2">
              {texto(
                "bairro",
                "Bairro",
                bairroSlug ? (
                  <>
                    Filtro: <code>{bairroSlug}</code>
                  </>
                ) : undefined,
              )}
              <div>
                <label htmlFor={id("cidade")} className={labelClass}>
                  Cidade
                </label>
                <select
                  id={id("cidade")}
                  value={estado.cidade}
                  onChange={(e) => mudar("cidade", e.target.value as Estado["cidade"])}
                  {...aria("cidade")}
                  className={`${inputClass} ${invalidoClass}`}
                >
                  {CIDADES.map((cidade) => (
                    <option key={cidade}>{cidade}</option>
                  ))}
                </select>
                {erroDe("cidade")}
              </div>
            </div>
            {texto("endereco", "Endereço")}
          </div>
        </fieldset>

        <fieldset>
          <legend className={legendClass}>Localização</legend>
          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor={id("link-maps")} className={labelClass}>
                Link do Google Maps{" "}
                <span className="font-normal text-ink-3">(opcional, só para preencher lat e lng)</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={id("link-maps")}
                  type="url"
                  inputMode="url"
                  placeholder="https://maps.app.goo.gl/…"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setErroLink(null);
                  }}
                  aria-invalid={erroLink ? true : undefined}
                  aria-describedby={erroLink ? "erro-dados-link-maps" : undefined}
                  className={`${inputClass} ${invalidoClass}`}
                />
                <button
                  type="button"
                  onClick={buscar}
                  disabled={buscando || !link.trim()}
                  className="h-11 shrink-0 rounded-full border border-line-strong bg-white px-5 text-[14px] font-semibold text-espresso hover:bg-hover-soft disabled:opacity-60"
                >
                  {buscando ? "Buscando…" : "Buscar coordenadas"}
                </button>
              </div>
              <Erro id="erro-dados-link-maps" erro={erroLink} className="mt-1.5" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {(["lat", "lng"] as const).map((campo) => (
                <div key={campo}>
                  <label htmlFor={id(campo)} className={labelClass}>
                    {campo === "lat" ? "Latitude" : "Longitude"}
                  </label>
                  <input
                    id={id(campo)}
                    type="text"
                    inputMode="decimal"
                    required
                    value={estado[campo]}
                    onChange={(e) => mudar(campo, e.target.value)}
                    onPaste={colarCoordenadas}
                    {...aria(campo, "dica-dados-coordenadas")}
                    className={`${inputClass} tabular-nums ${invalidoClass}`}
                  />
                  {erroDe(campo)}
                </div>
              ))}
            </div>
            <p id="dica-dados-coordenadas" className="-mt-3 text-[12.5px] text-ink-3">
              Colar o par copiado do Google Maps (<code>-8.0631, -34.8711</code>) preenche os dois campos.
            </p>
          </div>
        </fieldset>

        <fieldset>
          <legend className={legendClass}>Selos</legend>
          <div className="grid gap-x-6 sm:grid-cols-2">{SELOS_KEYS.map(checkbox)}</div>
        </fieldset>

        <fieldset>
          <legend className={legendClass}>Comodidades</legend>
          <div className="grid gap-x-6 sm:grid-cols-2">{COMODIDADES_KEYS.map(checkbox)}</div>
          <fieldset className="mt-3" {...aria("tem_ar_condicionado")}>
            <legend className={labelClass}>Ar-condicionado</legend>
            <div className="flex flex-wrap gap-x-6">
              {AR_CONDICIONADO.map(({ valor, rotulo }) => (
                <label key={rotulo} className={opcaoClass}>
                  <input
                    type="radio"
                    name="tem_ar_condicionado"
                    checked={estado.tem_ar_condicionado === valor}
                    onChange={() => mudar("tem_ar_condicionado", valor)}
                    className={marcaClass}
                  />
                  {rotulo}
                </label>
              ))}
            </div>
            {erroDe("tem_ar_condicionado")}
          </fieldset>
        </fieldset>

        <fieldset {...aria("faixa_preco")}>
          <legend className={legendClass}>Faixa de preço</legend>
          <div className="flex flex-wrap gap-x-6">
            {FAIXAS.map((faixa) => (
              <label key={faixa} className={opcaoClass}>
                <input
                  type="radio"
                  name="faixa_preco"
                  checked={estado.faixa_preco === faixa}
                  onChange={() => mudar("faixa_preco", faixa)}
                  className={marcaClass}
                />
                <span>
                  <span className="font-semibold">{faixa}</span> {faixaPrecoNome(faixa)}
                </span>
              </label>
            ))}
          </div>
          {erroDe("faixa_preco")}
        </fieldset>

        <fieldset>
          <legend className={legendClass}>Horário de funcionamento</legend>
          <HorarioEditor
            horario={estado.horario}
            erros={errosHorario}
            onChange={mudarHorario}
            onRepetir={repetirSegunda}
          />
        </fieldset>

        <fieldset>
          <legend className={legendClass}>Contato</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={id("instagram")} className={labelClass}>
                Instagram <span className="font-normal text-ink-3">(opcional)</span>
              </label>
              <input
                id={id("instagram")}
                type="text"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="@cafe ou link do perfil"
                value={estado.instagram}
                onChange={(e) => mudar("instagram", e.target.value)}
                {...aria("instagram")}
                className={`${inputClass} ${invalidoClass}`}
              />
              {erroDe("instagram")}
            </div>
            <div>
              <label htmlFor={id("telefone")} className={labelClass}>
                Telefone <span className="font-normal text-ink-3">(opcional)</span>
              </label>
              <input
                id={id("telefone")}
                type="tel"
                inputMode="tel"
                placeholder="(81) 99999-9999"
                value={estado.telefone}
                onChange={(e) => mudar("telefone", e.target.value)}
                {...aria("telefone")}
                className={`${inputClass} ${invalidoClass}`}
              />
              {erroDe("telefone")}
            </div>
          </div>
        </fieldset>
      </fieldset>

      <div className="sticky bottom-0 -mx-5 -mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-b-xl border-t border-line bg-white px-5 py-3">
        <button
          type="submit"
          disabled={salvando}
          className="h-[46px] rounded-full bg-terracotta px-6 text-[14.5px] font-semibold text-on-terracotta transition-colors hover:bg-terracotta-hover disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
        <Erro erro={erroGeral} />
        {sucesso && (
          <p role="status" className="text-[14px] font-medium text-open">
            {ativo ? "Salvo. Já está no site." : "Salvo."}
          </p>
        )}
        {sujo && !salvando && !sucesso && <p className="text-[13.5px] text-ink-3">Alterações não salvas</p>}
      </div>
    </form>
  );
}

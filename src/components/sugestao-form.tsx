"use client";

// Client pelo contador, pela dica que muda com o tipo, pela validação antes de
// enviar e pelo botão pendente. Sem JS, o formulário funciona igual: a Server
// Action valida e a página volta com os erros e o texto (`useFormState`).
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFormState, useFormStatus } from "react-dom";

import {
  BugIcon,
  CheckIcon,
  ClockIcon,
  InfoIcon,
  LightbulbIcon,
  LockIcon,
  MapIcon,
  MessageCircleIcon,
} from "@/components/icons";
import {
  contadorDaMensagem,
  DICA_SEM_TIPO,
  ENVIO_INICIAL,
  ehTipoSugestao,
  ERRO_MENSAGEM_LONGA,
  SOBRE_O_TIPO,
  TIPOS_SUGESTAO,
  validarSugestao,
  type ErrosSugestao,
} from "@/lib/sugestao";
import { enviarSugestao } from "@/lib/sugestoes-actions";

const ICONE_DO_TIPO = { sugestao: LightbulbIcon, problema: BugIcon, outro: MessageCircleIcon };

/** O contador fica laranja perto do limite. */
const PERTO_DO_LIMITE = 100;

type Props = {
  /** `/` ou `/cafes/{slug}`, já conferida pela página; `null` sem origem conhecida. */
  origem: string | null;
  /** Como a nota de privacidade chama a origem ("a lista de cafés", o nome do café). */
  nomeDaOrigem: string | null;
};

export function SugestaoForm({ origem, nomeDaOrigem }: Props) {
  const [envio, enviar] = useFormState(enviarSugestao, ENVIO_INICIAL);
  const [tipo, setTipo] = useState(envio.valores.tipo);
  const [mensagem, setMensagem] = useState(envio.valores.mensagem);
  const [erros, setErros] = useState<ErrosSugestao>(envio.erros);

  // Resposta nova do servidor: os erros dela substituem os da tela.
  const [ultimoEnvio, setUltimoEnvio] = useState(envio);
  if (envio !== ultimoEnvio) {
    setUltimoEnvio(envio);
    setErros(envio.erros);
  }

  const tipoRef = useRef<HTMLInputElement>(null);
  const mensagemRef = useRef<HTMLTextAreaElement>(null);
  const sucessoRef = useRef<HTMLHeadingElement>(null);

  const focarPrimeiroErro = (e: ErrosSugestao) => {
    if (e.tipo) tipoRef.current?.focus();
    else if (e.mensagem) mensagemRef.current?.focus();
  };

  // Depois da resposta, o foco vai para o que mudou: o título do sucesso ou o
  // primeiro campo com erro. A caixa de limite se anuncia sozinha (`alert`).
  useEffect(() => {
    if (envio.status === "enviado") sucessoRef.current?.focus();
    if (envio.status === "erro") focarPrimeiroErro(envio.erros);
  }, [envio]);

  // Com JS, o erro aparece sem ida ao servidor. O servidor valida de novo.
  const validarAntes = (evento: FormEvent<HTMLFormElement>) => {
    const r = validarSugestao({ tipo, mensagem });
    if (r.ok || r.robo) return;
    evento.preventDefault();
    setErros(r.erros);
    focarPrimeiroErro(r.erros);
  };

  if (envio.status === "enviado") {
    return <Sucesso origem={origem} tituloRef={sucessoRef} />;
  }

  const sobre = ehTipoSugestao(tipo) ? SOBRE_O_TIPO[tipo] : null;
  const contador = contadorDaMensagem(mensagem);
  // Passou do limite: avisa já, sem esperar o envio — é o que o leitor de tela anuncia.
  const erroMensagem = erros.mensagem ?? (contador.restantes < 0 ? ERRO_MENSAGEM_LONGA : undefined);
  const corDoContador =
    contador.restantes < 0 ? "text-erro" : contador.restantes <= PERTO_DO_LIMITE ? "text-terracotta" : "text-ink-3";

  return (
    <>
      <div className="flex flex-col gap-2 lg:gap-2.5">
        <h1 className="font-display text-[32px] leading-[1.1] text-espresso lg:text-[40px]">Sugestões</h1>
        <p className="text-pretty text-[15px] leading-[1.5] text-ink-2 lg:text-base lg:leading-[1.55]">
          Uma ideia para o site ou algo que não funcionou direito? Escreva aqui. Toda mensagem é lida, mas não há
          resposta por este canal.
        </p>
      </div>

      <form
        action={enviar}
        onSubmit={validarAntes}
        noValidate
        className="relative flex flex-col gap-5 lg:gap-[22px] lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:p-7 lg:shadow-[0_1px_2px_rgba(44,26,14,.06)]"
      >
        <fieldset aria-describedby={erros.tipo ? "erro-tipo" : undefined} className="flex flex-col gap-2 lg:gap-2.5">
          <legend className="mb-2 text-sm font-semibold text-espresso lg:mb-2.5">Sobre o quê?</legend>
          <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
            {TIPOS_SUGESTAO.map((valor, i) => {
              const Icone = ICONE_DO_TIPO[valor];
              return (
                <label
                  key={valor}
                  className={`flex h-[52px] cursor-pointer flex-col items-center justify-center gap-[3px] rounded-xl border bg-white text-[13px] font-medium text-espresso transition-colors has-[:checked]:border-espresso has-[:checked]:bg-espresso has-[:checked]:text-cream has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terracotta lg:h-12 lg:flex-row lg:gap-2 lg:text-[14.5px] ${
                    erros.tipo ? "border-erro" : "border-line-strong hover:bg-hover-soft"
                  }`}
                >
                  <input
                    ref={i === 0 ? tipoRef : undefined}
                    type="radio"
                    name="tipo"
                    value={valor}
                    checked={tipo === valor}
                    onChange={() => {
                      setTipo(valor);
                      setErros((atuais) => ({ ...atuais, tipo: undefined }));
                    }}
                    className="sr-only"
                  />
                  <Icone size={17} strokeWidth={2} />
                  {SOBRE_O_TIPO[valor].rotulo}
                </label>
              );
            })}
          </div>
          {erros.tipo && (
            <p id="erro-tipo" className="text-[13px] text-erro">
              {erros.tipo}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5 lg:gap-2">
          <label htmlFor="mensagem" className="text-sm font-semibold text-espresso">
            Sua mensagem
          </label>
          <p id="dica-mensagem" className="text-[13px] leading-[1.45] text-ink-3 lg:text-[13.5px] lg:leading-[1.5]">
            {sobre?.dica ?? DICA_SEM_TIPO}
          </p>
          <textarea
            ref={mensagemRef}
            id="mensagem"
            name="mensagem"
            rows={6}
            value={mensagem}
            onChange={(e) => {
              setMensagem(e.target.value);
              setErros((atuais) => ({ ...atuais, mensagem: undefined }));
            }}
            placeholder={sobre?.placeholder ?? "Escreva aqui"}
            aria-invalid={erroMensagem ? true : undefined}
            aria-describedby="dica-mensagem erro-mensagem contador-mensagem"
            className={`min-h-[150px] resize-none rounded-xl border bg-white px-3.5 py-3 text-base leading-[1.5] text-espresso transition-[border-color,box-shadow] placeholder:text-placeholder focus:border-terracotta focus:shadow-[0_0_0_3px_rgba(181,86,47,.18)] focus:outline-none lg:min-h-[168px] lg:resize-y lg:bg-[#FFFDFB] lg:px-4 lg:py-3.5 lg:leading-[1.55] ${
              erroMensagem ? "border-erro" : "border-line-strong"
            }`}
          />
          <div className="flex justify-between gap-2.5 text-[12.5px] lg:gap-3 lg:text-[13px]">
            <p id="erro-mensagem" aria-live="polite" className="text-erro">
              {erroMensagem}
            </p>
            <p id="contador-mensagem" className={`flex-none tabular-nums ${corDoContador}`}>
              {contador.rotulo}
            </p>
          </div>
        </div>

        {/* Honeypot: ninguém vê nem alcança por Tab; robô que preenche tudo cai aqui. */}
        <input
          type="text"
          name="site"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] size-px"
        />
        <input type="hidden" name="origem" value={origem ?? ""} />

        <div className="flex gap-2.5 rounded-xl bg-hover-soft px-3.5 py-3 text-[13px] leading-[1.45] text-ink-2 lg:gap-3 lg:px-4 lg:py-3.5 lg:text-[13.5px] lg:leading-[1.5]">
          <LockIcon size={16} strokeWidth={2} className="mt-0.5 flex-none" />
          <div className="flex flex-col gap-1">
            <p>
              <strong className="font-semibold text-espresso">Você não precisa se identificar.</strong> Evite colocar
              email, telefone ou outros dados pessoais no texto.
            </p>
            {/* Desvio consciente: o design só mostra a origem no desktop. É informação de privacidade. */}
            {nomeDaOrigem && (
              <p className="text-ink-3">
                Junto vai só a página de onde você veio:{" "}
                <span className="font-medium text-ink-2">{nomeDaOrigem}</span>.
              </p>
            )}
          </div>
        </div>

        {envio.status === "limite" && (
          <CaixaDeAviso Icone={ClockIcon} titulo="Opa, muitas mensagens seguidas.">
            Espere um pouco e tente de novo. Seu texto continua aqui.
          </CaixaDeAviso>
        )}
        {/* Não está no design: banco fora do ar ou envio recusado por configuração. */}
        {envio.status === "falha" && (
          <CaixaDeAviso Icone={InfoIcon} titulo="Não deu para enviar agora.">
            Tente de novo em alguns minutos. Seu texto continua aqui.
          </CaixaDeAviso>
        )}

        <div className="flex lg:justify-end">
          <BotaoEnviar />
        </div>
      </form>
    </>
  );
}

/** Caixa de limite (e de falha): anuncia ao aparecer, sem tirar o foco do formulário. */
function CaixaDeAviso({
  Icone,
  titulo,
  children,
}: {
  Icone: typeof ClockIcon;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <p
      role="alert"
      className="flex gap-2.5 rounded-xl border border-aviso-line bg-aviso-bg px-3.5 py-3 text-[13px] leading-[1.45] text-aviso-fg lg:gap-3 lg:px-4 lg:py-3.5 lg:text-[13.5px] lg:leading-[1.5]"
    >
      <Icone size={16} strokeWidth={2} className="mt-0.5 flex-none" />
      <span>
        <strong className="font-semibold">{titulo}</strong> {children}
      </span>
    </p>
  );
}

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-[52px] w-full rounded-full bg-terracotta text-base font-semibold text-on-terracotta transition-colors hover:bg-terracotta-hover disabled:opacity-70 lg:h-12 lg:w-auto lg:px-[26px] lg:text-[15px]"
    >
      {pending ? "Enviando…" : "Enviar mensagem"}
    </button>
  );
}

/**
 * "Recebido, obrigado!" no lugar do título e do formulário. Sem promessa de
 * resposta. "Enviar outra" é link comum: recarrega a página e começa do zero,
 * com ou sem JS.
 */
function Sucesso({ origem, tituloRef }: { origem: string | null; tituloRef: React.Ref<HTMLHeadingElement> }) {
  const outra = origem ? `/sugestoes?de=${encodeURIComponent(origem)}` : "/sugestoes";
  return (
    <div
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-3 px-2 pb-[60px] text-center lg:flex-none lg:gap-3.5 lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:px-10 lg:pb-12 lg:pt-14"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-hover-soft text-terracotta">
        <CheckIcon size={26} strokeWidth={2.2} />
      </span>
      <h1 ref={tituloRef} tabIndex={-1} className="font-display text-[28px] text-espresso focus:outline-none lg:text-[32px]">
        Recebido, obrigado!
      </h1>
      <p className="max-w-[400px] text-pretty text-[15px] leading-[1.5] text-ink-2 lg:text-[15.5px] lg:leading-[1.55]">
        Sua mensagem chegou e vai ser lida. Não tem resposta por aqui, mas ela ajuda a deixar o mapa melhor.
      </p>
      <div className="mt-3 flex w-full flex-col items-center gap-0 lg:mt-2.5 lg:w-auto lg:flex-row lg:gap-[18px]">
        <Link
          href="/"
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-espresso px-6 text-base font-semibold text-cream lg:h-12 lg:w-auto lg:text-[15px]"
        >
          <MapIcon size={17} strokeWidth={2} className="hidden lg:block" />
          Voltar ao mapa
        </Link>
        <a
          href={outra}
          className="inline-flex min-h-11 items-center text-sm font-medium text-ink-2 underline underline-offset-[3px] hover:text-terracotta lg:min-h-0"
        >
          Enviar outra
        </a>
      </div>
    </div>
  );
}

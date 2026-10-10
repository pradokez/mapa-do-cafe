"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { CHIP_OFF, CHIP_ON } from "@/components/filter-chip";
import { CoffeeIcon, CopyIcon, XIcon } from "@/components/icons";
import { APOIO_BOTAO_DESKTOP, APOIO_BOTAO_MOBILE } from "@/components/medidas";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { brCodePix, rotuloDoValor, VALOR_PADRAO, VALORES_DE_APOIO, type ConfigDoPix, type ValorDeApoio } from "@/lib/pix";
import { qrSvg } from "@/lib/qr-svg";

type Variante = "desktop" | "mobile";
type Props = { config: ConfigDoPix; variante: Variante };

const TITULO = "Me paga um café?";
const TEXTO: Record<Variante, string> = {
  desktop:
    "O Mapa do Café é feito por uma pessoa só, no tempo livre. Se ele te ajudou a achar um cantinho bom, qualquer valor ajuda o projeto a continuar existindo e crescer.",
  mobile:
    "O Mapa do Café é feito por uma pessoa só, no tempo livre. Qualquer valor ajuda o projeto a continuar existindo e crescer.",
};
const COPIADO: Record<Variante, string> = { desktop: "Copiado!", mobile: "Código copiado!" };
/** Quanto tempo o "Copiado!" fica no botão. */
const CONFIRMACAO_MS = 1800;

const nadaAssinar = () => () => {};

/**
 * "Me paga um café?" (#121, PRD #119): botão do header da home que abre o
 * apoio por Pix — modal no desktop, bottom sheet no mobile — com os valores, o
 * QR e o copia e cola do valor escolhido. O código sai do `pix`; o QR, do
 * `qr-svg`, carregado só quando abre. Estado (aberto, valor) local, fora da URL.
 *
 * Só depois da hidratação: sem JS, o botão não faria nada. Até lá, um espaço
 * invisível do mesmo tamanho segura o header no lugar.
 */
export function ApoioPix({ config, variante }: Props) {
  const hidratado = useSyncExternalStore(nadaAssinar, () => true, () => false);
  const desktop = variante === "desktop";

  if (!hidratado) {
    return <span aria-hidden="true" className={`block ${desktop ? APOIO_BOTAO_DESKTOP : APOIO_BOTAO_MOBILE}`} />;
  }

  if (!desktop) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={TITULO}
            className={`${APOIO_BOTAO_MOBILE} flex flex-none items-center justify-center border border-line-strong bg-white transition-colors hover:bg-hover-soft`}
          >
            <CoffeeIcon size={18} strokeWidth={2} className="text-terracotta" />
          </button>
        </SheetTrigger>
        <SheetContent className="items-center text-center">
          <SheetTitle className="!text-[23px]">{TITULO}</SheetTitle>
          <div className="-mx-[18px] flex min-h-0 w-[calc(100%+36px)] flex-col items-center overflow-y-auto px-[18px]">
            <ConteudoDoApoio config={config} variante="mobile" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className={`${APOIO_BOTAO_DESKTOP} inline-flex flex-none items-center justify-center gap-2 whitespace-nowrap border border-line-strong bg-white pl-3.5 pr-4 text-[13.5px] font-semibold text-espresso transition-colors hover:bg-hover-soft`}
        >
          <CoffeeIcon size={16} strokeWidth={2} className="text-terracotta" />
          {TITULO}
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-espresso/50" />
        <DialogPrimitive.Content
          // Sem descrição: o título e o texto logo abaixo bastam.
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[400px] -translate-x-1/2 -translate-y-1/2 flex-col items-center overflow-y-auto rounded-[20px] bg-cream p-7 text-center shadow-[0_30px_60px_-20px_rgba(44,26,14,.5)] focus:outline-none"
        >
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="absolute right-3.5 top-3.5 flex size-8 items-center justify-center rounded-full bg-line text-ink-2 transition-colors hover:bg-line-strong"
          >
            <XIcon size={14} strokeWidth={2.4} />
          </DialogPrimitive.Close>
          <DialogPrimitive.Title className="font-display text-[26px] text-espresso">{TITULO}</DialogPrimitive.Title>
          <ConteudoDoApoio config={config} variante="desktop" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type Copia = "pronto" | "copiado" | "manual";

/** O miolo do modal e do sheet. Monta a cada abertura: volta sempre em R$ 5. */
function ConteudoDoApoio({ config, variante }: Props) {
  const desktop = variante === "desktop";
  const [valor, setValor] = useState<ValorDeApoio>(VALOR_PADRAO);
  const [copia, setCopia] = useState<Copia>("pronto");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const manual = useRef<HTMLTextAreaElement>(null);
  const idManual = useId();
  const codigo = useMemo(() => brCodePix({ ...config, valor }), [config, valor]);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (copia !== "manual") return;
    if (!manual.current) return;
    manual.current.focus();
    selecionarTudo(manual.current);
  }, [copia]);

  const escolher = (novo: ValorDeApoio) => {
    clearTimeout(timer.current);
    setValor(novo);
    setCopia("pronto");
  };

  const copiar = async () => {
    clearTimeout(timer.current);
    try {
      if (!navigator.clipboard) throw new Error("sem clipboard");
      await navigator.clipboard.writeText(codigo);
      setCopia("copiado");
      timer.current = setTimeout(() => setCopia("pronto"), CONFIRMACAO_MS);
    } catch {
      // Navegador que bloqueia a área de transferência: o código à mão, já selecionado.
      setCopia("manual");
    }
  };

  const copiado = copia === "copiado";

  return (
    <>
      <p
        className={`mt-1.5 text-ink-2 [text-wrap:pretty] ${desktop ? "max-w-[300px] text-sm leading-[1.55]" : "text-[13.5px] leading-[1.55]"}`}
      >
        {TEXTO[variante]}
      </p>
      <Valores valor={valor} onEscolher={escolher} variante={variante} />
      <Qr codigo={codigo} valor={valor} variante={variante} />

      {desktop ? (
        <>
          <span className="mt-2 text-[12.5px] text-ink-3">Aponte a câmera do app do seu banco</span>
          <div aria-hidden="true" className="mt-1.5 flex w-full items-center gap-2.5">
            <span className="h-px flex-1 bg-line-strong" />
            <span className="text-[11.5px] font-semibold uppercase tracking-[.12em] text-ink-3">ou</span>
            <span className="h-px flex-1 bg-line-strong" />
          </div>
          <div className="mt-1.5 flex w-full items-center gap-2 rounded-full border border-line-strong bg-white py-1.5 pl-3.5 pr-1.5">
            <span className="min-w-0 flex-1 truncate text-left font-mono text-xs text-ink-2">{codigo}</span>
            <button
              type="button"
              onClick={copiar}
              className="inline-flex h-[34px] flex-none items-center rounded-full bg-terracotta px-3.5 text-[13px] font-semibold text-on-terracotta transition-colors hover:bg-terracotta-hover"
            >
              {copiado ? COPIADO.desktop : "Copiar"}
            </button>
          </div>
          <span className="mt-1.5 text-xs text-ink-3">Pix copia e cola</span>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={copiar}
            className="mt-4 flex h-[50px] w-full flex-none items-center justify-center gap-2 rounded-full bg-terracotta text-[15px] font-semibold text-on-terracotta transition-colors hover:bg-terracotta-hover"
          >
            <CopyIcon size={17} strokeWidth={2} />
            {copiado ? COPIADO.mobile : "Copiar código Pix"}
          </button>
          <span className="mt-1.5 text-xs text-ink-3">No celular, copie o código e cole na área Pix do seu banco</span>
        </>
      )}

      {copia === "manual" && (
        <div className="mt-3 flex w-full flex-col gap-1.5 text-left">
          <label htmlFor={idManual} className="text-[13px] font-semibold text-espresso">
            Selecione o código e copie
          </label>
          <textarea
            id={idManual}
            ref={manual}
            readOnly
            rows={4}
            value={codigo}
            onFocus={(e) => selecionarTudo(e.currentTarget)}
            className="w-full resize-none break-all rounded-xl border border-line-strong bg-white px-3 py-2 font-mono text-xs text-ink-2"
          />
        </div>
      )}
      <p role="status" className="sr-only">
        {copiado ? COPIADO[variante] : ""}
      </p>
    </>
  );
}

// `setSelectionRange` em vez do método `select` do campo: a guarda do `fronteiras.test.ts` o confundiria com uma leitura do Supabase.
function selecionarTudo(campo: HTMLTextAreaElement) {
  campo.setSelectionRange(0, campo.value.length);
}

/** Chips de valor: grupo de escolha única, com as setas como num radio nativo. */
function Valores({
  valor,
  onEscolher,
  variante,
}: {
  valor: ValorDeApoio;
  onEscolher: (valor: ValorDeApoio) => void;
  variante: Variante;
}) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = VALORES_DE_APOIO.indexOf(valor);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!passo) return;
    e.preventDefault();
    const n = VALORES_DE_APOIO.length;
    const proximo = (atual + passo + n) % n;
    onEscolher(VALORES_DE_APOIO[proximo]);
    botoes.current[proximo]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Valor do apoio"
      onKeyDown={onKeyDown}
      className={`flex gap-1.5 ${variante === "desktop" ? "mt-4" : "mt-3.5"}`}
    >
      {VALORES_DE_APOIO.map((v, i) => {
        const marcado = v === valor;
        return (
          <button
            key={rotuloDoValor(v)}
            ref={(el) => {
              botoes.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={marcado}
            tabIndex={marcado ? 0 : -1}
            onClick={() => onEscolher(v)}
            className={`rounded-full border font-semibold transition-colors duration-200 motion-reduce:transition-none ${marcado ? CHIP_ON : CHIP_OFF} ${variante === "desktop" ? "h-9 min-w-[62px] px-3.5 text-[13.5px]" : "h-10 min-w-16 px-[13px] text-sm"}`}
          >
            {rotuloDoValor(v)}
          </button>
        );
      })}
    </div>
  );
}

/** Moldura de tamanho fixo: `hover-soft` até o SVG chegar, sem salto. */
function Qr({ codigo, valor, variante }: { codigo: string; valor: ValorDeApoio; variante: Variante }) {
  const [qr, setQr] = useState<{ codigo: string; svg: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    qrSvg(codigo).then((svg) => vivo && setQr({ codigo, svg }));
    return () => {
      vivo = false;
    };
  }, [codigo]);

  const desktop = variante === "desktop";
  return (
    <div className={`mt-3 rounded-2xl border border-line bg-white ${desktop ? "p-3" : "p-2.5"}`}>
      <div
        role="img"
        aria-label={valor === null ? "QR Code Pix, valor livre" : `QR Code Pix de ${rotuloDoValor(valor)}`}
        className={`bg-hover-soft ${desktop ? "size-[200px]" : "size-[170px]"}`}
        // SVG gerado aqui pela lib, a partir do código do Pix (chave, nome e cidade das envs).
        dangerouslySetInnerHTML={qr?.codigo === codigo ? { __html: qr.svg } : undefined}
      />
    </div>
  );
}

"use client";

// Client pela conversão no navegador (canvas → WebP), pelo upload direto ao
// Storage e pelos estados do envio.
import { useEffect, useRef, useState } from "react";

import { urlDoLogin } from "@/lib/admin-auth";
import { descartarUpload, prepararUpload, registrarFoto } from "@/lib/admin/fotos-actions";
import {
  MAX_AUTORIZADO_POR,
  MAX_OBSERVACAO,
  ROTULO_ORIGEM,
  TIPOS_ENTRADA,
  checarArquivo,
  checarWebp,
  dimensoesDestino,
  validarAutorizacao,
  type CampoAutorizacao,
} from "@/lib/foto-upload";
import { falhaDeRede, falhaDoPut, mensagemDaFalha, type Falha } from "@/lib/foto-upload-erro";

import { botaoCtaClass, Erro, inputClass, labelClass } from "./form";

const QUALIDADE_WEBP = 0.82;
/** Upload de até 2 MB: passou disso sem terminar, a conexão não está dando conta. */
const TIMEOUT_ENVIO = 60_000;
const ERRO_LEITURA = "Não deu para abrir esta foto. O arquivo pode estar corrompido. Tente outra.";
const ERRO_MEMORIA =
  "O navegador não conseguiu converter esta foto. Ela pode ser grande demais para a memória dele. Feche outras abas ou use uma foto menor.";

/** O navegador abriu a foto, mas não conseguiu desenhá-la ou gerar o WebP (memória, quase sempre). */
class SemMemoria extends Error {}

type Convertida = { blob: Blob; previa: string; largura: number; altura: number };
type ErrosCampos = Partial<Record<CampoAutorizacao | "foto", string>>;

/** Redimensiona (lado maior ~1600 px, respeitando a orientação do EXIF) e converte para WebP. */
async function converter(arquivo: File): Promise<Convertida> {
  // Falhar aqui é não decodificar (arquivo corrompido, formato que o navegador não lê).
  const bitmap = await createImageBitmap(arquivo);
  try {
    const { largura, altura } = dimensoesDestino(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new SemMemoria();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALIDADE_WEBP));
    if (!blob) throw new SemMemoria();
    return { blob, previa: URL.createObjectURL(blob), largura, altura };
  } catch {
    // `drawImage` e `toBlob` também lançam quando falta memória para o canvas.
    throw new SemMemoria();
  } finally {
    bitmap.close();
  }
}

const tamanho = (bytes: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(bytes / 1024)} KB`;

type Props = { cafeId: string; hoje: string };

export function FotoUploadForm({ cafeId, hoje }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [foto, setFoto] = useState<Convertida | null>(null);
  const [convertendo, setConvertendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<ErrosCampos>({});
  const [falha, setFalha] = useState<Falha | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // A prévia é um object URL: solto quando troca a foto ou a seção sai da tela.
  useEffect(() => {
    if (!foto) return;
    return () => URL.revokeObjectURL(foto.previa);
  }, [foto]);

  async function escolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    setFoto(null);
    setSucesso(false);
    setFalha(null);
    if (!arquivo) return;

    const erro = checarArquivo(arquivo);
    if (erro) {
      setErros((e) => ({ ...e, foto: erro }));
      evento.target.value = "";
      return;
    }

    setConvertendo(true);
    try {
      const convertida = await converter(arquivo);
      const erroWebp = checarWebp(convertida.blob);
      if (erroWebp) {
        URL.revokeObjectURL(convertida.previa);
        setErros((e) => ({ ...e, foto: erroWebp }));
        evento.target.value = "";
        return;
      }
      setFoto(convertida);
      setErros((e) => ({ ...e, foto: undefined }));
    } catch (erro) {
      setErros((e) => ({ ...e, foto: erro instanceof SemMemoria ? ERRO_MEMORIA : ERRO_LEITURA }));
      evento.target.value = "";
    } finally {
      setConvertendo(false);
    }
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSucesso(false);
    setFalha(null);

    const dados = new FormData(evento.currentTarget);
    const campos = {
      origem: dados.get("origem"),
      autorizado_por: dados.get("autorizado_por"),
      autorizado_em: dados.get("autorizado_em"),
      observacao: dados.get("observacao"),
    };
    const temporaria = dados.get("temporaria") === "on";
    const validacao = validarAutorizacao(campos, hoje);
    const novosErros: ErrosCampos = validacao.ok ? {} : { ...validacao.erros };
    if (!foto) novosErros.foto = erros.foto ?? "Escolha uma foto.";
    setErros(novosErros);
    if (!foto || !validacao.ok) return;
    if (!navigator.onLine) {
      setFalha({ etapa: "preparar", codigo: "offline" });
      return;
    }

    // Em toda falha, a foto convertida e os campos ficam: é só corrigir e reenviar.
    setEnviando(true);
    try {
      let preparo;
      try {
        preparo = await prepararUpload(cafeId, validacao.valores, { type: foto.blob.type, size: foto.blob.size });
      } catch (erro) {
        setFalha(falhaDeRede("preparar", erro));
        return;
      }
      if (!preparo.ok) {
        setErros(preparo.erros ?? {});
        setFalha(preparo.falha);
        return;
      }

      let resposta;
      try {
        resposta = await fetch(preparo.url, {
          method: "PUT",
          // Caminho novo a cada foto: o arquivo nunca muda, pode ficar em cache por 1 ano.
          headers: { "content-type": foto.blob.type, "cache-control": "max-age=31536000" },
          body: foto.blob,
          signal: AbortSignal.timeout(TIMEOUT_ENVIO),
        });
      } catch (erro) {
        setFalha(falhaDeRede("enviar", erro));
        return;
      }
      if (!resposta.ok) {
        setFalha(falhaDoPut(resposta.status, await resposta.json().catch(() => null)));
        return;
      }

      let registro;
      try {
        registro = await registrarFoto(cafeId, preparo.caminho, validacao.valores, temporaria);
      } catch (erro) {
        // O registro não respondeu: o arquivo não pode ficar no bucket sem autorização.
        await descartarUpload(cafeId, preparo.caminho).catch(() => {});
        setFalha({ ...falhaDeRede("registrar", erro), codigo: "sem-resposta" });
        return;
      }
      if (!registro.ok) {
        setErros(registro.erros ?? {});
        setFalha(registro.falha);
        return;
      }

      form.current?.reset();
      setFoto(null);
      setSucesso(true);
    } finally {
      setEnviando(false);
    }
  }

  const descricao = (campo: keyof ErrosCampos) => (erros[campo] ? `erro-${campo}` : undefined);
  const invalido = (campo: keyof ErrosCampos) => (erros[campo] ? true : undefined);

  return (
    <form ref={form} onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <fieldset disabled={enviando} className="flex flex-col gap-5">
        <div>
          <label htmlFor="foto" className={labelClass}>
            Foto
          </label>
          <input
            id="foto"
            name="foto"
            type="file"
            accept={TIPOS_ENTRADA.join(",")}
            onChange={escolher}
            aria-describedby={["dica-foto", descricao("foto")].filter(Boolean).join(" ")}
            aria-invalid={invalido("foto")}
            className="block w-full text-[14px] text-ink-2 file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border file:border-line-strong file:bg-white file:px-4 file:text-[13.5px] file:font-semibold file:text-espresso hover:file:bg-hover-soft"
          />
          <p id="dica-foto" className="mt-1.5 text-[12.5px] text-ink-3">
            JPEG, PNG ou WebP até 15 MB. O navegador reduz para 1600 px e converte para WebP antes de enviar.
          </p>
          <Erro id="erro-foto" erro={erros.foto} className="mt-1.5" />
          {convertendo && (
            <p role="status" className="mt-2 text-[13.5px] text-ink-2">
              Preparando a foto…
            </p>
          )}
          {foto && (
            <figure className="mt-3 flex items-end gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- object URL local, nada a otimizar */}
              <img
                src={foto.previa}
                alt="Prévia da foto que vai ser enviada"
                className="h-[120px] w-auto max-w-full rounded-lg border border-card-line object-cover"
              />
              <figcaption className="text-[12.5px] text-ink-3">
                {foto.largura} × {foto.altura} · {tamanho(foto.blob.size)}
              </figcaption>
            </figure>
          )}
        </div>

        <fieldset aria-describedby={descricao("origem")}>
          <legend className={labelClass}>Origem</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Opcao valor="propria">{ROTULO_ORIGEM.propria}</Opcao>
            <Opcao valor="cedida">{ROTULO_ORIGEM.cedida}</Opcao>
          </div>
          <Erro id="erro-origem" erro={erros.origem} className="mt-1.5" />
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <div>
            <label htmlFor="autorizado_por" className={labelClass}>
              Quem autorizou
            </label>
            <input
              id="autorizado_por"
              name="autorizado_por"
              type="text"
              required
              maxLength={MAX_AUTORIZADO_POR}
              aria-describedby={descricao("autorizado_por")}
              aria-invalid={invalido("autorizado_por")}
              className={inputClass}
            />
            <Erro id="erro-autorizado_por" erro={erros.autorizado_por} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="autorizado_em" className={labelClass}>
              Data da autorização
            </label>
            <input
              id="autorizado_em"
              name="autorizado_em"
              type="date"
              required
              defaultValue={hoje}
              max={hoje}
              aria-describedby={descricao("autorizado_em")}
              aria-invalid={invalido("autorizado_em")}
              className={inputClass}
            />
            <Erro id="erro-autorizado_em" erro={erros.autorizado_em} className="mt-1.5" />
          </div>
        </div>

        <div>
          <label htmlFor="observacao" className={labelClass}>
            Observação <span className="font-normal text-ink-3">(opcional)</span>
          </label>
          <textarea
            id="observacao"
            name="observacao"
            rows={3}
            maxLength={MAX_OBSERVACAO}
            aria-describedby={descricao("observacao")}
            aria-invalid={invalido("observacao")}
            className={`${inputClass} h-auto py-2.5`}
          />
          <Erro id="erro-observacao" erro={erros.observacao} className="mt-1.5" />
        </div>

        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] text-espresso">
            <input
              type="checkbox"
              name="temporaria"
              aria-describedby="dica-temporaria"
              className="size-[18px] accent-terracotta"
            />
            Foto temporária
          </label>
          <p id="dica-temporaria" className="text-[12.5px] text-ink-3">
            Vai ao ar normalmente e fica marcada aqui para trocar depois.
          </p>
        </div>
      </fieldset>

      <ErroDoEnvio falha={falha} cafeId={cafeId} />
      {sucesso && (
        <p role="status" className="text-[14px] font-medium text-open">
          Foto enviada. Já está no site.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando || convertendo}
        className={`${botaoCtaClass} self-start`}
      >
        {enviando ? "Enviando…" : "Enviar foto"}
      </button>
    </form>
  );
}

function Opcao({ valor, children }: { valor: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] text-espresso">
      <input type="radio" name="origem" value={valor} required className="size-[18px] accent-terracotta" />
      {children}
    </label>
  );
}

/**
 * Falha do envio (#74): a frase (o que houve e o que fazer) e, recolhidos, os
 * detalhes técnicos para investigar. Sempre no DOM, como o `Erro`, para o
 * leitor de tela conhecer a região; o foco vem para cá quando a falha aparece
 * — o botão estava desabilitado durante o envio e o foco teria se perdido.
 */
function ErroDoEnvio({ falha, cafeId }: { falha: Falha | null; cafeId: string }) {
  const regiao = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (falha) regiao.current?.focus();
  }, [falha]);

  const traduzida = falha && mensagemDaFalha(falha);
  return (
    <div ref={regiao} role="alert" tabIndex={-1} className="flex flex-col gap-2 empty:hidden focus:outline-none">
      {traduzida && (
        <>
          <p className="text-[14px] font-medium text-terracotta">
            {traduzida.mensagem}
            {falha.codigo === "sessao" && (
              <>
                {" "}
                <a
                  href={urlDoLogin(`/admin/cafes/${cafeId}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-espresso underline underline-offset-2"
                >
                  Entrar de novo (abre em outra aba)
                </a>
              </>
            )}
          </p>
          <details className="text-[12.5px] text-ink-3">
            <summary className="w-fit cursor-pointer font-semibold text-ink-2">Detalhes técnicos</summary>
            <ul className="mt-1.5 select-all break-words rounded-lg bg-hover-soft px-3 py-2 font-mono">
              {traduzida.detalhes.map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

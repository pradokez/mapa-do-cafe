"use client";

// Client: canvas, object URL e `fetch` direto ao Storage — tudo do navegador.
import { useEffect, useRef, useState } from "react";

import { urlDoLogin } from "@/lib/admin-auth";
import { checarArquivo, checarWebp, dimensoesDestino } from "@/lib/foto-upload";
import { falhaDeRede, falhaDoPut, FOTO, mensagemDaFalha, type Falha, type ObjetoDoEnvio } from "@/lib/foto-upload-erro";

/**
 * O que a foto do café (#46) e a arte do combo (#105) dividem: escolher e
 * converter a imagem no navegador, subir pela URL assinada e explicar a falha.
 */

const QUALIDADE_WEBP = 0.82;
/** Upload de até 2 MB: passou disso sem terminar, a conexão não está dando conta. */
const TIMEOUT_ENVIO = 60_000;
const ERRO_LEITURA = "Não deu para abrir esta foto. O arquivo pode estar corrompido. Tente outra.";
const ERRO_MEMORIA =
  "O navegador não conseguiu converter esta foto. Ela pode ser grande demais para a memória dele. Feche outras abas ou use uma foto menor.";

/** O navegador abriu a foto, mas não conseguiu desenhá-la ou gerar o WebP (memória, quase sempre). */
class SemMemoria extends Error {}

export type Convertida = { blob: Blob; previa: string; largura: number; altura: number };

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

export const tamanho = (bytes: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(bytes / 1024)} KB`;

/**
 * A imagem escolhida, já convertida: `escolher` vai no `onChange` do
 * `<input type="file">`. Recusa (tipo, HEIC, tamanho, Safari sem WebP) vira
 * `erro`, e o campo esvazia. A prévia (object URL) é solta ao trocar ou sair.
 */
export function useImagemConvertida() {
  const [imagem, setImagem] = useState<Convertida | null>(null);
  const [convertendo, setConvertendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!imagem) return;
    return () => URL.revokeObjectURL(imagem.previa);
  }, [imagem]);

  async function escolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    setImagem(null);
    if (!arquivo) return;

    const recusa = checarArquivo(arquivo);
    if (recusa) {
      setErro(recusa);
      evento.target.value = "";
      return;
    }

    setConvertendo(true);
    try {
      const convertida = await converter(arquivo);
      const erroWebp = checarWebp(convertida.blob);
      if (erroWebp) {
        URL.revokeObjectURL(convertida.previa);
        setErro(erroWebp);
        evento.target.value = "";
        return;
      }
      setImagem(convertida);
      setErro(null);
    } catch (falha) {
      setErro(falha instanceof SemMemoria ? ERRO_MEMORIA : ERRO_LEITURA);
      evento.target.value = "";
    } finally {
      setConvertendo(false);
    }
  }

  return { imagem, convertendo, erro, setErro, escolher, limpar: () => setImagem(null) };
}

/** `PUT` do WebP na URL assinada: `null` se subiu, senão a falha. */
export async function subirParaOStorage(url: string, blob: Blob): Promise<Falha | null> {
  let resposta;
  try {
    resposta = await fetch(url, {
      method: "PUT",
      // Caminho novo a cada envio: o arquivo nunca muda, pode ficar em cache por 1 ano.
      headers: { "content-type": blob.type, "cache-control": "max-age=31536000" },
      body: blob,
      signal: AbortSignal.timeout(TIMEOUT_ENVIO),
    });
  } catch (erro) {
    return falhaDeRede("enviar", erro);
  }
  return resposta.ok ? null : falhaDoPut(resposta.status, await resposta.json().catch(() => null));
}

/**
 * Falha do envio (#74): a frase (o que houve e o que fazer) e, recolhidos, os
 * detalhes técnicos para investigar. Sempre no DOM, como o `Erro`, para o
 * leitor de tela conhecer a região; o foco vem para cá quando a falha aparece
 * — o botão estava desabilitado durante o envio e o foco teria se perdido.
 * `voltarPara`: a página onde se entra de novo quando a sessão expira.
 */
export function ErroDoEnvio({
  falha,
  voltarPara,
  objeto = FOTO,
}: {
  falha: Falha | null;
  voltarPara: string;
  objeto?: ObjetoDoEnvio;
}) {
  const regiao = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (falha) regiao.current?.focus();
  }, [falha]);

  const traduzida = falha && mensagemDaFalha(falha, objeto);
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
                  href={urlDoLogin(voltarPara)}
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

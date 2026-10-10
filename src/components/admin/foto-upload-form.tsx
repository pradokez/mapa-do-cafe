"use client";

// Client pela conversão no navegador (canvas → WebP), pelo upload direto ao
// Storage e pelos estados do envio.
import { useRef, useState } from "react";

import { descartarUpload, prepararUpload, registrarFoto } from "@/lib/admin/fotos-actions";
import {
  MAX_AUTORIZADO_POR,
  MAX_OBSERVACAO,
  ROTULO_ORIGEM,
  TIPOS_ENTRADA,
  validarAutorizacao,
  type CampoAutorizacao,
} from "@/lib/foto-upload";
import { falhaDeRede, type Falha } from "@/lib/foto-upload-erro";

import { ErroDoEnvio, subirParaOStorage, tamanho, useImagemConvertida } from "./envio-de-imagem";
import { botaoCtaClass, Erro, inputClass, labelClass } from "./form";

type ErrosCampos = Partial<Record<CampoAutorizacao | "foto", string>>;

type Props = { cafeId: string; hoje: string };

export function FotoUploadForm({ cafeId, hoje }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const { imagem: foto, convertendo, erro: erroFoto, setErro: setErroFoto, escolher, limpar } = useImagemConvertida();
  const [enviando, setEnviando] = useState(false);
  const [errosAutorizacao, setErros] = useState<Partial<Record<CampoAutorizacao, string>>>({});
  const [falha, setFalha] = useState<Falha | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const erros: ErrosCampos = { ...errosAutorizacao, foto: erroFoto ?? undefined };

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
    setErros(validacao.ok ? {} : validacao.erros);
    if (!foto) setErroFoto(erroFoto ?? "Escolha uma foto.");
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

      const falhaDoEnvio = await subirParaOStorage(preparo.url, foto.blob);
      if (falhaDoEnvio) {
        setFalha(falhaDoEnvio);
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
      limpar();
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
            onChange={(evento) => {
              setSucesso(false);
              setFalha(null);
              escolher(evento);
            }}
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

      <ErroDoEnvio falha={falha} voltarPara={`/admin/cafes/${cafeId}`} />
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

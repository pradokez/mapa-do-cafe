"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { definirPublicacao } from "@/lib/admin/festivais-actions";
import { erroDePublicacao } from "@/lib/festival-dados";

import { botaoCtaClass, botaoNeutroClass, Erro } from "./form";

const ERRO_REDE = "Não deu para falar com o servidor. Confira a conexão e tente de novo.";

type Props = {
  edicaoId: string;
  /** "Eu Amo Café 2026". */
  nome: string;
  /** "18 out a 15 nov 2026". */
  periodo: string;
  publicada: boolean;
  preco: number | null;
};

/**
 * Seção Publicação da edição (#102): publicar e despublicar, sempre com
 * confirmação (nos dois sentidos — despublicar tira chip, selo e combos do
 * site na hora). Publicada, a edição entra e sai do ar sozinha pelas datas.
 * Sem preço não publica: o botão nem abre o diálogo.
 */
export function PublicacaoForm({ edicaoId, nome, periodo, publicada, preco }: Props) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const impedimento = publicada ? null : erroDePublicacao({ preco });

  const texto = publicada
    ? {
        estado: `Publicada: chip, selo, vitrine e combos aparecem no site de ${periodo} e saem sozinhos depois do último dia.`,
        acao: "Despublicar",
        titulo: `Despublicar ${nome}?`,
        efeito:
          "Chip, selo, vitrine e combos saem do site na hora, e a página da edição deixa de abrir. Nada é apagado: datas e participantes ficam guardados.",
        feito: "Pronto: a edição saiu do site.",
      }
    : {
        estado: "Rascunho: o site não mostra esta edição.",
        acao: "Publicar",
        titulo: `Publicar ${nome}?`,
        efeito: `Chip, selo, vitrine e combos aparecem no site de ${periodo}, e saem sozinhos depois do último dia. Quem estiver sem arte aparece com o placeholder.`,
        feito: "Pronto: a edição está publicada.",
      };

  const abrirOuFechar = (abrir: boolean) => {
    if (salvando) return;
    setErro(null);
    if (abrir) setAviso(null);
    setAberto(abrir);
  };

  const confirmar = async () => {
    setSalvando(true);
    const resultado = await definirPublicacao(edicaoId, !publicada).catch(() => null);
    setSalvando(false);
    if (!resultado?.ok) {
      setErro(resultado?.erro ?? ERRO_REDE);
      return;
    }
    setAviso(texto.feito);
    setAberto(false);
  };

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-[14px] text-ink-2">{texto.estado}</p>

      {impedimento ? (
        <p className="text-[14px] font-medium text-terracotta">{impedimento} (em Dados, abaixo)</p>
      ) : (
        <Dialog.Root open={aberto} onOpenChange={abrirOuFechar}>
          <Dialog.Trigger className={`${publicada ? botaoNeutroClass : botaoCtaClass} self-start`}>
            {texto.acao}
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-espresso/45" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-cream p-6 shadow-xl focus:outline-none">
              <Dialog.Title className="font-display text-[22px] leading-[1.2] text-espresso">{texto.titulo}</Dialog.Title>
              <Dialog.Description className="mt-2.5 text-[14.5px] leading-[1.5] text-ink-2">
                {texto.efeito}
              </Dialog.Description>
              <Erro erro={erro} className="mt-3" />
              <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                <Dialog.Close disabled={salvando} className={botaoNeutroClass}>
                  Cancelar
                </Dialog.Close>
                <button type="button" onClick={confirmar} disabled={salvando} className={botaoCtaClass}>
                  {salvando ? "Salvando…" : texto.acao}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <p role="status" className="text-[14px] font-medium text-open empty:hidden">
        {aviso}
      </p>
    </div>
  );
}

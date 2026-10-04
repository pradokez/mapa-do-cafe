"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useTransition } from "react";

import { definirStatus } from "@/lib/admin/status-actions";

import { botaoCtaClass, botaoNeutroClass, Erro } from "./form";

const TEXTO = {
  noAr: {
    estado: "O café aparece no mapa, na lista e na busca.",
    acao: "Tirar do ar",
    titulo: (nome: string) => `Tirar ${nome} do ar?`,
    efeito:
      "O café sai do mapa, da lista e da busca, e a página dele deixa de abrir. Nada é apagado: dados e fotos ficam guardados, e você pode colocá-lo de volta quando quiser.",
    feito: "Pronto: o café saiu do mapa.",
  },
  foraDoAr: {
    estado: "O café não aparece no site. Dados e fotos continuam guardados.",
    acao: "Colocar no ar",
    titulo: (nome: string) => `Colocar ${nome} no ar?`,
    efeito: "O café volta a aparecer no mapa, na lista e na busca, com os dados e as fotos de antes.",
    feito: "Pronto: o café voltou ao mapa.",
  },
};

/**
 * Seção Status de `/admin/cafes/[id]`: tirar o café do ar e colocar de volta,
 * sempre com confirmação (nos dois sentidos — reativar também publica algo).
 * Foco preso, Esc e foco de volta ao gatilho vêm do Radix Dialog. Depois de
 * gravar, a action revalida a página, que volta com o `ativo` novo.
 */
export function StatusForm({ cafeId, nome, ativo }: { cafeId: string; nome: string; ativo: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const texto = ativo ? TEXTO.noAr : TEXTO.foraDoAr;

  const abrirOuFechar = (abrir: boolean) => {
    if (salvando) return;
    setErro(null);
    if (abrir) setAviso(null);
    setAberto(abrir);
  };

  const confirmar = () => {
    iniciar(async () => {
      const resultado = await definirStatus(cafeId, !ativo);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setAviso(texto.feito);
      setAberto(false);
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-[14px] text-ink-2">{texto.estado}</p>

      <Dialog.Root open={aberto} onOpenChange={abrirOuFechar}>
        <Dialog.Trigger className={`${ativo ? botaoNeutroClass : botaoCtaClass} self-start`}>{texto.acao}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-espresso/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-cream p-6 shadow-xl focus:outline-none">
            <Dialog.Title className="font-display text-[22px] leading-[1.2] text-espresso">
              {texto.titulo(nome)}
            </Dialog.Title>
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

      <p role="status" className="text-[14px] font-medium text-open empty:hidden">
        {aviso}
      </p>
    </div>
  );
}

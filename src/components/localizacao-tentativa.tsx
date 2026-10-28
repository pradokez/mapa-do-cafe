"use client";

import { useCallback } from "react";

import { LocateIcon, LocateOffIcon } from "@/components/icons";
import { Spinner } from "@/components/spinner";
import { Toast, useToast } from "@/components/toast";
import { tentarDeNovo, useGeolocation } from "@/hooks/use-geolocation";

/**
 * Nova tentativa de localização do chip "Distância" sem posição (#164):
 * `tentar` pede a posição de novo e, se ela não vier, mostra o `aviso` —
 * o toast "Permita a localização…", que tenta de novo quando tocado. Quem usa
 * põe o `aviso` onde ele aparece (na home ou dentro do sheet de filtros).
 */
export function useTentativaDeLocalizacao(className: string) {
  const { visivel, mostrar, esconder } = useToast();

  const tentar = useCallback(async () => {
    if (await tentarDeNovo()) esconder();
    else mostrar();
  }, [mostrar, esconder]);

  const aviso = (
    <Toast
      visivel={visivel}
      onClick={tentar}
      icone={<LocateOffIcon size={18} strokeWidth={2} className="flex-none text-brasa" />}
      className={className}
    >
      Permita a localização para filtrar por distância.
    </Toast>
  );

  return { tentar, aviso };
}

/**
 * Ícone do chip "Distância" (desktop e mobile): com posição, o de sempre; sem
 * ela, a localização riscada, e o spinner no lugar enquanto tenta de novo.
 */
export function IconeDaDistancia({ semPosicao, size }: { semPosicao: boolean; size: number }) {
  const { tentando } = useGeolocation();
  if (!semPosicao) return <LocateIcon size={size} strokeWidth={2} />;
  if (tentando) return <Spinner className="size-[15px] border-line-strong border-t-ink-3 lg:size-4" />;
  return <LocateOffIcon size={size} strokeWidth={2} />;
}

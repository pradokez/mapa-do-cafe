"use client";

import { useEffect, useState } from "react";

import { SearchIcon } from "@/components/icons";
import { BUSCA_MOLDURA } from "@/components/medidas";

const DEBOUNCE_MS = 300;

type Props = {
  /** Termo em vigor (o `q` da URL). */
  value: string;
  /** Recebe o termo digitado depois de 300 ms sem digitação. */
  onSearch: (q: string) => void;
};

/**
 * Campo de busca do header da home (440×42; largura total no mobile, desvio
 * consciente do design). O texto é local — digitar não mexe na URL a cada
 * tecla —, e o termo sobe para `onSearch` com debounce.
 */
export function SearchField({ value, onSearch }: Props) {
  const [texto, setTexto] = useState(value);
  // Último termo enviado e último `value` visto: distinguem o eco da própria
  // busca de uma mudança externa ("Limpar filtros", voltar/avançar).
  const [enviado, setEnviado] = useState(value);
  const [anterior, setAnterior] = useState(value);
  if (value !== anterior) {
    setAnterior(value);
    if (value !== enviado) {
      setTexto(value);
      setEnviado(value);
    }
  }

  // Efeito só para o timer: cada tecla (ou mudança externa) cancela o anterior.
  // `onSearch` muda quando a URL muda, e aí o timer recomeça com o estado novo
  // — nunca reescreve a URL com os filtros de antes de um clique num chip.
  useEffect(() => {
    const termo = texto.trim();
    if (termo === enviado) return;
    const timer = setTimeout(() => {
      setEnviado(termo);
      onSearch(termo);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [texto, enviado, onSearch]);

  return (
    <label className={`${BUSCA_MOLDURA} cursor-text focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracotta`}>
      <SearchIcon size={16} strokeWidth={2} />
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar café ou bairro"
        aria-label="Buscar café ou bairro"
        enterKeyHint="search"
        autoComplete="off"
        // O anel de foco fica na pílula (focus-within), não num retângulo interno.
        // 16 px abaixo de `lg`: com menos que isso, o Safari do iPhone amplia a
        // tela ao focar o campo.
        className="min-w-0 flex-1 bg-transparent text-base text-espresso lg:text-sm outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  );
}

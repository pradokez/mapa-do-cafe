/**
 * Medidas compartilhadas entre o conteúdo real e o skeleton de carregamento
 * (#45). O skeleton copia o formato da página; com as classes num lugar só,
 * mudar o card ou a grade muda o skeleton junto, e a troca não pula.
 *
 * Módulo neutro, de propósito: constante exportada de um arquivo
 * `"use client"` chega ao Server Component como referência de cliente, não
 * como string.
 */

// Home — header e barra de filtros

/** Pílula da busca (440×42; largura total no mobile). */
export const BUSCA_MOLDURA =
  "flex h-[42px] w-full items-center gap-2.5 rounded-full border border-line-strong bg-white px-[18px] text-ink-3 shadow-[0_1px_2px_rgba(44,26,14,.05)] lg:w-[440px]";

/** Botão "Me paga um café?" (#121): 42 px com texto no desktop, 44 px só com o ícone no mobile. */
export const APOIO_BOTAO_DESKTOP = "h-[42px] w-[176px] rounded-full";
export const APOIO_BOTAO_MOBILE = "size-11 rounded-full";

/** Faixa da barra de filtros (64 px no desktop). */
export const BARRA_FILTROS =
  "flex flex-none items-center gap-[7px] border-b border-line px-[18px] pb-3 pt-1.5 lg:h-16 lg:gap-2 lg:px-7 lg:py-0";

/** Pílula de filtro do design: 36 px no mobile, 38 px no desktop. */
export const CHIP_FORMA = "h-9 flex-none rounded-full lg:h-[38px]";

// Home — lista e card

/** Coluna da lista abaixo da barra: só ela rola. */
export const LISTA_ROLAGEM = "relative scroll-py-3 overflow-y-auto lg:block";
export const LISTA_SECTION = "flex min-h-full flex-col px-4 pb-[110px] pt-3.5 lg:px-7 lg:pb-8 lg:pt-5";
/** Linha do contador (e do "Limpar filtros"). */
export const LISTA_TOPO = "mb-2.5 flex min-h-6 items-center justify-between gap-4 px-0.5 lg:mb-4 lg:px-0";
// De `lg` até 1220 px, 1 coluna: abaixo disso as 6 fichas de comodidade
// (198 px) não cabem numa linha num card de meia coluna — 1180 px bastaria
// com barra de rolagem sobreposta, mas não com a permanente (~15 px).
export const LISTA_GRADE =
  "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 lg:gap-[18px] min-[1220px]:grid-cols-2";

/** Lista e mapa lado a lado no desktop. */
export const HOME_COLUNAS = "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[45%_55%]";

/** Moldura do card (formato e superfície; a borda leva a cor à parte). */
export const CARD_MOLDURA =
  "relative flex h-full gap-3 rounded-[14px] border bg-white p-2 shadow-[0_1px_2px_rgba(44,26,14,.06)] lg:flex-col lg:rounded-2xl lg:px-2.5 lg:pb-3.5 lg:pt-2.5";
/** Thumb do card: 92×92 ao lado no mobile, 16/10 em cima no desktop. */
export const CARD_FOTO = "size-[92px] flex-none rounded-[10px] lg:aspect-[16/10] lg:size-auto lg:rounded-[11px]";
/** Coluna de texto ao lado (mobile) ou abaixo (desktop) da foto. */
export const CARD_CORPO = "flex min-w-0 flex-1 flex-col gap-1 pb-0.5 pr-1 pt-[3px] lg:gap-1.5 lg:px-1 lg:py-0";
/** Nome: duas linhas no máximo; no desktop, reservadas mesmo com nome curto. */
export const CARD_NOME = "text-[16.5px] leading-[1.2] lg:min-h-[2.4em] lg:text-[19px]";
/** Linha de comodidades: altura fixa no desktop (28 px + 6 de respiro), reservada mesmo vazia. */
export const CARD_COMODIDADES = "mt-auto flex min-h-4 items-center gap-2.5 lg:h-[34px] lg:pt-1.5";

// Detalhe

export const DETALHE_MAIN = "mx-auto max-w-[1200px] px-4 pb-20 pt-[22px] sm:px-7 xl:px-0";
export const DETALHE_TRILHA = "mb-[18px] flex items-center gap-3.5 text-[13.5px] text-ink-3";
/** Hero: 260 px abaixo de `lg`, 500 px a partir dele. */
export const CARROSSEL = "relative h-[260px] overflow-hidden rounded-[18px] lg:h-[500px]";
/** Mobile: título → aside → corpo. Desktop: aside fixo na 2ª coluna. */
export const DETALHE_GRADE =
  "mt-8 grid items-start gap-y-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-16 lg:gap-y-0";
export const DETALHE_COLUNA = "flex flex-col lg:col-start-1";
export const DETALHE_NOME = "text-[36px] leading-[1.05] tracking-[-0.015em] lg:text-[58px]";
export const DETALHE_ASIDE_POSICAO = "lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1";
export const ASIDE_MOLDURA =
  "flex flex-col gap-4 rounded-[18px] border border-card-line bg-white p-3.5 shadow-[0_1px_2px_rgba(44,26,14,.06),0_12px_30px_-16px_rgba(44,26,14,.2)]";
export const ASIDE_MAPA = "h-[230px] rounded-[12px]";
export const ASIDE_CTA = "flex h-[46px] items-center justify-center gap-2 rounded-full";
/** Tag de "Comodidades" (38 px). */
export const DETALHE_TAG =
  "inline-flex h-[38px] items-center gap-2 rounded-full border border-line-strong bg-white px-[15px] text-sm text-espresso";

// Página do festival (#104)

/** Coluna de conteúdo da página: 1200 px no desktop, com respiro até lá. */
export const FESTIVAL_CONTEUDO = "mx-auto w-full max-w-[1256px] px-4 lg:px-7";

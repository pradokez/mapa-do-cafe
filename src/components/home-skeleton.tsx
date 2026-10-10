import { CafeCardSkeleton } from "@/components/cafe-card-skeleton";
import { SearchIcon } from "@/components/icons";
import {
  APOIO_BOTAO_DESKTOP,
  BOTAO_HEADER_MOBILE,
  BARRA_FILTROS,
  BUSCA_MOLDURA,
  CHIP_FORMA,
  HOME_COLUNAS,
  LISTA_GRADE,
  LISTA_ROLAGEM,
  LISTA_SECTION,
  LISTA_TOPO,
} from "@/components/medidas";
import { Bloco, CarregandoStatus, Linha } from "@/components/skeleton";
import { SiteHeader } from "@/components/site-header";

// Larguras medidas dos chips da barra (mobile / desktop): Recife Coffee, Eu
// Amo Café, estacionamento e bairro; depois do divisor, $, $$ e $$$.
const CHIPS = ["w-[131px] lg:w-[141px]", "w-[128px] lg:w-[138px]", "w-[149px] lg:w-[190px]", "w-[82px] lg:w-[113px]"];
const PRECOS = ["w-[42px] lg:w-[46px]", "w-[42px] lg:w-[46px]", "w-[49px] lg:w-[54px]"];
const CARDS = 6;

/**
 * Home enquanto os cafés não chegam (sobretudo com o Supabase acordando da
 * hibernação): o logo de verdade e o resto em blocos com as medidas do
 * `CafeDirectory` — busca, barra de filtros, contador, cards e mapa — e,
 * com o Pix configurado, o botão "Me paga um café?".
 */
export function HomeSkeleton({ comApoio = false }: { comApoio?: boolean }) {
  return (
    <>
      <CarregandoStatus>Carregando cafés…</CarregandoStatus>
      <SiteHeader
        actions={
          <>
            {comApoio && <Bloco tom="creme" className={BOTAO_HEADER_MOBILE} />}
            <Bloco tom="creme" className={BOTAO_HEADER_MOBILE} />
          </>
        }
        extra={comApoio && <Bloco tom="creme" className={APOIO_BOTAO_DESKTOP} />}
      >
        <div aria-hidden="true" className={BUSCA_MOLDURA}>
          <SearchIcon size={16} strokeWidth={2} />
        </div>
      </SiteHeader>
      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col">
        <div className={`${BARRA_FILTROS} overflow-hidden`}>
          {CHIPS.map((largura) => (
            <Bloco key={largura} tom="creme" className={`${CHIP_FORMA} ${largura}`} />
          ))}
          {/* "Mais filtros": só no desktop. */}
          <Bloco tom="creme" className={`${CHIP_FORMA} hidden w-[145px] lg:block`} />
          <span className="mx-1.5 hidden h-[22px] w-px flex-none bg-line-strong lg:block" />
          {PRECOS.map((largura, i) => (
            <Bloco key={i} tom="creme" className={`${CHIP_FORMA} ${largura}`} />
          ))}
        </div>
        <div className={HOME_COLUNAS}>
          <div className={LISTA_ROLAGEM}>
            <div className={LISTA_SECTION}>
              <div className={LISTA_TOPO}>
                <span className="text-[12.5px] lg:text-[13px]">
                  <Linha tom="creme" className="w-32" />
                </span>
              </div>
              <ul className={LISTA_GRADE}>
                {Array.from({ length: CARDS }, (_, i) => (
                  <li key={i}>
                    <CafeCardSkeleton />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Bloco tom="mapa" className="hidden lg:block" />
        </div>
      </div>
    </>
  );
}

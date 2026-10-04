import {
  ASIDE_CTA,
  ASIDE_MAPA,
  ASIDE_MOLDURA,
  CARROSSEL,
  DETALHE_ASIDE_POSICAO,
  DETALHE_COLUNA,
  DETALHE_GRADE,
  DETALHE_MAIN,
  DETALHE_NOME,
  DETALHE_TAG,
  DETALHE_TRILHA,
} from "@/components/medidas";
import { Bloco, CarregandoStatus, Linha } from "@/components/skeleton";
import { SiteHeader } from "@/components/site-header";
import { VoltarAoMapa } from "@/components/voltar-ao-mapa";

const TAGS = ["w-[150px]", "w-[118px]", "w-[170px]", "w-[132px]", "w-[104px]"];

/**
 * Detalhe enquanto o café não chega. Só aparece na navegação dentro do site:
 * no acesso direto, o Next 14 espera o `generateMetadata` (que busca o mesmo
 * café) antes de mandar qualquer byte. Cobre a primeira tela — trilha,
 * carrossel, título, aside e comodidades —, com as medidas da página; o
 * "Voltar ao mapa" é de verdade, para desistir sem esperar.
 */
export function CafeDetailSkeleton() {
  return (
    <div className="min-h-screen">
      <CarregandoStatus>Carregando café…</CarregandoStatus>
      <SiteHeader />
      <main className={DETALHE_MAIN}>
        <nav aria-label="Trilha" className={DETALHE_TRILHA}>
          <VoltarAoMapa />
          <span aria-hidden="true" className="h-3.5 w-px flex-none bg-chip-line" />
          <Linha tom="creme" className="w-48" />
        </nav>

        <Bloco tom="creme" className={CARROSSEL} />

        <div aria-hidden="true" className={DETALHE_GRADE}>
          <div className={DETALHE_COLUNA}>
            <Bloco tom="creme" className="mb-3.5 h-7 w-[150px] rounded-full" />
            <div className={DETALHE_NOME}>
              <Linha tom="creme" className="w-3/4" />
            </div>
            <div className="mt-3.5 text-[15px]">
              <Linha tom="creme" className="w-2/3 max-w-[420px]" />
            </div>
          </div>

          <div className={`${ASIDE_MOLDURA} ${DETALHE_ASIDE_POSICAO}`}>
            <Bloco tom="mapa" className={ASIDE_MAPA} />
            <div className="flex flex-col gap-1 px-1">
              <span className="text-[14.5px]">
                <Linha className="w-3/4" />
              </span>
              <span className="text-[13px]">
                <Linha className="w-1/2" />
              </span>
            </div>
            {/* "Como chegar" e "Ver no Instagram" — quase todo café tem Instagram. */}
            <div className="flex flex-col gap-2">
              <Bloco className={ASIDE_CTA} />
              <Bloco className={ASIDE_CTA} />
            </div>
          </div>

          {/* No desktop, o corpo real (horário, avaliações) é sempre mais alto que o
              aside; sem a reserva, o grid esticaria a linha do título e o corpo desceria. */}
          <div className={`${DETALHE_COLUNA} lg:min-h-[320px]`}>
            <hr className="mb-[30px] hidden border-line lg:block lg:mt-[30px]" />
            <span className="mb-3.5 text-xs">
              <Linha tom="creme" className="w-28" />
            </span>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((largura) => (
                <span key={largura} className={`${DETALHE_TAG} ${largura}`}>
                  <Bloco className="h-[0.8em] flex-1 rounded-full" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

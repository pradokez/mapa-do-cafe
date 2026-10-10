import { CalendarIcon, CoffeeIcon, DollarSignIcon } from "@/components/icons";
import { FESTIVAL_CONTEUDO } from "@/components/medidas";
import { VoltarAoMapa } from "@/components/voltar-ao-mapa";
import {
  INSTAGRAM_DO_FESTIVAL,
  formatarPreco,
  periodoDaEdicao,
  rotuloDeParticipantes,
  rotuloDeStatus,
  type Edicao,
  type EstadoEdicao,
} from "@/lib/festival";

// Pílula de status (design 5a/5b): clara no ar, apagada na encerrada. O ponto
// é decorativo — o texto diz o estado.
const STATUS: Record<EstadoEdicao, { pilula: string; ponto: string }> = {
  futura: { pilula: "bg-cream text-espresso", ponto: "bg-brasa" },
  ativa: { pilula: "bg-cream text-espresso", ponto: "bg-terracotta" },
  encerrada: { pilula: "bg-cream/[.12] text-sobre-espresso", ponto: "bg-placeholder" },
};

type Props = {
  edicao: Edicao;
  estado: EstadoEdicao;
  participantes: number;
  agora: Date;
};

/** Topo da página do festival, em `espresso`: status, nome e ano, e o resumo da edição. */
export function FestivalFaixa({ edicao, estado, participantes, agora }: Props) {
  const { nome } = edicao.festival;
  const periodo = periodoDaEdicao(edicao);
  const preco = edicao.preco !== null ? formatarPreco(edicao.preco) : null;

  return (
    <div className="bg-espresso text-cream">
      <div className={`${FESTIVAL_CONTEUDO} flex flex-col gap-3 pb-6 pt-2.5 lg:gap-[18px] lg:pb-10 lg:pt-[22px]`}>
        <VoltarAoMapa className="min-h-11 self-start text-sm font-medium text-sobre-espresso-2 hover:text-cream lg:min-h-0 lg:text-[13.5px]" />
        <div className="flex max-w-[720px] flex-col gap-3 lg:gap-3.5">
          <p
            className={`inline-flex h-[26px] items-center gap-[7px] self-start rounded-full px-[11px] text-xs font-semibold lg:h-7 lg:px-3 lg:text-[12.5px] ${STATUS[estado].pilula}`}
          >
            <span aria-hidden="true" className={`size-1.5 rounded-full lg:size-[7px] ${STATUS[estado].ponto}`} />
            {rotuloDeStatus(edicao, agora)}
          </p>
          <h1 className="font-display text-[34px] leading-[1.05] lg:text-[60px] lg:leading-[1.02]">
            {nome} <span className="text-brasa">{edicao.ano}</span>
          </h1>
          {edicao.descricao && (
            // O mobile do design (5b) não tem a descrição.
            <p className="hidden text-pretty text-[16.5px] leading-[1.55] text-sobre-espresso lg:block">
              {edicao.descricao}
            </p>
          )}
          <p className="text-sm text-sobre-espresso-2 lg:hidden">
            {[periodo, participantes === 1 ? "1 café" : `${participantes} cafés`, preco && `combo a ${preco}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <ul className="hidden items-center gap-[18px] text-sm text-sobre-espresso-2 lg:flex">
            <li className="inline-flex items-center gap-[7px]">
              <CalendarIcon strokeWidth={2} />
              {periodo}
            </li>
            <li className="inline-flex items-center gap-[7px]">
              <CoffeeIcon strokeWidth={2} />
              {rotuloDeParticipantes(participantes)}
            </li>
            {preco && (
              <li className="inline-flex items-center gap-[7px]">
                <DollarSignIcon strokeWidth={2} />
                Combo a {preco}
              </li>
            )}
          </ul>
          <p className="text-xs text-sobre-espresso-2 lg:text-[12.5px]">
            Artes divulgadas no Instagram do{" "}
            <a
              href={INSTAGRAM_DO_FESTIVAL[edicao.festival.slug]}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-cream"
            >
              {nome}
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

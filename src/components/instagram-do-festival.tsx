import { INSTAGRAM_DO_FESTIVAL, type Edicao } from "@/lib/festival";

type Props = {
  festival: Edicao["festival"];
  className?: string;
};

/**
 * O nome do festival como link para o perfil dele no Instagram, onde as artes
 * foram divulgadas: o crédito das artes na faixa, na vitrine, na arte
 * ampliada e no combo do detalhe.
 */
export function InstagramDoFestival({ festival, className = "" }: Props) {
  return (
    <a
      href={INSTAGRAM_DO_FESTIVAL[festival.slug]}
      target="_blank"
      rel="noopener noreferrer"
      className={`underline underline-offset-2 ${className}`}
    >
      {festival.nome}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

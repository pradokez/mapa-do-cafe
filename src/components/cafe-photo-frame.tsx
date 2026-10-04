import { FotoDoStorage } from "@/components/foto-do-storage";
import type { PhotoSource } from "@/lib/cafe-photos";

/**
 * `priority`: carrega já, com preload (capa do detalhe, primeiros cards).
 * `eager`: carrega já, sem preload (vizinhas da foto à vista no carrossel).
 * `lazy`: só perto da viewport.
 */
export type Carregamento = "priority" | "eager" | "lazy";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  photo: PhotoSource;
  /** Texto alternativo da foto real; vazio quando o texto em volta já diz qual é o café. */
  alt?: string;
  carregamento?: Carregamento;
};

/**
 * Moldura de uma foto de `resolveCafePhotos`: placeholder vira o fundo
 * listrado, foto real vira `<FotoDoStorage fill>` cobrindo a moldura — que tem tamanho
 * próprio, então a foto chegando não mexe no layout. Quem chama dá o tamanho
 * (`className`) e o que vai por cima (`children`: selo, legenda).
 */
export function CafePhotoFrame({
  photo,
  alt = "",
  carregamento = "lazy",
  className = "",
  style,
  children,
  ...rest
}: Props) {
  return (
    <div
      {...rest}
      className={`relative overflow-hidden ${photo.kind === "url" ? "bg-hover-soft" : ""} ${className}`}
      style={photo.kind === "placeholder" ? { background: photo.background, ...style } : style}
    >
      {photo.kind === "url" && (
        <FotoDoStorage
          src={photo.src}
          alt={alt}
          fill
          priority={carregamento === "priority"}
          loading={carregamento === "priority" ? undefined : carregamento}
          className="object-cover"
        />
      )}
      {children}
    </div>
  );
}

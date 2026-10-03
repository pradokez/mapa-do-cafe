import type { PhotoSource } from "@/lib/cafe-photos";

type Props = React.HTMLAttributes<HTMLDivElement> & { photo: PhotoSource };

/**
 * Moldura de uma foto de `resolveCafePhotos`: placeholder vira o fundo
 * listrado, foto real vira `<img>` cobrindo a moldura. Quem chama dá o tamanho
 * (`className`) e o que vai por cima (`children`: selo, legenda).
 */
export function CafePhotoFrame({ photo, className = "", style, children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`relative overflow-hidden ${className}`}
      style={photo.kind === "placeholder" ? { background: photo.background, ...style } : style}
    >
      {photo.kind === "url" && (
        // eslint-disable-next-line @next/next/no-img-element -- fotos do Storage chegam na Fase 2
        <img src={photo.src} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {children}
    </div>
  );
}

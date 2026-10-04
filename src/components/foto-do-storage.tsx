import Image, { type ImageProps } from "next/image";

/**
 * Foto do Storage (#52): `next/image` sem o otimizador. Ela já chega em WebP
 * redimensionado do upload (#46) e vai direto do Supabase ao navegador. O
 * `next.config.mjs` liga `unoptimized` para o site todo; a prop repete aqui
 * porque fora do Next (Vitest) o config não vale.
 */
export function FotoDoStorage({ alt, ...props }: Omit<ImageProps, "unoptimized">) {
  return <Image alt={alt} {...props} unoptimized />;
}

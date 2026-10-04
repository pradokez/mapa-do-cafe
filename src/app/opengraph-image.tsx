import { OG_ALTURA, OG_LARGURA, SITE_NOME } from "@/lib/cafe-seo";
import { CHAMADA_HOME, imagemDaHome } from "@/lib/og/imagens";

// Imagem de compartilhamento da home (#49). Na raiz, vale também para as rotas
// sem imagem própria (o 404, por exemplo); o detalhe do café define a sua.
export const alt = `${SITE_NOME}. ${CHAMADA_HOME}`;
export const size = { width: OG_LARGURA, height: OG_ALTURA };
export const contentType = "image/png";

export default function Image() {
  return imagemDaHome();
}

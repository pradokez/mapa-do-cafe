import { listCafesAtivos } from "@/lib/cafe-repository";
import { imagemDoCafe } from "@/lib/og/imagens";

// Imagem de compartilhamento do café sem foto (#49); quem tem foto usa a capa
// (`imagemCompartilhamento`). Lê da lista em cache (1 h, tag `cafes`): rastreador
// de rede social repetindo o pedido não acorda o banco, e o `revalidarCafe` do
// admin já invalida. Café inexistente ou inativo → 404.
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const cafe = (await listCafesAtivos()).find(({ slug }) => slug === params.slug);
  if (!cafe) return new Response("Café não encontrado", { status: 404 });

  const imagem = await imagemDoCafe(cafe);
  imagem.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
  return imagem;
}

import type { Cafe } from "@/lib/cafe";
import type { FotoDoCafe } from "@/lib/cafe-repository";
import { hojeEmRecife } from "@/lib/foto-upload";

import { FotoUploadForm } from "./foto-upload-form";
import { ListaDeFotos } from "./lista-de-fotos";

/**
 * Seção Fotos de `/admin/cafes/[id]`: as fotos no ar (na ordem do site, a
 * primeira é a capa), com a autorização, para reordenar e remover (#51), e o
 * envio de uma foto nova com a autorização (#46).
 */
export function FotosCafe({ cafe, fotos }: { cafe: Pick<Cafe, "id" | "nome">; fotos: FotoDoCafe[] }) {
  return (
    <div className="mt-3 flex flex-col gap-6">
      <ListaDeFotos cafeId={cafe.id} nome={cafe.nome} fotos={fotos} />
      <FotoUploadForm cafeId={cafe.id} hoje={hojeEmRecife(new Date())} />
    </div>
  );
}

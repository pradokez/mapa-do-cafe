import Image from "next/image";

import type { Cafe } from "@/lib/cafe";
import { hojeEmRecife } from "@/lib/foto-upload";
import { isHttpUrl } from "@/lib/url";

import { FotoUploadForm } from "./foto-upload-form";

/**
 * Seção Fotos de `/admin/cafes/[id]`: o que já está no ar (na ordem do site,
 * a primeira é a capa) e o envio de uma foto nova com a autorização.
 * Ordenar, remover e ver a autorização de cada foto vêm na #51.
 */
export function FotosCafe({ cafe }: { cafe: Pick<Cafe, "id" | "nome" | "fotos"> }) {
  // Mesmo filtro do site (`resolveCafePhotos`): só URL http(s) vira `src`.
  const fotos = cafe.fotos.filter(isHttpUrl);

  return (
    <div className="mt-3 flex flex-col gap-6">
      {fotos.length === 0 ? (
        <p className="text-[14px] text-ink-2">Nenhuma foto ainda — o café aparece com o placeholder listrado.</p>
      ) : (
        <ul className="flex flex-wrap gap-3" aria-label={`Fotos no ar (${fotos.length})`}>
          {fotos.map((src, i) => (
            <li key={src} className="relative">
              <Image
                src={src}
                alt={`Foto ${i + 1} de ${fotos.length} — ${cafe.nome}`}
                width={112}
                height={112}
                className="size-[112px] rounded-lg border border-card-line object-cover"
              />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-cream px-2 py-0.5 text-[11.5px] font-semibold text-espresso">
                  Capa
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <FotoUploadForm cafeId={cafe.id} hoje={hojeEmRecife(new Date())} />
    </div>
  );
}

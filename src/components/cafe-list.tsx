import { CafeCard } from "@/components/cafe-card";
import type { Cafe } from "@/lib/cafe";
import { contadorLabel } from "@/lib/format";

export function CafeList({ cafes }: { cafes: Cafe[] }) {
  return (
    <section aria-label="Cafés" className="px-7 pb-8 pt-5">
      <p className="mb-4 flex min-h-6 items-center text-[13px] text-ink-3">
        {contadorLabel(cafes.length)}
      </p>
      <ul className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
        {cafes.map((cafe) => (
          <li key={cafe.id}>
            <CafeCard cafe={cafe} />
          </li>
        ))}
      </ul>
    </section>
  );
}

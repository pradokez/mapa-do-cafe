import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Cafe } from "./cafe";

import { resolveCafePhotos } from "./cafe-photos";

const ID = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";

const placeholderOf = (cafe: Pick<Cafe, "id" | "fotos">) => {
  const [photo] = resolveCafePhotos(cafe);
  if (photo.kind !== "placeholder") throw new Error("esperava placeholder");
  return photo.background;
};

describe("resolveCafePhotos", () => {
  it("café sem fotos resolve para um único placeholder listrado", () => {
    const photos = resolveCafePhotos({ id: ID, fotos: [] });

    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ kind: "placeholder" });
    expect(photos[0].kind === "placeholder" && photos[0].background).toMatch(
      /^repeating-linear-gradient\(135deg, #[0-9A-F]{6} 0 14px, #[0-9A-F]{6} 14px 28px\)$/,
    );
  });

  it("café com fotos do Storage resolve para elas, na ordem, sem placeholder", () => {
    const fotos = [
      "https://xyz.supabase.co/storage/v1/object/public/cafes/b.jpg",
      "https://xyz.supabase.co/storage/v1/object/public/cafes/a.jpg",
    ];

    expect(resolveCafePhotos({ id: ID, fotos })).toEqual([
      { kind: "url", src: fotos[0] },
      { kind: "url", src: fotos[1] },
    ]);
  });

  it("placeholder é determinístico: o mesmo café gera sempre o mesmo gradiente", () => {
    expect(placeholderOf({ id: ID, fotos: [] })).toBe(placeholderOf({ id: ID, fotos: [] }));
  });

  it("cafés diferentes do seed real se distribuem entre os tons do design", () => {
    const seed: Cafe[] = JSON.parse(
      readFileSync(new URL("../../supabase/seed/cafes.json", import.meta.url), "utf8"),
    );
    const tons = new Set(seed.map(placeholderOf));

    expect(tons.size).toBe(5);
  });

  it.each([
    ["nulo", null],
    ["ausente", undefined],
    ["não-array", "https://exemplo.com/a.jpg"],
    ["só entradas vazias ou inválidas", ["", "   ", "foto.jpg", "javascript:alert(1)", 42]],
  ])("fotos %s degrada para o placeholder sem lançar", (_, fotos) => {
    const photos = resolveCafePhotos({ id: ID, fotos } as unknown as Cafe);

    expect(photos).toEqual([
      { kind: "placeholder", background: placeholderOf({ id: ID, fotos: [] }) },
    ]);
  });

  it("descarta entradas inválidas e mantém as válidas na ordem", () => {
    const fotos = ["", "https://exemplo.com/a.jpg", "nao-e-url", "http://exemplo.com/b.jpg"];

    expect(resolveCafePhotos({ id: ID, fotos })).toEqual([
      { kind: "url", src: "https://exemplo.com/a.jpg" },
      { kind: "url", src: "http://exemplo.com/b.jpg" },
    ]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Cafe } from "./cafe";

import { resolveCafePhotos, tonsDoPlaceholder, urlsPublicasDasFotos } from "./cafe-photos";

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

  describe("com minSlots (carrossel do detalhe)", () => {
    it("fotos parcialmente preenchido: as reais primeiro, placeholders completam os slots", () => {
      const fotos = ["https://exemplo.com/a.jpg"];
      const photos = resolveCafePhotos({ id: ID, fotos }, { minSlots: 4 });

      expect(photos).toHaveLength(4);
      expect(photos[0]).toEqual({ kind: "url", src: fotos[0] });
      expect(photos.slice(1).every((p) => p.kind === "placeholder")).toBe(true);
    });

    it("mais fotos que slots: todas aparecem, na ordem, sem corte e sem placeholder", () => {
      const fotos = [1, 2, 3, 4, 5, 6].map((n) => `https://exemplo.com/${n}.jpg`);

      expect(resolveCafePhotos({ id: ID, fotos }, { minSlots: 4 })).toEqual(
        fotos.map((src) => ({ kind: "url", src })),
      );
    });

    it("cada slot de placeholder tem um tom, e o primeiro é o mesmo do card", () => {
      const slots = resolveCafePhotos({ id: ID, fotos: [] }, { minSlots: 4 }).map((p) =>
        p.kind === "placeholder" ? p.background : p.src,
      );

      expect(new Set(slots).size).toBe(4);
      expect(slots[0]).toBe(placeholderOf({ id: ID, fotos: [] }));
    });

    it.each([0, -3, NaN, 2.5])("minSlots inválido (%s) degrada para pelo menos um slot", (minSlots) => {
      const photos = resolveCafePhotos({ id: ID, fotos: [] }, { minSlots });

      expect(photos.length).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(photos.length)).toBe(true);
    });
  });

  it("descarta entradas inválidas e mantém as válidas na ordem", () => {
    const fotos = ["", "https://exemplo.com/a.jpg", "nao-e-url", "http://exemplo.com/b.jpg"];

    expect(resolveCafePhotos({ id: ID, fotos })).toEqual([
      { kind: "url", src: "https://exemplo.com/a.jpg" },
      { kind: "url", src: "http://exemplo.com/b.jpg" },
    ]);
  });

  describe("com tom escuro (sobre espresso, como a vitrine da home)", () => {
    const escuroDe = (cafe: Pick<Cafe, "id" | "fotos">) => {
      const [photo] = resolveCafePhotos(cafe, { tom: "escuro" });
      if (photo.kind !== "placeholder") throw new Error("esperava placeholder");
      return photo.background;
    };

    it("listra um tom escuro com o espresso, e não o par claro do card", () => {
      expect(escuroDe({ id: ID, fotos: [] })).toMatch(
        /^repeating-linear-gradient\(135deg, #[0-9A-F]{6} 0 12px, #2C1A0E 12px 24px\)$/,
      );
      expect(escuroDe({ id: ID, fotos: [] })).not.toBe(placeholderOf({ id: ID, fotos: [] }));
    });

    it("é determinístico, e cafés diferentes se distribuem entre os tons escuros do design", () => {
      const seed: Cafe[] = JSON.parse(
        readFileSync(new URL("../../supabase/seed/cafes.json", import.meta.url), "utf8"),
      );

      expect(escuroDe({ id: ID, fotos: [] })).toBe(escuroDe({ id: ID, fotos: [] }));
      expect(new Set(seed.map(escuroDe)).size).toBe(4);
    });

    it("não muda as fotos reais", () => {
      const fotos = ["https://exemplo.com/a.jpg"];

      expect(resolveCafePhotos({ id: ID, fotos }, { tom: "escuro" })).toEqual([{ kind: "url", src: fotos[0] }]);
    });
  });
});

describe("urlsPublicasDasFotos (caminho do Storage → URL pública)", () => {
  const BASE = "https://xyz.supabase.co";
  const CAMINHO = `${ID}/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.webp`;

  it("caminho do bucket cafe-fotos vira URL pública, na ordem", () => {
    const outro = `${ID}/0b3a4c1e-2d5f-4a6b-8c7d-9e0f1a2b3c4d.webp`;

    expect(urlsPublicasDasFotos([CAMINHO, outro], BASE)).toEqual([
      `${BASE}/storage/v1/object/public/cafe-fotos/${CAMINHO}`,
      `${BASE}/storage/v1/object/public/cafe-fotos/${outro}`,
    ]);
  });

  it("barra no fim da URL do projeto não duplica", () => {
    expect(urlsPublicasDasFotos([CAMINHO], `${BASE}/`)).toEqual([
      `${BASE}/storage/v1/object/public/cafe-fotos/${CAMINHO}`,
    ]);
  });

  it("o resultado é o que resolveCafePhotos mostra no lugar do placeholder", () => {
    const [foto] = resolveCafePhotos({ id: ID, fotos: urlsPublicasDasFotos([CAMINHO], BASE) });
    expect(foto).toEqual({ kind: "url", src: `${BASE}/storage/v1/object/public/cafe-fotos/${CAMINHO}` });
  });

  it("fotos ausentes ou malformadas não quebram", () => {
    expect(urlsPublicasDasFotos(null, BASE)).toEqual([]);
    const [foto] = resolveCafePhotos({ id: ID, fotos: urlsPublicasDasFotos(["../x", 42], BASE) });
    expect(foto.kind).toBe("placeholder");
  });
});

describe("tonsDoPlaceholder", () => {
  it("são as duas cores do placeholder do café — a imagem de compartilhamento repete as listras do card", () => {
    const [a, b] = tonsDoPlaceholder({ id: ID });
    expect(placeholderOf({ id: ID, fotos: [] })).toBe(
      `repeating-linear-gradient(135deg, ${a} 0 14px, ${b} 14px 28px)`,
    );
  });
});

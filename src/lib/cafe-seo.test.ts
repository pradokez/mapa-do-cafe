import { describe, expect, it } from "vitest";

import { cafe } from "./cafe.fixture";
import { descricaoCafe, imagemCompartilhamento, jsonLdCafe, tituloCafe } from "./cafe-seo";

describe("tituloCafe", () => {
  it("é o nome do café seguido do nome do site", () => {
    expect(tituloCafe(cafe("x", { nome: "81 Coffee Co." }))).toBe("81 Coffee Co. · Mapa do Café");
  });
});

describe("descricaoCafe", () => {
  it("local e faixa de preço", () => {
    const c = cafe("x", { bairro: "Graças", cidade: "Recife", faixa_preco: "$$" });
    expect(descricaoCafe(c)).toBe(
      "Café especial · Graças, Recife · preço moderado ($$). Endereço, horário e comodidades no Mapa do Café.",
    );
  });

  it("fora do Recife, usa o nome inteiro da cidade", () => {
    const c = cafe("x", { bairro: "Candeias", cidade: "Jaboatão dos Guararapes" });
    expect(descricaoCafe(c)).toContain("· Candeias, Jaboatão dos Guararapes ·");
  });

  it("muda de café para café", () => {
    const a = cafe("a", { bairro: "Graças" });
    const b = cafe("b", { bairro: "Espinheiro" });
    expect(descricaoCafe(a)).not.toBe(descricaoCafe(b));
  });
});

describe("jsonLdCafe", () => {
  const URL_CAFE = "https://mapa.example/cafes/x";

  it("descreve o café: tipo, nome, URL, endereço, coordenadas e faixa de preço", () => {
    const c = cafe("x", {
      nome: "81 Coffee Co.",
      endereco: "R. das Pernambucanas, 81",
      cidade: "Recife",
      lat: -8.0476,
      lng: -34.8977,
      faixa_preco: "$$",
    });
    expect(jsonLdCafe(c, URL_CAFE)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "CafeOrCoffeeShop",
      name: "81 Coffee Co.",
      url: URL_CAFE,
      address: {
        "@type": "PostalAddress",
        streetAddress: "R. das Pernambucanas, 81",
        addressLocality: "Recife",
        addressRegion: "PE",
        addressCountry: "BR",
      },
      geo: { "@type": "GeoCoordinates", latitude: -8.0476, longitude: -34.8977 },
      priceRange: "$$",
    });
  });

  it("café sem telefone, Instagram nem foto não ganha esses campos", () => {
    const ld = jsonLdCafe(cafe("x"), URL_CAFE);
    expect(ld).not.toHaveProperty("telephone");
    expect(ld).not.toHaveProperty("sameAs");
    expect(ld).not.toHaveProperty("image");
  });

  it("café com telefone e Instagram ganha telephone e sameAs", () => {
    const c = cafe("x", { telefone: "(81) 99455-7497", instagram: "https://instagram.com/81coffee" });
    expect(jsonLdCafe(c, URL_CAFE)).toMatchObject({
      telephone: "(81) 99455-7497",
      sameAs: ["https://instagram.com/81coffee"],
    });
  });

  it("Instagram que não é URL http(s) fica de fora", () => {
    const ld = jsonLdCafe(cafe("x", { instagram: "javascript:alert(1)" }), URL_CAFE);
    expect(ld).not.toHaveProperty("sameAs");
  });

  it("fotos reais viram image; URL inválida é descartada", () => {
    const c = cafe("x", { fotos: ["https://cdn.example/a.webp", "data:image/png;base64,xx"] });
    expect(jsonLdCafe(c, URL_CAFE)).toMatchObject({ image: ["https://cdn.example/a.webp"] });
  });

  describe("horário", () => {
    const semana = {
      segunda: "08:00 – 18:00",
      terca: "08:00 – 18:00",
      quarta: "08:00 – 18:00",
      quinta: "08:00 – 18:00",
      sexta: "08:30 – 12:30, 15:00 – 20:00",
      sabado: "14:00 – 00:00",
      domingo: "Fechado",
    };
    const horas = (horario: unknown) =>
      jsonLdCafe(cafe("x", { horario_funcionamento: horario as never }), URL_CAFE).openingHoursSpecification;
    const doDia = (horario: unknown, dia: string) =>
      (horas(horario) as { dayOfWeek: string }[]).filter((h) => h.dayOfWeek === dia);

    it("dia aberto vira uma entrada com abertura e fechamento", () => {
      expect(doDia(semana, "Monday")).toEqual([
        { "@type": "OpeningHoursSpecification", dayOfWeek: "Monday", opens: "08:00", closes: "18:00" },
      ]);
    });

    it("dois turnos viram duas entradas no mesmo dia", () => {
      expect(doDia(semana, "Friday")).toMatchObject([
        { opens: "08:30", closes: "12:30" },
        { opens: "15:00", closes: "20:00" },
      ]);
    });

    it("turno que fecha à meia-noite sai como está", () => {
      expect(doDia(semana, "Saturday")).toMatchObject([{ opens: "14:00", closes: "00:00" }]);
    });

    it('dia "Fechado" é marcado fechado de forma explícita (00:00 – 00:00)', () => {
      expect(doDia(semana, "Sunday")).toMatchObject([{ opens: "00:00", closes: "00:00" }]);
    });

    it("dia sem informação fica de fora — não é o mesmo que fechado", () => {
      expect(doDia({ ...semana, domingo: undefined }, "Sunday")).toEqual([]);
      expect(doDia({ ...semana, domingo: "das 8 às 18" }, "Sunday")).toEqual([]);
    });

    it("sai na ordem de segunda a domingo, qualquer que seja a ordem das chaves", () => {
      const embaralhado = Object.fromEntries(Object.entries(semana).reverse());
      const dias = (horas(embaralhado) as { dayOfWeek: string }[]).map((h) => h.dayOfWeek);
      expect(dias.filter((d, i) => dias.indexOf(d) === i)).toEqual([
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
      ]);
    });

    it("sem nenhum dia informado, o campo some", () => {
      expect(horas({})).toBeUndefined();
      expect(horas(null)).toBeUndefined();
    });
  });
});

describe("imagemCompartilhamento", () => {
  it("café sem foto usa a imagem gerada, 1200×630, pelo caminho relativo ao metadataBase", () => {
    const c = cafe("x", { slug: "borsoi-cafe-riomar", fotos: [] });
    expect(imagemCompartilhamento(c)).toMatchObject({
      url: "/cafes/borsoi-cafe-riomar/og",
      width: 1200,
      height: 630,
      type: "image/png",
    });
  });

  it("café com foto usa a capa (fotos[0]) como está, em WebP e sem dimensões fixas", () => {
    const capa = "https://xyz.supabase.co/storage/v1/object/public/cafe-fotos/a/1.webp";
    const c = cafe("x", { fotos: [capa, "https://xyz.supabase.co/storage/v1/object/public/cafe-fotos/a/2.webp"] });
    const imagem = imagemCompartilhamento(c);
    expect(imagem).toMatchObject({ url: capa, type: "image/webp" });
    expect(imagem).not.toHaveProperty("width");
  });

  it("foto que não é URL http(s) é ignorada: cai na imagem gerada", () => {
    const c = cafe("x", { slug: "x", fotos: ["javascript:alert(1)"] });
    expect(imagemCompartilhamento(c).url).toBe("/cafes/x/og");
  });

  it("o texto alternativo diz o nome e o local, com a cidade fora do Recife", () => {
    const recife = cafe("a", { nome: "Borsoi Café", bairro: "Pina", cidade: "Recife" });
    const olinda = cafe("b", { nome: "Café do Alto", bairro: "Carmo", cidade: "Olinda" });
    expect(imagemCompartilhamento(recife).alt).toBe("Borsoi Café · Pina");
    expect(imagemCompartilhamento(olinda).alt).toBe("Café do Alto · Carmo, Olinda");
  });
});

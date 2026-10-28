import { describe, expect, it } from "vitest";

import {
  dentroDoRaio,
  distanciaChipLabel,
  distanciaKm,
  distanciaLabel,
  formatarDistancia,
  OPCOES_DE_RAIO,
  ordenarPorDistancia,
  RAIOS_KM,
  raioLabel,
} from "./cafe-distance";

const MARCO_ZERO = { lat: -8.0631, lng: -34.8711 };

describe("distanciaKm", () => {
  it("mesmo ponto é 0", () => {
    expect(distanciaKm(MARCO_ZERO, MARCO_ZERO)).toBe(0);
  });

  it("1° de longitude no equador ≈ 111,19 km", () => {
    expect(distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.19, 1);
  });

  it("Londres → Paris ≈ 343,5 km, nos dois sentidos", () => {
    const londres = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    expect(Math.abs(distanciaKm(londres, paris)! - 343.5)).toBeLessThan(1);
    expect(distanciaKm(paris, londres)).toBeCloseTo(distanciaKm(londres, paris)!, 9);
  });

  it("antípodas: meia circunferência, sem NaN por arredondamento", () => {
    expect(distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(20015.09, 0);
    expect(distanciaKm({ lat: 90, lng: 0 }, { lat: -90, lng: 0 })).toBeCloseTo(20015.09, 0);
  });

  it("sem origem conhecida não há distância — nem 0, nem NaN", () => {
    expect(distanciaKm(null, MARCO_ZERO)).toBeNull();
  });

  it("coordenada inválida não vira NaN", () => {
    expect(distanciaKm({ lat: Number.NaN, lng: 0 }, MARCO_ZERO)).toBeNull();
  });
});

describe("formatarDistancia", () => {
  it("a partir de 1 km: uma casa decimal, com vírgula", () => {
    expect(formatarDistancia(1.234)).toBe("1,2 km");
    expect(formatarDistancia(9.25)).toBe("9,3 km");
  });

  it("longe de Recife: separador de milhar com ponto", () => {
    expect(formatarDistancia(2130.44)).toBe("2.130,4 km");
  });

  it("abaixo de 1 km: metros arredondados a 10 m", () => {
    expect(formatarDistancia(0.85)).toBe("850 m");
    expect(formatarDistancia(0.847)).toBe("850 m");
    expect(formatarDistancia(0.044)).toBe("40 m");
  });

  it("muito perto nunca vira 0 m: piso de 10 m", () => {
    expect(formatarDistancia(0.003)).toBe("10 m");
    expect(formatarDistancia(0)).toBe("10 m");
  });

  it("o que arredonda para 1000 m já é 1,0 km — nunca '1000 m'", () => {
    expect(formatarDistancia(0.995)).toBe("1,0 km");
    expect(formatarDistancia(1)).toBe("1,0 km");
  });
});

describe("distanciaLabel", () => {
  // Marco Zero → Alto da Sé (Olinda): 5,85 km em linha reta.
  const ALTO_DA_SE = { lat: -8.0136, lng: -34.8530 };

  it("com origem, a distância já formatada", () => {
    expect(distanciaLabel(MARCO_ZERO, ALTO_DA_SE)).toBe("5,9 km");
  });

  it("sem origem conhecida, nada a exibir", () => {
    expect(distanciaLabel(null, ALTO_DA_SE)).toBeNull();
  });
});

describe("ordenarPorDistancia", () => {
  // Ao norte do Marco Zero, a 0,01°, 0,02° e 0,03° de latitude.
  const perto = { nome: "perto", lat: -8.0531, lng: -34.8711 };
  const meio = { nome: "meio", lat: -8.0431, lng: -34.8711 };
  const longe = { nome: "longe", lat: -8.0331, lng: -34.8711 };
  const nomes = (itens: { nome: string }[]) => itens.map((i) => i.nome);

  it("com origem, do mais perto ao mais longe", () => {
    expect(nomes(ordenarPorDistancia([longe, perto, meio], MARCO_ZERO))).toEqual([
      "perto",
      "meio",
      "longe",
    ]);
  });

  it("sem origem conhecida, a ordem de entrada fica como está", () => {
    expect(nomes(ordenarPorDistancia([longe, perto, meio], null))).toEqual(["longe", "perto", "meio"]);
  });

  it("café com coordenada inválida vai para o fim, sem bagunçar os demais", () => {
    const semLugar = { nome: "sem lugar", lat: Number.NaN, lng: -34.8711 };
    expect(nomes(ordenarPorDistancia([semLugar, longe, perto, meio], MARCO_ZERO))).toEqual([
      "perto",
      "meio",
      "longe",
      "sem lugar",
    ]);
  });

  it("empate mantém a ordem de entrada: mesma entrada, mesma ordem", () => {
    const vizinho = { ...perto, nome: "vizinho" };
    const semLugarA = { nome: "sem lugar A", lat: Number.NaN, lng: 0 };
    const semLugarB = { nome: "sem lugar B", lat: 0, lng: Number.NaN };
    expect(nomes(ordenarPorDistancia([semLugarA, vizinho, semLugarB, perto], MARCO_ZERO))).toEqual([
      "vizinho",
      "perto",
      "sem lugar A",
      "sem lugar B",
    ]);
    expect(nomes(ordenarPorDistancia([semLugarB, perto, semLugarA, vizinho], MARCO_ZERO))).toEqual([
      "perto",
      "vizinho",
      "sem lugar B",
      "sem lugar A",
    ]);
  });

  it("não altera a lista recebida", () => {
    const entrada = [longe, perto, meio];
    ordenarPorDistancia(entrada, MARCO_ZERO);
    expect(nomes(entrada)).toEqual(["longe", "perto", "meio"]);
  });
});

describe("dentroDoRaio", () => {
  // Ao norte do Marco Zero: 0,009° ≈ 1,0 km; 0,0089° fica dentro de 1 km e 0,0091° fora.
  const dentro = { nome: "dentro", lat: -8.0542, lng: -34.8711 };
  const fora = { nome: "fora", lat: -8.054, lng: -34.8711 };
  const longe = { nome: "longe", lat: -8.0331, lng: -34.8711 };
  const nomes = (itens: { nome: string }[]) => itens.map((i) => i.nome);

  it("deixa só os cafés a até o raio da origem", () => {
    expect(distanciaKm(MARCO_ZERO, dentro)).toBeLessThan(1);
    expect(distanciaKm(MARCO_ZERO, fora)).toBeGreaterThan(1);
    expect(nomes(dentroDoRaio([longe, dentro, fora], MARCO_ZERO, 1))).toEqual(["dentro"]);
    expect(nomes(dentroDoRaio([longe, dentro, fora], MARCO_ZERO, 7))).toEqual(["longe", "dentro", "fora"]);
  });

  it("na borda exata do raio, o café entra", () => {
    const km = distanciaKm(MARCO_ZERO, fora)!;
    expect(nomes(dentroDoRaio([fora], MARCO_ZERO, km))).toEqual(["fora"]);
    expect(dentroDoRaio([fora], MARCO_ZERO, km - 1e-9)).toEqual([]);
  });

  it("sem origem conhecida, ninguém sai", () => {
    expect(nomes(dentroDoRaio([longe, dentro, fora], null, 1))).toEqual(["longe", "dentro", "fora"]);
  });

  it("com origem, café sem coordenada válida fica de fora", () => {
    const semLugar = { nome: "sem lugar", lat: Number.NaN, lng: -34.8711 };
    expect(nomes(dentroDoRaio([semLugar, dentro], MARCO_ZERO, 7))).toEqual(["dentro"]);
  });

  it("preserva a ordem de entrada (ordenar é do ordenarPorDistancia)", () => {
    expect(nomes(dentroDoRaio([fora, longe, dentro], MARCO_ZERO, 7))).toEqual(["fora", "longe", "dentro"]);
  });
});

describe("raios", () => {
  it("as opções são 1, 3 e 7 km, e a de desligar vem primeiro", () => {
    expect(RAIOS_KM).toEqual([1, 3, 7]);
    expect(OPCOES_DE_RAIO).toEqual([null, 1, 3, 7]);
  });

  it("o chip diz \"Distância\" até um raio ser escolhido", () => {
    expect(distanciaChipLabel(null)).toBe("Distância");
    expect(distanciaChipLabel(3)).toBe("Até 3 km");
  });

  it("rótulo do raio, e o de desligar", () => {
    expect(raioLabel(1)).toBe("Até 1 km");
    expect(raioLabel(7)).toBe("Até 7 km");
    expect(raioLabel(null)).toBe("Qualquer distância");
  });
});

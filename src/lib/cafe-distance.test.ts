import { describe, expect, it } from "vitest";

import { distanciaKm, distanciaLabel, formatarDistancia } from "./cafe-distance";

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
  // Marco Zero → Alto da Sé (Olinda): ~6 km em linha reta.
  const ALTO_DA_SE = { lat: -8.0136, lng: -34.8530 };

  it("com origem, a distância já formatada", () => {
    expect(distanciaLabel(MARCO_ZERO, ALTO_DA_SE)).toMatch(/^\d,\d km$/);
  });

  it("sem origem conhecida, nada a exibir", () => {
    expect(distanciaLabel(null, ALTO_DA_SE)).toBeNull();
  });
});

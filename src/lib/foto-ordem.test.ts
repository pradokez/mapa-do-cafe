import { describe, expect, it } from "vitest";

import { moverFoto, ordensParaGravar } from "./foto-ordem";

describe("moverFoto", () => {
  it("subir troca a foto com a anterior", () => {
    expect(moverFoto(["a", "b", "c"], "c", "subir")).toEqual(["a", "c", "b"]);
  });

  it("descer troca a foto com a seguinte", () => {
    expect(moverFoto(["a", "b", "c"], "a", "descer")).toEqual(["b", "a", "c"]);
  });

  it("capa leva a foto para o início, sem embaralhar as outras", () => {
    expect(moverFoto(["a", "b", "c", "d"], "c", "capa")).toEqual(["c", "a", "b", "d"]);
  });

  it("movimento que não muda nada, foto de fora ou movimento inválido devolvem null", () => {
    expect(moverFoto(["a", "b"], "a", "subir")).toBeNull();
    expect(moverFoto(["a", "b"], "a", "capa")).toBeNull();
    expect(moverFoto(["a", "b"], "b", "descer")).toBeNull();
    expect(moverFoto(["a", "b"], "z", "capa")).toBeNull();
    expect(moverFoto(["a", "b"], "b", "pular" as never)).toBeNull();
  });
});

describe("ordensParaGravar", () => {
  it("grava só as fotos cuja ordem muda", () => {
    const atuais = [
      { id: "a", ordem: 0 },
      { id: "b", ordem: 1 },
      { id: "c", ordem: 2 },
    ];
    expect(ordensParaGravar(atuais, ["a", "c", "b"])).toEqual([
      { id: "c", ordem: 1 },
      { id: "b", ordem: 2 },
    ]);
  });

  it("buracos e empates (de remoções ou de gravação pela metade) viram 0…n-1", () => {
    const atuais = [
      { id: "a", ordem: 0 },
      { id: "b", ordem: 0 },
      { id: "c", ordem: 7 },
    ];
    expect(ordensParaGravar(atuais, ["a", "b", "c"])).toEqual([
      { id: "b", ordem: 1 },
      { id: "c", ordem: 2 },
    ]);
  });

  it("já na ordem: nada a gravar", () => {
    expect(ordensParaGravar([{ id: "a", ordem: 0 }, { id: "b", ordem: 1 }], ["a", "b"])).toEqual([]);
  });
});

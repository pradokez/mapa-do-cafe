import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Cafe } from "./cafe";

import {
  coordenadasDaUrl,
  ehLinkDoMaps,
  horarioDosTurnos,
  normalizarInstagram,
  normalizarTelefone,
  parDeCoordenadas,
  turnosDoHorario,
  validarDadosCafe,
  validarHorarioDia,
} from "./cafe-dados";

const seed: Cafe[] = JSON.parse(readFileSync(new URL("../../supabase/seed/cafes.json", import.meta.url), "utf8"));

/** O que o formulário manda: o café sem o que não se edita. */
function dadosDe(cafe: Cafe) {
  const { id: _id, slug: _slug, fotos: _fotos, ativo: _ativo, ...dados } = cafe;
  return dados;
}

describe("validarHorarioDia", () => {
  it("aceita 'Fechado', um turno e turnos separados por ', '", () => {
    expect(validarHorarioDia("Fechado")).toBeNull();
    expect(validarHorarioDia("08:00 – 18:00")).toBeNull();
    expect(validarHorarioDia("08:30 – 12:30, 15:00 – 20:00")).toBeNull();
  });

  it("aceita turno que vira a meia-noite (fecha antes de abrir)", () => {
    expect(validarHorarioDia("14:00 – 00:00")).toBeNull();
    expect(validarHorarioDia("18:00 – 02:00")).toBeNull();
  });

  it("recusa formato fora de 'HH:MM – HH:MM' (hífen, sem zero, texto livre, vazio)", () => {
    for (const valor of ["08:00 - 18:00", "8:00 – 18:00", "das 8 às 18", "", "08:00 – 18:00,15:00 – 20:00", null]) {
      expect(validarHorarioDia(valor), String(valor)).toBe("Use o formato 08:00 – 18:00, ou marque Fechado.");
    }
  });

  it("aceita 24:00 só como fechamento (café 24 horas: '00:00 – 24:00')", () => {
    expect(validarHorarioDia("00:00 – 24:00")).toBeNull();
    expect(validarHorarioDia("24:00 – 08:00")).toBe("Hora inválida.");
  });

  it("recusa hora que não existe", () => {
    expect(validarHorarioDia("08:00 – 24:30")).toBe("Hora inválida.");
    expect(validarHorarioDia("08:60 – 18:00")).toBe("Hora inválida.");
  });

  it("recusa turno que abre e fecha na mesma hora", () => {
    expect(validarHorarioDia("08:00 – 08:00")).toBe("O turno precisa fechar depois de abrir.");
  });

  it("recusa turnos fora de ordem ou sobrepostos", () => {
    const erro = "Os turnos precisam estar em ordem e sem sobreposição.";
    expect(validarHorarioDia("15:00 – 20:00, 08:00 – 12:00")).toBe(erro);
    expect(validarHorarioDia("08:00 – 13:00, 12:00 – 18:00")).toBe(erro);
    // Só o último turno pode virar a meia-noite.
    expect(validarHorarioDia("20:00 – 01:00, 02:00 – 05:00")).toBe(erro);
  });
});

describe("turnosDoHorario / horarioDosTurnos (o formulário edita turnos, o banco guarda texto)", () => {
  it("separa os turnos e volta ao mesmo texto", () => {
    for (const valor of ["Fechado", "08:00 – 18:00", "08:30 – 12:30, 15:00 – 20:00", "14:00 – 00:00"]) {
      expect(horarioDosTurnos(turnosDoHorario(valor))).toBe(valor);
    }
    expect(turnosDoHorario("08:30 – 12:30, 15:00 – 20:00")).toEqual({
      fechado: false,
      turnos: [
        { abre: "08:30", fecha: "12:30" },
        { abre: "15:00", fecha: "20:00" },
      ],
    });
  });

  it("'Fechado' guarda um turno vazio para quando desmarcar", () => {
    expect(turnosDoHorario("Fechado")).toEqual({ fechado: true, turnos: [{ abre: "", fecha: "" }] });
    expect(horarioDosTurnos({ fechado: true, turnos: [{ abre: "08:00", fecha: "18:00" }] })).toBe("Fechado");
  });

  it("24 horas: o <input type=time> não tem 24:00, então '00:00 – 00:00' é o dia inteiro", () => {
    expect(turnosDoHorario("00:00 – 24:00")).toEqual({ fechado: false, turnos: [{ abre: "00:00", fecha: "00:00" }] });
    expect(horarioDosTurnos({ fechado: false, turnos: [{ abre: "00:00", fecha: "00:00" }] })).toBe("00:00 – 24:00");
  });

  it("valor fora do formato vira um turno vazio, para preencher de novo", () => {
    expect(turnosDoHorario("das 8 às 18")).toEqual({ fechado: false, turnos: [{ abre: "", fecha: "" }] });
    expect(turnosDoHorario(undefined)).toEqual({ fechado: false, turnos: [{ abre: "", fecha: "" }] });
  });
});

describe("normalizarInstagram", () => {
  it("aceita @, só o usuário ou o link do perfil, e guarda a URL completa", () => {
    for (const entrada of [
      "@borsoicafe",
      "borsoicafe",
      "instagram.com/borsoicafe",
      "https://instagram.com/borsoicafe",
      "https://www.instagram.com/borsoicafe/",
      "http://instagram.com/borsoicafe?igsh=abc123",
      "  @borsoicafe  ",
    ]) {
      expect(normalizarInstagram(entrada), entrada).toEqual({ ok: true, valor: "https://instagram.com/borsoicafe" });
    }
    expect(normalizarInstagram("@cafe.do_bairro")).toEqual({ ok: true, valor: "https://instagram.com/cafe.do_bairro" });
  });

  it("vazio é sem Instagram", () => {
    expect(normalizarInstagram("")).toEqual({ ok: true, valor: null });
    expect(normalizarInstagram("   ")).toEqual({ ok: true, valor: null });
    expect(normalizarInstagram(null)).toEqual({ ok: true, valor: null });
  });

  it("recusa outro site, post em vez de perfil, javascript: e usuário inválido", () => {
    for (const entrada of [
      "https://facebook.com/borsoicafe",
      "https://instagram.com.evil.com/borsoicafe",
      "https://instagram.com/p/C1abcDEF/",
      "javascript:alert(1)",
      "@borsoi café",
      "@" + "a".repeat(31),
    ]) {
      expect(normalizarInstagram(entrada), entrada).toEqual({
        ok: false,
        erro: "Use o @ ou o link do perfil no Instagram.",
      });
    }
  });
});

describe("normalizarTelefone", () => {
  it("com DDD, qualquer pontuação: guarda no formato do site", () => {
    expect(normalizarTelefone("81 99908-4986")).toEqual({ ok: true, valor: "(81) 99908-4986" });
    expect(normalizarTelefone("(81)999084986")).toEqual({ ok: true, valor: "(81) 99908-4986" });
    expect(normalizarTelefone("81 3071.6834")).toEqual({ ok: true, valor: "(81) 3071-6834" });
    expect(normalizarTelefone("(81) 3071-6834")).toEqual({ ok: true, valor: "(81) 3071-6834" });
  });

  it("vazio é sem telefone", () => {
    expect(normalizarTelefone("  ")).toEqual({ ok: true, valor: null });
    expect(normalizarTelefone(undefined)).toEqual({ ok: true, valor: null });
  });

  it("recusa sem DDD, celular sem o 9 e número com dígitos demais", () => {
    for (const entrada of ["99908-4986", "81 89908-4986", "81 999084986 0", "+55 81 99908-4986", "0800 123 4567"]) {
      expect(normalizarTelefone(entrada), entrada).toEqual({
        ok: false,
        erro: "Use DDD e número, ex.: (81) 99999-9999.",
      });
    }
  });
});

const BORSOI =
  "https://www.google.com/maps/place/Borsoi+Caf%C3%A9/@-8.1046293,-34.8901222,17z/data=!3m1!4b1!4m6!3m5!1s0x7ab1f0dac745dcf:0xe23542388b9372c7!8m2!3d-8.1046346!4d-34.8875473!16s%2Fg%2F11c5hw77pm?entry=tts";

describe("coordenadasDaUrl (link completo do Google Maps)", () => {
  it("usa o ponto do lugar (!3d…!4d…), não o centro da tela (@…)", () => {
    expect(coordenadasDaUrl(BORSOI)).toEqual({ lat: -8.1046346, lng: -34.8875473 });
  });

  it("sem o ponto do lugar, usa o centro da tela ou o ?q=lat,lng", () => {
    expect(coordenadasDaUrl("https://www.google.com/maps/@-8.0631,-34.8711,15z")).toEqual({ lat: -8.0631, lng: -34.8711 });
    expect(coordenadasDaUrl("https://maps.google.com/?q=-8.0631,-34.8711")).toEqual({ lat: -8.0631, lng: -34.8711 });
  });

  it("link sem coordenadas (busca por nome) ou que não é URL dá null", () => {
    expect(coordenadasDaUrl("https://www.google.com/maps/search/borsoi+cafe")).toBeNull();
    expect(coordenadasDaUrl("não é link")).toBeNull();
  });
});

describe("ehLinkDoMaps (o servidor só segue links do Google Maps)", () => {
  it("aceita o link curto de compartilhar e o do Google Maps, em https", () => {
    for (const url of [
      "https://maps.app.goo.gl/E7D9JZewVfG9fCVL7",
      "https://goo.gl/maps/abc123",
      "https://www.google.com/maps/place/x",
      "https://www.google.com.br/maps/@-8,-34,15z",
      "https://maps.google.com/?q=-8,-34",
    ]) {
      expect(ehLinkDoMaps(url), url).toBe(true);
    }
  });

  it("recusa http, outro host, host parecido e outro serviço do Google", () => {
    for (const url of [
      "http://maps.app.goo.gl/E7D9JZewVfG9fCVL7",
      "https://evil.com/maps",
      "https://maps.app.goo.gl.evil.com/x",
      "https://goo.gl/outra-coisa",
      "https://www.google.com/search?q=cafe",
      "https://user@maps.app.goo.gl/x",
      "https://localhost/maps",
      "não é link",
    ]) {
      expect(ehLinkDoMaps(url), url).toBe(false);
    }
  });
});

describe("parDeCoordenadas (colado no campo de latitude)", () => {
  it("lê o par que o Google Maps copia, com ponto ou vírgula decimal", () => {
    expect(parDeCoordenadas("-8.0631, -34.8711")).toEqual({ lat: -8.0631, lng: -34.8711 });
    expect(parDeCoordenadas("  -8.0631,-34.8711 ")).toEqual({ lat: -8.0631, lng: -34.8711 });
    expect(parDeCoordenadas("-8,0631; -34,8711")).toEqual({ lat: -8.0631, lng: -34.8711 });
  });

  it("um número só não é par", () => {
    expect(parDeCoordenadas("-8.0631")).toBeNull();
    expect(parDeCoordenadas("-8,0631")).toBeNull();
  });
});

describe("validarDadosCafe", () => {
  it("os 53 cafés do seed passam sem mudar nada: as regras não recusam dado real", () => {
    for (const cafe of seed) {
      expect(validarDadosCafe(dadosDe(cafe)), cafe.slug).toEqual({ ok: true, valores: dadosDe(cafe) });
    }
  });

  const base = () => dadosDe(seed.find((c) => c.slug === "borsoi-cafe-riomar")!);
  const errosDe = (dados: unknown) => {
    const resultado = validarDadosCafe(dados);
    return resultado.ok ? {} : resultado.erros;
  };

  it("deriva bairro_slug do bairro e ignora o que vier no payload", () => {
    const resultado = validarDadosCafe({ ...base(), bairro: "  Poço da Panela ", bairro_slug: "outro" });
    expect(resultado.ok && resultado.valores).toMatchObject({ bairro: "Poço da Panela", bairro_slug: "poco-da-panela" });
  });

  it("nunca deixa passar id, slug, fotos nem ativo — nem chave desconhecida", () => {
    const resultado = validarDadosCafe({ ...base(), id: "x", slug: "novo-slug", fotos: ["a"], ativo: false, extra: 1 });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      for (const chave of ["id", "slug", "fotos", "ativo", "extra"]) expect(resultado.valores).not.toHaveProperty(chave);
    }
  });

  it("nome, bairro e endereço são obrigatórios e têm limite", () => {
    expect(errosDe({ ...base(), nome: "  ", bairro: "", endereco: undefined })).toEqual({
      nome: "Informe o nome do café.",
      bairro: "Informe o bairro.",
      endereco: "Informe o endereço.",
    });
    expect(errosDe({ ...base(), nome: "a".repeat(101) })).toEqual({ nome: "Use até 100 caracteres." });
  });

  it("cidade e faixa de preço só das listas do banco", () => {
    expect(errosDe({ ...base(), cidade: "Paulista", faixa_preco: "$$$$" })).toEqual({
      cidade: "Escolha a cidade.",
      faixa_preco: "Escolha a faixa de preço.",
    });
    for (const cidade of ["Recife", "Olinda", "Jaboatão dos Guararapes"]) {
      expect(errosDe({ ...base(), cidade }), cidade).toEqual({});
    }
  });

  it("lat e lng aceitam vírgula decimal e precisam estar na região", () => {
    const ok = validarDadosCafe({ ...base(), lat: "-8,0631", lng: " -34.8711 " });
    expect(ok.ok && [ok.valores.lat, ok.valores.lng]).toEqual([-8.0631, -34.8711]);

    const trocados = "Fora de Recife, Olinda e Jaboatão — confira se lat e lng não estão trocados.";
    expect(errosDe({ ...base(), lat: -34.8711, lng: -8.0631 })).toEqual({ lat: trocados });
    expect(errosDe({ ...base(), lat: 8.0631, lng: -34.8711 })).toEqual({ lat: trocados });
    expect(errosDe({ ...base(), lat: "", lng: "abc" })).toEqual({
      lat: "Informe a latitude, ex.: -8,0631.",
      lng: "Informe a longitude, ex.: -34,8711.",
    });
  });

  it("selos e comodidades são booleanos; ar-condicionado aceita sem informação (null)", () => {
    for (const ar of [true, false, null]) {
      const resultado = validarDadosCafe({ ...base(), tem_ar_condicionado: ar });
      expect(resultado.ok && resultado.valores.tem_ar_condicionado, String(ar)).toBe(ar);
    }
    expect(errosDe({ ...base(), aceita_pets: "true", tem_ar_condicionado: undefined })).toEqual({
      aceita_pets: "Valor inválido.",
      tem_ar_condicionado: "Escolha uma opção.",
    });
    expect(errosDe({ ...base(), aceita_pets: null })).toEqual({ aceita_pets: "Valor inválido." });
  });

  it("horário com as 7 chaves: dia faltando ou inválido erra naquele dia; chave a mais não é gravada", () => {
    const { domingo: _domingo, ...semDomingo } = base().horario_funcionamento;
    expect(errosDe({ ...base(), horario_funcionamento: { ...semDomingo, sabado: "8h às 12h" } })).toEqual({
      "horario.sabado": "Use o formato 08:00 – 18:00, ou marque Fechado.",
      "horario.domingo": "Use o formato 08:00 – 18:00, ou marque Fechado.",
    });

    const resultado = validarDadosCafe({
      ...base(),
      horario_funcionamento: { ...base().horario_funcionamento, segunda: "Fechado", feriado: "Fechado" },
    });
    expect(resultado.ok && Object.keys(resultado.valores.horario_funcionamento).sort()).toEqual(
      ["domingo", "quarta", "quinta", "sabado", "segunda", "sexta", "terca"],
    );
    expect(resultado.ok && resultado.valores.horario_funcionamento.segunda).toBe("Fechado");
  });

  it("Instagram e telefone vazios viram null; preenchidos saem normalizados", () => {
    const vazios = validarDadosCafe({ ...base(), instagram: "", telefone: "  " });
    expect(vazios.ok && [vazios.valores.instagram, vazios.valores.telefone]).toEqual([null, null]);

    const preenchidos = validarDadosCafe({ ...base(), instagram: "@borsoicafe", telefone: "81999084986" });
    expect(preenchidos.ok && [preenchidos.valores.instagram, preenchidos.valores.telefone]).toEqual([
      "https://instagram.com/borsoicafe",
      "(81) 99908-4986",
    ]);

    expect(errosDe({ ...base(), instagram: "https://facebook.com/x", telefone: "123" })).toEqual({
      instagram: "Use o @ ou o link do perfil no Instagram.",
      telefone: "Use DDD e número, ex.: (81) 99999-9999.",
    });
  });

  it("payload que não é objeto é recusado sem quebrar", () => {
    for (const entrada of [null, "texto", 42, []]) {
      expect(validarDadosCafe(entrada).ok, String(entrada)).toBe(false);
    }
  });
});

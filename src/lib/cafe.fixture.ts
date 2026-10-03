import type { Cafe } from "./cafe";

/** Café mínimo para teste: tudo desligado, fechado a semana toda; `atributos` sobrescreve. */
export function cafe(id: string, atributos: Partial<Cafe> = {}): Cafe {
  return {
    id,
    slug: id,
    nome: id,
    bairro: "Graças",
    bairro_slug: "gracas",
    endereco: "Rua X, 1",
    cidade: "Recife",
    lat: -8.05,
    lng: -34.9,
    selo_ascape: false,
    selo_eu_amo_cafe: false,
    aceita_pets: false,
    tem_estacionamento: false,
    permite_coffee_office: false,
    acessivel_pcd: false,
    opcoes_vegetarianas: false,
    tem_ar_condicionado: null,
    faixa_preco: "$$",
    horario_funcionamento: {
      segunda: "Fechado",
      terca: "Fechado",
      quarta: "Fechado",
      quinta: "Fechado",
      sexta: "Fechado",
      sabado: "Fechado",
      domingo: "Fechado",
    },
    instagram: null,
    telefone: null,
    fotos: [],
    ativo: true,
    ...atributos,
  };
}

// `.mjs`, não `.ts`: o `next.config.mjs` monta os redirects daqui, e o Node não
// importa TypeScript. O `cafe-dados` lê a mesma lista para recusar esses slugs
// num café novo — o redirect venceria e o café ficaria inacessível.

/** Slug que mudou → slug atual. Links antigos seguem valendo (308). */
export const SLUGS_ANTIGOS = [
  // #38: o Borsoi do RioMar ganhou slug próprio.
  { de: "borsoi-cafe", para: "borsoi-cafe-riomar" },
];

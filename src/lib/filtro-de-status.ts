/**
 * Filtro por chips de status das listas do admin (sugestões, revisões):
 * o que a URL pede e o que cada clique aplica. `todos` está na ordem dos chips.
 */

/** Status desconhecido é ignorado, e sem nenhum válido vale o padrão. Sempre na ordem dos chips. */
export function statusDoParam<S extends string>(
  todos: readonly S[],
  padrao: readonly S[],
  param: string | string[] | undefined,
): S[] {
  const pedidos = ([param].flat()[0] ?? "").split(",");
  const status = todos.filter((s) => pedidos.includes(s));
  return status.length > 0 ? status : [...padrao];
}

/**
 * O filtro que um chip aplica ao ser clicado: liga ou desliga aquele status.
 * O último ligado não desliga — um filtro vazio cairia no padrão, e o clique
 * pareceria fazer o contrário.
 */
export function alternarEm<S extends string>(todos: readonly S[], atuais: readonly S[], status: S): S[] {
  const ligado = atuais.includes(status);
  if (ligado && atuais.length === 1) return [...atuais];
  return todos.filter((s) => (s === status ? !ligado : atuais.includes(s)));
}

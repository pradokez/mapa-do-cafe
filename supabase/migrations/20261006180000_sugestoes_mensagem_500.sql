-- Issue #89: o limite da mensagem cai de 2.000 para 500 caracteres — recado
-- curto sobre a plataforma, lido um a um na triagem. O mínimo de 10 fica.
--
-- A `enviar_sugestao` não repete o número: quem revalida é este check. O
-- original era inline (`sugestoes_mensagem_check`, nome dado pelo Postgres);
-- sem `if exists`, para falhar alto se o nome não bater. Sem `not valid`: a
-- única sugestão em produção era de teste — se passar de 500, o `add` falha
-- e ela pode ser apagada antes (mensagem real nunca se corta).

alter table public.sugestoes drop constraint sugestoes_mensagem_check;

alter table public.sugestoes add constraint sugestoes_mensagem_check
  check (char_length(mensagem) between 10 and 500);

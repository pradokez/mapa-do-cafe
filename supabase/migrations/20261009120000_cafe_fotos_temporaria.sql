-- Issue #92: foto temporária — no ar como qualquer outra, marcada no admin
-- como "trocar depois" enquanto o café não ganha a foto definitiva.
--
-- Só `cafe_fotos` (já só do admin: RLS e grants não mudam). O público lê
-- `cafes.fotos`, que o trigger continua derivando só dos caminhos: a marca
-- nunca chega ao site.

alter table public.cafe_fotos
  add column temporaria boolean not null default false;

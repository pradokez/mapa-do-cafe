-- Issue #17: o array `comodidades` não tinha consumidor — as tags de
-- "Comodidades" do detalhe vêm do selo, dos 3 booleanos e da faixa de preço.
-- A constraint `cafes_comodidades_check` cai junto com a coluna.

alter table public.cafes drop column comodidades;

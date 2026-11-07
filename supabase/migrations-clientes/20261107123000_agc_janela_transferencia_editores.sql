-- Banco: murano-clientes. JÁ APLICADO em 07/11/2026.
-- Só Rômulo e Jonatas podem alterar a janela de transferência AGC.
begin;
create table public.agc_janela_editores (
  email text primary key check (email = lower(email)),
  nome text,
  criado_em timestamptz not null default now()
);
insert into public.agc_janela_editores (email, nome) values
  ('romuloalbuquerque@muranoprofessional.com.br', 'Rômulo'),
  ('jonatassilva@muranoprofessional.com.br', 'Jonatas');
alter table public.agc_janela_editores enable row level security;
create policy agc_janela_editores_leitura on public.agc_janela_editores for select to anon, authenticated using (true);
grant select on public.agc_janela_editores to anon, authenticated;

drop function public.agc_remover_excecao_janela(text);

create or replace function public.agc_definir_janela(p_mes text, p_dia int, p_usuario text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from agc_janela_editores where email = lower(trim(coalesce(p_usuario, '')))) then
    raise exception 'Sem permissão para alterar a janela de transferência.';
  end if;
  if p_dia is null or p_dia < 5 or p_dia > 31 then
    raise exception 'Dia limite deve ficar entre 5 e 31.';
  end if;
  insert into agc_janela_transferencia (mes_referencia, dia_limite, atualizado_por, atualizado_em)
  values (coalesce(nullif(p_mes, ''), 'padrao'), p_dia, lower(trim(p_usuario)), now())
  on conflict (mes_referencia) do update
    set dia_limite = excluded.dia_limite, atualizado_por = excluded.atualizado_por, atualizado_em = now();
end;
$$;

create function public.agc_remover_excecao_janela(p_mes text, p_usuario text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from agc_janela_editores where email = lower(trim(coalesce(p_usuario, '')))) then
    raise exception 'Sem permissão para alterar a janela de transferência.';
  end if;
  if p_mes is null or p_mes = 'padrao' then
    raise exception 'O prazo padrão não pode ser removido, só alterado.';
  end if;
  delete from agc_janela_transferencia where mes_referencia = p_mes;
end;
$$;
revoke all on function public.agc_remover_excecao_janela(text,text) from public;
grant execute on function public.agc_remover_excecao_janela(text,text) to anon, authenticated;
commit;

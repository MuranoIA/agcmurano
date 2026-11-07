-- Banco: murano-clientes (api-clientes.muranoprofessional.com.br). JÁ APLICADO em 07/11/2026.
-- Janela de transferência da carteira AGC configurável pelo gestor.
-- A regra original (trg_janela_transferencia_agc, dias 1-5) pertence a supabase_admin e
-- não foi alterada. O gatilho abaixo roda antes dela (ordem alfabética) e, se o dia estiver
-- dentro do prazo da tabela, liga a liberação que a regra original já aceita
-- (app.bypass_janela_transferencia), só na transação corrente.
begin;
create table public.agc_janela_transferencia (
  mes_referencia text primary key check (mes_referencia = 'padrao' or mes_referencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  dia_limite int not null check (dia_limite between 5 and 31),
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
insert into public.agc_janela_transferencia (mes_referencia, dia_limite, atualizado_por)
values ('padrao', 9, 'implantação (pedido do dono, 07/11/2026)');

alter table public.agc_janela_transferencia enable row level security;
create policy agc_janela_leitura on public.agc_janela_transferencia for select to anon, authenticated using (true);
grant select on public.agc_janela_transferencia to anon, authenticated;

create or replace function public.agc_janela_limite(p_quando timestamptz default now())
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select dia_limite from agc_janela_transferencia where mes_referencia = to_char(p_quando at time zone 'America/Belem', 'YYYY-MM')),
    (select dia_limite from agc_janela_transferencia where mes_referencia = 'padrao'),
    5);
$$;

create or replace function public.agc_prazo_janela_libera()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if extract(day from (now() at time zone 'America/Belem'))::int <= agc_janela_limite(now()) then
    perform set_config('app.bypass_janela_transferencia', 'true', true);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_a_prazo_janela_agc
  before insert or update or delete on public.grandes_contas
  for each row execute function public.agc_prazo_janela_libera();

create or replace function public.agc_definir_janela(p_mes text, p_dia int, p_usuario text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_dia is null or p_dia < 5 or p_dia > 31 then
    raise exception 'Dia limite deve ficar entre 5 e 31.';
  end if;
  insert into agc_janela_transferencia (mes_referencia, dia_limite, atualizado_por, atualizado_em)
  values (coalesce(nullif(p_mes, ''), 'padrao'), p_dia, p_usuario, now())
  on conflict (mes_referencia) do update
    set dia_limite = excluded.dia_limite, atualizado_por = excluded.atualizado_por, atualizado_em = now();
end;
$$;

create or replace function public.agc_remover_excecao_janela(p_mes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_mes is null or p_mes = 'padrao' then
    raise exception 'O prazo padrão não pode ser removido, só alterado.';
  end if;
  delete from agc_janela_transferencia where mes_referencia = p_mes;
end;
$$;

revoke all on function public.agc_definir_janela(text,int,text), public.agc_remover_excecao_janela(text), public.agc_prazo_janela_libera() from public;
grant execute on function public.agc_definir_janela(text,int,text), public.agc_remover_excecao_janela(text) to anon, authenticated;
grant execute on function public.agc_janela_limite(timestamptz) to anon, authenticated;
commit;

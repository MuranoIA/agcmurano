-- Banco: murano-clientes (api-clientes.muranoprofessional.com.br)
-- Amplia a janela de transferencia da carteira AGC (trigger trg_janela_transferencia_agc
-- em grandes_contas) ate o dia 9 em novembro/2026, como ja foi feito em outubro/2026.
-- A funcao pertence a supabase_admin: aplicar no SQL Editor do Studio como supabase_admin.
CREATE OR REPLACE FUNCTION public.check_janela_transferencia_agc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_dia int;
  v_mes int;
  v_ano int;
  v_bypass text;
  v_limite int;
BEGIN
  v_bypass := current_setting('app.bypass_janela_transferencia', true);
  IF v_bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_dia := extract(day from (now() AT TIME ZONE 'America/Belem'))::int;
  v_mes := extract(month from (now() AT TIME ZONE 'America/Belem'))::int;
  v_ano := extract(year from (now() AT TIME ZONE 'America/Belem'))::int;

  -- Janela padrao: dias 1-5. Excecoes pontuais: outubro/2026 e novembro/2026 vao ate dia 9.
  v_limite := 5;
  IF v_ano = 2026 AND v_mes IN (10, 11) THEN
    v_limite := 9;
  END IF;

  IF v_dia NOT BETWEEN 1 AND v_limite THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Janela de transferencia AGC fechada (so dias 1-% do mes). Inclusao de cliente % bloqueada.', v_limite, NEW.cod_cliente;
    ELSIF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Janela de transferencia AGC fechada (so dias 1-% do mes). Remocao de cliente % bloqueada.', v_limite, OLD.cod_cliente;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.ativo IS DISTINCT FROM OLD.ativo OR NEW.vendedor IS DISTINCT FROM OLD.vendedor THEN
        RAISE EXCEPTION 'Janela de transferencia AGC fechada (so dias 1-% do mes). Alteracao de carteira do cliente % bloqueada.', v_limite, NEW.cod_cliente;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

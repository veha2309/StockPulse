-- Apply once in the Supabase SQL editor before deploying the logic fixes.
-- All functions below are service-role-only. No account data is deleted.
BEGIN;

CREATE TABLE IF NOT EXISTS public.recharge_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_email text NOT NULL, user_name text, requested_amount integer NOT NULL DEFAULT 10000, description text, status text DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), created_at timestamptz DEFAULT now(), resolved_at timestamptz, admin_note text);

CREATE TABLE IF NOT EXISTS public.stockpulse_rate_limits (
  key text PRIMARY KEY, hits integer NOT NULL, reset_at timestamptz NOT NULL
);
ALTER TABLE public.stockpulse_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stockpulse_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.stockpulse_rate_limit(p_key text, p_limit integer, p_window integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hits integer;
BEGIN
  DELETE FROM stockpulse_rate_limits WHERE reset_at < now() - interval '1 day';
  INSERT INTO stockpulse_rate_limits AS r (key, hits, reset_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window))
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.hits + 1 END,
    reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => p_window) ELSE r.reset_at END
  RETURNING r.hits INTO hits;
  RETURN hits <= p_limit;
END $$;

CREATE OR REPLACE FUNCTION public.stockpulse_register(p_email text, p_name text, p_password text, p_otp text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE code public.email_otps%ROWTYPE; account public.users%ROWTYPE;
BEGIN
  SELECT * INTO code FROM email_otps WHERE email = p_email AND otp = p_otp AND verified = false AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_OTP'; END IF;
  INSERT INTO users (email, name, password, etokens, e_tokens, portfolio, options)
    VALUES (p_email, p_name, p_password, 10000, 10000, '[]', '[]') RETURNING * INTO account;
  DELETE FROM email_otps WHERE email = p_email;
  RETURN to_jsonb(account);
END $$;

CREATE OR REPLACE FUNCTION public.stockpulse_commit_trade(p_email text, p_expected jsonb, p_state jsonb, p_kind text, p_trade jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE account public.users%ROWTYPE; snapshot jsonb; receipt jsonb;
BEGIN
  SELECT * INTO account FROM users WHERE email = p_email FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF p_kind = 'equity' THEN SELECT to_jsonb(t) INTO receipt FROM trades t WHERE _id = p_trade->>'_id';
  ELSIF p_kind = 'option' THEN SELECT to_jsonb(t) INTO receipt FROM option_trades t WHERE _id = p_trade->>'_id'; END IF;
  IF receipt IS NOT NULL THEN
    IF receipt->>'email' <> p_email OR receipt->>'action' <> p_trade->>'action' OR
      (p_kind = 'equity' AND (receipt->>'symbol' <> p_trade->>'symbol' OR (receipt->>'amount')::numeric <> (p_trade->>'amount')::numeric)) OR
      (p_kind = 'option' AND (receipt->>'contractSymbol' <> p_trade->>'contractSymbol' OR (receipt->>'lots')::numeric <> (p_trade->>'lots')::numeric))
    THEN RAISE EXCEPTION 'ORDER_ID_REUSED'; END IF;
    RETURN to_jsonb(account) || jsonb_build_object('executionPrice',coalesce(receipt->'price',receipt->'premium'),'total',receipt->'total');
  END IF;
  snapshot := jsonb_build_object('balance', coalesce(account.etokens, account.e_tokens, 0), 'portfolio', coalesce(account.portfolio, '[]'), 'options', coalesce(account.options, '[]'));
  IF snapshot <> p_expected THEN RAISE EXCEPTION 'CONFLICT'; END IF;
  IF (p_state->>'eTokens')::numeric < 0 OR (p_trade->>'total')::numeric <= 0 OR p_trade->>'action' NOT IN ('buy','sell') THEN RAISE EXCEPTION 'INVALID_TRADE'; END IF;
  UPDATE users SET etokens = (p_state->>'eTokens')::numeric, e_tokens = (p_state->>'eTokens')::numeric,
    portfolio = p_state->'portfolio', options = p_state->'options' WHERE email = p_email RETURNING * INTO account;
  IF p_kind = 'equity' THEN
    INSERT INTO trades (_id,email,action,symbol,amount,price,total,timestamp)
    VALUES (p_trade->>'_id',p_email,p_trade->>'action',p_trade->>'symbol',(p_trade->>'amount')::numeric,(p_trade->>'price')::numeric,(p_trade->>'total')::numeric,p_trade->>'timestamp');
  ELSIF p_kind = 'option' THEN
    INSERT INTO option_trades (_id,email,action,"contractSymbol","underlyingSymbol","optionType",strike,expiration,lots,premium,total,timestamp)
    VALUES (p_trade->>'_id',p_email,p_trade->>'action',p_trade->>'contractSymbol',p_trade->>'underlyingSymbol',p_trade->>'optionType',(p_trade->>'strike')::numeric,(p_trade->>'expiration')::numeric,(p_trade->>'lots')::numeric,(p_trade->>'premium')::numeric,(p_trade->>'total')::numeric,p_trade->>'timestamp');
  ELSE RAISE EXCEPTION 'INVALID_TRADE_TYPE'; END IF;
  RETURN to_jsonb(account) || jsonb_build_object('executionPrice',coalesce(p_trade->'price',p_trade->'premium'),'total',p_trade->'total');
END $$;

CREATE OR REPLACE FUNCTION public.stockpulse_set_targets(p_email text, p_symbol text, p_sl numeric, p_tp numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE account public.users%ROWTYPE; positions jsonb;
BEGIN
  IF (p_sl IS NOT NULL AND p_sl <= 0) OR (p_tp IS NOT NULL AND p_tp <= 0) OR (p_sl IS NOT NULL AND p_tp IS NOT NULL AND p_sl >= p_tp) THEN RAISE EXCEPTION 'INVALID_TARGETS'; END IF;
  SELECT * INTO account FROM users WHERE email = p_email FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(account.portfolio) p WHERE p->>'symbol' = p_symbol) THEN RAISE EXCEPTION 'NO_HOLDING'; END IF;
  SELECT jsonb_agg(CASE WHEN p->>'symbol' = p_symbol THEN
    (p - 'sl' - 'tp') || CASE WHEN p_sl IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('sl',p_sl) END || CASE WHEN p_tp IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('tp',p_tp) END ELSE p END)
    INTO positions FROM jsonb_array_elements(account.portfolio) p;
  UPDATE users SET portfolio = positions WHERE email = p_email RETURNING * INTO account;
  RETURN to_jsonb(account);
END $$;

CREATE OR REPLACE FUNCTION public.stockpulse_resolve_recharge(p_id uuid, p_status text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recharge public.recharge_requests%ROWTYPE;
BEGIN
  IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT * INTO recharge FROM recharge_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  IF recharge.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_RESOLVED'; END IF;
  IF p_status = 'approved' THEN
    IF recharge.requested_amount < 10000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    UPDATE users SET etokens = coalesce(etokens,e_tokens,0) + recharge.requested_amount, e_tokens = coalesce(etokens,e_tokens,0) + recharge.requested_amount WHERE email = recharge.user_email;
    IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  END IF;
  UPDATE recharge_requests SET status = p_status, admin_note = p_note, resolved_at = now() WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.stockpulse_airdrop(p_amount numeric)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  IF p_amount <= 0 OR p_amount > 100000000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  UPDATE users SET etokens = coalesce(etokens,e_tokens,0) + p_amount, e_tokens = coalesce(etokens,e_tokens,0) + p_amount;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;

-- Browsers use authenticated API routes, not anonymous direct-table access.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recharge_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users, public.trades, public.option_trades, public.email_otps, public.app_config, public.recharge_requests FROM anon, authenticated;
GRANT ALL ON public.users, public.trades, public.option_trades, public.email_otps, public.app_config, public.recharge_requests, public.stockpulse_rate_limits TO service_role;

REVOKE ALL ON FUNCTION public.stockpulse_rate_limit(text,integer,integer), public.stockpulse_register(text,text,text,text), public.stockpulse_commit_trade(text,jsonb,jsonb,text,jsonb), public.stockpulse_set_targets(text,text,numeric,numeric), public.stockpulse_resolve_recharge(uuid,text,text), public.stockpulse_airdrop(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stockpulse_rate_limit(text,integer,integer), public.stockpulse_register(text,text,text,text), public.stockpulse_commit_trade(text,jsonb,jsonb,text,jsonb), public.stockpulse_set_targets(text,text,numeric,numeric), public.stockpulse_resolve_recharge(uuid,text,text), public.stockpulse_airdrop(numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.stockpulse_admin_stats()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('totalUsers',(SELECT count(*) FROM users),'totalTrades',(SELECT count(*) FROM trades),'totalOptionTrades',(SELECT count(*) FROM option_trades),'totalETokens',(SELECT coalesce(sum(coalesce(etokens,e_tokens,0)),0) FROM users),'totalVolume',(SELECT coalesce(sum(total),0) FROM trades)+(SELECT coalesce(sum(total),0) FROM option_trades));
$$;
CREATE OR REPLACE FUNCTION public.stockpulse_admin_users()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('name',u.name,'email',u.email,'eTokens',coalesce(u.etokens,u.e_tokens,0),'portfolio',u.portfolio,'options',u.options,'tradeCount',(SELECT count(*) FROM trades t WHERE t.email=u.email),'optionTradeCount',(SELECT count(*) FROM option_trades t WHERE t.email=u.email))),'[]') FROM users u;
$$;
REVOKE ALL ON FUNCTION public.stockpulse_admin_stats(), public.stockpulse_admin_users() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stockpulse_admin_stats(), public.stockpulse_admin_users() TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

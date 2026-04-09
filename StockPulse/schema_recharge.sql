-- ================================================================
-- StockPulse: Recharge Requests Table
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ================================================================

CREATE TABLE IF NOT EXISTS public.recharge_requests (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email   text NOT NULL,
  user_name    text,
  requested_amount integer NOT NULL DEFAULT 10000,
  description  text,
  status       text DEFAULT 'pending' 
               CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   timestamptz DEFAULT now(),
  resolved_at  timestamptz,
  admin_note   text
);

-- Allow service role full access (bypasses RLS)
ALTER TABLE public.recharge_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.recharge_requests
  FOR ALL USING (true) WITH CHECK (true);

-- Notify Supabase to reload schema cache
NOTIFY pgrst, 'reload schema';

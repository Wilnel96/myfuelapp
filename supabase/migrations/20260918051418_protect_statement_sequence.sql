-- F14: statement_sequence had row level security disabled and full CRUD granted to
-- anon and authenticated, so anyone could rewind, delete or truncate the counter.

ALTER TABLE public.statement_sequence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.statement_sequence FROM anon, authenticated;

DROP POLICY IF EXISTS "statement_sequence_admin_select" ON public.statement_sequence;
DROP POLICY IF EXISTS "statement_sequence_admin_insert" ON public.statement_sequence;
DROP POLICY IF EXISTS "statement_sequence_admin_update" ON public.statement_sequence;
DROP POLICY IF EXISTS "statement_sequence_admin_delete" ON public.statement_sequence;

CREATE POLICY "statement_sequence_admin_select"
  ON public.statement_sequence FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

CREATE POLICY "statement_sequence_admin_insert"
  ON public.statement_sequence FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

CREATE POLICY "statement_sequence_admin_update"
  ON public.statement_sequence FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

CREATE POLICY "statement_sequence_admin_delete"
  ON public.statement_sequence FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

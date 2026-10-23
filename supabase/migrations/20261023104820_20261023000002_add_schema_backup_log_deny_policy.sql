-- Add deny-by-default policy for _schema_backup_log (RLS Enabled No Policy)
-- Grants were already revoked from anon/authenticated in the previous migration,
-- but a policy is needed so the advisor stops reporting "no policies".
CREATE POLICY "_schema_backup_log_deny_all" ON public._schema_backup_log
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

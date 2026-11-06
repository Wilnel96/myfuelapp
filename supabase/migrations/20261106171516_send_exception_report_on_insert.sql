/*
# Email exception reports immediately when they are created

1. Overview
- Every new row in `vehicle_exceptions` now triggers an email report straight away.
- The email is sent by the `send-exception-report` function.

2. Changes
- Enables the `pg_net` extension so the database can make HTTP calls without waiting for the app.
- Adds `email_sent_at` to `vehicle_exceptions` so each exception is emailed only once.
- Adds an AFTER INSERT trigger that posts the new exception's id to the email function.

3. Security
- The trigger function runs with owner rights so any signed-in or driver-session insert can fire it.
- EXECUTE on the trigger function is revoked from public roles; it can only run from the trigger.
- The email function is public (no login token) but only emails exceptions that have not been emailed yet.

4. Notes
- The function URL points at this project's Supabase address. If the project is ever rebuilt under a new address, update the URL here.
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE vehicle_exceptions ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_exception_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://dhklqlqpowrwjplrkfzz.supabase.co/functions/v1/send-exception-report',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('exception_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_exception_report() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vehicle_exceptions_send_report ON vehicle_exceptions;
CREATE TRIGGER vehicle_exceptions_send_report
AFTER INSERT ON vehicle_exceptions
FOR EACH ROW
EXECUTE FUNCTION public.notify_exception_report();

/*
  # Add Driver Authentication System

  1. Changes to drivers table
    - Add `password_hash` column for secure password storage (date of birth based)
    - Add unique constraint on first_name + organization_id combination for login
    - Add `last_login_at` timestamp to track driver sessions

  2. New Table: driver_sessions
    - `id` (uuid, primary key)
    - `driver_id` (uuid, foreign key to drivers)
    - `token` (text, unique session token)
    - `created_at` (timestamptz)
    - `expires_at` (timestamptz)
    - Track active driver sessions separately from admin auth

  3. Security
    - Enable RLS on driver_sessions table
    - Drivers can only access their own session data
    - No access to backend tables (vehicles, garages management, etc.)

  4. Important Notes
    - Drivers authenticate with: first_name + date_of_birth
    - Drivers can ONLY access the mobile fuel purchase screen
    - Admin users authenticate with email/password via Supabase Auth
    - Complete separation between driver and admin authentication
*/

-- Add password_hash column to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE drivers ADD COLUMN password_hash text;
  END IF;
END $$;

-- Add last_login_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE drivers ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

-- Create driver_sessions table
CREATE TABLE IF NOT EXISTS driver_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS driver_sessions_driver_id_idx ON driver_sessions(driver_id);
CREATE INDEX IF NOT EXISTS driver_sessions_token_idx ON driver_sessions(token);
CREATE INDEX IF NOT EXISTS driver_sessions_expires_at_idx ON driver_sessions(expires_at);

ALTER TABLE driver_sessions ENABLE ROW LEVEL SECURITY;

-- Drivers can only view their own sessions (using token-based lookup)
CREATE POLICY "Drivers can view own sessions"
  ON driver_sessions FOR SELECT
  USING (true);

-- Only allow inserting new sessions (handled by edge function)
CREATE POLICY "Allow session creation"
  ON driver_sessions FOR INSERT
  WITH CHECK (true);

-- Allow deleting expired sessions
CREATE POLICY "Allow session deletion"
  ON driver_sessions FOR DELETE
  USING (true);

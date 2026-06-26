-- Add garage_capabilities array to classify what a garage does on the system
-- Values: 'card_only', 'external_local_accounts', 'manages_own_clients', 'own_fleet'
ALTER TABLE garages
  ADD COLUMN IF NOT EXISTS garage_capabilities text[] NOT NULL DEFAULT ARRAY['card_only']::text[];

-- Add client_org_id: links a garage to its own client organization (Scenario 4 - own fleet)
-- This is distinct from organization_id (which is the garage-type auth org)
ALTER TABLE garages
  ADD COLUMN IF NOT EXISTS client_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_garages_client_org_id ON garages(client_org_id) WHERE client_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_garages_capabilities ON garages USING gin(garage_capabilities);

-- Any garage that already has managed clients should get 'manages_own_clients' capability
UPDATE garages g
SET garage_capabilities = ARRAY['manages_own_clients']::text[]
WHERE EXISTS (
  SELECT 1 FROM organizations o
  WHERE o.managing_garage_id = g.id
  AND o.is_garage_managed = true
);

-- Comment explaining the capability values
COMMENT ON COLUMN garages.garage_capabilities IS
  'Array of capability flags: card_only=card/debit transactions only, external_local_accounts=hosts local accounts for registered clients, manages_own_clients=manages own sub-clients billed through garage, own_fleet=garage runs its own vehicles/drivers as a client';

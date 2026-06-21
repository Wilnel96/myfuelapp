/*
  # Remove Fuel Transaction Edit/Delete Permissions

  1. Rationale
    - Fuel transactions are financial records
    - Financial data integrity is critical
    - No one should be able to edit or delete transactions after creation
    - Transactions must remain immutable for audit purposes
    
  2. Changes
    - Remove can_add_fuel_transactions column
    - Remove can_edit_fuel_transactions column
    - Remove can_delete_fuel_transactions column
    - Keep can_view_fuel_transactions for read access control
    
  3. Security
    - Transactions can only be viewed, never modified
    - Maintains complete audit trail
    - Prevents financial data tampering
*/

-- Remove edit and delete permission columns
ALTER TABLE organization_users DROP COLUMN IF EXISTS can_add_fuel_transactions;
ALTER TABLE organization_users DROP COLUMN IF EXISTS can_edit_fuel_transactions;
ALTER TABLE organization_users DROP COLUMN IF EXISTS can_delete_fuel_transactions;

-- Keep can_view_fuel_transactions for read-only access control
-- This allows organizations to control which users can see financial data
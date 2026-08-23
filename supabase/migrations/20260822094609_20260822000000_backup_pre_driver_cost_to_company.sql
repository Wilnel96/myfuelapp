/*
# Backup point: Pre Driver Cost-to-Company Feature

This migration serves as a backup marker before adding the Driver Cost-to-Company feature.
No schema changes are made — it simply records a backup point in the migrations table
so the state can be identified if a rollback is needed.

## Important Notes
1. This is a no-op migration that creates a backup marker
2. If rollback is needed, identify this migration as the restore point
3. All subsequent migrations in this feature set can be identified by their 20260822xxxxxx timestamps
*/

SELECT 1;
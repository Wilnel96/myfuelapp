-- Security fix (F2): the organization_users.password column mirrored live account
-- passwords in clear text. Supabase Auth holds the real credential, so the column
-- value is redundant. Clear the stored secrets; the column itself is kept so that
-- existing queries keep working.
UPDATE organization_users
SET password = NULL
WHERE password IS NOT NULL;

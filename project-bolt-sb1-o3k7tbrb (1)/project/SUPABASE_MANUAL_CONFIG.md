# Supabase Manual Configuration Required

The following security improvements require manual configuration in your Supabase dashboard. These settings cannot be applied via SQL migrations.

## 1. Auth DB Connection Strategy

**Current Issue:** Auth server uses fixed connection allocation (10 connections)

**Fix Required:**
1. Go to Supabase Dashboard → Project Settings → Database
2. Navigate to "Connection Pooling" section
3. Change Auth connection strategy from **Fixed Number** to **Percentage-based**
4. This ensures Auth performance scales with your database instance

**Why:** When using fixed connection allocation, upgrading your database instance won't automatically improve Auth server performance. Percentage-based allocation scales automatically.

---

## 2. Leaked Password Protection

**Current Issue:** Password breach detection is disabled

**Fix Required:**
1. Go to Supabase Dashboard → Authentication → Settings
2. Scroll to "Security and Protection" section
3. Enable "**Leaked Password Protection**"
4. This feature checks passwords against the HaveIBeenPwned database

**Why:** This prevents users from choosing compromised passwords, significantly improving account security.

---

## What Was Already Fixed

The following issues have been resolved via database migration:

### Security Improvements
- ✅ Fixed RLS policy performance on `organization_users` table
- ✅ Removed SECURITY DEFINER from views (garage_daily_sales, vehicle_statistics, driver_statistics)
- ✅ Fixed function search_path security vulnerabilities (4 functions)
- ✅ Added `security_invoker = true` to all views for proper RLS enforcement

### Performance Improvements
- ✅ Optimized auth.uid() calls in RLS policies (prevents re-evaluation per row)
- ✅ Added indexes for all 21 foreign keys to improve JOIN and CASCADE performance
- ✅ Proper index coverage for all foreign key relationships

---

## Next Steps

1. Apply the manual configurations above in your Supabase dashboard
2. Monitor query performance after changes
3. Review the migration: `fix_security_and_performance_issues_comprehensive.sql`

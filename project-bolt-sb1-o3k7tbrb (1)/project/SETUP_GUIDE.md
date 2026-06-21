# Database Setup Guide

This guide will help you set up your MyFuelApp database from scratch.

## Prerequisites

- A Supabase account (free tier is fine)
- Node.js installed on your machine

## Step-by-Step Setup

### 1. Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Choose an organization (or create one)
4. Fill in project details:
   - **Name**: `myfuelapp` (or whatever you prefer)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your location
5. Click "Create new project" and wait 1-2 minutes

### 2. Get Your Supabase Credentials

Once your project is ready:

1. Go to **Project Settings** (gear icon in sidebar)
2. Navigate to **API** section
3. You'll need these three values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`)

### 3. Configure Your Environment File

1. Open the `.env` file in your project root
2. Update these three lines with your credentials:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
```

⚠️ **Important**: Keep your service role key secret! Never commit it to version control.

### 4. Run the Database Setup Script

This script will apply all migrations to your database:

```bash
node setup-database.js
```

You should see output like:
```
🚀 Starting Database Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Environment: https://xxxxx.supabase.co
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔌 Testing connection...
✅ Connected successfully

🔍 Checking for migrations...
📦 Found 250 migration(s) to apply

📄 Applying: 20251116122838_add_image_verification_fields.sql
✅ Success: 20251116122838_add_image_verification_fields.sql
...
```

This will take a few minutes as it applies all migrations.

### 5. Verify Your Setup

Once complete, you can verify your database is working:

1. Go to your Supabase project dashboard
2. Click on **Table Editor** in the sidebar
3. You should see many tables including:
   - organizations
   - profiles
   - vehicles
   - drivers
   - garages
   - fuel_transactions
   - and many more...

### 6. Start Your Application

```bash
npm run dev
```

Your app should now be running and connected to your Supabase database!

---

## Troubleshooting

### Connection Failed
- Double-check your `.env` file has the correct credentials
- Make sure there are no extra spaces or quotes around the values
- Verify your Supabase project is active (not paused)

### Migration Errors
- Check that your service role key is correct (not the anon key)
- Some migrations might fail if tables already exist - this is usually okay
- If stuck, you can reset your database in Supabase settings and run setup again

### Port Already in Use
```bash
# If port 5173 is busy, kill the process or use a different port
npm run dev -- --port 3000
```

---

## Next Steps

After setup, you'll want to:

1. **Create Test Users** - Run `node create_test_users.js` to create sample data
2. **Import Garages** - Use `node import_garages_from_csv.js` to bulk import garages
3. **Review Documentation**:
   - `README.md` - Main application documentation
   - `TEST_CREDENTIALS.md` - Test user credentials
   - `ROLE_SYSTEM_DOCUMENTATION.md` - User roles and permissions

---

## Need Multiple Environments?

If you need separate databases for development, staging, and production:

1. Create 3 Supabase projects (dev, staging, prod)
2. Create 3 `.env` files (`.env.development`, `.env.staging`, `.env.production`)
3. Run the setup script for each environment
4. Use environment-specific commands to switch between them

Let me know if you need help setting up multiple environments!

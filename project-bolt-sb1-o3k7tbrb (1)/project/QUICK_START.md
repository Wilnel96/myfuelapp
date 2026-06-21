# Quick Start - Single Environment Setup

Get your MyFuelApp database up and running in 5 minutes.

## 📋 What You'll Need

- [ ] Supabase account (sign up at https://app.supabase.com)
- [ ] Node.js installed
- [ ] 5 minutes

---

## 🚀 Setup Steps

### Step 1: Create Supabase Project (2 min)

1. Go to https://app.supabase.com
2. Click **"New Project"**
3. Enter project name: `myfuelapp`
4. Set a database password (save it somewhere safe!)
5. Choose your region
6. Click **"Create new project"**

Wait for it to finish (about 1-2 minutes).

### Step 2: Get Your API Keys (1 min)

1. In your Supabase project, click the **Settings** icon (gear) in the sidebar
2. Go to **API** section
3. Copy these three values:

   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: The long key under "Project API keys"
   - **service_role**: Click "Reveal" to see it, then copy

### Step 3: Update Your .env File (1 min)

Open `.env` in your project and paste your values:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

Save the file.

### Step 4: Install Dependencies (30 sec)

```bash
npm install
```

### Step 5: Run Database Setup (1 min)

```bash
npm run setup
```

You'll see migrations being applied. This takes about 1 minute.

When you see `🎉 Database setup complete!` you're done!

### Step 6: Start the App (10 sec)

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

---

## ✅ Verify It Works

1. Go to your Supabase dashboard
2. Click **Table Editor** in sidebar
3. You should see ~20 tables created

---

## 🎯 What's Next?

### Create Test Data

```bash
node create_test_users.js
```

This creates sample users, vehicles, and data to test with.

### Login Credentials

After creating test users, check `TEST_CREDENTIALS.md` for login details.

### Import Garages

```bash
node import_garages_from_csv.js
```

Bulk imports garages from the CSV template.

---

## 🆘 Troubleshooting

**"Connection failed"**
- Check your `.env` file for typos
- Make sure you used the service_role key, not the anon key twice

**"Port 5173 in use"**
```bash
npm run dev -- --port 3000
```

**"Migration failed"**
- Check your service_role key is correct
- Try resetting your database in Supabase settings and run setup again

---

## 📚 Documentation

- `SETUP_GUIDE.md` - Detailed setup instructions
- `README.md` - Full application documentation
- `ROLE_SYSTEM_DOCUMENTATION.md` - User roles and permissions

---

**Need help?** Check `SETUP_GUIDE.md` for more detailed instructions.

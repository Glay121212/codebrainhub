# Codebrainhub - Supabase Setup

## Prerequisites
1. Create a Supabase project at https://supabase.com
2. Get your credentials from Project Settings → API

## Step 1: Configure Environment
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Edit `.env` with your values:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 2: Run Database Schema
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase-schema.sql`
3. Run the script

## Step 3: Install Dependencies
```bash
npm install
```

## Step 4: Test Locally
```bash
npm run dev
```

## Security Notes
- The `SUPABASE_ANON_KEY` is public (safe to expose in client code)
- All write operations go through RPC functions (stored procedures)
- Row Level Security (RLS) policies enforce access control at database level
- Input validation happens both in client AND in database functions

## Deployment
Push to GitHub - Vercel will pick up the `.env` variables automatically if configured in Vercel dashboard.
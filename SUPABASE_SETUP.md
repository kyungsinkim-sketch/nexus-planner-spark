# Supabase Setup Guide for Nexus Planner

This guide will walk you through setting up Supabase as the backend for Nexus Planner.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- Node.js and npm installed
- Nexus Planner project cloned locally

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in the project details:
   - **Name**: Nexus Planner (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (this takes ~2 minutes)

## Step 2: Get Your API Credentials

1. In your Supabase project dashboard, click on the "Settings" icon (⚙️) in the sidebar
2. Navigate to "API" section
3. You'll find two important values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: A long string starting with `eyJ...`
4. Copy these values - you'll need them in the next step

## Step 3: Configure Environment Variables

1. In your Nexus Planner project root, copy the example environment file:

```bash
cp .env.example .env
```

2. Open `.env` and update with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Save the file

## Step 4: Set Up the Database Schema

### Option A: Using Supabase Dashboard (Recommended)

1. In your Supabase project dashboard, click on "SQL Editor" in the sidebar
2. Click "New query"
3. Open the `supabase/schema.sql` file from your local project
4. Copy the entire contents
5. Paste it into the SQL Editor
6. Click "Run" (or press Cmd/Ctrl + Enter)
7. Wait for the query to complete (you should see "Success. No rows returned")

### Option B: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Step 5: Load Seed Data (Optional)

If you want to start with some sample data:

1. In Supabase SQL Editor, create a new query
2. Open `supabase/seed.sql` from your local project
3. Copy and paste the contents
4. Click "Run"

**Note**: The seed data uses placeholder UUIDs. For production use, you'll need to:
1. Create actual user accounts first
2. Update the seed data with real user IDs

## Step 6: Configure Storage (For File Uploads)

1. In Supabase dashboard, go to "Storage"
2. The `project-files` bucket should already be created by the schema
3. If not, create it manually:
   - Click "New bucket"
   - Name: `project-files`
   - Public: No (keep it private)
   - Click "Create bucket"

## Step 7: Verify the Setup

1. Start your development server:

```bash
npm run dev
```

2. Open `http://localhost:8080`
3. You should see the login/signup page
4. Create a new account:
   - Enter your email
   - Choose a password (min 6 characters)
   - Enter your full name
   - Click "Create Account"
5. Check your email for a confirmation link (if email confirmation is enabled)
6. After confirmation, you should be able to log in

## Step 8: Create Your First Admin User

The first user you create will be a regular MEMBER. To make them an ADMIN:

1. Go to Supabase dashboard → "Table Editor"
2. Select the `profiles` table
3. Find your user's row
4. Click on the `role` cell
5. Change it from `MEMBER` to `ADMIN`
6. Click the checkmark to save
7. Refresh your Nexus Planner app

Now you'll have access to the Admin dashboard!

## Troubleshooting

### "Supabase not configured" Error

**Problem**: The app shows this error even though you've set up `.env`

**Solution**:
1. Make sure your `.env` file is in the project root (not in `src/`)
2. Restart your development server (`npm run dev`)
3. Check that the environment variables start with `VITE_`
4. Verify the values don't have quotes around them

### "Failed to sign in" Error

**Problem**: Can't log in with correct credentials

**Solution**:
1. Check if email confirmation is required:
   - Go to Supabase → Authentication → Settings
   - Look for "Enable email confirmations"
   - If enabled, check your email for confirmation link
2. Verify your password meets requirements (min 6 characters)
3. Check browser console for detailed error messages

### Database Connection Errors

**Problem**: Errors about database connection or RLS policies

**Solution**:
1. Verify the schema was applied correctly:
   - Go to Supabase → Table Editor
   - You should see all tables (profiles, projects, calendar_events, etc.)
2. Check RLS is enabled:
   - Click on a table
   - Look for "RLS enabled" indicator
3. Re-run the schema if needed

### No Data Showing Up

**Problem**: App loads but shows no projects/events

**Solution**:
1. Check if you loaded the seed data
2. Verify RLS policies allow your user to read data:
   - Most tables allow all authenticated users to read
   - Check the `profiles` table has your user
3. Try creating new data through the UI

## Advanced Configuration

### Email Templates

Customize the emails Supabase sends:

1. Go to Supabase → Authentication → Email Templates
2. Customize:
   - Confirmation email
   - Password reset email
   - Magic link email

### Real-time Subscriptions

Real-time features are automatically enabled. To verify:

1. Go to Supabase → Database → Replication
2. Ensure replication is enabled for:
   - `calendar_events`
   - `chat_messages`
   - `projects`

### Custom Domain (Production)

For production deployment:

1. Go to Supabase → Settings → API
2. Add your custom domain to "Allowed Redirect URLs"
3. Update your `.env` with production URL

## Security Best Practices

1. **Never commit `.env` to git**
   - It's already in `.gitignore`
   - Use environment variables in production

2. **Use Row Level Security (RLS)**
   - Already configured in schema
   - Review policies for your use case

3. **Rotate API keys regularly**
   - Generate new keys in Supabase dashboard
   - Update your `.env`

4. **Enable MFA for Supabase account**
   - Go to your Supabase account settings
   - Enable two-factor authentication

## Production Deployment

When deploying to production (Vercel, Netlify, etc.):

1. Add environment variables in your hosting platform:
   ```
   VITE_SUPABASE_URL=your_production_url
   VITE_SUPABASE_ANON_KEY=your_production_key
   ```

2. Update Supabase settings:
   - Add production URL to allowed redirect URLs
   - Configure CORS if needed

3. Consider upgrading Supabase plan:
   - Free tier: Good for development
   - Pro tier: Recommended for production

## Getting Help

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Supabase Discord**: [discord.supabase.com](https://discord.supabase.com)
- **Project Issues**: Open an issue in the GitHub repository

## Next Steps

After successful setup:

1. ✅ Create your admin account
2. ✅ Create your first project
3. ✅ Add team members
4. ✅ Explore all features
5. ✅ Customize to your needs

Congratulations! Your Nexus Planner backend is now fully configured! 🎉

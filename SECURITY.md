# Security Setup Guide

## Current Security Status

⚠️ **WARNING**: Supabase credentials are currently hardcoded in `index.html` and visible to anyone who views the page source.

## Recommendations

### 1. Enable Row Level Security (RLS) - **CRITICAL**

Go to your Supabase dashboard and enable RLS on ALL tables:

```sql
-- Example: Enable RLS on reservations table
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read their own data
CREATE POLICY "Users can read own reservations"
  ON reservations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow authenticated users to insert their own data
CREATE POLICY "Users can insert own reservations"
  ON reservations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

Repeat for all tables: `properties`, `team_members`, `payments`, etc.

### 2. Use Environment Variables (Recommended)

We've created an `/api/config` endpoint that serves configuration from environment variables.

#### Setup Steps:

1. **In Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add these variables:
     ```
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_ANON_KEY=your_anon_key_here
     ```

2. **The `/api/config.js` endpoint will automatically:**
   - Read credentials from environment variables
   - Serve them to the frontend securely
   - Work as a serverless function on Vercel

3. **Update the frontend (future improvement):**
   - Modify `index.html` to fetch config from `/api/config`
   - Remove hardcoded credentials

### 3. API Key Restrictions

In Supabase Dashboard → Settings → API:
- Note: The ANON key is meant to be public
- Security comes from RLS policies, not from hiding the key
- However, using environment variables is still best practice

### 4. Domain Restrictions

In Vercel:
- Project Settings → Domains
- Only allow requests from your approved domains

## Migration Checklist

- [ ] Enable RLS on all Supabase tables
- [ ] Create appropriate RLS policies for each table
- [ ] Add environment variables in Vercel dashboard
- [ ] Test `/api/config` endpoint
- [ ] Update frontend to use API endpoint (optional)
- [ ] Remove hardcoded credentials from `index.html` (optional)

## Testing RLS

Test your RLS policies:

```javascript
// Try to access data without authentication
const { data, error } = await supabase.from('reservations').select('*');
// Should return empty or error if RLS is working correctly
```

## Additional Security Measures

1. **Use HTTPS only** - Vercel handles this automatically
2. **Implement Content Security Policy (CSP)** - Add to HTML
3. **Regular security audits** - Review Supabase logs for suspicious activity
4. **Rate limiting** - Configure in Supabase dashboard
5. **Monitor API usage** - Set up alerts for unusual activity

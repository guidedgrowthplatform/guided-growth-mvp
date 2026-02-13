# Google OAuth Setup Guide - Custom Branding

This guide will help you set up Google OAuth with your custom domain and branding, so users see your app name and domain instead of Supabase's URL.

## Prerequisites

- Google Cloud Console account
- Access to your Vercel project
- Your custom domain (e.g., `guided-growth-mvp.vercel.app` or your custom domain)

## Step 1: Create Google OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen first (see Step 2)

## Step 2: Configure OAuth Consent Screen

This is where you set your app name, logo, and domain.

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace)
3. Fill in the required information:
   - **App name**: `Guided Growth` (or your app name)
   - **User support email**: Your email
   - **App logo**: Upload your logo (512x512px recommended)
   - **App domain**: `guided-growth-mvp.vercel.app` (or your domain)
   - **Application home page**: `https://guided-growth-mvp.vercel.app`
   - **Privacy policy URL**: Your privacy policy URL
   - **Terms of service URL**: Your terms of service URL
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Add test users (if app is in testing mode)
6. Click **Save and Continue**

## Step 3: Create OAuth Client ID

1. Go back to **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Configure:
   - **Name**: `Guided Growth Web Client` (or your name)
   - **Authorized JavaScript origins**:
     - `https://guided-growth-mvp.vercel.app`
     - `http://localhost:5173` (for local development)
   - **Authorized redirect URIs**:
     - `https://guided-growth-mvp.vercel.app/api/auth/callback`
     - `http://localhost:5173/api/auth/callback` (for local development)
5. Click **Create**
6. **Copy the Client ID and Client Secret** - you'll need these for environment variables

## Step 4: Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

   ```
   GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   GOOGLE_REDIRECT_URI=https://guided-growth-mvp.vercel.app/api/auth/callback
   FRONTEND_URL=https://guided-growth-mvp.vercel.app
   ```

4. Make sure to select **Production**, **Preview**, and **Development** environments
5. Click **Save**

## Step 5: Update Local Development (Optional)

For local development, create a `.env.local` file:

```bash
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/callback
FRONTEND_URL=http://localhost:5173
```

**Note**: Vercel serverless functions don't run locally with `npm run dev`. You'll need to use `vercel dev` for local API testing, or test directly on Vercel.

## Step 6: Submit for Verification (If Needed)

If your app is in production and you want to remove the "unverified app" warning:

1. Go to **OAuth consent screen**
2. Click **Publish App**
3. Fill out any additional required information
4. Submit for verification (this can take several days)

## Step 7: Test the Flow

1. Deploy your changes to Vercel
2. Visit your app: `https://guided-growth-mvp.vercel.app`
3. Click "Continue with Google"
4. You should now see:
   - ✅ Your app name (not Supabase URL)
   - ✅ Your logo (if uploaded)
   - ✅ Your domain in the consent screen
   - ✅ No "unverified app" warning (if verified)

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the redirect URI in Google Console exactly matches what's in your environment variables
- Check for trailing slashes or http vs https

### Still seeing Supabase domain
- Make sure you're using the new auth flow (not Supabase auth)
- Check that environment variables are set correctly in Vercel
- Clear browser cache and try again

### API routes not working
- Make sure `@vercel/node` is installed
- Check Vercel function logs for errors
- Verify environment variables are set

## What Changed

- **Removed**: Supabase Auth for Google OAuth
- **Added**: Custom Google OAuth implementation using Vercel serverless functions
- **Result**: Users see your custom domain and branding on Google consent screen

## Files Modified

- `api/auth/google.ts` - OAuth initiation endpoint
- `api/auth/callback.ts` - OAuth callback handler
- `api/auth/session.ts` - Session validation
- `src/lib/auth.ts` - New auth client (replaces Supabase auth)
- `src/pages/Login.tsx` - Updated to use new auth
- `src/pages/AuthCallback.tsx` - Updated to use new auth
- `src/pages/Dashboard.tsx` - Updated to use new auth

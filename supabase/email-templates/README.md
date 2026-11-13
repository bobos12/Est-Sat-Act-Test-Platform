# Auth emails and sign-in options (Supabase dashboard)

## 1. URL settings (Authentication → URL Configuration)
- **Site URL:** your live address, e.g. `https://your-domain.vercel.app`
- **Redirect URLs:** `https://your-domain.vercel.app/**`, `https://*-aahmedsharaff-gmailcoms-projects.vercel.app/**`, `http://localhost:3000/**`

## 2. Branded emails (Authentication → Email Templates)
For each template, set the subject and paste the whole HTML file into the message body:

| Template | Subject | File |
|---|---|---|
| Confirm signup | Confirm your 16hundred account ✓ | `confirm-signup.html` |
| Magic Link | Your 16hundred sign-in link 🔑 | `magic-link.html` |
| Reset Password | Reset your 16hundred password | `reset-password.html` |

These links open `/auth/confirm` on your site, so they work on any device (phone or computer) and show the "You're confirmed!" screen.

## 3. Continue with Google (Authentication → Sign In / Providers → Google)
1. In Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (type: Web application).
2. **Authorized redirect URI:** `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows this exact URL on the Google provider page).
3. Copy the **Client ID** and **Client secret** into Supabase's Google provider and switch it **on**.

## 4. Email sign-in link
Works as soon as the Magic Link template is saved (Email provider must be enabled, which it is by default).

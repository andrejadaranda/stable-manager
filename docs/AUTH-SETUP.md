# Auth & Email Setup

This document explains the one-time configuration required in the Supabase
Dashboard so signup confirmation emails actually arrive.

The application code (signup action, callback route, resend flow, login
error handling) is already wired up. **The dashboard config below is what
you must do once per environment.**

---

## Why this matters

Supabase's built-in email service is for **testing only**:

- Hard rate limit (~2–4 emails per hour for new projects, 30/hour overall).
- Sends from `noreply@mail.app.supabase.io` — many providers send these
  straight to spam.
- After a few quick signups in a row the limit silently kicks in and
  emails simply stop arriving.

Production must use custom SMTP. We use **Resend** because we already pay
for it and the `longrein.eu` domain is verified there.

---

## 1. Configure custom SMTP in Supabase

Supabase Dashboard → **Project Settings → Authentication → SMTP Settings**
→ enable **Custom SMTP** and fill in:

| Field          | Value                                       |
| -------------- | ------------------------------------------- |
| Host           | `smtp.resend.com`                           |
| Port           | `465`                                       |
| Username       | `resend`                                    |
| Password       | The Resend API key (starts with `re_…`)     |
| Sender email   | `hello@longrein.eu`                         |
| Sender name    | `Longrein`                                  |
| Min interval   | `60` seconds (between emails per user)      |

Click **Save**.

> If port 465 misbehaves on your hosting environment, switch to **587** with
> `STARTTLS` — both work with Resend.

---

## 2. Configure Site URL & Redirect URLs

Supabase Dashboard → **Authentication → URL Configuration**.

**Site URL** — this is what Supabase uses as the base for confirmation
links when you don't pass `emailRedirectTo`. Set it to the canonical prod
URL:

```
https://app.longrein.eu
```

**Redirect URLs** — every URL the auth flow may legitimately redirect to
after a confirmation. Add **all** of:

```
http://localhost:3000/auth/callback
https://app.longrein.eu/auth/callback
https://*.vercel.app/auth/callback        # if previewing on Vercel
```

(The signup action already passes `emailRedirectTo` based on the request
host, so dev / preview / prod all just work — but Supabase still validates
the URL against this allow-list, so each must be listed.)

---

## 3. Enable email confirmation

Supabase Dashboard → **Authentication → Sign In / Providers → Email**:

- **Confirm email** = ON
- **Secure email change** = ON (recommended)

This is the safe default for production. The signup flow now handles the
"confirmation pending" state correctly, so this won't break anything.

---

## 4. (Optional) Customize email templates

Supabase Dashboard → **Authentication → Email Templates**. The default
"Confirm your email" template works, but for a polished feel:

- Replace the default subject with `Confirm your Longrein account`.
- Replace `{{ .ConfirmationURL }}` link wording with `Confirm your email`.
- Add a short brand line at the bottom.

Keep `{{ .ConfirmationURL }}` exactly as-is — Supabase substitutes it at
send time.

---

## 5. Sanity check

After saving the SMTP config:

1. Open the **Resend dashboard** → Logs. Keep it open in another tab.
2. Sign up in the app with a fresh email address.
3. You should see the email appear in Resend within a few seconds, with
   status `delivered`.
4. The user lands on `/auth/check-email`. Clicking the link in the email
   takes them through `/auth/callback` and on into `/dashboard`.

If the email shows in Resend logs but never arrives:

- Check spam.
- Check the recipient's mailbox provider isn't bouncing — Resend will
  show `bounced` if so.
- Confirm the `from:` domain (`longrein.eu`) is fully verified in Resend
  (DKIM, SPF, DMARC all green).

If the email never appears in Resend logs at all, the SMTP creds in
Supabase are wrong — re-paste the Resend API key.

---

## 6. Local development

For local dev you can either:

- **Recommended** — keep custom SMTP on. Confirmations go through Resend
  and land in your real inbox. Just make sure `http://localhost:3000/auth/callback`
  is in the Redirect URLs list.

- **Faster iteration** — temporarily disable email confirmation in
  Supabase (Authentication → Providers → Email → Confirm email = OFF). The
  signup action will then provision the stable immediately and drop you
  into `/dashboard`. Re-enable before pushing to production.

---

## 7. Troubleshooting

| Symptom                                          | Likely cause                                                                                | Fix                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| "Account created. Confirm your email…" but no email arrives | Built-in SMTP rate limit hit, or never configured                                | Configure custom SMTP (step 1).                                                      |
| Email arrives but link goes to wrong domain      | `emailRedirectTo` not allowed in Redirect URLs, or Site URL is `localhost` in production    | Add the env's `/auth/callback` URL to Redirect URLs (step 2).                        |
| Link clicks through to `/auth/error?reason=…`    | The callback got a real error — read the reason                                             | Common: link expired (default 24h). User should request a resend on `/auth/check-email`. |
| `provision_stable` fails inside callback          | User clicked confirmation link from a different browser than the one they signed up in      | The `user_metadata` is preserved, so resigning in and re-clicking works. If recurring, dig into RLS / trigger errors. |

---

## 8. Code touchpoints (for context)

- `app/(auth)/signup/page.tsx` – signup form
- `lib/auth/actions.ts` – `signupOwnerAction`, `loginAction`, `resendConfirmationAction`
- `app/auth/callback/route.ts` – exchanges confirmation code → session, calls `provision_stable`
- `app/auth/check-email/page.tsx` – "we sent you an email" page with resend
- `app/auth/error/page.tsx` – surfaces flow errors
- `components/auth/login-form.tsx` – inline resend on "Email not confirmed"
- `middleware.ts` – `/auth/*` is reachable in any session state

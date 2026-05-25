# Supabase Auth Email Templates — Longrein branded

These are the branded HTML templates to paste into the Supabase Dashboard
under **Authentication → Email Templates**. Each file in this folder
maps 1:1 to a Supabase template slot:

| File | Supabase template | Subject |
|------|------------------|---------|
| `confirm-signup.html` | **Confirm signup** | `Confirm your Longrein account` |
| `magic-link.html` | **Magic Link** | `Your Longrein sign-in link` |
| `recovery.html` | **Reset password** | `Reset your Longrein password` |
| `change-email.html` | **Change email address** | `Confirm your new Longrein email` |
| `invite.html` | **Invite user** | `You've been invited to Longrein` |

## How to install

1. Open <https://supabase.com/dashboard/project/dluxzjphpokzkrwmmibe/auth/templates>
2. For each template above:
   - Click the template name in the left column
   - Paste the **Subject** into the Subject field (see table above)
   - Open the matching `.html` file from this folder, copy its full content
   - Paste into the **Message body (HTML)** editor
   - Click **Save changes**
3. (Optional but recommended) Send a test email to yourself from the
   "Send test email" button to confirm rendering.

## Supabase template variables

These are interpolated server-side by Supabase Auth before sending:

| Variable | What it is |
|---|---|
| `{{ .ConfirmationURL }}` | Verified link the user clicks |
| `{{ .Token }}` | 6-digit OTP (where applicable) |
| `{{ .TokenHash }}` | Hash of the token |
| `{{ .SiteURL }}` | The project Site URL (`https://app.longrein.eu`) |
| `{{ .Email }}` | Recipient address |
| `{{ .Data }}` | Custom data passed at `auth.signUp({ options: { data } })` |

Don't escape them, paste as-is. Supabase replaces them before send.

## Branding ground rules

- Wordmark: serif "Longrein" + orange period.
- Background: `#F4ECDF` (warm cream).
- Accent: navy `#1E3A2A`, brand orange `#B5793E`.
- Body font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- Headings: Georgia serif.
- CTA buttons: dark navy filled, white text, 8px radius.
- All emails have a plain-text fallback paragraph at the bottom in case
  HTML rendering fails — Supabase doesn't expose a separate text body
  field, so we inline a fallback link.
- Footer: `© Longrein · Vilnius, Lithuania` + `longrein.eu`.

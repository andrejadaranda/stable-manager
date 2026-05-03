# Longrein — Email templates (Supabase Auth → Resend SMTP)

5 brand-voice templates'ai, paruošti kopijuoti į Supabase Dashboard → Authentication → Emails. Visi naudoja Paddock Green wordmark'ą, Inter / Source Serif 4 typografiją iš inline `<style>` (be external font loading'o, kad veiktų Gmail/Outlook), ir Longrein voice — direct, not chatty.

---

## 0. Bendras inline `<style>` (kopijuojamas į kiekvieną template'ą `<head>`)

```html
<style>
  body { margin: 0; padding: 0; background-color: #F4ECDF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1B1B1B; }
  .wrapper { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
  .card { background: #FFFFFF; border-radius: 16px; padding: 32px 28px; box-shadow: 0 2px 8px rgba(30, 58, 42, 0.06); }
  .wordmark { font-family: Georgia, "Times New Roman", serif; font-size: 22px; color: #1E3A2A; letter-spacing: -0.01em; margin: 0 0 20px; }
  .wordmark .dot { color: #B5793E; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 24px; line-height: 1.25; color: #1E3A2A; margin: 0 0 12px; letter-spacing: -0.01em; }
  p { font-size: 15px; line-height: 1.55; color: #1B1B1B; margin: 0 0 14px; }
  .muted { color: #6E6760; font-size: 13px; }
  .button { display: inline-block; background: #1E3A2A; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 500; font-size: 15px; margin: 16px 0 4px; }
  .button:hover { background: #14271C; }
  .footer { text-align: center; padding: 24px 0 0; color: #6E6760; font-size: 12px; line-height: 1.5; }
  .footer a { color: #1E3A2A; text-decoration: none; }
</style>
```

---

## 1. Welcome / Confirm signup (`confirm_signup`)

**Subject:** `Welcome to Longrein. Confirm your email.`

**HTML body:**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Confirm your Longrein account</title>
<!-- inline style here (see section 0) -->
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <p class="wordmark">Longrein<span class="dot">.</span></p>
      <h1>Confirm your email and we&rsquo;ll set you up.</h1>
      <p>Hi {{ .Email }},</p>
      <p>Welcome to Longrein — the stable management tool for European riding schools and livery yards. One click and we&rsquo;ll have your stable ready for its first lesson.</p>
      <p><a href="{{ .ConfirmationURL }}" class="button">Confirm email →</a></p>
      <p class="muted">If you didn&rsquo;t sign up for Longrein, you can ignore this message and your email will not be added to anything.</p>
    </div>
    <div class="footer">
      © 2026 Longrein · Vilnius, Lithuania<br>
      <a href="https://longrein.eu">longrein.eu</a> · <a href="https://longrein.eu/legal/privacy">Privacy</a> · <a href="https://longrein.eu/legal/terms">Terms</a>
    </div>
  </div>
</body>
</html>
```

**Voice notes:** direct, not chatty. No "exciting!", "amazing!", "your journey begins!". Premium positioning — sit next to Linear / Stripe.

---

## 2. Password reset (`reset_password`)

**Subject:** `Reset your Longrein password`

**HTML body:**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Reset your Longrein password</title>
<!-- inline style -->
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <p class="wordmark">Longrein<span class="dot">.</span></p>
      <h1>Reset your password.</h1>
      <p>Someone — we hope it&rsquo;s you — asked to reset the password for {{ .Email }}.</p>
      <p><a href="{{ .ConfirmationURL }}" class="button">Set a new password →</a></p>
      <p class="muted">The link expires in 24 hours. If you didn&rsquo;t ask to reset your password, ignore this message — your account stays as it is.</p>
    </div>
    <div class="footer">
      © 2026 Longrein · Vilnius, Lithuania<br>
      <a href="https://longrein.eu">longrein.eu</a>
    </div>
  </div>
</body>
</html>
```

---

## 3. Magic link (`magic_link`)

**Subject:** `Your Longrein sign-in link`

**HTML body:**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Sign in to Longrein</title>
<!-- inline style -->
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <p class="wordmark">Longrein<span class="dot">.</span></p>
      <h1>Sign in.</h1>
      <p>Click the button below to sign in to Longrein. This link works once and expires in 1 hour.</p>
      <p><a href="{{ .ConfirmationURL }}" class="button">Sign in →</a></p>
      <p class="muted">If you didn&rsquo;t request this, ignore the email — no one signs in without clicking the link.</p>
    </div>
    <div class="footer">
      © 2026 Longrein · Vilnius, Lithuania<br>
      <a href="https://longrein.eu">longrein.eu</a>
    </div>
  </div>
</body>
</html>
```

---

## 4. Team invite (`invite_user`)

**Subject:** `{{ .Data.inviter_name }} added you to {{ .Data.stable_name }} on Longrein`

**HTML body:**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>You&rsquo;re invited to Longrein</title>
<!-- inline style -->
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <p class="wordmark">Longrein<span class="dot">.</span></p>
      <h1>You&rsquo;re on the team.</h1>
      <p>{{ .Data.inviter_name }} added you as a {{ .Data.role }} at <strong>{{ .Data.stable_name }}</strong>.</p>
      <p>Click below to set a password and start using Longrein. The calendar, horse list, and your assigned lessons will be there waiting.</p>
      <p><a href="{{ .ConfirmationURL }}" class="button">Accept invite →</a></p>
      <p class="muted">If you weren&rsquo;t expecting this invite, ignore the email — your details aren&rsquo;t added to anything until you click.</p>
    </div>
    <div class="footer">
      © 2026 Longrein · Vilnius, Lithuania<br>
      <a href="https://longrein.eu">longrein.eu</a>
    </div>
  </div>
</body>
</html>
```

**Notes on placeholders:** `{{ .Data.inviter_name }}`, `{{ .Data.stable_name }}`, `{{ .Data.role }}` need to be passed when calling Supabase Admin's `inviteUserByEmail` — these are custom data fields. If Supabase doesn't accept custom data in templates yet, fall back to a generic "You&rsquo;re invited to a stable on Longrein" line and rely on the in-app onboarding to show stable name once they sign in.

---

## 5. Lesson reminder (placeholder — wired in W2 sub-task with Resend Cron)

**Subject:** `Tomorrow at {{ .lesson_time }} — your lesson at {{ .stable_name }}`

**HTML body:**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Lesson tomorrow at {{ .stable_name }}</title>
<!-- inline style -->
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <p class="wordmark">Longrein<span class="dot">.</span></p>
      <h1>Tomorrow at {{ .lesson_time }}.</h1>
      <p>Hi {{ .client_name }},</p>
      <p>This is a reminder that you have a lesson tomorrow at <strong>{{ .stable_name }}</strong>.</p>
      <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6E6760; font-size: 13px; width: 100px;">Day</td>
          <td style="padding: 8px 0; font-size: 14px; color: #1B1B1B;">{{ .lesson_day }}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6E6760; font-size: 13px;">Time</td>
          <td style="padding: 8px 0; font-size: 14px; color: #1B1B1B;">{{ .lesson_time }}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6E6760; font-size: 13px;">Horse</td>
          <td style="padding: 8px 0; font-size: 14px; color: #1B1B1B;">{{ .horse_name }}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6E6760; font-size: 13px;">Trainer</td>
          <td style="padding: 8px 0; font-size: 14px; color: #1B1B1B;">{{ .trainer_name }}</td>
        </tr>
      </table>
      <p class="muted">Need to cancel or move? Contact your stable directly — Longrein doesn&rsquo;t auto-reply to this address.</p>
    </div>
    <div class="footer">
      © 2026 Longrein · {{ .stable_name }}<br>
      Sent via <a href="https://longrein.eu">Longrein</a>
    </div>
  </div>
</body>
</html>
```

**Wiring note:** lesson reminders are NOT in scope for W2 sprint — only the template is prepared. Actual cron job + per-stable opt-in toggle is Wave 14 work (post-launch).

---

## How to apply (after Resend domain verified)

1. **Supabase Dashboard** → Authentication → Emails → SMTP Settings (https://supabase.com/dashboard/project/dluxzjphpokzkrwmmibe/settings/auth)
2. Enable Custom SMTP → fill:
   - Host: `smtp.resend.com`
   - Port: `465` (TLS) or `587` (STARTTLS)
   - Username: `resend`
   - Password: Resend API key (create at https://resend.com/api-keys → "Sending access" scope)
   - Sender email: `hello@longrein.eu`
   - Sender name: `Longrein`
3. **Authentication → Email Templates** → for each of the 4 active templates (confirm_signup, reset_password, magic_link, invite_user), paste the corresponding HTML from above.
4. Test: trigger a real signup via `app.longrein.eu/signup` → verify email arrives in Gmail/Outlook with brand styling intact.

---

## Sender configuration

- `hello@longrein.eu` — primary inbox, monitored by Andreja from `longrein.team@gmail.com` (forwarded). Used for: founding-members onboarding emails, support, replies to lesson reminders.
- `noreply@longrein.eu` — automated transactional emails only (welcome, reset, invite, reminders). No reply expected.
- Do NOT use `andreja@longrein.eu` until Phase 2 (Google Workspace setup, Month 3).

For W2 launch, all 4 active templates send from `hello@longrein.eu`. Lesson reminders (Wave 14) will switch to `noreply@longrein.eu` once cron job is in place.

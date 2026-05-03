// /legal/cookies — Cookie Policy.
//
// Strict-by-default. Lists each cookie we set, its purpose, and how to
// opt out. The cookie banner (`components/legal/cookie-banner.tsx`)
// reads consent state from localStorage `longrein.consent.v1`.

export const metadata = {
  title: "Cookie Policy · Longrein",
  description:
    "Which cookies Longrein uses, what each one does, and how to opt out of non-essential ones.",
};

export default function CookiesPage() {
  return (
    <>
      <p className="text-[13px] uppercase tracking-[0.14em] font-semibold text-brand-700 mb-2">
        Legal
      </p>
      <h1 className="font-display text-3xl md:text-4xl text-navy-900 leading-tight mb-2">
        Cookie Policy
      </h1>
      <p className="text-ink-500 text-[13px] mb-8">
        Effective: 2026-05-02 · Last updated: 2026-05-02
      </p>

      <h2>1. What are cookies</h2>
      <p>
        Cookies are small text files a website places on your device. They let the site remember
        you between requests. Some cookies are required for the site to work; others are optional.
      </p>

      <h2>2. What we use</h2>
      <p>We try to keep cookies to the minimum needed to run the Service.</p>

      <table className="w-full text-[13px] border-collapse my-5">
        <thead>
          <tr className="border-b border-ink-200">
            <th className="text-left py-2 pr-3 font-semibold">Name</th>
            <th className="text-left py-2 pr-3 font-semibold">Purpose</th>
            <th className="text-left py-2 pr-3 font-semibold">Type</th>
            <th className="text-left py-2 font-semibold">Lifetime</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-ink-100">
            <td className="py-2 pr-3"><code>sb-*</code></td>
            <td className="py-2 pr-3">Supabase auth session — keeps you logged in.</td>
            <td className="py-2 pr-3"><strong>Essential</strong></td>
            <td className="py-2">Session + refresh (7 days)</td>
          </tr>
          <tr className="border-b border-ink-100">
            <td className="py-2 pr-3"><code>longrein.consent.v1</code></td>
            <td className="py-2 pr-3">Records your cookie banner choice. Stored in localStorage.</td>
            <td className="py-2 pr-3"><strong>Essential</strong></td>
            <td className="py-2">12 months</td>
          </tr>
          <tr>
            <td className="py-2 pr-3"><em>(reserved)</em></td>
            <td className="py-2 pr-3">Privacy-friendly analytics may be added later — only with your
              consent. We will update this table before any new cookie is set.</td>
            <td className="py-2 pr-3">Optional</td>
            <td className="py-2">—</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Third-party cookies</h2>
      <p>
        We do not use third-party advertising or tracking cookies. We do not embed Facebook Pixel,
        Google Analytics, or similar tools at this time. If that changes, we will update this page
        and ask for your consent before any new cookie is set.
      </p>

      <h2>4. Your choices</h2>
      <p>Strict-by-default: non-essential cookies are off until you opt in.</p>
      <ul>
        <li>The first time you visit, you see a cookie banner. You can <strong>Accept</strong> or{" "}
          <strong>Reject</strong> — both options dismiss the banner.</li>
        <li>You can change your choice any time by clearing the
          <code> longrein.consent.v1</code> entry in your browser&apos;s localStorage; the banner will
          reappear on next visit.</li>
        <li>You can also block cookies entirely in your browser settings — the Service will work,
          but you will need to log in each time.</li>
      </ul>

      <h2>5. Contact</h2>
      <p>Cookie questions: <a href="mailto:hello@longrein.eu">hello@longrein.eu</a>.</p>
    </>
  );
}

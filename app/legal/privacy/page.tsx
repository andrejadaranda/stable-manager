// /legal/privacy — Privacy Policy.
//
// GDPR-aligned. Single controller (Longrein UAB / Andreja Adaranda),
// processors disclosed (Supabase, Vercel, Resend), data subject rights,
// retention, security. To be reviewed by qualified counsel pre-paid.

export const metadata = {
  title: "Privacy Policy · Longrein",
  description:
    "How Longrein collects, uses, and protects your personal data. GDPR-aligned for EU customers.",
};

export default function PrivacyPage() {
  return (
    <>
      <p className="text-[13px] uppercase tracking-[0.14em] font-semibold text-brand-700 mb-2">
        Legal
      </p>
      <h1 className="font-display text-3xl md:text-4xl text-navy-900 leading-tight mb-2">
        Privacy Policy
      </h1>
      <p className="text-ink-500 text-[13px] mb-8">
        Effective: 2026-05-02 · Last updated: 2026-05-02
      </p>

      <h2>1. Who is the controller</h2>
      <p>
        Longrein is operated by <strong>Andreja Adaranda</strong>, a sole trader registered in
        Vilnius, Lithuania. We act as the data controller for the data described below.
        Contact: <a href="mailto:hello@longrein.eu">hello@longrein.eu</a>.
      </p>

      <h2>2. What data we collect</h2>
      <p><strong>Data you give us when you sign up or use the Service:</strong></p>
      <ul>
        <li>Account: email, full name, role, password (hashed), optional phone, optional photo URL.</li>
        <li>Stable data: stable name, address (optional), opening hours, services, price list.</li>
        <li>Operational data: horses (name, age, breed, owner, photo, health records, weekly limit),
          clients (name, email, phone, skill level, emergency contact), lessons, sessions, payments,
          expenses, charges, notes.</li>
      </ul>
      <p><strong>Data we collect automatically:</strong></p>
      <ul>
        <li>Login timestamps, IP address, browser user agent, device type (for security and abuse
          detection).</li>
        <li>Audit log entries — who created, edited, or deleted records inside your Stable.</li>
        <li>Cookies — see the <a href="/legal/cookies">Cookie Policy</a>.</li>
      </ul>

      <h2>3. Why we collect it (legal bases)</h2>
      <ul>
        <li><strong>Contract</strong> (GDPR Art. 6(1)(b)) — to provide the Service you signed up for.</li>
        <li><strong>Legitimate interests</strong> (Art. 6(1)(f)) — to keep the Service secure, prevent
          abuse, debug issues, and improve the product.</li>
        <li><strong>Consent</strong> (Art. 6(1)(a)) — for non-essential cookies and any optional
          marketing emails.</li>
        <li><strong>Legal obligation</strong> (Art. 6(1)(c)) — to comply with tax, accounting, and
          law-enforcement requests.</li>
      </ul>

      <h2>4. Who we share it with (processors)</h2>
      <p>We do not sell personal data. We share it only with the processors below, under written
        data processing agreements:</p>
      <ul>
        <li><strong>Supabase Inc.</strong> (USA, EU region: Ireland) — primary database, file storage,
          and authentication. Customer Data is hosted in West EU (Ireland).</li>
        <li><strong>Vercel Inc.</strong> (USA, EU region: Frankfurt) — application hosting and edge
          delivery.</li>
        <li><strong>Resend Inc.</strong> (USA) — transactional email (welcome, password reset,
          team invites, lesson reminders).</li>
        <li><strong>Hostinger</strong> (Lithuania) — domain registration for{" "}
          <code>longrein.eu</code>.</li>
      </ul>
      <p>Where data is transferred outside the EU/EEA, we rely on EU Standard Contractual Clauses
        and the providers&apos; supplementary measures.</p>

      <h2>5. How long we keep it</h2>
      <ul>
        <li>Active account data — for as long as your Stable account is active.</li>
        <li>Closed account data — exportable for at least 30 days after closure, then deleted from
          active systems within 60 days; deleted from backups within 90 days.</li>
        <li>Audit log entries — retained for 36 months for security and dispute resolution.</li>
        <li>Email server logs — 30 days.</li>
        <li>Tax / accounting records — as required by Lithuanian law (currently 10 years for
          invoices once issued).</li>
      </ul>

      <h2>6. Your rights (GDPR)</h2>
      <p>You have the right to:</p>
      <ul>
        <li>access the personal data we hold about you;</li>
        <li>have it corrected if inaccurate;</li>
        <li>have it deleted (&ldquo;right to be forgotten&rdquo;) where applicable;</li>
        <li>have it exported in a portable format (we provide CSV export from Settings → Backup);</li>
        <li>object to or restrict processing;</li>
        <li>withdraw consent for any consent-based processing at any time;</li>
        <li>lodge a complaint with the Lithuanian State Data Protection Inspectorate (VDAI) or your
          local supervisory authority.</li>
      </ul>
      <p>To exercise any of these, email <a href="mailto:hello@longrein.eu">hello@longrein.eu</a>.
        We respond within 30 days.</p>

      <h2>7. Security</h2>
      <p>We use industry-standard measures: HTTPS-only, hashed passwords, optional two-factor
        authentication, row-level security in the database (every query is filtered by your Stable),
        regular backups, access logging, principle of least privilege for engineering access. No
        system is perfectly secure; in the event of a breach affecting your data we will notify you
        and the supervisory authority within 72 hours, as required by GDPR Art. 33 / 34.</p>

      <h2>8. Children</h2>
      <p>The Service is intended for B2B use. Stables may store data about minor riders (lesson
        clients) — that data is your responsibility as the controller of your stable, with Longrein
        acting as a processor for the minor-related data. Do not sign up to use the Service yourself
        if you are under 16.</p>

      <h2>9. Changes to this policy</h2>
      <p>We may update this Policy. Material changes are notified by email at least 14 days before
        they take effect. The &ldquo;Last updated&rdquo; date above always reflects the latest
        version.</p>

      <h2>10. Contact</h2>
      <p>Privacy questions: <a href="mailto:hello@longrein.eu">hello@longrein.eu</a>.</p>

      <hr />
      <p className="text-[12px] text-ink-500">
        This Policy is a working draft for the Founding Members beta. It will be reviewed by
        qualified counsel before paid customers sign on.
      </p>
    </>
  );
}

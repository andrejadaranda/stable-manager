// /legal/terms — Terms of Service.
//
// Base structure adapted from Termly's free SaaS template, customized
// for: EU GDPR, single-tenant B2B equestrian SaaS, Lithuania-based
// controller. To be reviewed by qualified counsel before paid customers
// sign on (Founding Members trial = no commercial transaction).

export const metadata = {
  title: "Terms of Service · Longrein",
  description:
    "The contract between your stable and Longrein UAB covering your use of the Longrein platform.",
};

export default function TermsPage() {
  return (
    <>
      <p className="text-[13px] uppercase tracking-[0.14em] font-semibold text-brand-700 mb-2">
        Legal
      </p>
      <h1 className="font-display text-3xl md:text-4xl text-navy-900 leading-tight mb-2">
        Terms of Service
      </h1>
      <p className="text-ink-500 text-[13px] mb-8">
        Effective: 2026-05-02 · Last updated: 2026-05-02
      </p>

      <h2>1. Who we are</h2>
      <p>
        Longrein (&ldquo;<strong>Longrein</strong>,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is operated by
        Andreja Adaranda, a sole trader registered in Vilnius, Lithuania. Contact:{" "}
        <a href="mailto:hello@longrein.eu">hello@longrein.eu</a>. Service domain:{" "}
        <code>longrein.eu</code>.
      </p>

      <h2>2. What these terms cover</h2>
      <p>
        These Terms govern your access to and use of the Longrein web application and any related
        services (together, the &ldquo;<strong>Service</strong>&rdquo;). By creating an account or using
        the Service on behalf of a stable, you agree to these Terms. If you do not agree, do not use
        the Service.
      </p>

      <h2>3. Your account and your stable</h2>
      <p>
        The Service is multi-tenant. Each customer (&ldquo;<strong>Stable</strong>&rdquo;) gets a private
        workspace. The first person to sign up for a Stable becomes its <strong>Owner</strong> and
        controls who else has access. Owners are responsible for keeping login credentials secure,
        for the actions of their team and clients on the Service, and for ensuring their use complies
        with applicable law, including GDPR.
      </p>
      <p>
        You must be at least 16 years old to create an account. The Service is intended for B2B use by
        equestrian businesses; it is not directed at children.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>upload data you do not have the right to upload;</li>
        <li>use the Service to harass, defame, or harm any person or animal;</li>
        <li>reverse-engineer, scrape, or attempt to bypass our security or rate limits;</li>
        <li>use the Service for unlawful purposes or in breach of GDPR, animal welfare law, or any
          other regulation that applies to your business;</li>
        <li>resell or sublicense the Service without our written permission.</li>
      </ul>

      <h2>5. Founding Members beta (free trial)</h2>
      <p>
        During the Founding Members programme (2026-05-23 through 2027-05-23), the Service is
        provided <strong>free of charge</strong> in exchange for product feedback, a named case study,
        and referrals as separately agreed. We may ship breaking changes, run experiments, and pause
        non-essential features during this period. We will give reasonable notice before any change
        that could affect your data.
      </p>

      <h2>6. Your data</h2>
      <p>
        You retain ownership of all data you put into the Service (horse records, client lists,
        lessons, payments, notes — &ldquo;<strong>Customer Data</strong>&rdquo;). You grant us a limited
        licence to host, process, and back up Customer Data solely to provide the Service.
        We do not sell Customer Data and we do not use it to train third-party AI models. See our{" "}
        <a href="/legal/privacy">Privacy Policy</a> for full detail.
      </p>
      <p>
        On termination you can export Customer Data via the Settings → Backup tools for at least
        30 days; after that we may delete it from active systems. Backups follow our standard
        rotation and are deleted within 90 days.
      </p>

      <h2>7. Availability and support</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted Service during the Founding
        Members beta. Scheduled maintenance is announced in advance where possible. Support is
        provided by email at <a href="mailto:hello@longrein.eu">hello@longrein.eu</a> and via the
        weekly Founding Members call.
      </p>

      <h2>8. Changes to the Service and these Terms</h2>
      <p>
        We may update the Service and these Terms. Material changes are notified by email at least
        14 days before they take effect. Continued use after the effective date is acceptance of the
        updated Terms.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may close your account at any time from Settings → Account. We may suspend or terminate
        access if you breach these Terms or if your use poses a security risk to other Stables. On
        termination we keep Customer Data accessible for at least 30 days for export.
      </p>

      <h2>10. Liability</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; during the Founding Members beta. To the maximum
        extent permitted by Lithuanian and EU law, our aggregate liability to you in any 12-month
        period is capped at the fees paid by you in that period (which during the Founding Members
        programme is €0). We do not exclude or limit liability for fraud, gross negligence, death or
        personal injury, or any liability that cannot lawfully be limited.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of the Republic of Lithuania. Disputes are subject to
        the exclusive jurisdiction of the Vilnius courts, save for any non-waivable consumer rights
        you may have in your country of residence.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:hello@longrein.eu">hello@longrein.eu</a>.
      </p>

      <hr />
      <p className="text-[12px] text-ink-500">
        These Terms are provided as a starting point for the Founding Members beta and are not a
        substitute for advice from qualified counsel. Once paid plans launch (Month 4–6) they will
        be reviewed and re-signed by all customers.
      </p>
    </>
  );
}

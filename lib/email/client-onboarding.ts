// lib/email/client-onboarding.ts
//
// First-lesson onboarding invitation email (Lithuanian — TJK).
//
// Sent once per client by the "Send onboarding invitation" button in the
// client profile. Carries the secure onboarding link the client opens to
// review the club info and (later phases) fill their details + sign the
// required agreements. Calm, premium, non-marketing voice — this is the
// client's first impression of the club.
//
// Parameterised so it works for any stable, but the default copy is the
// TJK first-lesson text. Send via the generic sendEmail() helper.

import { sendEmail, emailFooter } from "./send";

export type OnboardingEmailArgs = {
  to: string;
  /** Rider/client display name for the greeting. */
  clientName: string;
  /** Secure onboarding link (https://app.longrein.eu/onboarding/<token>). */
  onboardingUrl: string;
  /** Club name shown in copy + sign-off. Defaults to Trakų jojimo klubas. */
  clubName?: string;
  /** Who the email is signed by (the trainer/owner). */
  signerName?: string;
  /** Reply-To so the client can just reply with questions. */
  replyTo?: string;
  /** Dedup key — prevents Resend double-sends on retry. */
  idempotencyKey?: string;
};

export function buildOnboardingEmail(args: {
  clientName: string;
  onboardingUrl: string;
  clubName: string;
  signerName: string;
}): { subject: string; html: string; text: string } {
  const { clientName, onboardingUrl, clubName, signerName } = args;
  const greetingName = clientName?.trim() || "";

  const subject = `Jūsų pirmoji pamoka — ${clubName}`;

  const text = `Sveiki, ${greetingName},

dėkojame, kad registruojatės į ${clubName}.

Prieš pirmąją pamoką norime trumpai pasidalinti svarbia informacija, kad atvykimas būtų aiškus, ramus ir sklandus.

Prašome atvykti 10–15 minučių anksčiau, kad turėtume laiko susipažinti, aptarti pirmąją treniruotę ir pasiruošti.

Apranga:
• patogios, judesių nevaržančios kelnės;
• batai su nedideliu kulnu arba tvirtesni uždari batai;
• pagal oro sąlygas pritaikyta viršutinė apranga;
• šalmas, jei turite savo.

Jeigu šalmo neturite, dėl to susitarsime prieš pamoką.

Prieš pirmąją pamoką taip pat prašome susipažinti su jojimo paslaugų sutartimi ir ją pasirašyti:
${onboardingUrl}

Jojimas yra veikla, kuriai reikalingas dėmesys, atsakomybė ir pagarba žirgui, todėl labai svarbu, kad visi klientai prieš pamoką būtų susipažinę su pagrindinėmis taisyklėmis.

Jeigu pamokoje dalyvaus vaikas, sutartį turi pasirašyti vienas iš tėvų arba globėjų.

Jeigu turite klausimų prieš atvykstant, galite atsakyti į šį laišką arba susisiekti telefonu.

Iki pasimatymo,
${signerName}
${clubName}`;

  const html = `<!doctype html><html lang="lt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F4ECDF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="background:#ffffff;border:1px solid #E7DECF;border-radius:16px;padding:32px 28px;color:#2A2722;line-height:1.6;font-size:15px;">
    <p style="margin:0 0 16px;">Sveiki, <strong>${greetingName}</strong>,</p>
    <p style="margin:0 0 16px;">dėkojame, kad registruojatės į ${clubName}.</p>
    <p style="margin:0 0 16px;">Prieš pirmąją pamoką norime trumpai pasidalinti svarbia informacija, kad atvykimas būtų aiškus, ramus ir sklandus.</p>
    <p style="margin:0 0 16px;">Prašome atvykti <strong>10–15 minučių anksčiau</strong>, kad turėtume laiko susipažinti, aptarti pirmąją treniruotę ir pasiruošti.</p>
    <p style="margin:0 0 6px;font-weight:600;">Apranga:</p>
    <ul style="margin:0 0 16px;padding-left:20px;">
      <li>patogios, judesių nevaržančios kelnės;</li>
      <li>batai su nedideliu kulnu arba tvirtesni uždari batai;</li>
      <li>pagal oro sąlygas pritaikyta viršutinė apranga;</li>
      <li>šalmas, jei turite savo.</li>
    </ul>
    <p style="margin:0 0 16px;">Jeigu šalmo neturite, dėl to susitarsime prieš pamoką.</p>
    <p style="margin:0 0 18px;">Prieš pirmąją pamoką taip pat prašome susipažinti su jojimo paslaugų sutartimi ir ją pasirašyti:</p>
    <p style="margin:0 0 22px;text-align:center;">
      <a href="${onboardingUrl}" style="display:inline-block;background:#1E3A2A;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">Peržiūrėti ir pasirašyti →</a>
    </p>
    <p style="margin:0 0 16px;">Jojimas yra veikla, kuriai reikalingas dėmesys, atsakomybė ir pagarba žirgui, todėl labai svarbu, kad visi klientai prieš pamoką būtų susipažinę su pagrindinėmis taisyklėmis.</p>
    <p style="margin:0 0 16px;">Jeigu pamokoje dalyvaus vaikas, sutartį turi pasirašyti vienas iš tėvų arba globėjų.</p>
    <p style="margin:0 0 20px;">Jeigu turite klausimų prieš atvykstant, galite atsakyti į šį laišką arba susisiekti telefonu.</p>
    <p style="margin:0;">Iki pasimatymo,<br><strong>${signerName}</strong><br><span style="color:#6E6760;">${clubName}</span></p>
  </div>
  ${emailFooter()}
</div>
</body></html>`;

  return { subject, html, text };
}

export async function sendOnboardingEmail(args: OnboardingEmailArgs): Promise<void> {
  const clubName = args.clubName?.trim() || "Trakų jojimo klubas";
  const signerName = args.signerName?.trim() || "Trakų jojimo klubas";
  const { subject, html, text } = buildOnboardingEmail({
    clientName:    args.clientName,
    onboardingUrl: args.onboardingUrl,
    clubName,
    signerName,
  });

  await sendEmail({
    to:             args.to,
    subject,
    html,
    text,
    replyTo:        args.replyTo,
    idempotencyKey: args.idempotencyKey,
  });
}

"use server";

// Public onboarding submission (Phase 2). Called by the self-service form
// at /onboarding/<token>. There is NO session here — the token is the
// capability, re-validated server-side via the service-role client. We
// never trust anything from the client beyond the token + the fields.
//
// Submitting writes the rider's details (and, for a minor, the legally
// responsible parent/guardian) straight onto the client row and flips
// onboarding_status -> 'submitted'. Zero manual data entry by staff.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ONBOARDING_ENABLED } from "@/lib/config/onboarding";

export type OnboardingSubmitState = { error: string | null; success: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function s(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function submitOnboardingAction(
  _prev: OnboardingSubmitState,
  formData: FormData,
): Promise<OnboardingSubmitState> {
  if (!ONBOARDING_ENABLED) return { error: "Funkcija šiuo metu nepasiekiama.", success: false };

  const token = s(formData, "token");
  if (token.length < 16) return { error: "Neteisinga nuoroda.", success: false };

  const supabase = createSupabaseAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, onboarding_status, onboarding_token_expires_at")
    .eq("onboarding_token", token)
    .maybeSingle();
  if (!client) return { error: "Nuoroda nebegalioja arba jau panaudota.", success: false };
  const c = client as { id: string; onboarding_status: string; onboarding_token_expires_at: string | null };

  if (c.onboarding_token_expires_at && new Date(c.onboarding_token_expires_at).getTime() <= Date.now())
    return { error: "Nuoroda nebegalioja. Susisiekite su klubu dėl naujo kvietimo.", success: false };
  if (c.onboarding_status === "signed" || c.onboarding_status === "completed")
    return { error: "Onboarding jau užbaigtas.", success: false };

  const participant = s(formData, "participant"); // 'adult' | 'child'
  if (participant !== "adult" && participant !== "child")
    return { error: "Pasirinkite, kas dalyvaus pamokose.", success: false };
  const isMinor = participant === "child";

  // Shared optional rider info.
  const riderName  = s(formData, "rider_name");
  const dob        = s(formData, "date_of_birth");
  const experience = s(formData, "riding_experience");
  const medical    = s(formData, "medical_notes");
  const allergies  = s(formData, "allergies");

  if (!riderName) return { error: "Įveskite jojiko vardą ir pavardę.", success: false };
  if (!dob)       return { error: "Įveskite gimimo datą.", success: false };

  const update: Record<string, unknown> = {
    full_name:               riderName,
    date_of_birth:           dob,
    is_minor:                isMinor,
    riding_experience:       experience || null,
    medical_notes:           medical || null,
    allergies:               allergies || null,
    onboarding_status:       "submitted",
    onboarding_submitted_at: new Date().toISOString(),
  };

  if (isMinor) {
    // Legal responsibility belongs to the parent/guardian. Comms route to
    // them — the rider's own email/phone stay empty by design.
    const gName  = s(formData, "guardian_name");
    const gRel   = s(formData, "guardian_relationship");
    const gEmail = s(formData, "guardian_email");
    const gPhone = s(formData, "guardian_phone");
    const consent = s(formData, "guardian_consent"); // "on" when checked

    if (!gName)  return { error: "Įveskite tėvo / globėjo vardą ir pavardę.", success: false };
    if (!gRel)   return { error: "Nurodykite ryšį su vaiku (mama / tėtis / globėjas).", success: false };
    if (!gEmail || !EMAIL_RE.test(gEmail)) return { error: "Įveskite teisingą tėvo / globėjo el. pašto adresą.", success: false };
    if (!gPhone) return { error: "Įveskite tėvo / globėjo telefono numerį.", success: false };
    if (consent !== "on") return { error: "Pažymėkite, kad esate teisėtas vaiko atstovas.", success: false };

    update.guardian_name         = gName;
    update.guardian_relationship = gRel;
    update.guardian_email        = gEmail;
    update.guardian_phone        = gPhone;
    // Surface the guardian as the client's contact email/phone so existing
    // reminder + invoice flows reach the responsible adult, not the child.
    update.email                 = gEmail;
    update.phone                 = gPhone;
  } else {
    // Adult — their own contact details + (optional) emergency contact.
    const email = s(formData, "email");
    const phone = s(formData, "phone");
    if (!email || !EMAIL_RE.test(email)) return { error: "Įveskite teisingą el. pašto adresą.", success: false };
    if (!phone) return { error: "Įveskite telefono numerį.", success: false };

    update.email = email;
    update.phone = phone;

    const ecName  = s(formData, "emergency_contact_name");
    const ecPhone = s(formData, "emergency_contact_phone");
    const ecRel   = s(formData, "emergency_contact_relation");
    if (ecName)  update.emergency_contact_name     = ecName;
    if (ecPhone) update.emergency_contact_phone    = ecPhone;
    if (ecRel)   update.emergency_contact_relation = ecRel;
  }

  const { error } = await supabase.from("clients").update(update).eq("id", c.id);
  if (error) return { error: `Nepavyko išsaugoti: ${error.message}.`, success: false };

  return { error: null, success: true };
}

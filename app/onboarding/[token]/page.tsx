// Public onboarding landing — opened from the secure email link.
//
// Phase 1: validate the token (service role — the token IS the capability,
// there is no session here), mark the invitation 'opened', and show the
// club's first-lesson information. Phase 2 replaces the placeholder below
// with the real self-service form (details + adult/minor branch); Phase 3
// adds document review + e-signature.
//
// Security: token = secret. We read by token via the service-role client,
// never via a client directory. Expired or unknown tokens render a neutral
// "link is no longer valid" page — no enumeration signal.

import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { ONBOARDING_ENABLED } from "@/lib/config/onboarding";

export const dynamic = "force-dynamic";

type OnboardingClient = {
  id: string;
  full_name: string;
  stable_id: string;
  onboarding_status: string;
  onboarding_token_expires_at: string | null;
};

export default async function OnboardingPage({
  params,
}: {
  params: { token: string };
}) {
  if (!ONBOARDING_ENABLED) notFound();

  const token = params.token ?? "";
  let client: OnboardingClient | null = null;
  let clubName = "Trakų jojimo klubas";

  if (token.length >= 16) {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, stable_id, onboarding_status, onboarding_token_expires_at")
      .eq("onboarding_token", token)
      .maybeSingle();
    client = (data as OnboardingClient | null) ?? null;

    if (client) {
      const expired =
        client.onboarding_token_expires_at != null &&
        new Date(client.onboarding_token_expires_at).getTime() <= Date.now();
      if (expired) {
        client = null;
      } else {
        // Resolve the club name for the greeting.
        const { data: stable } = await supabase
          .from("stables")
          .select("name")
          .eq("id", client.stable_id)
          .maybeSingle();
        clubName = ((stable as { name?: string } | null)?.name ?? "").trim() || clubName;

        // Mark 'opened' on first visit (best-effort; only advances from invited).
        if (client.onboarding_status === "invited") {
          await supabase
            .from("clients")
            .update({ onboarding_status: "opened", onboarding_opened_at: new Date().toISOString() })
            .eq("id", client.id)
            .eq("onboarding_status", "invited");
        }
      }
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4ECDF", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ textAlign: "center", marginBottom: 20, fontFamily: "'Source Serif 4',Georgia,serif", fontSize: 22, fontWeight: 600, color: "#1E3A2A" }}>
          Longrein<span style={{ color: "#B5793E" }}>.</span>
        </div>

        {!client ? (
          <div style={{ background: "#fff", border: "1px solid #E7DECF", borderRadius: 16, padding: "32px 28px", color: "#2A2722", lineHeight: 1.6 }}>
            <h1 style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: 22, margin: "0 0 10px", color: "#16291E" }}>Nuoroda nebegalioja</h1>
            <p style={{ margin: 0, fontSize: 15 }}>
              Ši onboarding nuoroda nebegalioja arba jau panaudota. Jeigu tai
              klaida, parašykite mums — atsiųsime naują kvietimą.
            </p>
          </div>
        ) : client.onboarding_status === "submitted" || client.onboarding_status === "signed" || client.onboarding_status === "completed" ? (
          <div style={{ background: "#fff", border: "1px solid #E7DECF", borderRadius: 16, padding: "32px 28px", color: "#2A2722", lineHeight: 1.6, fontSize: 15, textAlign: "center" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
            <h1 style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: 22, margin: "0 0 10px", color: "#16291E" }}>Ačiū — duomenys jau gauti</h1>
            <p style={{ margin: 0, color: "#4A453E" }}>
              Jūsų informacija užregistruota. Su jumis susisieksime dėl pirmosios
              pamokos. Sutarties pasirašymą internetu netrukus įdiegsime čia.
            </p>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #E7DECF", borderRadius: 16, padding: "32px 28px", color: "#2A2722", lineHeight: 1.6, fontSize: 15 }}>
            <OnboardingForm token={token} riderName={client.full_name} />

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #EFE7D8", color: "#6E6760", fontSize: 13.5, lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#16291E" }}>Prieš pirmąją pamoką</p>
              <p style={{ margin: 0 }}>
                Atvykite 10–15 min anksčiau. Apranga: patogios kelnės, batai su
                nedideliu kulnu, pagal orą pritaikyta viršutinė apranga, šalmas
                (jei turite — jei ne, susitarsime klube).
              </p>
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", color: "#6E6760", fontSize: 12, marginTop: 22 }}>
          {clubName}
        </p>
      </div>
    </div>
  );
}

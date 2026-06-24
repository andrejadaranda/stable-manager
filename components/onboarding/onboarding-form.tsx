"use client";

// Self-service onboarding form (Phase 2) — rendered on the public
// /onboarding/<token> page. Two branches:
//   Adult  → own contact details + optional emergency contact.
//   Child  → rider info + parent/guardian (legally responsible) + consent.
// The rider is always the client row; for a minor the guardian becomes the
// contact and signer. Submits to submitOnboardingAction (token re-validated
// server-side). LT throughout — this is TJK's client-facing surface.

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitOnboardingAction, type OnboardingSubmitState } from "@/app/onboarding/[token]/actions";

const initial: OnboardingSubmitState = { error: null, success: false };

const FIELD: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid #D9CDBA",
  background: "#fff", color: "#2A2722", fontSize: 15, padding: "10px 12px", fontFamily: "inherit",
};
const LABEL: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#4A453E", margin: "0 0 5px" };
const ROW: React.CSSProperties = { marginBottom: 14 };

export function OnboardingForm({ token, riderName }: { token: string; riderName: string }) {
  const [state, formAction] = useFormState(submitOnboardingAction, initial);
  const [participant, setParticipant] = useState<"" | "adult" | "child">("");

  if (state.success) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
        <h1 style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: 22, margin: "0 0 10px", color: "#16291E" }}>Ačiū — duomenys gauti</h1>
        <p style={{ margin: 0, color: "#4A453E", lineHeight: 1.6, fontSize: 15 }}>
          Jūsų informacija sėkmingai užregistruota. Sutarties pasirašymą internetu
          netrukus įdiegsime — iki tol su jumis susisieksime dėl pirmosios pamokos.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />

      <h1 style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: 22, margin: "0 0 6px", color: "#16291E" }}>Registracijos anketa</h1>
      <p style={{ margin: "0 0 20px", color: "#4A453E", lineHeight: 1.55, fontSize: 14.5 }}>
        Užpildykite anketą prieš pirmąją pamoką. Užtruksite porą minučių.
      </p>

      {/* Who participates */}
      <div style={ROW}>
        <span style={LABEL}>Kas dalyvaus pamokose?</span>
        <div style={{ display: "flex", gap: 10 }}>
          {([["adult", "Suaugęs (18+)"], ["child", "Vaikas (iki 18)"]] as const).map(([val, lbl]) => (
            <label key={val} style={{
              flex: 1, cursor: "pointer", textAlign: "center", padding: "10px 8px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: participant === val ? "2px solid #1E3A2A" : "1px solid #D9CDBA",
              background: participant === val ? "#EAF0EA" : "#fff", color: participant === val ? "#16291E" : "#4A453E",
            }}>
              <input type="radio" name="participant" value={val} checked={participant === val}
                onChange={() => setParticipant(val)} required style={{ display: "none" }} />
              {lbl}
            </label>
          ))}
        </div>
      </div>

      {participant && (
        <>
          {/* Rider — always the client */}
          <Section title={participant === "child" ? "Jojiko informacija" : "Jūsų informacija"}>
            <div style={ROW}>
              <label style={LABEL}>Vardas ir pavardė</label>
              <input name="rider_name" defaultValue={riderName} required maxLength={120} style={FIELD} />
            </div>
            <div style={ROW}>
              <label style={LABEL}>Gimimo data</label>
              <input name="date_of_birth" type="date" required style={FIELD} />
            </div>

            {participant === "adult" && (
              <>
                <div style={ROW}>
                  <label style={LABEL}>El. paštas</label>
                  <input name="email" type="email" required maxLength={254} style={FIELD} />
                </div>
                <div style={ROW}>
                  <label style={LABEL}>Telefono numeris</label>
                  <input name="phone" type="tel" required maxLength={32} style={FIELD} placeholder="+370…" />
                </div>
              </>
            )}

            {participant === "child" && (
              <>
                <div style={ROW}>
                  <label style={LABEL}>Jojimo patirtis <span style={{ color: "#9A9388", fontWeight: 400 }}>(neprivaloma)</span></label>
                  <input name="riding_experience" maxLength={200} style={FIELD} placeholder="Pvz. pradedantis, jojo stovykloje…" />
                </div>
                <div style={ROW}>
                  <label style={LABEL}>Sveikatos pastabos <span style={{ color: "#9A9388", fontWeight: 400 }}>(neprivaloma)</span></label>
                  <input name="medical_notes" maxLength={300} style={FIELD} />
                </div>
                <div style={ROW}>
                  <label style={LABEL}>Alergijos <span style={{ color: "#9A9388", fontWeight: 400 }}>(neprivaloma)</span></label>
                  <input name="allergies" maxLength={300} style={FIELD} />
                </div>
              </>
            )}
          </Section>

          {participant === "adult" && (
            <Section title="Kontaktas nelaimės atveju (neprivaloma)">
              <div style={ROW}>
                <label style={LABEL}>Vardas</label>
                <input name="emergency_contact_name" maxLength={120} style={FIELD} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ ...ROW, flex: 1 }}>
                  <label style={LABEL}>Telefonas</label>
                  <input name="emergency_contact_phone" type="tel" maxLength={32} style={FIELD} />
                </div>
                <div style={{ ...ROW, flex: 1 }}>
                  <label style={LABEL}>Ryšys</label>
                  <input name="emergency_contact_relation" maxLength={60} style={FIELD} placeholder="sutuoktinis, draugas…" />
                </div>
              </div>
            </Section>
          )}

          {participant === "child" && (
            <Section title="Tėvas / globėjas">
              <div style={ROW}>
                <label style={LABEL}>Vardas ir pavardė</label>
                <input name="guardian_name" required maxLength={120} style={FIELD} />
              </div>
              <div style={ROW}>
                <label style={LABEL}>Ryšys su vaiku</label>
                <input name="guardian_relationship" required maxLength={60} style={FIELD} placeholder="mama / tėtis / globėjas" />
              </div>
              <div style={ROW}>
                <label style={LABEL}>El. paštas</label>
                <input name="guardian_email" type="email" required maxLength={254} style={FIELD} />
              </div>
              <div style={ROW}>
                <label style={LABEL}>Telefono numeris</label>
                <input name="guardian_phone" type="tel" required maxLength={32} style={FIELD} placeholder="+370…" />
              </div>
              <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", fontSize: 13.5, color: "#4A453E", lineHeight: 1.5, marginTop: 4 }}>
                <input type="checkbox" name="guardian_consent" required style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
                <span>Patvirtinu, kad esu vaiko tėvas arba teisėtas globėjas ir turiu teisę pasirašyti dokumentus jo / jos vardu.</span>
              </label>
            </Section>
          )}

          {state.error && (
            <p style={{ margin: "0 0 14px", background: "#FBEAEA", border: "1px solid #E7B7B7", color: "#9A2E2E", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, lineHeight: 1.45 }}>
              {state.error}
            </p>
          )}

          <Submit />
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#9A9388", textAlign: "center" }}>
            Pasirašymas internetu bus įdiegtas netrukus. Duomenis saugome pagal BDAR.
          </p>
        </>
      )}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #EFE7D8" }}>
      <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6E6760" }}>{title}</p>
      {children}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{
      width: "100%", marginTop: 8, border: "none", borderRadius: 11, cursor: pending ? "default" : "pointer",
      background: "#1E3A2A", color: "#fff", fontWeight: 600, fontSize: 15.5, padding: "13px 18px", opacity: pending ? 0.6 : 1, fontFamily: "inherit",
    }}>
      {pending ? "Siunčiama…" : "Pateikti"}
    </button>
  );
}

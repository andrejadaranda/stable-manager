import type { Config } from "tailwindcss";

/**
 * Hoofbeat design tokens — locked brand system.
 *
 * Brand strategy (2026-04-30 brand-consistency pass):
 * - `brand-*` ramp = Paddock Green family. The primary action color
 *   across both marketing and product. Replaces the prior orange so
 *   in-app dashboard matches the cream/green/saddle marketing site.
 * - `saddle-*` ramp = warm tan/cognac. Used for accent highlights and
 *   secondary chrome only — never as the dominant action color.
 * - `surface` = Arena Cream (#F8F4EE). The warm base for everything.
 * - `navy-*` retained for high-contrast text on cream and editorial
 *   serif headings. Reduced from a chrome color to a typography color.
 * - `alert-*` = the old warm orange ramp. Restricted to error / warning
 *   / "live now" / focus rings. Never primary action.
 *
 * Locked colors per memory file project_hoofbeat_brand:
 *   Paddock Green:  #1E3A2A
 *   Saddle Tan:     #B5793E
 *   Arena Cream:    #F4ECDF (close to existing surface #F8F4EE)
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand — Paddock Green. 600 = primary action.
        brand: {
          50:  "#EEF4EE",
          100: "#D8E5D9",
          200: "#B0CDB1",
          300: "#82B287",
          400: "#559263",
          500: "#3D7A4F",
          600: "#2D5440", // primary
          700: "#1E3A2A", // deepest — chrome / serif headings on cream
          800: "#15281C",
          900: "#0D1A12",
        },
        // Saddle — warm tan / cognac. Accent only.
        saddle: {
          50:  "#FAF1E5",
          100: "#F0DEC0",
          200: "#E0C291",
          300: "#CFA463",
          400: "#C18C44",
          500: "#B5793E",
          600: "#9A6432",
          700: "#7A4F26",
          800: "#5A3A1B",
          900: "#3D2812",
        },
        // Alert — restricted-use warm orange. Errors / warnings / focus
        // rings. Maps to the old `brand-*` orange palette so legacy
        // alert components keep working.
        alert: {
          50:  "#FFF1EB",
          100: "#FED7C3",
          200: "#FBB89A",
          300: "#F89B72",
          400: "#F68153",
          500: "#F4663D",
          600: "#E04E25",
          700: "#B23F1A",
          800: "#8A2F12",
          900: "#5C1F0B",
        },
        // Navy retained for editorial typography on cream surfaces.
        navy: {
          50:  "#EEF1F8",
          100: "#DCE2EE",
          200: "#B5C0D8",
          300: "#8896B5",
          400: "#56688E",
          500: "#3A4C6F",
          600: "#293A57",
          700: "#1E2A47",
          800: "#162038",
          900: "#0E1729",
        },
        // Surface = Arena Cream. Same DNA as Notion / Aesop / Berluti.
        surface: {
          DEFAULT: "#F8F4EE",
          muted:   "#F1EAE0",
          sunken:  "#EAE1D3",
        },
        // Ink = warm dark for text. Unchanged.
        ink: {
          900: "#1C1A17",
          800: "#2B2724",
          700: "#3F3934",
          600: "#5A5249",
          500: "#7B7167",
          400: "#A09487",
          300: "#C4B9AC",
          200: "#E1D9CD",
          100: "#EFEBE3",
          50:  "#F5F1EA",
        },
      },
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: [
          "Fraunces",
          "Source Serif 4",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
        display: [
          "Fraunces",
          "Source Serif 4",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
      },
      borderRadius: {
        lg: "10px",
        xl: "14px",
        "2xl": "24px",
        "3xl": "32px",
      },
      boxShadow: {
        soft:  "0 1px 2px rgba(30, 58, 42, 0.04), 0 8px 24px -8px rgba(30, 58, 42, 0.08)",
        lift:  "0 1px 2px rgba(30, 58, 42, 0.05), 0 14px 32px -10px rgba(30, 58, 42, 0.14)",
        ring:  "0 0 0 1px rgba(30, 58, 42, 0.06)",
        // Focus ring uses paddock green now, not orange.
        focus: "0 0 0 3px rgba(45, 84, 64, 0.22)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

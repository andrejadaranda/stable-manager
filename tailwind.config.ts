import type { Config } from "tailwindcss";

/**
 * Stable OS design tokens — Navy + Orange refresh.
 *
 * Brand strategy (2026-04-28 refresh):
 * - `brand-*` ramp = vivid warm orange (#F4663D family). It carries primary
 *   actions, accents, status "live", focus rings. Keeps the same Tailwind
 *   class names so existing markup (bg-brand-600, text-brand-700, etc.)
 *   automatically picks up the new orange without code edits.
 * - `navy-*` ramp = deep slate blue. Used for chrome (sidebar active state,
 *   high-contrast cards like the "Revenue" hero), serif headings, primary
 *   text on warm surfaces.
 * - `surface` = warm cream (#F8F4EE). Pairs with navy as the calm,
 *   premium base. Same DNA as Notion / Apple Fitness backgrounds.
 *
 * Status colors stay generic (emerald / amber / rose / sky) — brand is
 * reserved for primary actions and accents, never for status meaning.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand — warm orange. 600 = primary action, 500 = hover/light.
        brand: {
          50:  "#FFF1EB",
          100: "#FED7C3",
          200: "#FBB89A",
          300: "#F89B72",
          400: "#F68153",
          500: "#F4663D",
          600: "#E04E25", // primary
          700: "#B23F1A",
          800: "#8A2F12",
          900: "#5C1F0B",
        },
        // Navy — deep slate. 900 = darkest chrome / serif headings.
        navy: {
          50:  "#EEF1F8",
          100: "#DCE2EE",
          200: "#B5C0D8",
          300: "#8896B5",
          400: "#56688E",
          500: "#3A4C6F",
          600: "#293A57",
          700: "#1E2A47", // primary chrome
          800: "#162038",
          900: "#0E1729",
        },
        // Surface = warm cream (slightly cooler than terracotta era).
        surface: {
          DEFAULT: "#F8F4EE",
          muted:   "#F1EAE0",
          sunken:  "#EAE1D3",
        },
        // Ink = warm dark for text. Tighter set than tailwind defaults.
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
        // Premium serif for hero greetings, horse names, financial sums.
        serif: [
          "Fraunces",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
      },
      borderRadius: {
        // Cards bumped from 20→24 for a softer, more editorial feel.
        // xl/2xl/3xl reserved for cards. Inputs use lg.
        lg: "10px",
        xl: "14px",
        "2xl": "24px",
        "3xl": "32px",
      },
      boxShadow: {
        // Soft elevation — replaces border + drop-shadow combos.
        soft:  "0 1px 2px rgba(14, 23, 41, 0.04), 0 8px 24px -8px rgba(14, 23, 41, 0.08)",
        lift:  "0 1px 2px rgba(14, 23, 41, 0.05), 0 14px 32px -10px rgba(14, 23, 41, 0.14)",
        ring:  "0 0 0 1px rgba(14, 23, 41, 0.06)",
        focus: "0 0 0 3px rgba(244, 102, 61, 0.22)", // orange brand-500 @ 22%
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

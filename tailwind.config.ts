import type { Config } from "tailwindcss";

/**
 * Stable OS design tokens.
 *
 * Brand color = warm terracotta. Picked because:
 * - reads as "earth / equestrian" without being literal
 * - friendly enough for trial onboarding, professional enough for invoices
 * - distinct from typical SaaS blue / green
 *
 * Neutrals = warm gray (slight tan tint) so brand color blends instead of
 * fighting cold #6b7280 grays.
 *
 * Status colors stay generic (emerald/amber/rose/sky) — brand is reserved
 * for primary actions and accents, never for status meaning.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand — warm terracotta. 600 = primary action, 500 = hover/light.
        brand: {
          50:  "#FBF1EA",
          100: "#F5DDCB",
          200: "#EBBA98",
          300: "#E29A6E",
          400: "#D87E4D",
          500: "#C9663A",
          600: "#B25430", // primary
          700: "#8E4327",
          800: "#6A321E",
          900: "#472116",
        },
        // Surface = warm off-white (slight cream).
        surface: {
          DEFAULT: "#FAF8F5",
          muted:   "#F3F0EB",
          sunken:  "#EDE9E2",
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
      },
      borderRadius: {
        // xl/2xl/3xl reserved for cards. Inputs use lg.
        lg: "10px",
        xl: "14px",
        "2xl": "20px",
        "3xl": "28px",
      },
      boxShadow: {
        // Soft elevation — replaces border + drop-shadow combos.
        soft:  "0 1px 2px rgba(28, 26, 23, 0.04), 0 8px 24px -8px rgba(28, 26, 23, 0.08)",
        lift:  "0 1px 2px rgba(28, 26, 23, 0.05), 0 14px 32px -10px rgba(28, 26, 23, 0.14)",
        ring:  "0 0 0 1px rgba(28, 26, 23, 0.06)",
        focus: "0 0 0 3px rgba(178, 84, 48, 0.20)", // brand-600 @ 20%
      },
      spacing: {
        // 18 / 22 fill awkward gaps in Tailwind's default scale.
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

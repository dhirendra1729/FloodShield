import type { Config } from "tailwindcss";

/**
 * Every colour resolves to a CSS custom property declared in globals.css.
 * That keeps one source of truth: change the variable, both the Tailwind
 * utility and the raw CSS follow. Do not inline hex values here.
 */
const token = (name: string) => `var(--fs-${name})`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // --- Semantic names (preferred in new code) -----------------------
        surface: {
          base: token("surface-base"),
          sunken: token("surface-sunken"),
          DEFAULT: token("surface"),
          raised: token("surface-raised"),
          high: token("surface-high"),
          highest: token("surface-highest"),
          glass: token("surface-glass"),
        },
        content: {
          DEFAULT: token("text"),
          muted: token("text-muted"),
          subtle: token("text-subtle"),
          faint: token("text-faint"),
        },
        brand: {
          DEFAULT: token("primary"),
          strong: token("primary-strong"),
          dim: token("primary-dim"),
          wash: token("primary-wash"),
        },
        success: { DEFAULT: token("success"), wash: token("success-wash") },
        warning: { DEFAULT: token("warning"), wash: token("warning-wash") },
        danger: { DEFAULT: token("danger"), wash: token("danger-wash") },
        info: { DEFAULT: token("info"), wash: token("info-wash") },
        edge: {
          DEFAULT: token("border"),
          strong: token("border-strong"),
          focus: token("focus"),
        },

        // --- Legacy Material-3 aliases ------------------------------------
        // Kept so any un-migrated markup still resolves to the token layer
        // instead of a stale hex. Slated for removal once the migration ends.
        background: token("surface-base"),
        "on-background": token("text"),
        "on-surface": token("text"),
        "on-surface-variant": token("text-muted"),
        primary: token("primary"),
        "primary-container": token("surface-sunken"),
        "on-primary-container": token("primary-dim"),
        "primary-fixed": token("primary-strong"),
        secondary: token("primary"),
        "secondary-container": token("surface-high"),
        "on-secondary-container": token("text-muted"),
        tertiary: token("info"),
        "tertiary-container": token("surface-sunken"),
        "surface-container-lowest": token("surface-base"),
        "surface-container-low": token("surface"),
        "surface-container": token("surface-raised"),
        "surface-container-high": token("surface-high"),
        "surface-container-highest": token("surface-highest"),
        "surface-glass": token("surface-glass"),
        "surface-variant": token("surface-highest"),
        "border-glass": token("border"),
        outline: token("text-subtle"),
        "outline-variant": token("border"),
        error: token("danger"),
        "status-emergency": token("danger"),
        "status-warning": token("warning"),
        "status-success": token("success"),
      },

      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
        // Legacy aliases
        "body-lg": ["var(--font-inter)", "sans-serif"],
        "display-lg": ["var(--font-inter)", "sans-serif"],
        "display-xl": ["var(--font-inter)", "sans-serif"],
        "headline-md": ["var(--font-inter)", "sans-serif"],
        "headline-lg": ["var(--font-inter)", "sans-serif"],
        "title-lg": ["var(--font-inter)", "sans-serif"],
        "body-md": ["var(--font-inter)", "sans-serif"],
        "data-mono": ["var(--font-jetbrains-mono)", "monospace"],
        "label-caps": ["var(--font-jetbrains-mono)", "monospace"],
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem", letterSpacing: "0.06em" }],
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.875rem", { lineHeight: "1.375rem" }],
        md: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.625rem" }],
        xl: ["1.5rem", { lineHeight: "1.875rem", letterSpacing: "-0.01em" }],
        "2xl": ["2rem", { lineHeight: "2.375rem", letterSpacing: "-0.02em" }],
        // Legacy aliases
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "data-mono": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "label-caps": ["12px", { lineHeight: "16px", letterSpacing: "0.1em", fontWeight: "700" }],
        "title-lg": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "display-lg": ["48px", { lineHeight: "52px", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-xl": ["64px", { lineHeight: "72px", letterSpacing: "-0.03em", fontWeight: "800" }],
      },

      spacing: {
        // Tailwind's default scale already covers 4px increments; these are
        // the layout-level names the shell uses.
        "panel": "1.5rem",
        "gutter": "1.5rem",
      },

      borderRadius: {
        sm: token("radius-sm"),
        DEFAULT: token("radius"),
        lg: token("radius-lg"),
        xl: token("radius-xl"),
        full: "9999px",
      },

      boxShadow: {
        sm: token("shadow-sm"),
        DEFAULT: token("shadow"),
        lg: token("shadow-lg"),
      },

      transitionTimingFunction: {
        DEFAULT: token("ease"),
      },

      transitionDuration: {
        fast: token("duration-fast"),
        DEFAULT: token("duration"),
        slow: token("duration-slow"),
      },

      // Grid used by the responsive workspace layouts.
      gridTemplateColumns: {
        studio: "minmax(280px, 340px) minmax(0, 1fr)",
        studioWide: "minmax(280px, 340px) minmax(0, 1fr) minmax(260px, 320px)",
      },

      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up var(--fs-duration) var(--fs-ease) both",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

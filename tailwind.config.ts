import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b3ccff",
          300: "#80a9ff",
          400: "#4d7fff",
          500: "#2f5bf6",
          600: "#2144d1",
          700: "#1a35a3",
          800: "#182c80",
          900: "#172763",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f6f7fb",
        },
        success: "#12b76a",
        warning: "#f79009",
        danger: "#f04438",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        floating: "0 8px 24px rgba(16, 24, 40, 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

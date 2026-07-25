/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./providers/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#fbfcfe",
          dark: "#0b1220",
        },
        foreground: {
          DEFAULT: "#0f172a",
          dark: "#e2e8f0",
        },
        card: {
          DEFAULT: "#ffffff",
          dark: "#111827",
        },
        primary: {
          DEFAULT: "#1d4ed8",
          foreground: "#f8fafc",
          dark: "#60a5fa",
        },
        muted: {
          DEFAULT: "#f1f5f9",
          foreground: "#64748b",
          dark: "#1e293b",
        },
        border: {
          DEFAULT: "#e2e8f0",
          dark: "#1f2937",
        },
        destructive: {
          DEFAULT: "#e11d48",
        },
        brand: {
          cyan: "#0891b2",
          coral: "#e11d48",
          amber: "#d97706",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};

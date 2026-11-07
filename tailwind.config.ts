import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cafe: {
          50: "#FAF7F2",
          100: "#F3EDE2",
          200: "#E6D8C4",
          300: "#D4BEA0",
          400: "#BC9E77",
          500: "#A37F53",
          600: "#86643C",
          700: "#6B4D2C",
          800: "#4D351D",
          900: "#2F2011",
          950: "#1A1108",
        },
        gold: {
          400: "#E5B94E",
          500: "#D4A32D",
          600: "#B8861B",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

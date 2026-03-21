import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4F46E5",
          50: "#EEEEFF",
          100: "#E0E0FF",
          200: "#C7C4FF",
          300: "#A89FFF",
          400: "#8577FF",
          500: "#4F46E5",
          600: "#4038D0",
          700: "#332DB8",
          800: "#26229A",
          900: "#1A1875",
        },
      },
    },
  },
  plugins: [],
};

export default config;

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
        dusk: {
          bg: "#07101b",
          panel: "#101a2b",
          line: "#263754",
          aqua: "#61e8ff",
          pink: "#ff4f9b",
          purple: "#a88dff",
          gold: "#ffd46f",
        },
      },
      boxShadow: {
        dusk: "0 28px 70px rgba(0,0,0,.35)",
      },
    },
  },
  plugins: [],
};

export default config;

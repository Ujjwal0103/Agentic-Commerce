import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stacks: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          500: "#5546ff",
          600: "#4435ee",
          700: "#3325cc",
          900: "#1a0f66",
        },
      },
    },
  },
  plugins: [],
};

export default config;

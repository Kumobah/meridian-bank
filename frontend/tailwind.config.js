/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10151F",
        "ink-soft": "#1B2230",
        paper: "#F2F4F2",
        line: "#DCE0DA",
        muted: "#5B665F",
        emerald: {
          DEFAULT: "#1F7A5C",
          soft: "#E6F1EB",
          deep: "#10473A",
        },
        rust: {
          DEFAULT: "#A6512B",
          soft: "#F5E9E1",
        },
        alert: "#B23A3A",
        amber: {
          100: "#F7E9C9",
          400: "#D9A441",
          600: "#A9782C",
          700: "#8A6222",
        },
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

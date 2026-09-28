/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vault: {
          950: "#0B0E14",
          900: "#12161F",
          850: "#171C27",
          800: "#1E2430",
          700: "#2A3140",
          600: "#3B4356",
        },
        brass: {
          200: "#F0DFA9",
          300: "#E0C275",
          400: "#C9A24B",
          500: "#AD8636",
          600: "#8B6A2A",
        },
        verdigris: {
          400: "#5DB39A",
          500: "#4FA187",
          600: "#3B7E69",
        },
        clay: {
          400: "#D46A44",
          500: "#C1552F",
          600: "#9C4324",
        },
        bone: {
          100: "#EFEAE0",
          200: "#E2DBCC",
          400: "#A6A091",
          500: "#807A6C",
          600: "#5C574C",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        vault: "0 1px 0 0 rgba(240,223,169,0.06) inset, 0 20px 40px -20px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 1px 1px, rgba(240,223,169,0.05) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};

import type { Config } from 'tailwindcss';

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        zen: {
          bg: "#0b1220",
          panel: "#0f172a",
          accent: "#21e1a8",
          text: "#dbe7ff",
          sub: "#9fb4d8",
          badge: {
            stake: "#ffb200",
            gm: "#f59e0b",
            nft: "#38bdf8",
            domain: "#60a5fa",
            swap: "#34d399",
            add: "#22d3ee",
            remove: "#06b6d4",
            approve: "#a78bfa",
            native: "#f87171",
            cc: "#f472b6",
            cco: "#fb7185",
            fail: "#ef4444",
            other: "#94a3b8"
          }
        }
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.25)"
      }
    }
  },
  plugins: []
} satisfies Config;
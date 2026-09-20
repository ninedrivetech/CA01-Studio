import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // Worker-only imports are otherwise discovered after the page connects,
  // triggering a cold-start dependency reload that loses the device session.
  optimizeDeps: {
    include: [
      "@kayahr/text-encoding/no-encodings",
      "@kayahr/text-encoding/encodings/gbk",
    ],
  },
});

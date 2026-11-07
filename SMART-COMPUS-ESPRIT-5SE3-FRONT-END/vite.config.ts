import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: {
      // ── Module 3 : Gestion des Ressources (Spring Boot sur 8080) ────
      "/api/rooms": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/api/reservations": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/api/equipements": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/api/interventions": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },

      // ── Module 2 : Académique / Étudiant (Spring Boot sur 8081) ──────
      "/api/academic": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/api/courses": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/api/enrollments": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/api/timetable": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/api/grades": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },

      // ── Module 1 : Utilisateurs & Auth (Node.js Express sur 4001) ───
      "/api/auth": {
        target: "http://localhost:4001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      "/api/users": {
        target: "http://localhost:4001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      "/api/roles": {
        target: "http://localhost:4001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      "/api/login-history": {
        target: "http://localhost:4001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      "/auth": {
        target: "http://localhost:4001",
        changeOrigin: true,
      },
      "/users": {
        target: "http://localhost:4001",
        changeOrigin: true,
      },
    },
  },
});

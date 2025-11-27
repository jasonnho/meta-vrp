// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        proxy: {
            "/api": {
                target: "http://127.0.0.1:8000", // Alamat backend Anda
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ""), // Hapus prefix '/api' sebelum kirim ke backend
            },
        },
    },
});

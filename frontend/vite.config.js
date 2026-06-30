import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // escucha en 0.0.0.0 -> accesible desde fuera del contenedor
    port: 3000,
    // PROXY: cualquier petición a /api se reenvía al backend por la red interna
    // de Docker (host "backend"). Así el navegador solo habla con el puerto 3000
    // y nos olvidamos de CORS y de poner la IP de la VM en el código.
    proxy: {
      '/api': 'http://backend:3001',
    },
  },
});

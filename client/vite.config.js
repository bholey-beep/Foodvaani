import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = 'http://localhost:5000';

// When the backend is down, the raw proxy would answer with a bare 500.
// Return a JSON 503 instead so the UI can explain what is wrong.
function apiProxy() {
  return {
    target: API_TARGET,
    configure(proxy) {
      proxy.on('error', (err, req, res) => {
        console.error(`[vite] proxy error for ${req.url}: ${err.message}`);
        if (res && !res.headersSent && typeof res.writeHead === 'function') {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'The API server is not reachable. Start the backend with "npm run dev" in the server folder, then try again.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiProxy(),
      '/media': apiProxy(),
    },
  },
});

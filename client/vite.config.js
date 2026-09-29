import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        /**
         * Split the bundle by concern. MUI and the editor/date libraries are
         * large and change far less often than application code, so caching
         * them separately keeps rebuild churn out of the vendor chunk.
         */
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          forms: ['formik', 'yup'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});

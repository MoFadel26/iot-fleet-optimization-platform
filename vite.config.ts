import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const iotDeviceUrl = env.VITE_IOT_DEVICE_URL || 'http://172.20.10.6'

  return {
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        // The ESP32 lives on the local network, so the real-device mode of the
        // IoT feed only works under `npm run dev`.
        '/iot-device': {
          target: iotDeviceUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/iot-device/, ''),
        },
      },
    },
    preview: {
      // preview.proxy defaults to server.proxy; keep the LAN device proxy out
      // of `vite preview` (used on Railway), where it can only time out.
      proxy: {},
      allowedHosts: ['iotfleetoptimizationplatform-production.up.railway.app', 'all'],
    },
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})

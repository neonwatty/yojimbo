import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { parse as parseYaml } from 'yaml';

// Load YAML config for dev server proxy
interface AppConfig {
  host?: string;
  serverPort?: number;
  clientPort?: number;
}

function loadConfig(): AppConfig {
  const configPaths = [
    path.resolve(__dirname, '../config.yaml'),
    path.resolve(__dirname, '../.config.yaml'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return parseYaml(content) || {};
      } catch {
        // Ignore parse errors, use defaults
      }
    }
  }
  return {};
}

const config = loadConfig();
const serverHost = config.host || '127.0.0.1';
const serverPort = config.serverPort || 3456;
const clientPort = config.clientPort || 5173;

// Load version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: clientPort,
    proxy: {
      '/api': {
        target: `http://${serverHost}:${serverPort}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://${serverHost}:${serverPort}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

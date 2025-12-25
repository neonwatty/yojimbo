import { config } from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'url';

// Load environment variables
config();

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load YAML config if it exists
interface YamlConfig {
  host?: string;
  serverPort?: number;
  clientPort?: number;
}

function loadYamlConfig(): YamlConfig {
  const projectRoot = path.resolve(__dirname, '../../..');
  const configPaths = [
    path.join(projectRoot, 'config.yaml'),
    path.join(projectRoot, '.config.yaml'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return parseYaml(content) || {};
      } catch (err) {
        console.warn(`Failed to parse config at ${configPath}:`, err);
      }
    }
  }
  return {};
}

const yamlConfig = loadYamlConfig();

export const CONFIG = {
  // Server (env vars override YAML, YAML overrides defaults)
  port: parseInt(process.env.PORT || String(yamlConfig.serverPort || 3456), 10),
  host: process.env.HOST || yamlConfig.host || '127.0.0.1',
  clientPort: parseInt(process.env.CLIENT_PORT || String(yamlConfig.clientPort || 5173), 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databasePath: process.env.DATABASE_PATH || './data/orchestrator.db',

  // Claude Code
  claudeConfigDir: process.env.CLAUDE_CONFIG_DIR?.replace('~', os.homedir()) ||
    path.join(os.homedir(), '.claude'),

  // Paths
  get claudeProjectsDir() {
    return path.join(this.claudeConfigDir, 'projects');
  },
  get claudeHistoryPath() {
    return path.join(this.claudeConfigDir, 'history.jsonl');
  },
  get claudeSettingsPath() {
    return path.join(this.claudeConfigDir, 'settings.json');
  },

  // Development
  isDev: process.env.NODE_ENV !== 'production',
};

export default CONFIG;

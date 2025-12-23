import { config } from 'dotenv';
import path from 'path';
import os from 'os';

// Load environment variables
config();

export const CONFIG = {
  // Server
  port: parseInt(process.env.PORT || '3456', 10),
  host: process.env.HOST || '127.0.0.1',
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

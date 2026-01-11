/**
 * PM2 Ecosystem Configuration
 *
 * This file configures PM2 process management for production deployments.
 *
 * Usage:
 *   pm2 start ecosystem.config.js      # Start the application
 *   pm2 reload ecosystem.config.js     # Zero-downtime reload
 *   pm2 stop ecosystem.config.js       # Stop the application
 *   pm2 delete ecosystem.config.js     # Remove from PM2
 *
 * Or use Makefile commands:
 *   make pm2-start
 *   make pm2-reload
 *   make pm2-stop
 *   make pm2-logs
 */

module.exports = {
  apps: [
    {
      name: 'yojimbo',
      script: 'npm',
      args: 'start',
      cwd: __dirname,

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3456,
      },

      // Restart behavior
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 1000,
      autorestart: true,

      // Watch (disabled in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git', '*.log'],

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,

      // Performance
      instances: 1, // Single instance for this app
      exec_mode: 'fork',

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};

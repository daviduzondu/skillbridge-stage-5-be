module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'skillbridge-api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 5000,

      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      env_dev: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 3001,
      },
      env_staging: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 4001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5001,
      },
    },
  ],
};

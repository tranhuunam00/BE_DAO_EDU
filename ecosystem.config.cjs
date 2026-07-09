module.exports = {
  apps: [
    {
      name: 'dao-edu-production-api',
      cwd: __dirname,
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '768M',
      min_uptime: '10s',
      restart_delay: 3000,
      listen_timeout: 15000,
      kill_timeout: 5000,
      time: true,
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5005,
      },
    },
  ],
};

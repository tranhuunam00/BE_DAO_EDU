const { execSync } = require('child_process');

let appName = 'dao-edu-api';
let defaultPort = 5000;

try {
  const branch = execSync('git branch --show-current').toString().trim();
  if (branch === 'master') {
    appName = 'dao-edu-production-api';
    defaultPort = 5005;
  }
} catch (e) {
  // fallback
}

module.exports = {
  apps: [
    {
      name: appName,
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
        PORT: process.env.PORT || defaultPort,
      },
    },
  ],
};

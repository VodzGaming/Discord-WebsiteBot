module.exports = {
  apps: [
    {
      name: 'vtuber-bot',
      script: 'src/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production'
      },
      time: true,
      max_restarts: 10,
      watch: false,
      autorestart: true,
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};

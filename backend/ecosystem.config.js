module.exports = {
  apps: [
    {
      name: 'whiteboard-api',
      script: './dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};

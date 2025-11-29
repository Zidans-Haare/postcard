module.exports = {
  apps: [
    {
      name: 'postkarte-backend',
      cwd: './backend',
      script: 'dist/server.js',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        PORT: '4000'
      }
    },
    {
      name: 'postkarte-frontend',
      cwd: './frontend/.next/standalone',
      script: 'frontend/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3100',
        HOSTNAME: '0.0.0.0'
      }
    },
    {
      name: 'postkarte-admin',
      cwd: './admin/.next/standalone',
      script: 'admin/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3200',
        HOSTNAME: '0.0.0.0'
      }
    }
  ]
};

module.exports = {
  apps: [
    {
      name: 'cs-automation',
      script: 'npx',
      args: 'n8n',
      interpreter: 'none',
      // Keep a small restart window to avoid rapid restarts if config is broken
      max_restarts: 10,
      watch: false,
      env: {
        // Core settings
        N8N_PORT: 5678,
        WEBHOOK_URL: process.env.WEBHOOK_URL || 'http://localhost:5678/',
        GENERIC_TIMEZONE: process.env.GENERIC_TIMEZONE || 'UTC',

        // Auth (enable basic auth for local)
        N8N_BASIC_AUTH_ACTIVE: process.env.N8N_BASIC_AUTH_ACTIVE || 'true',
        N8N_BASIC_AUTH_USER: process.env.N8N_BASIC_AUTH_USER || 'admin',
        N8N_BASIC_AUTH_PASSWORD: process.env.N8N_BASIC_AUTH_PASSWORD || 'changeme',

        // Database (PostgreSQL) — align with Step 1 connection string
        DB_TYPE: process.env.DB_TYPE || 'postgresdb',
        DB_POSTGRESDB_HOST: process.env.DB_POSTGRESDB_HOST || 'localhost',
        DB_POSTGRESDB_PORT: process.env.DB_POSTGRESDB_PORT || 5432,
        DB_POSTGRESDB_DATABASE: process.env.DB_POSTGRESDB_DATABASE || 'customer_success',
        DB_POSTGRESDB_USER: process.env.DB_POSTGRESDB_USER || 'postgres',
        DB_POSTGRESDB_PASSWORD: process.env.DB_POSTGRESDB_PASSWORD || 'password',

        // Optional: encryption key for credentials storage
        N8N_ENCRYPTION_KEY: process.env.N8N_ENCRYPTION_KEY,

        // Optional: webhook URLs if behind tunnel/proxy
        N8N_TUNNEL_SUBDOMAIN: process.env.N8N_TUNNEL_SUBDOMAIN,
      },
    },
  ],
}

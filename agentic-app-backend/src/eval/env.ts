// Loads .env before any other module reads process.env. In CI there is no .env file, which is fine.
try {
  (process as any).loadEnvFile?.(".env");
} catch {
  /* no .env file */
}
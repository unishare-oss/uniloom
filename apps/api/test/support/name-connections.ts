import 'dotenv/config';

// e2e files run in parallel worker processes against one database. Each worker names its
// connections, so a test can count only its own in pg_stat_activity (application_name).
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  url.searchParams.set('application_name', `uniloom-e2e-${process.pid}`);
  process.env.DATABASE_URL = url.toString();
}

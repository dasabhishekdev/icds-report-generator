import { buildApp } from './app';
import { loadConfig } from './config';
import { connect } from './db';

async function main() {
  const config = loadConfig();
  const { client, db } = await connect(config.mongoUrl);
  const app = await buildApp(db, config, { logger: true });

  const shutdown = async () => {
    await app.close();
    await client.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ host: '0.0.0.0', port: config.port });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

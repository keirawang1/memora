import { embedPendingCatalog } from './embedCatalog.js';

async function main(): Promise<void> {
  const limit = Number(process.env.EMBED_LIMIT || 5000);
  const result = await embedPendingCatalog(limit);
  console.log(result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

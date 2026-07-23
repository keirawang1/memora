import { generateForUser } from '../generate/generateForUser.js';

async function main(): Promise<void> {
  const userId = process.argv[2] || process.env.USER_ID;
  if (!userId) {
    console.error('Usage: npm run generate-user -- <userId>');
    process.exit(1);
  }
  const force = process.argv.includes('--force');
  const result = await generateForUser(userId, { force });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

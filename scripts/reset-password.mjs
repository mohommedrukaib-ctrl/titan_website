/**
 * Reset the admin password (or username) from the command line.
 *
 *   node scripts/reset-password.mjs                    # prompts for a new password
 *   node scripts/reset-password.mjs NewPassw0rd!       # sets it directly
 *   node scripts/reset-password.mjs NewPassw0rd! editor  # also changes the username
 */
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { CONFIG } from '../server/config.js';
import { initStore, readDb, updateAdmin } from '../server/lib/store.js';

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

initStore();

const argPassword = process.argv[2];
const argUsername = process.argv[3];

const password = argPassword || (await ask('New admin password (min 8 characters): '));
if (!password || password.length < 8) {
  console.error('\n  ✖ Password must be at least 8 characters. Nothing was changed.\n');
  process.exit(1);
}

const current = readDb().admin?.username || CONFIG.admin.username;
const username = argUsername || current;

updateAdmin({ username, password });
console.log(`\n  ✔ Admin credentials updated.`);
console.log(`     username: ${username}`);
console.log(`     password: ${'•'.repeat(password.length)}`);
console.log(`     (stored as a bcrypt hash in data/titan.json)\n`);

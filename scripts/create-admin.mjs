// Create an admin user, or reset an admin's password.
//   npm run admin:create            -> local D1 (wrangler pages dev)
//   npm run admin:create -- --remote -> production D1
// The password is typed at the prompt (never put on the command line or in files).

import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const remote = process.argv.includes('--remote');
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else if (s === '\r\n' || s === '\n') rl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function sql(command) {
  const args = [wrangler, 'd1', 'execute', 'DB', remote ? '--remote' : '--local', '--command', command];
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) process.exit(r.status || 1);
}

// Non-interactive use (CI / tests): ADMIN_EMAIL and ADMIN_PASSWORD environment variables.
const envEmail = process.env.ADMIN_EMAIL;
const envPassword = process.env.ADMIN_PASSWORD;
const email = String(envEmail || (await ask('Admin email: ', false))).trim().toLowerCase();
if (!EMAIL_RE.test(email) || email.length > 254) {
  console.error('Invalid email address.');
  process.exit(1);
}
const password = envPassword || (await ask('Password (min 12 characters): ', true));
const again = envPassword || (await ask('Repeat password: ', true));
if (password !== again) {
  console.error('Passwords do not match.');
  process.exit(1);
}
if (password.length < 12 || password.length > 256) {
  console.error('Password must be 12-256 characters.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
const stored = 'pbkdf2$100000$' + salt.toString('base64') + '$' + hash.toString('base64');

sql(
  "INSERT INTO admins (email, password_hash) VALUES ('" + email + "', '" + stored + "') " +
    'ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash'
);
sql("DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = '" + email + "')");
console.log('\nAdmin ready: ' + email + (remote ? ' (remote)' : ' (local)'));

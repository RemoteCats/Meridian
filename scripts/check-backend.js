'use strict';

/**
 * What is still needed before the backend is live.
 *
 * `GET /api/health?probe=1` answers the same question from inside a running
 * server, which is the right tool once there is one to ask. This is the tool
 * for the half hour before that: it runs from a terminal, reads .env the way
 * the server will, and reports every step of the setup in order — the keys,
 * the two migrations, the admin row, anonymous sign-ins, the sending domain —
 * with the exact thing to do about each one.
 *
 *   npm run check:backend          report, exit 0
 *   npm run check:backend -- --strict   exit 1 if anything required is missing
 *
 * Reads only. It never writes to the database, never sends mail, and never
 * prints a key.
 */

const { loadEnv } = require('../src/utils/env');

loadEnv();

const config = require('../src/utils/config');

const STRICT = process.argv.includes('--strict');

/* Output -------------------------------------------------------------------
   Colour only when the output is a terminal, so piping this into a file or a
   CI log leaves plain text. */
const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\u001b[${code}m${s}\u001b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);

const PASS = c('32', '  ok  ');
const FAIL = c('31', ' need ');
const WARN = c('33', ' warn ');
const SKIP = dim(' skip ');

const todo = [];
let required = 0;

function ok(label, detail) {
  console.log(`${PASS} ${label}${detail ? dim(`  ${detail}`) : ''}`);
}
function need(label, action) {
  required += 1;
  console.log(`${FAIL} ${label}`);
  if (action) {
    console.log(`       ${c('31', '->')} ${action}`);
    todo.push(action);
  }
}
function warn(label, action) {
  console.log(`${WARN} ${label}`);
  if (action) console.log(`       ${c('33', '->')} ${action}`);
}
function skip(label, why) {
  console.log(`${SKIP} ${label}${why ? dim(`  ${why}`) : ''}`);
}
function heading(n, title) {
  console.log(`\n${bold(`${n}. ${title}`)}`);
}

/* A fetch that never throws, so one unreachable host does not end the run. */
async function get(url, options = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), options.timeout || 12000);
  try {
    const res = await fetch(url, { ...options, signal: ctl.signal });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (err) { body = text; }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, error: err.name === 'AbortError' ? 'timed out' : err.message };
  }
}

/* The tables the code reads and writes, and the columns it needs on each.
   Asking for the columns by name is what catches a table created from an
   older copy of the migration: the table exists, the insert fails. */
const TABLES = [
  { table: 'enquiries', columns: 'id,created_at,name,email,company,service,message,ip,status', migration: '0001_init.sql' },
  { table: 'applications', columns: 'id,created_at,name,email,phone,role_id,role_title,portfolio,experience,message,ip,status', migration: '0001_init.sql' },
  { table: 'chat_sessions', columns: 'id,created_at,visitor_id,last_message_at,status,handled_by_agent', migration: '0001_init.sql' },
  { table: 'chat_messages', columns: 'id,created_at,session_id,sender,body', migration: '0001_init.sql' },
  { table: 'admins', columns: 'user_id,email', migration: '0001_init.sql' },
  { table: 'site_settings', columns: 'id,updated_at,address,email,phone,hours', migration: '0001_init.sql', optional: true },
  { table: 'email_threads', columns: 'id,participant_email,subject,last_message_at,status', migration: '0002_email.sql', mailOnly: true },
  { table: 'email_messages', columns: 'id,thread_id,direction,from_email,to_email,message_id', migration: '0002_email.sql', mailOnly: true },
];

const domainOf = (address) => (config.parseAddress(address).email.split('@')[1] || '').toLowerCase();

async function main() {
  console.log(bold('\nMeridian Constructions — backend setup\n'));
  console.log(dim('Reads .env the way the server does. Nothing is written and no key is printed.'));

  const url = config.supabaseUrl();
  const anon = config.supabaseAnonKey();
  const service = config.supabaseServiceKey();

  /* 1 ------------------------------------------------------------------- */
  heading(1, 'Supabase keys');
  if (url) ok('project URL', url.replace(/^https?:\/\//, ''));
  else need('project URL is not set',
    `Add SUPABASE_URL to .env (Supabase, Project Settings, Data API). Accepted names: ${config.ACCEPTED_NAMES.supabaseUrl.join(', ')}.`);

  if (anon) ok('browser key', `${anon.slice(0, 7)}… (public by design)`);
  else need('browser key is not set',
    `Add SUPABASE_ANON_KEY to .env — the anon or publishable key from the same page. Accepted names: ${config.ACCEPTED_NAMES.supabaseAnonKey.join(', ')}.`);

  if (service) ok('service role key', 'set, server only');
  else need('service role key is not set',
    'Add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase, Project Settings, API keys, service_role). It bypasses row level security, so it never goes in the browser or in git.');

  if (!url || !service) {
    skip('everything below that needs the database', 'no project URL or service key yet');
    return report();
  }

  /* 2 ------------------------------------------------------------------- */
  heading(2, 'Reaching the project');
  const rest = `${url.replace(/\/+$/, '')}/rest/v1`;
  const headers = { apikey: service, Authorization: `Bearer ${service}` };
  // Asking for a known table rather than the API root: a 404 from PostgREST
  // still proves the project answered, and some stand-ins for it (the test
  // double included) do not serve a root route at all.
  const ping = await get(`${rest}/admins?select=user_id&limit=1`, { headers });
  if (ping.status === 0) {
    need(`cannot reach ${url} (${ping.error})`,
      'Check the project URL, and that the project is not paused in the Supabase dashboard.');
    return report();
  }
  if (ping.status === 401 || ping.status === 403) {
    need(`the project answered ${ping.status} — the service role key is not valid for it`,
      'Copy the service_role key from this same project, Project Settings, API keys.');
    return report();
  }
  ok('the project answers', `HTTP ${ping.status}`);
  if (ping.status === 404) {
    warn('the tables are not there yet', 'Run supabase/migrations/0001_init.sql, then 0002_email.sql, in the Supabase SQL Editor.');
  }

  /* 3 ------------------------------------------------------------------- */
  heading(3, 'Tables and columns');
  const mail = Boolean(config.mailboxAddress());
  const failed = new Set();
  for (const spec of TABLES) {
    const res = await get(`${rest}/${spec.table}?select=${spec.columns}&limit=1`, { headers });
    const needed = !spec.mailOnly || mail;
    if (res.ok) {
      ok(spec.table);
    } else if (!needed) {
      skip(spec.table, 'only needed once MAILBOX_ADDRESS is set');
    } else {
      const message = (res.body && res.body.message) || res.error || `HTTP ${res.status}`;
      need(`${spec.table}: ${message}`, `Run supabase/migrations/${spec.migration} in the Supabase SQL Editor.`);
      failed.add(spec.table);
    }
  }

  /* 4 ------------------------------------------------------------------- */
  heading(4, 'An admin who can open /admin');
  if (failed.has('admins')) {
    skip('admin check', 'the admins table did not answer');
  } else {
    const admins = await get(`${rest}/admins?select=email`, { headers });
    const rows = Array.isArray(admins.body) ? admins.body : [];
    if (rows.length) ok(`${rows.length} admin${rows.length === 1 ? '' : 's'}`, rows.map((r) => r.email).join(', '));
    else need('no admin rows, so /admin will refuse every sign-in',
      'Create the user under Supabase, Authentication, Users, then run supabase/grant-admin.sql with that address.');
  }

  /* 5 ------------------------------------------------------------------- */
  heading(5, 'Anonymous sign-ins (the live chat)');
  if (!anon) {
    skip('anonymous sign-in', 'no browser key to test with');
  } else {
    const signup = await get(`${url.replace(/\/+$/, '')}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    });
    const body = signup.body || {};
    const code = body.error_code || body.code || '';
    if (signup.ok) {
      ok('enabled', 'the widget talks to Supabase directly');
    } else if (/anonymous/i.test(code) || /anonymous/i.test(body.msg || body.message || '')) {
      warn('disabled, so chat falls back to the server',
        'Optional. Supabase, Authentication, Sign In / Providers, Anonymous sign-ins. Without it the chat still works and still persists, one HTTP call further away.');
    } else {
      warn(`could not tell: HTTP ${signup.status} ${body.msg || body.message || signup.error || ''}`.trim(),
        'Not fatal — the chat falls back to the server either way.');
    }
  }

  /* 6 ------------------------------------------------------------------- */
  heading(6, 'Email');
  const resendKey = config.resendApiKey();
  const to = config.formTo();
  const from = config.formFrom();
  const mailbox = config.mailboxAddress();

  if (!resendKey) {
    warn('RESEND_API_KEY is not set, so no mail is sent',
      'Optional. Every enquiry is still stored and still shows on /admin. To send: resend.com, API Keys.');
  } else {
    const domains = await get('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${resendKey}` } });
    if (domains.status === 401) {
      need('Resend rejected the API key', 'Create a new key at resend.com, API Keys, and update RESEND_API_KEY.');
    } else if (!domains.ok) {
      warn(`could not check the sending domain (HTTP ${domains.status || domains.error})`, 'Check again once the network allows it.');
    } else {
      const list = (domains.body && domains.body.data) || [];
      const verified = list.filter((d) => d.status === 'verified').map((d) => d.name.toLowerCase());
      ok('API key accepted', verified.length ? `verified: ${verified.join(', ')}` : 'no verified domain yet');
      const fromDomain = domainOf(from);
      if (!verified.length) {
        need('no verified sending domain, so every send returns 403',
          'Add and verify your domain at resend.com, Domains, then set FORM_FROM to an address on it.');
      } else if (fromDomain && !verified.includes(fromDomain)) {
        need(`FORM_FROM is on ${fromDomain}, which is not verified`,
          `Set FORM_FROM to an address on one of: ${verified.join(', ')}.`);
      } else {
        ok('FORM_FROM', from);
      }
    }
    if (to) ok('FORM_TO', to);
    else need('FORM_TO is not set, so notifications have nowhere to go', 'Set FORM_TO to the address that should receive enquiries.');
  }

  if (mailbox) {
    ok('MAILBOX_ADDRESS', mailbox);
    if (config.resendWebhookSecret()) ok('RESEND_WEBHOOK_SECRET', 'inbound mail is signature-checked');
    else need('MAILBOX_ADDRESS is set but RESEND_WEBHOOK_SECRET is not, so /api/inbound/resend refuses every post',
      'Resend, Webhooks, add https://YOUR-DOMAIN/api/inbound/resend, then copy its whsec_ signing secret into RESEND_WEBHOOK_SECRET.');
  } else {
    skip('inbound mail', 'MAILBOX_ADDRESS not set — the studio inbox on /admin stays empty');
  }

  if (config.forwardWouldLoop()) {
    need("FORWARD_TO is one of this site's own addresses",
      'Point FORWARD_TO at a mailbox on another domain, or leave it empty. As it stands, forwarding would loop mail back into the webhook.');
  }

  report();
}

function report() {
  console.log();
  if (!required) {
    console.log(c('32', bold('Backend is ready.')), dim('Start the site with npm start, then open /admin.'));
  } else {
    console.log(bold(`${required} thing${required === 1 ? '' : 's'} left:`));
    todo.forEach((line, i) => console.log(`  ${i + 1}. ${line}`));
    console.log(dim('\nFull walkthrough: docs/BACKEND-SETUP.md'));
  }
  console.log();
  if (STRICT && required) process.exit(1);
}

main().catch((err) => {
  console.error('[backend] check failed to run:', err.message);
  process.exit(STRICT ? 1 : 0);
});

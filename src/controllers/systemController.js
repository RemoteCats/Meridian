'use strict';

/**
 * Runtime configuration and diagnostics.
 *
 * The browser is handed its Supabase URL and anon key per request rather than
 * having them baked in at build time. Nothing needs rebuilding when they
 * change, and no secret needs a public prefix to reach the client.
 */

const config = require('../utils/config');
const { getSupabase } = require('../utils/supabase');

/**
 * `GET /api/health?probe=1` asks Postgres for one row of every column the
 * server actually reads or writes. It costs one cheap query per table and
 * catches the failure that is otherwise invisible until a visitor tries to use
 * the site: tables created from an older copy of the migration, so a column the
 * code needs is missing and every insert is rejected.
 */
const PROBES = [
  { table: 'enquiries', columns: 'id,created_at,name,email,company,service,message,ip,status' },
  { table: 'site_settings', columns: 'id,updated_at,address,email,phone,hours', optional: true },
  { table: 'applications', columns: 'id,created_at,name,email,phone,role_id,role_title,portfolio,experience,message,ip,status' },
  { table: 'chat_sessions', columns: 'id,created_at,visitor_id,last_message_at,status,handled_by_agent' },
  { table: 'chat_messages', columns: 'id,created_at,session_id,sender,body' },
  { table: 'admins', columns: 'user_id,email' },
  // From 0002_email.sql. A site not receiving mail never needs these, but once
  // MAILBOX_ADDRESS is set they carry the admin inbox, so their absence is a
  // fault rather than a choice: filing is best effort, so the webhook still
  // answers 200 and Resend still reports success while nothing reaches /admin.
  {
    table: 'email_threads',
    columns: 'id,participant_email,subject,last_message_at,status',
    migration: '0002_email.sql',
    neededWhen: () => Boolean(config.mailboxAddress()),
  },
  {
    table: 'email_messages',
    columns: 'id,thread_id,direction,from_email,to_email,message_id',
    migration: '0002_email.sql',
    neededWhen: () => Boolean(config.mailboxAddress()),
  },
];

async function probeSchema() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const results = {};
  const problems = [];
  for (const { table, columns, migration, neededWhen } of PROBES) {
    const needed = neededWhen ? neededWhen() : true;
    try {
      await supabase.select(table, `select=${columns}&limit=1`);
      results[table] = 'ok';
    } catch (err) {
      results[table] = needed ? err.message : `optional: ${err.message}`;
      if (needed) problems.push({ table, message: err.message, migration: migration || '0001_init.sql' });
    }
  }
  return { results, problems };
}

/**
 * Ask Resend whether this deployment can actually send.
 *
 * A send is refused for reasons the server cannot see from its own
 * environment: a key that was revoked or belongs to another account, or a
 * FROM address on a domain that was never verified, which answers 403 on
 * every attempt. Both look identical from here — mail simply does not
 * arrive — so the question is put to Resend rather than guessed at.
 *
 * Reads only: it lists domains, it does not send anything.
 */
async function probeMail() {
  const apiKey = config.resendApiKey();
  if (!apiKey) return { configured: false, note: 'RESEND_API_KEY is not set, so no mail is sent.' };

  const from = config.parseAddress(config.formFrom()).email;
  const fromDomain = (from.split('@')[1] || '').toLowerCase();
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401) return { configured: true, keyValid: false, note: 'Resend rejected the API key.' };
    if (!res.ok) return { configured: true, note: `Resend answered ${res.status} to a domain list.` };

    const body = await res.json().catch(() => ({}));
    const verified = (body.data || []).filter((d) => d.status === 'verified').map((d) => String(d.name).toLowerCase());
    return {
      configured: true,
      keyValid: true,
      verifiedDomains: verified,
      from,
      canSendAsFrom: verified.includes(fromDomain),
    };
  } catch (err) {
    return { configured: true, note: `Could not reach Resend: ${err.message}` };
  }
}

/** GET /api/public-config: what the browser needs to talk to Supabase. */
exports.publicConfig = (req, res) => {
  const url = config.supabaseUrl();
  const anonKey = config.supabaseAnonKey();

  // Short cache: this changes rarely, but a stale key should not outlive a
  // rotation for long.
  // Which of the two is absent, and the names this server would have accepted
  // for it. Names only, never values, so the page can say what is wrong
  // instead of a bare "not connected" that leaves you guessing.
  const missing = [];
  if (!url) missing.push({ value: 'supabaseUrl', accepts: config.ACCEPTED_NAMES.supabaseUrl });
  if (!anonKey) missing.push({ value: 'supabaseAnonKey', accepts: config.ACCEPTED_NAMES.supabaseAnonKey });

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    // The widget degrades to the server-side chat when this is false.
    chatEnabled: Boolean(url && anonKey),
    missing,
  });
};

/**
 * GET /api/health: which variables the running server can actually see.
 * Values are never returned, only whether they are set, plus warnings for
 * combinations that are configured but wrong.
 */
exports.health = async (req, res) => {
  const url = config.supabaseUrl();
  const anon = config.supabaseAnonKey();
  const service = config.supabaseServiceKey();
  const resend = config.resendApiKey();
  const webhook = config.resendWebhookSecret();
  const to = config.formTo();
  const mailbox = config.mailboxAddress();
  const forward = config.forwardTo();

  const warnings = [];

  if (url && !service) {
    warnings.push(
      'SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is not. Enquiries cannot be written; the server falls back to local files, which do not persist on Vercel.'
    );
  }
  if (url && service && !anon) {
    warnings.push(
      `No browser key is set, so /admin reports the backend as not connected and the chat widget falls back to the server-side responder. Set one of: ${config.ACCEPTED_NAMES.supabaseAnonKey.join(', ')}.`
    );
  }
  if (!url && (anon || service)) {
    warnings.push(
      `A Supabase key is set but no project URL. Set one of: ${config.ACCEPTED_NAMES.supabaseUrl.join(', ')}.`
    );
  }
  if (resend && !to) {
    warnings.push('RESEND_API_KEY is set but FORM_TO is not, so notifications have nowhere to go.');
  }
  if (to && !resend) {
    warnings.push('FORM_TO is set but RESEND_API_KEY is not, so no email is sent.');
  }
  if (mailbox && !webhook) {
    warnings.push(
      'MAILBOX_ADDRESS is set but RESEND_WEBHOOK_SECRET is not. The inbound endpoint refuses every request rather than trusting unsigned posts.'
    );
  }
  if (config.forwardWouldLoop()) {
    warnings.push(
      "FORWARD_TO is one of this site's own addresses. Forwarding would loop mail back into the inbound webhook until the sending quota is gone. Set it to a mailbox on another domain, or leave it unset."
    );
  }

  // Opt-in: the plain health check stays a pure environment read.
  let schema;
  let mailProbe;
  if (req.query.probe) {
    const probed = await probeSchema();
    schema = probed ? probed.results : null;
    (probed ? probed.problems : []).forEach(({ table, message, migration }) => {
      warnings.push(
        `Table ${table} did not answer as expected: ${message}. Run supabase/migrations/${migration} in the Supabase SQL Editor.`
      );
    });

    mailProbe = await probeMail();
    if (mailProbe.keyValid === false) {
      warnings.push('Resend rejected RESEND_API_KEY. Create a new key and set it again, here and in the hosting environment.');
    }
    if (mailProbe.verifiedDomains && !mailProbe.verifiedDomains.length) {
      warnings.push('Resend has no verified sending domain, so every send is refused with 403. Verify a domain under Resend, Domains.');
    }
    if (mailProbe.canSendAsFrom === false && mailProbe.verifiedDomains && mailProbe.verifiedDomains.length) {
      warnings.push(
        `FORM_FROM sends as ${mailProbe.from}, which is not on a verified domain (${mailProbe.verifiedDomains.join(', ')}), so every send is refused with 403.`
      );
    }
    // Mail arriving at the mailbox is filed onto these two tables. Without
    // them a message is accepted, acknowledged to the provider, and then
    // dropped — the provider's log says delivered and /admin stays empty.
    if (mailbox && schema && (schema.email_threads !== 'ok' || schema.email_messages !== 'ok')) {
      warnings.push(
        'Mail can be received but not filed: email_threads / email_messages are not answering, so the Email tab on /admin stays empty however many messages arrive. Run supabase/migrations/0002_email.sql.'
      );
    }
    if (mailbox && !url) {
      warnings.push(
        'MAILBOX_ADDRESS is set but there is no database, so received mail is acknowledged and dropped rather than filed. The Email tab on /admin will stay empty.'
      );
    }
  }

  res.json({
    status: warnings.length ? 'degraded' : 'ok',
    service: 'meridian-construction',
    time: new Date().toISOString(),
    config: {
      supabaseUrl: Boolean(url),
      supabaseAnonKey: Boolean(anon),
      supabaseServiceRoleKey: Boolean(service),
      resendApiKey: Boolean(resend),
      resendWebhookSecret: Boolean(webhook),
      formTo: Boolean(to),
      formFrom: Boolean(config.formFrom()),
      mailboxAddress: Boolean(mailbox),
      forwardTo: Boolean(forward),
    },
    storage: url && service ? 'supabase' : 'filesystem',
    schema: req.query.probe ? schema || 'supabase not configured' : undefined,
    mail: mailProbe,
    warnings,
  });
};

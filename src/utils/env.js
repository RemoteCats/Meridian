'use strict';

/**
 * Load .env for local development.
 *
 * In production the platform supplies the environment — Vercel injects its
 * project variables, and there is no file to read. Locally there is no
 * platform, so without this `npm start` runs with no Supabase and no Resend
 * however carefully .env was filled in, and the site quietly falls back to
 * local files. That failure looks exactly like a misconfigured key, which is
 * a bad hour to hand anyone.
 *
 * Deliberately not a dependency: the file format that matters here is
 * KEY=value, one per line, # for a comment, optional quotes. Anything that
 * is already set in the real environment wins, so exporting a variable for
 * one command still overrides the file.
 */

const fs = require('fs');
const path = require('path');

let loaded = false;

function parse(text) {
  const out = {};
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq < 1) return;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let value = line.slice(eq + 1).trim();
    // Quoted values keep their inner spaces and #; unquoted ones end at a
    // trailing comment.
    if ((value.startsWith('"') && value.endsWith('"') && value.length > 1)
      || (value.startsWith("'") && value.endsWith("'") && value.length > 1)) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    if (key) out[key] = value;
  });
  return out;
}

/** Read .env once. Returns the names it set, which is what a report wants. */
function loadEnv(file) {
  if (loaded) return [];
  loaded = true;
  const target = file || process.env.ENV_FILE || path.join(__dirname, '..', '..', '.env');
  let text;
  try {
    text = fs.readFileSync(target, 'utf8');
  } catch (err) {
    return [];
  }
  const applied = [];
  Object.entries(parse(text)).forEach(([key, value]) => {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
      applied.push(key);
    }
  });
  return applied;
}

module.exports = { loadEnv, parse };

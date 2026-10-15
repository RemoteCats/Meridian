'use strict';

const chatStore = require('../utils/chatStore');
const notify = require('../utils/notify');
const site = require('../data/site.json');

function clean(str, max) {
  return String(str == null ? '' : str).trim().slice(0, max);
}

/**
 * The line the widget opens with, before the visitor has typed anything.
 *
 * It is drawn in the browser and never stored, so as far as the database is
 * concerned it was never said — which is how a visitor who opened with "hi"
 * used to be welcomed twice, once by the widget and once by the rule below
 * that answers a greeting. The responder is given it as already spoken.
 *
 * Keep in step with GREETING in public/js/chat.js.
 */
const OPENING = "Hi, you're through to Meridian Constructions. What are you building, and where does it get difficult?";

/**
 * Lightweight rule-based responder. This is the seam where a real agent, a
 * human hand-off, or a third-party desk (Intercom, etc.) would plug in.
 *
 * `context.said` is every line the agent has already put in this conversation.
 * Each rule offers its lines best first and the first unsaid one is used, so
 * the responder never answers two messages with the same sentence and never
 * repeats the widget's opening line.
 */
function autoReply(text, context = {}) {
  const t = String(text == null ? '' : text).toLowerCase().trim();
  const has = (...words) => words.some((w) => t.includes(w));
  const greeted = /\b(hi|hey|hello|yo|hiya|howdy)\b/.test(t) || has('good morning', 'good afternoon', 'good evening');

  const spoken = new Set([OPENING, ...(context.said || [])]);
  const pick = (...lines) => lines.find((line) => !spoken.has(line)) || lines[lines.length - 1];

  if (greeted && t.split(/\s+/).length <= 4) {
    return pick(
      OPENING,
      'Good to meet you. Tell me what you are building, and the part of it that worries you.',
      'Still here. Tell me about the project and the part of it that worries you, and I will point it at the right engineer.'
    );
  }
  if (has('career', 'job', 'hiring', 'vacancy', 'apply', 'position', 'role')) {
    return pick(
      'We are hiring across the structural, civil, mechanical and digital teams, on site, and in the dive locker. Open roles are on our Careers page, or tell me which discipline you work in.',
      'Send what you have worked on through the form on our Careers page and it reaches the engineers you would sit with. Everyone gets an answer.'
    );
  }
  if (has('quote', 'cost', 'price', 'fee', 'budget')) {
    return pick(
      'Fees follow scope and stage. Leave a short brief and your email and a principal engineer will come back with a considered answer rather than a number pulled out of the air.',
      'The honest answer needs the scope. A drawing set, or a paragraph about the site and the programme, is enough for a real number.'
    );
  }
  if (has('project', 'portfolio', 'work', 'reference', 'example')) {
    return pick(
      'Selected projects are on our Projects page: towers, crossings, process plant, transit and industrial delivery. Is there a sector you would like to see?',
      'Name the sector and I will point you at the closest job we have done: commercial, civil, oil and gas, marine or underwater.'
    );
  }
  if (has('bridge', 'structural', 'seismic', 'civil', 'mechanical', 'hvac', 'bim', 'digital twin', 'facade', 'weld', 'diver', 'diving', 'subsea', 'underwater', 'pipeline', 'refinery', 'tank', 'offshore', 'wharf', 'pier', 'dock')) {
    return pick(
      'That is work we do every week. Tell me a little about the project and the part of it that worries you, and I will put you in front of the right engineer.',
      'We have people on that now. What is the site, and what is the constraint you keep running into?'
    );
  }
  if (has('contact', 'call', 'phone', 'email', 'meet', 'speak')) {
    return pick(
      `Quickest is the phone: ${site.phone}, ${site.hours.replace(' PT', ' Pacific')}. Otherwise email ${site.email}, or leave your address here and we will come back within two working days.`,
      `Leave your address here and a principal engineer picks it up, or ring ${site.phone} and ask for the duty engineer.`
    );
  }
  if (has('thanks', 'thank you', 'cheers', 'great')) {
    return pick('Any time. Anything else I can help with?', 'Any time. We will be here.');
  }
  return pick(
    'Thanks for the message. Someone from the studio will pick this up. Leave your email and a one-line brief and it goes straight to the engineer who covers it.',
    `Noted — it is in the studio inbox. If it is urgent, ${site.phone} reaches a desk rather than a queue.`
  );
}

/** Every line the agent has already said in a conversation. */
function spokenIn(messages) {
  return (messages || []).filter((m) => m.role === 'agent').map((m) => m.text);
}

/**
 * POST /api/chat/message
 *
 * Fallback path: used when the browser cannot reach Supabase itself (not
 * configured, or the client library failed to load). The server holds the
 * service role, so it writes both sides of the exchange.
 */
exports.postMessage = async (req, res, next) => {
  try {
    const sessionId = clean(req.body.sessionId, 64);
    const text = clean(req.body.text, 2000);

    if (!chatStore.isValidId(sessionId)) {
      return res.status(422).json({ error: 'invalid_session', message: 'Missing or malformed session id.' });
    }
    if (text.length < 1) {
      return res.status(422).json({ error: 'empty_message', message: 'Message cannot be empty.' });
    }

    const now = new Date().toISOString();
    const messages = [{ role: 'user', text, at: now }];

    // Stay quiet once a member of the studio has picked the conversation up.
    let handedOver = false;
    try {
      handedOver = await chatStore.isHandedOver(sessionId);
    } catch (err) {
      console.error('[meridian] chat handover check failed:', err.message);
    }

    // What has already been said, so the responder does not repeat itself.
    let said = [];
    if (!handedOver) {
      try {
        said = spokenIn((await chatStore.load(sessionId)).messages);
      } catch (err) {
        console.error('[meridian] chat history read failed:', err.message);
      }
    }

    const reply = handedOver
      ? null
      : { role: 'agent', text: autoReply(text, { said }), at: new Date(Date.now() + 1).toISOString() };
    if (reply) messages.push(reply);

    let stored = true;
    try {
      await chatStore.append(sessionId, messages);
    } catch (err) {
      stored = false;
      console.error('[meridian] failed to persist chat message:', err.message);
    }

    // Route the visitor's message to the inbox so a human can pick it up.
    await notify.chatMessage(chatStore.sessionUuid(sessionId), text);

    // Both sides come back, so the widget draws the visitor's own message from
    // the same source it draws everything else and cannot double it up.
    return res.status(201).json({ ok: true, stored, messages });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/chat/notify
 *
 * Companion to the browser-written path. The visitor's own message is already
 * in the database, written by their browser under row level security; this
 * raises the flag by email and, until a human takes over, posts the holding
 * reply with the service role so it reaches them over realtime.
 */
exports.notifyMessage = async (req, res, next) => {
  try {
    const sessionId = clean(req.body.sessionId, 64);
    const text = clean(req.body.text, 2000);

    if (!chatStore.isUuid(sessionId)) {
      return res.status(422).json({ error: 'invalid_session', message: 'Missing or malformed session id.' });
    }
    if (text.length < 1) {
      return res.status(422).json({ error: 'empty_message', message: 'Message cannot be empty.' });
    }

    let replied = false;
    try {
      if (!(await chatStore.isHandedOverById(sessionId))) {
        const said = spokenIn((await chatStore.loadById(sessionId)).messages);
        await chatStore.appendById(sessionId, [
          { role: 'agent', text: autoReply(text, { said }), at: new Date().toISOString() },
        ]);
        replied = true;
      }
    } catch (err) {
      console.error('[meridian] failed to post chat reply:', err.message);
    }

    await notify.chatMessage(sessionId, text);

    return res.status(202).json({ ok: true, replied });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/chat/:sessionId */
exports.getHistory = async (req, res, next) => {
  try {
    const sessionId = clean(req.params.sessionId, 64);
    if (!chatStore.isValidId(sessionId)) {
      return res.status(422).json({ error: 'invalid_session', message: 'Malformed session id.' });
    }
    let convo = { messages: [] };
    try {
      convo = await chatStore.load(sessionId);
    } catch (err) {
      // A storage fault should cost the visitor their history, not the widget.
      console.error('[meridian] failed to load chat history:', err.message);
    }
    return res.json({ sessionId, messages: convo.messages });
  } catch (err) {
    return next(err);
  }
};

'use strict';

const leadership = require('../data/leadership.json');
const images = require('./images');
const site = require('../data/site.json');
const { contactForm } = require('./layout');

/* Reusable interior page header with an image band. */
function pageHeader({ eyebrow, title, sub, image }) {
  return `
  <header class="page-header" style="--ph-image:url('${image}')">
    <div class="page-header-media" aria-hidden="true"></div>
    <div class="wrap page-header-inner">
      <span class="eyebrow">${eyebrow}</span>
      <h1 data-reveal>${title}</h1>
      ${sub ? `<p data-reveal>${sub}</p>` : ''}
    </div>
  </header>`;
}

/**
 * A full-height chapter of the landing page. Each one carries its own
 * photograph over the site-wide underlay, so scrolling the page reads as
 * moving through a building rather than down a document.
 */
function chapter({ id, label, image, tone = '', inner }) {
  return `
  <section class="chapter ${tone}" id="${id}" data-chapter="${label}">
    ${image ? `<div class="chapter-media" aria-hidden="true"><img src="${image}" alt="" loading="lazy" decoding="async" /></div>
    <div class="chapter-scrim" aria-hidden="true"></div>` : ''}
    <div class="wrap chapter-inner">${inner}</div>
  </section>`;
}

/* ---------- Landing ----------
   The leadership chapter runs off the first entry in leadership.json. Until a
   principal's own name is filled in there, the chapter credits the practice
   rather than inventing a person, so nothing on the page is made up. */
const principal = leadership[0];
const principalName = principal.name || principal.attribution || 'Meridian Constructions';

const heroSection = `
  <section class="hero chapter" id="top" data-chapter="Meridian">
    <div class="hero-slides" id="hero-slides" aria-hidden="true">
      ${images.heroSlides.map((src, i) => `<div class="slide${i === 0 ? ' is-active' : ''}" style="background-image:url('${src}')"></div>`).join('\n      ')}
    </div>
    <div class="hero-scrim" aria-hidden="true"></div>
    <div class="hero-inner wrap">
      <div class="hero-copy">
        <span class="eyebrow hero-tag" data-reveal>Commercial &middot; civil &middot; oil and gas &middot; marine &middot; underwater</span>
        <h1 data-reveal>Engineered to hold.</h1>
        <p class="hero-sub" data-reveal>We engineer and build the structures that have to work on the worst day they will ever see.</p>
        <div class="hero-actions" data-reveal>
          <a href="/projects" class="btn">See the work <span class="arw">&rsaquo;</span></a>
          <a href="#contact" class="btn ghost">Start a project <span class="arw">&rsaquo;</span></a>
        </div>
        <div class="hero-dots" id="hero-dots" role="tablist" aria-label="Background slides">
          ${images.heroSlides.map((src, i) => `<button class="dot${i === 0 ? ' is-active' : ''}" data-slide="${i}" aria-label="Slide ${i + 1}"></button>`).join('\n          ')}
        </div>
      </div>
    </div>
    <div class="hero-readout" aria-label="Practice at a glance">
      <div class="cell"><span class="k">Engineering since</span><span class="v">2003</span></div>
      <div class="cell"><span class="k">Disciplines</span><span class="v">Ten</span></div>
      <div class="cell"><span class="k">Projects delivered</span><span class="v">480+</span></div>
    </div>
  </section>`;

const capabilitiesSection = chapter({
  id: 'services',
  label: 'Capabilities',
  image: images.capabilities,
  inner: `
      <div class="section-head" data-reveal>
        <span class="eyebrow">01 / Capabilities</span>
        <h2>One model. Every discipline working inside it.</h2>
        <p>Frame, ground, systems and site all resolve in the same model, so the gap between two sets of drawings is never where a problem gets to hide.</p>
      </div>
      <div class="services-grid" id="services-grid"></div>`,
});

const metricsSection = chapter({
  id: 'metrics',
  label: 'Practice',
  image: images.metrics,
  tone: 'is-centred',
  inner: `
      <div class="section-head centred" data-reveal>
        <span class="eyebrow">02 / The practice</span>
        <h2>Twenty three years of load paths.</h2>
        <p>Numbers a client can hold us to, against projects they can go and stand in.</p>
      </div>
      <div class="stats-grid" data-reveal>
        <div class="stat"><div class="num" data-count="480" data-suffix="+">0</div><div class="lbl">Projects delivered</div></div>
        <div class="stat"><div class="num" data-count="23" data-suffix="">0</div><div class="lbl">Years in practice</div></div>
        <div class="stat"><div class="num"><em data-count="18" data-suffix="%">0</em></div><div class="lbl">Average material saved</div></div>
        <div class="stat"><div class="num" data-count="40" data-suffix="k">0</div><div class="lbl">Certified dive hours</div></div>
      </div>`,
});

const leadershipSection = chapter({
  id: 'leadership',
  label: 'Leadership',
  inner: `
      <div class="leadership${principal.image ? '' : ' is-textonly'}">
        ${principal.image ? `<div class="leadership-media" data-reveal>
          <img src="${principal.image}" alt="${principal.name ? `Portrait of ${principal.name}` : 'Meridian Constructions, principal-led delivery'}" loading="lazy" />
          <span class="leadership-badge">${principal.role}</span>
        </div>` : ''}
        <div class="leadership-body" data-reveal>
          <span class="eyebrow">03 / Leadership</span>
          <blockquote>&ldquo;${principal.quote}&rdquo;</blockquote>
          <h3>${principalName}</h3>
          ${principal.image ? '' : `<p class="leadership-role">${principal.role}</p>`}
          <p>${principal.bio}</p>
          <a href="/careers" class="link-arrow">Work with us <span class="arw">&rsaquo;</span></a>
        </div>
      </div>`,
});

const workSection = chapter({
  id: 'work',
  label: 'Work',
  image: images.work,
  inner: `
      <div class="section-head with-action" data-reveal>
        <div>
          <span class="eyebrow">04 / Selected work</span>
          <h2>Work you can go and stand in.</h2>
          <p>Three commissions from the last three years. The rest are on the projects page.</p>
        </div>
        <a href="/projects" class="btn ghost">All projects <span class="arw">&rsaquo;</span></a>
      </div>
      <div class="cards-grid" id="featured-projects"></div>`,
});

const contactSection = chapter({
  id: 'contact',
  label: 'Contact',
  image: images.contact,
  inner: `
      <div class="contact-grid">
        <div class="contact-info" data-reveal>
          <span class="eyebrow">05 / Start a project</span>
          <h2>Start with the hard part.</h2>
          <p class="contact-lede">Send the drawing set, the constraint you keep running into, or one paragraph about the site. A principal engineer reads it and answers within two working days &mdash; not a form receipt, an answer.</p>
          <div class="contact-detail">
            <div class="row"><div class="k">Telephone</div><div class="val"><a href="tel:${site.phone.replace(/[^+\d]/g, '')}" data-site="phone">${site.phone}</a></div></div>
            <div class="row"><div class="k">Email</div><div class="val"><a href="mailto:${site.email}" data-site="email">${site.email}</a></div></div>
            <div class="row" data-site-row="address" hidden><div class="k">Studio</div><div class="val" data-site="address"></div></div>
          </div>
        </div>
        ${contactForm('home-contact-form')}
      </div>`,
});

const indexContent = [
  '<nav class="chapter-rail" id="chapter-rail" aria-label="Page sections"></nav>',
  heroSection,
  capabilitiesSection,
  metricsSection,
  leadershipSection,
  workSection,
  contactSection,
].join('\n');

/* ---------- Projects listing ---------- */
const projectsContent = `
  ${pageHeader({ eyebrow: 'Selected work', title: 'Projects.', sub: 'Towers, crossings, tank farms, wharves and the welds nobody sees &mdash; from the first scheme sketch to the day the operator takes the keys.', image: images.projectsHeader })}
  <section class="section-pad">
    <div class="wrap">
      <div class="proj-filters" id="proj-filters" data-reveal></div>
      <div class="cards-grid" id="projects-grid"></div>
    </div>
  </section>`;

/* ---------- Project detail (hydrated by id) ---------- */
const projectContent = `
  <article id="project-detail" class="project-detail" data-loading="true">
    <div class="wrap project-loading">Loading project&hellip;</div>
  </article>`;

/* ---------- Services listing ---------- */
const servicesContent = `
  ${pageHeader({ eyebrow: 'What we do', title: 'Services.', sub: 'Ten disciplines under one roof, from the ground investigation to the last weld on the seabed.', image: images.capabilities })}
  <section class="section-pad">
    <div class="wrap">
      <div class="service-index" id="service-index"></div>
    </div>
  </section>`;

/* ---------- Service detail (hydrated by id) ---------- */
const serviceContent = `
  <article id="service-detail" class="service-detail" data-loading="true">
    <div class="wrap project-loading">Loading service&hellip;</div>
  </article>`;

/* ---------- Apply ---------- */
const applyContent = `
  ${pageHeader({ eyebrow: 'Careers', title: 'Apply.', sub: 'One form, read by the engineers you would sit with. Everyone gets an answer.', image: images.metrics })}
  <section class="section-pad">
    <div class="wrap contact-grid">
      <div class="contact-info" data-reveal>
        <h2 id="apply-role-title">Speculative application</h2>
        <p class="contact-lede" id="apply-role-sub">Tell us what you have built, and what you want to be building in five years.</p>
        <div class="contact-detail" id="apply-role-meta"></div>
        <div class="contact-note">
          <p>We read every application ourselves. If your experience does not line up with an open role we will say so plainly, and say what would change that.</p>
        </div>
        <a class="link-arrow" href="/careers">All open roles <span class="arw">&rsaquo;</span></a>
      </div>

      <form id="apply-form" novalidate data-reveal>
        <div class="field two">
          <div class="field"><label for="apply-name">Name</label><input type="text" id="apply-name" name="name" autocomplete="name" required /><div class="err" data-err="name"></div></div>
          <div class="field"><label for="apply-email">Email</label><input type="email" id="apply-email" name="email" autocomplete="email" required /><div class="err" data-err="email"></div></div>
        </div>
        <div class="field two">
          <div class="field"><label for="apply-phone">Phone <span class="opt">(optional)</span></label><input type="tel" id="apply-phone" name="phone" autocomplete="tel" /><div class="err" data-err="phone"></div></div>
          <div class="field"><label for="apply-experience">Years in practice</label>
            <select id="apply-experience" name="experience">
              <option value="">Select</option>
              <option>Graduate</option>
              <option>1 to 3</option>
              <option>4 to 8</option>
              <option>9 to 15</option>
              <option>15 or more</option>
            </select><div class="err" data-err="experience"></div>
          </div>
        </div>
        <div class="field"><label for="apply-role">Role</label>
          <select id="apply-role" name="roleId"><option value="">Speculative application</option></select>
          <div class="err" data-err="roleId"></div>
        </div>
        <div class="field"><label for="apply-portfolio">Portfolio or profile <span class="opt">(optional)</span></label><input type="url" id="apply-portfolio" name="portfolio" placeholder="https://" /><div class="err" data-err="portfolio"></div></div>
        <div class="field"><label for="apply-message">What have you worked on?</label><textarea id="apply-message" name="message" placeholder="The projects you would want us to ask about, and the part of each one that was yours." required></textarea><div class="err" data-err="message"></div></div>
        <div class="honeypot" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
        <div class="form-status" id="apply-status" role="status" aria-live="polite"></div>
        <button type="submit" class="btn" id="apply-submit">Send application <span class="arw">&rsaquo;</span></button>
      </form>
    </div>
  </section>`;

/* ---------- Careers ---------- */
const careersContent = `
  ${pageHeader({ eyebrow: 'Careers', title: 'Stay on the work.', sub: 'Meridian is a practice of engineers who never left the drawing board for a management floor. If that is the career you want, write to us.', image: images.careersHeader })}
  <section class="section-pad">
    <div class="wrap careers-intro" data-reveal>
      <div>
        <span class="eyebrow">Life at Meridian</span>
        <h2>Engineering treated as a design discipline.</h2>
      </div>
      <p>Our engineers join a project at the first sketch rather than the final check, so whoever sizes a member is in the room while the idea is still being drawn. Graduates sit beside principals and carry their own packages inside a year. We work from downtown towers to tank farms, wharves and the Gulf, we send people to site to watch their own details go in, and we buy the tools our engineers ask for, from parametric modelling to the dive spread.</p>
    </div>
  </section>
  <section class="section-pad alt">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <span class="eyebrow">Open roles</span>
        <h2>Where we are hiring.</h2>
        <p>If your discipline is not on the list, write anyway and tell us what you would want to be working on.</p>
      </div>
      <div class="roles" id="roles"></div>
      <div class="roles-cta" data-reveal>
        <a href="/apply" class="btn ghost">Send a speculative application <span class="arw">&rsaquo;</span></a>
      </div>
    </div>
  </section>`;

/* ---------- Contact ---------- */
const contactContent = `
  ${pageHeader({ eyebrow: 'Start a project', title: 'Talk to an engineer.', sub: 'Send the drawing set, the constraint you keep running into, or one paragraph about the site. A principal engineer answers within two working days.', image: images.contactHeader })}
  <section class="section-pad">
    <div class="wrap contact-grid">
      <div class="contact-info" data-reveal>
        <div class="contact-detail">
          <div class="row"><div class="k">Telephone</div><div class="val"><a href="tel:${site.phone.replace(/[^+\d]/g, '')}" data-site="phone">${site.phone}</a></div></div>
          <div class="row"><div class="k">Email</div><div class="val"><a href="mailto:${site.email}" data-site="email">${site.email}</a></div></div>
          <!-- The address is blank until the desk sets one under Settings, so
               its row appears only once there is something to put in it. -->
          <div class="row" data-site-row="address" hidden><div class="k">Studio</div><div class="val" data-site="address"></div></div>
          <div class="row"><div class="k">Hours</div><div class="val" data-site="hours">${site.hours}</div></div>
        </div>
        <div class="contact-note">
          <p>Every enquiry lands on the studio desk and a principal engineer picks it up. If you would rather talk now, the live chat in the corner reaches the same desk and the same people.</p>
        </div>
      </div>

      ${contactForm('contact-form')}
    </div>
  </section>`;

/* ---------- Admin dashboard (staff only, no site furniture) ---------- */
const adminContent = `
  <main class="admin" id="admin">
    <section class="admin-gate" id="admin-boot">
      <div class="admin-card"><p class="admin-note">Checking access&hellip;</p></div>
    </section>

    <section class="admin-gate" id="admin-unconfigured" hidden>
      <div class="admin-card">
        <span class="eyebrow">Meridian / Studio desk</span>
        <h1>Backend not connected.</h1>
        <div id="admin-missing"></div>
        <p class="admin-note">Set it in the deployment's environment variables and reload. Nothing needs rebuilding, but the change only reaches a running deployment after a redeploy.</p>
        <p class="admin-note"><a href="/api/health">/api/health</a> lists everything the server can see.</p>
        <a class="admin-back" href="/">Back to site</a>
      </div>
    </section>

    <section class="admin-gate" id="admin-login" hidden>
      <form class="admin-card" id="login-form" novalidate>
        <span class="eyebrow">Meridian / Studio desk</span>
        <h1>Staff sign in.</h1>
        <p class="admin-note" id="login-note">Enquiries, applications, live chat and studio mail on one desk.</p>
        <div class="field"><label for="login-email">Email</label><input type="email" id="login-email" name="email" autocomplete="username" required /></div>
        <div class="field"><label for="login-password">Password</label><input type="password" id="login-password" name="password" autocomplete="current-password" required /></div>
        <div class="err" id="login-error" role="alert"></div>
        <button type="submit" class="btn" id="login-btn">Sign in <span class="arw">&rsaquo;</span></button>
        <a class="admin-back" href="/">Back to site</a>
      </form>
    </section>

    <div class="admin-shell" id="admin-shell" hidden>
      <header class="admin-bar">
        <a class="admin-brand" href="/">
          <img class="brand-mark" src="/assets/brand/meridian-mark.webp" alt="" width="26" height="25" aria-hidden="true" />
          <b class="admin-brand-word">Meridian</b>
          <span>Studio desk</span>
        </a>
        <div class="admin-bar-end">
          <span class="admin-who" id="admin-who"></span>
          <button type="button" class="admin-signout" id="admin-signout">Sign out</button>
        </div>
      </header>

      <nav class="admin-tabs" id="admin-tabs" role="tablist" aria-label="Sections">
        <button type="button" class="admin-tab is-active" role="tab" data-tab="enquiries" aria-selected="true">Enquiries<span class="tally" data-tally="enquiries">0</span></button>
        <button type="button" class="admin-tab" role="tab" data-tab="applications" aria-selected="false">Applications<span class="tally" data-tally="applications">0</span></button>
        <button type="button" class="admin-tab" role="tab" data-tab="chat" aria-selected="false">Live chat<span class="tally" data-tally="chat">0</span></button>
        <button type="button" class="admin-tab" role="tab" data-tab="email" aria-selected="false">Email<span class="tally" data-tally="email">0</span></button>
        <button type="button" class="admin-tab" role="tab" data-tab="settings" aria-selected="false">Settings</button>
      </nav>

      <p class="admin-alert" id="admin-alert" role="alert" hidden></p>

      <div class="admin-body">
        <section class="admin-panel" data-panel="enquiries">
          <div class="admin-split">
            <ul class="admin-list" id="enquiry-list"><li class="admin-empty">Loading&hellip;</li></ul>
            <div class="admin-detail" id="enquiry-detail"><p class="admin-empty">Pick an enquiry to read it.</p></div>
          </div>
        </section>

        <section class="admin-panel" data-panel="applications" hidden>
          <div class="admin-split">
            <ul class="admin-list" id="application-list"><li class="admin-empty">Loading&hellip;</li></ul>
            <div class="admin-detail" id="application-detail"><p class="admin-empty">Pick an application to read it.</p></div>
          </div>
        </section>

        <section class="admin-panel" data-panel="chat" hidden>
          <div class="admin-split">
            <ul class="admin-list" id="chat-list"><li class="admin-empty">Loading&hellip;</li></ul>
            <div class="admin-detail" id="chat-detail"><p class="admin-empty">Pick a conversation to read and reply.</p></div>
          </div>
        </section>

        <section class="admin-panel" data-panel="email" hidden>
          <div class="admin-split">
            <ul class="admin-list" id="email-list"><li class="admin-empty">Loading&hellip;</li></ul>
            <div class="admin-detail" id="email-detail"><p class="admin-empty">Pick a thread to read it.</p></div>
          </div>
        </section>
        <section class="admin-panel" data-panel="settings" hidden>
          <div class="admin-settings" id="settings-panel"><p class="admin-empty">Loading&hellip;</p></div>
        </section>
      </div>
    </div>
  </main>`;

/* ---------- 404 ---------- */
const notFoundContent = `
  <section class="notfound">
    <div class="wrap">
      <span class="eyebrow">Error 404</span>
      <h1>Off the drawings.</h1>
      <p>This page has moved, or it was never issued. The links below put you back on a sheet that exists.</p>
      <div class="hero-actions"><a href="/" class="btn">Back to home <span class="arw">&rsaquo;</span></a><a href="/projects" class="btn ghost">See the work</a></div>
    </div>
  </section>`;

module.exports = [
  { file: 'index.html', active: '', bodyClass: 'page-home', title: 'Meridian Constructions | Engineered to hold', description: 'Meridian Constructions is an engineer-led construction practice: commercial building, major civil engineering, oil and gas facilities, and underwater and marine welding, delivered by the people who engineered them.', content: indexContent },
  { file: 'projects.html', active: 'projects', bodyClass: 'page-projects', title: 'Projects | Meridian Constructions', description: 'Selected Meridian Constructions projects across commercial, oil and gas, marine and underwater, major civil and energy work.', content: projectsContent, extraScripts: ['/js/projects.js'] },
  { file: 'project.html', active: 'projects', bodyClass: 'page-project', title: 'Project | Meridian Constructions', description: 'Project detail.', content: projectContent, extraScripts: ['/js/project.js'] },
  { file: 'services.html', active: 'services', bodyClass: 'page-services', title: 'Services | Meridian Constructions', description: 'Ten disciplines: commercial construction, structural and major civil engineering, oil and gas facilities, underwater and marine welding, steel, groundworks, mechanical, digital engineering and commissioning.', content: servicesContent, extraScripts: ['/js/services.js'] },
  { file: 'service.html', active: 'services', bodyClass: 'page-service', title: 'Service | Meridian Constructions', description: 'Service detail.', content: serviceContent, extraScripts: ['/js/service.js'] },
  { file: 'apply.html', active: 'careers', bodyClass: 'page-apply', title: 'Apply | Meridian Constructions', description: 'Apply to Meridian Constructions. One form, read by the engineers you would sit with.', content: applyContent, extraScripts: ['/js/apply.js'] },
  { file: 'careers.html', active: 'careers', bodyClass: 'page-careers', title: 'Careers | Meridian Constructions', description: 'Open engineering and site roles at Meridian Constructions, across structural, civil, mechanical and digital teams.', content: careersContent, extraScripts: ['/js/careers.js'] },
  { file: 'contact.html', active: 'contact', bodyClass: 'page-contact', title: 'Contact us | Meridian Constructions', description: 'Contact Meridian Constructions to start a project. A principal engineer answers within two working days.', content: contactContent },
  { file: 'admin.html', active: '', bodyClass: 'page-admin', bare: true, noindex: true,
    styles: ['/css/admin.css'],
    title: 'Studio desk | Meridian Constructions', description: 'Staff dashboard.',
    content: adminContent, extraScripts: ['/js/supabase-lite.js', '/js/admin.js'] },
  { file: '404.html', active: '', bodyClass: 'page-404', title: 'Page not found | Meridian Constructions', description: 'Page not found.', content: notFoundContent },
];

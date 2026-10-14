// Portfolio Application Logic for George Moussa
// Handles: project rendering, filtering, modal inspector, navigation,
// hero constellation canvas, scroll reveals, spotlight cards, and small delights.

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('DOMContentLoaded', () => {
  initProjects();
  initFilters();
  initModal();
  initMobileNav();
  initContactActions();
  initReveal();
  initSpotlight();
  initHeroCanvas();
  initPortraitTilt();
  initLocalClock();
  initCounters();
  initEmbedViz();

  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});

/* ==========================================================================
   Shared icons
   ========================================================================== */
const ICONS = {
  github: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.420-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>',
  check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  arrow: '<svg class="arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>'
};

const FLAGSHIP_PIPELINES = {
  'documind': {
    color: '167, 139, 250',
    steps: [
      ['AST static analysis', 'ts-morph compiler API'],
      ['Dependency graph', 'zonal folder grouping'],
      ['LLM contextualization', 'semantic role mapping'],
      ['Zero-drift blueprint', 'synced on every commit']
    ]
  },
  'inner-compass': {
    color: '52, 211, 153',
    steps: [
      ['Expo mobile core', 'React Native engine'],
      ['Encrypted offline store', 'reflection journal'],
      ['AI-assisted clarity', 'decision matrix'],
      ['Calm adaptive UI', 'micro-interactions']
    ]
  }
};

/* ==========================================================================
   Projects Rendering
   ========================================================================== */
function initProjects() {
  if (typeof projectsData === 'undefined') return;
  renderFlagships();
  renderProjectGrid(projectsData);

  const statEl = document.getElementById('stat-projects');
  if (statEl) statEl.dataset.count = String(projectsData.length);
}

function renderFlagships() {
  const container = document.getElementById('flagship-container');
  if (!container) return;

  const flagships = ['documind', 'inner-compass']
    .map(id => projectsData.find(p => p.id === id))
    .filter(Boolean);

  container.innerHTML = flagships.map((p, idx) => {
    const pipe = FLAGSHIP_PIPELINES[p.id];
    const num = String(idx + 1).padStart(2, '0');
    return `
    <article class="flagship-card reveal" data-project-id="${p.id}">
      <div class="flagship-content">
        <div>
          <div class="flagship-meta">
            <span class="flagship-index">${num} /</span>
            <span class="badge ${p.id === 'documind' ? 'badge-purple' : 'badge-emerald'}">${p.badge}</span>
            <span class="badge badge-ghost">${p.metrics}</span>
          </div>
          <h3 class="flagship-title">${p.title}</h3>
          <p class="flagship-tagline">${p.tagline}</p>
          <p class="flagship-desc">${p.shortDescription}</p>

          <ul class="flagship-highlights">
            ${p.highlights.map(h => `<li>${ICONS.check}<span>${h}</span></li>`).join('')}
          </ul>

          <div class="tech-tag-group">
            ${p.tech.map(t => `<span class="tech-tag">${t}</span>`).join('')}
          </div>
        </div>

        <div class="card-actions">
          <button class="btn btn-primary btn-sm inspect-btn" data-project-id="${p.id}">
            <span>Deep dive</span>${ICONS.arrow}
          </button>
          <a href="${p.github}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
            ${ICONS.github}<span>Repository</span>
          </a>
        </div>
      </div>

      <div class="flagship-visual" style="--fc: ${pipe ? pipe.color : '167, 139, 250'}">
        <span class="flagship-bignum" aria-hidden="true">${num}</span>
        <div class="pipeline">
          <div class="pipeline-head"><span>Architecture</span><span>${p.id}</span></div>
          ${(pipe ? pipe.steps : []).map((s, i) => `
            <div class="pipeline-step">
              <span class="pipeline-num">${i + 1}</span>
              <span>${s[0]}<span class="pipeline-sub">${s[1]}</span></span>
            </div>
          `).join('')}
        </div>
      </div>
    </article>
  `;
  }).join('');

  // Size the flowing pulse to the pipeline height
  requestAnimationFrame(() => {
    container.querySelectorAll('.pipeline').forEach(pl => {
      pl.style.setProperty('--flow-h', `${Math.max(120, pl.offsetHeight - 80)}px`);
    });
  });

  observeReveals(container);
}

function renderProjectGrid(projects) {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  if (projects.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>No projects match that filter.</p>
        <button class="btn btn-secondary btn-sm" id="reset-filter-btn">Reset filters</button>
      </div>
    `;
    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const searchInput = document.getElementById('project-search');
        if (searchInput) searchInput.value = '';
        document.querySelector('[data-filter="all"]').click();
      });
    }
    return;
  }

  grid.innerHTML = projects.map((p, i) => `
    <article class="project-card spotlight" style="--i:${i}" data-category="${p.category}" data-project-id="${p.id}" tabindex="0" aria-label="Inspect ${p.title}">
      <div class="card-top">
        <div class="card-header-row">
          <span class="badge ${getCategoryBadgeClass(p.category)}">${p.badge}</span>
          <a href="${p.github}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="View code on GitHub" aria-label="View ${p.title} on GitHub">
            ${ICONS.github}
          </a>
        </div>
        <h3 class="project-card-title">${p.title}</h3>
        <p class="project-card-tagline">${p.tagline}</p>
        <p class="project-card-desc">${p.shortDescription}</p>

        <div class="tech-tag-group">
          ${p.tech.map(t => `<span class="tech-tag">${t}</span>`).join('')}
        </div>
      </div>

      <div class="card-footer-row">
        <span class="card-metrics">${p.metrics.split('·')[0].trim()}</span>
        <button class="details-btn inspect-btn" data-project-id="${p.id}">
          <span>Inspect</span>${ICONS.chevron}
        </button>
      </div>
    </article>
  `).join('');
}

function getCategoryBadgeClass(category) {
  switch (category) {
    case 'ai': return 'badge-purple';
    case 'mobile': return 'badge-emerald';
    case 'data': return 'badge-amber';
    case 'systems': return 'badge-pink';
    default: return '';
  }
}

/* ==========================================================================
   Filter & Search
   ========================================================================== */
function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
  const searchInput = document.getElementById('project-search');
  if (!filterBtns.length || typeof projectsData === 'undefined') return;

  // Add counts to each pill
  filterBtns.forEach(btn => {
    const key = btn.getAttribute('data-filter');
    const n = key === 'all' ? projectsData.length : projectsData.filter(p => p.category === key).length;
    btn.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`);
  });

  let activeCategory = 'all';
  let searchTerm = '';

  function applyFilter() {
    let filtered = projectsData;

    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.category === activeCategory);
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(term) ||
        p.tagline.toLowerCase().includes(term) ||
        p.shortDescription.toLowerCase().includes(term) ||
        p.tech.some(t => t.toLowerCase().includes(term))
      );
    }

    renderProjectGrid(filtered);
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.getAttribute('data-filter');
      applyFilter();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      applyFilter();
    });
  }
}

/* ==========================================================================
   Project Deep-Dive Modal
   ========================================================================== */
let lastFocusedEl = null;

function initModal() {
  const backdrop = document.getElementById('project-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  if (!backdrop) return;

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
  });

  // Event delegation: inspect buttons + whole project cards
  document.addEventListener('click', (e) => {
    if (e.target.closest('a')) return; // let real links work
    const trigger = e.target.closest('.inspect-btn, .project-card');
    if (!trigger) return;
    const id = trigger.getAttribute('data-project-id');
    const project = typeof projectsData !== 'undefined' && projectsData.find(p => p.id === id);
    if (project) showProjectModal(project, trigger);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const card = e.target.closest && e.target.closest('.project-card');
    if (card && e.target === card) {
      const project = projectsData.find(p => p.id === card.dataset.projectId);
      if (project) showProjectModal(project, card);
    }
  });
}

function closeModal() {
  const backdrop = document.getElementById('project-modal');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
  if (lastFocusedEl) lastFocusedEl.focus({ preventScroll: true });
}

function showProjectModal(p, trigger) {
  const backdrop = document.getElementById('project-modal');
  if (!backdrop) return;
  lastFocusedEl = trigger || null;

  const $ = (id) => document.getElementById(id);

  $('modal-title').textContent = p.title;
  $('modal-tagline').textContent = p.tagline;
  const badgeEl = $('modal-badge');
  badgeEl.textContent = p.badge;
  badgeEl.className = `badge ${getCategoryBadgeClass(p.category)}`;
  const metricsEl = $('modal-metrics');
  if (metricsEl) metricsEl.textContent = p.metrics;
  $('modal-desc').textContent = p.fullDescription;

  $('modal-highlights').innerHTML = p.highlights
    .map(h => `<li>${ICONS.check}<span>${h}</span></li>`)
    .join('');

  $('modal-tech').innerHTML = p.tech.map(t => `<span class="tech-tag">${t}</span>`).join('');

  const archEl = $('modal-arch');
  const arch = p.architecture || 'Direct Service Integration ──> Processing Flow';
  const nodes = arch.split(/\s*(?:──>|->|→)\s*/).filter(Boolean);
  archEl.innerHTML = nodes
    .map(n => `<span class="arch-node">${n.trim()}</span>`)
    .join('<span class="arch-arrow">→</span>');

  $('modal-github-link').href = p.github;

  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  backdrop.querySelector('.modal-content').scrollTop = 0;
  setTimeout(() => $('modal-close-btn').focus({ preventScroll: true }), 50);
}

/* ==========================================================================
   Navigation: mobile drawer, scroll-spy, hide-on-scroll, scrolled state
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  const links = document.querySelectorAll('.nav-link');
  const navbar = document.querySelector('.navbar');

  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', () => {
      const open = !navLinks.classList.contains('open');
      toggleBtn.classList.toggle('open', open);
      navLinks.classList.toggle('open', open);
      toggleBtn.setAttribute('aria-expanded', String(open));
    });

    links.forEach(link => {
      link.addEventListener('click', () => {
        toggleBtn.classList.remove('open');
        navLinks.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Scroll-spy via IntersectionObserver
  const sections = document.querySelectorAll('section[id]');
  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s));
  }

  // Smart hide-on-scroll (mobile) + scrolled styling
  let lastScrollY = window.scrollY || 0;
  let scrollUpDistance = 0;
  const downThreshold = 8;
  const upThreshold = 25;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      const y = window.scrollY || 0;
      if (navbar) {
        navbar.classList.toggle('scrolled', y > 24);
        if (!navLinks || !navLinks.classList.contains('open')) {
          const delta = y - lastScrollY;
          if (y <= 50) {
            navbar.classList.remove('nav-hidden');
            scrollUpDistance = 0;
          } else if (delta > downThreshold) {
            navbar.classList.add('nav-hidden');
            scrollUpDistance = 0;
          } else if (delta < 0) {
            scrollUpDistance += Math.abs(delta);
            if (scrollUpDistance >= upThreshold) navbar.classList.remove('nav-hidden');
          }
        }
      }
      lastScrollY = Math.max(0, y);
      ticking = false;
    });
  }, { passive: true });
}

/* ==========================================================================
   Contact & Toast
   ========================================================================== */
function initContactActions() {
  const toast = document.getElementById('toast');

  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const textToCopy = btn.getAttribute('data-copy');
      if (!textToCopy) return;

      navigator.clipboard.writeText(textToCopy)
        .then(() => showToast('✓ Link copied to clipboard'))
        .catch(() => showToast(textToCopy));
    });
  });

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2800);
  }
}

/* ==========================================================================
   Scroll reveal
   ========================================================================== */
let revealObserver = null;

function initReveal() {
  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
    return;
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  observeReveals(document);
}

function observeReveals(root) {
  const els = root.querySelectorAll('.reveal:not(.in)');
  if (!revealObserver) {
    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      els.forEach(el => el.classList.add('in'));
    }
    return;
  }
  els.forEach(el => revealObserver.observe(el));
}

/* ==========================================================================
   Spotlight cards — cursor-following glow
   ========================================================================== */
function initSpotlight() {
  if (window.matchMedia('(hover: none)').matches) return;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.spotlight');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

/* ==========================================================================
   Hero canvas — "embedding constellation"
   Drifting nodes in a pseudo-3D space, linked by proximity; the cursor
   acts as a query vector that lights up its nearest neighbours.
   ========================================================================== */
function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hero = canvas.parentElement;

  const COLORS = [[103, 232, 249], [167, 139, 250], [240, 171, 252]];
  let w = 0, h = 0, dpr = 1, nodes = [], raf = null, visible = true;
  const mouse = { x: -9999, y: -9999, active: false };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth;
    h = hero.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round(Math.min(110, Math.max(40, (w * h) / 14000)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.8 + 0.2,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      c: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));
  }

  function step() {
    ctx.clearRect(0, 0, w, h);
    const linkDist = Math.min(150, w / 8);

    for (const n of nodes) {
      n.x += n.vx * n.z;
      n.y += n.vy * n.z;
      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;

      if (mouse.active) {
        const dx = mouse.x - n.x, dy = mouse.y - n.y;
        const d = Math.hypot(dx, dy);
        if (d < 180 && d > 0.1) {
          n.x += (dx / d) * 0.35 * n.z;
          n.y += (dy / d) * 0.35 * n.z;
        }
      }
    }

    // links
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < linkDist * linkDist) {
          const t = 1 - Math.sqrt(d2) / linkDist;
          ctx.strokeStyle = `rgba(${a.c[0]}, ${a.c[1]}, ${a.c[2]}, ${t * 0.22 * Math.min(a.z, b.z)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // query-vector links from cursor
    if (mouse.active) {
      for (const n of nodes) {
        const d = Math.hypot(mouse.x - n.x, mouse.y - n.y);
        if (d < 200) {
          const t = 1 - d / 200;
          ctx.strokeStyle = `rgba(255, 255, 255, ${t * 0.35})`;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
        }
      }
    }

    // nodes
    for (const n of nodes) {
      const r = 0.6 + n.z * 1.6;
      ctx.fillStyle = `rgba(${n.c[0]}, ${n.c[1]}, ${n.c[2]}, ${0.35 + n.z * 0.6})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (visible && !prefersReducedMotion) raf = requestAnimationFrame(step);
  }

  resize();
  step();

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { resize(); if (prefersReducedMotion) step(); }, 150);
  });

  hero.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.active = true;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { mouse.active = false; });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !prefersReducedMotion) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(step);
      }
    }).observe(hero);
  }
}

/* ==========================================================================
   Portrait 3D tilt
   ========================================================================== */
function initPortraitTilt() {
  const el = document.getElementById('portrait');
  if (!el || prefersReducedMotion || window.matchMedia('(hover: none)').matches) return;
  const wrap = el.parentElement;

  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg)`;
  });
  wrap.addEventListener('pointerleave', () => {
    el.style.transform = '';
  });
}

/* ==========================================================================
   Local clock (London, Ontario — America/Toronto)
   ========================================================================== */
function initLocalClock() {
  const el = document.getElementById('local-time');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto', timeZoneName: 'short'
  });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 30000);
}

/* ==========================================================================
   Count-up stats
   ========================================================================== */
function initCounters() {
  // Dynamically calculate years on the job from career start date (Jan 2020) and round
  const yearsEl = document.getElementById('stat-years');
  if (yearsEl) {
    const careerStart = new Date(2020, 0, 1);
    const now = new Date();
    const diffYears = (now - careerStart) / (365.25 * 24 * 60 * 60 * 1000);
    const roundedYears = Math.round(diffYears);
    yearsEl.dataset.count = roundedYears;
    yearsEl.textContent = roundedYears;
  }

  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;

  const run = (el) => {
    const rawVal = el.dataset.count;
    const isFloat = rawVal.includes('.');
    const target = isFloat ? parseFloat(rawVal) : (parseInt(rawVal, 10) || 0);
    if (prefersReducedMotion || target === 0) { el.textContent = rawVal; return; }
    const start = performance.now();
    const dur = 1400;
    const frame = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = isFloat ? (target * eased).toFixed(2) : Math.round(target * eased);
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); }
    });
  }, { threshold: 0.6 });
  els.forEach(el => io.observe(el));
}

/* ==========================================================================
   Writing card visual — scattered "embedding" dots
   ========================================================================== */
function initEmbedViz() {
  const g = document.getElementById('embed-dots');
  if (!g) return;
  const colors = ['#67e8f9', '#a78bfa', '#f0abfc'];
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  let html = '';
  for (let i = 0; i < 70; i++) {
    const cluster = i % 3;
    const cx = [440, 170, 220][cluster];
    const cy = [80, 70, 195][cluster];
    const x = cx + (rand() - 0.5) * 160;
    const y = cy + (rand() - 0.5) * 90;
    const r = 1 + rand() * 1.8;
    html += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${colors[cluster]}" opacity="${(0.25 + rand() * 0.5).toFixed(2)}"/>`;
  }
  g.innerHTML = html;
}

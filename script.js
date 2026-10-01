// Portfolio Application Logic for George Moussa
// Handles Project Rendering, Filtering, Terminal Interactions, Telemetry, and Modals

document.addEventListener('DOMContentLoaded', () => {
  initTerminal();
  initTelemetry();
  initProjects();
  initFilters();
  initModal();
  initMobileNav();
  initContactActions();
});

/* ==========================================================================
   Terminal Simulation
   ========================================================================== */
const terminalTabsData = {
  whoami: `
<span class="t-prompt">george@workstation</span>:<span class="t-comment">~</span>$ whoami --verbose
<span class="t-comment"># Identity & Engineering Profile</span>
{
  <span class="t-key">"name"</span>: <span class="t-val">"George Moussa"</span>,
  <span class="t-key">"role"</span>: <span class="t-val">"Software Engineer & AI Systems Builder"</span>,
  <span class="t-key">"location"</span>: <span class="t-val">"London, Ontario, Canada 🇨🇦"</span>,
  <span class="t-key">"focus"</span>: [
    <span class="t-val">"Local-First AI Agents"</span>,
    <span class="t-val">"AST Static Code Analysis"</span>,
    <span class="t-val">"Calm Tech & Full-Stack Systems"</span>
  ],
  <span class="t-key">"status"</span>: <span class="t-val">"Available for High-Impact Roles"</span>
}
`,
  documind: `
<span class="t-prompt">george@workstation</span>:<span class="t-comment">~/projects/documind</span>$ ts-node run-ast-map.ts
<span class="t-comment">[INFO] Initializing AST Engine via ts-morph...</span>
<span class="t-val">✔</span> Parsed 142 source files without regex heuristics.
<span class="t-val">✔</span> Resolved import graphs and cross-module boundaries.
<span class="t-val">✔</span> LLM Role Contextualization: 0 architectural drift detected.
<span class="t-key">→ Visual Blueprint rendered to:</span> <span class="t-val">blueprint.interactive.json</span>
`,
  agent: `
<span class="t-prompt">george@workstation</span>:<span class="t-comment">~/projects/desktop_local_agent</span>$ python agent.py
<span class="t-comment">[AI LOCAL ORCHESTRATOR] Initializing Ollama engine...</span>
<span class="t-val">● Model:</span> <span class="t-key">llama3 / deepseek-r1 (Local GPU)</span>
<span class="t-val">● Network:</span> <span class="t-tag">100% AIR-GAPPED / ZERO TELEMETRY</span>
<span class="t-prompt">User Prompt ></span> <span class="t-cmd">"Analyze open ports and format as markdown table"</span>
<span class="t-val">[Agent Plan]</span> Executing safe PowerShell command sequence...
<span class="t-val">[Success]</span> Process completed in 320ms.
`,
  stats: `
<span class="t-prompt">george@workstation</span>:<span class="t-comment">~</span>$ curl -s https://api.github.com/users/gogmoussa | jq .
<span class="t-comment"># Live GitHub Identity Matrix</span>
{
  <span class="t-key">"login"</span>: <span class="t-val">"gogmoussa"</span>,
  <span class="t-key">"public_repos"</span>: <span class="t-val">20</span>,
  <span class="t-key">"primary_languages"</span>: [<span class="t-val">"TypeScript"</span>, <span class="t-val">"Python"</span>, <span class="t-val">"C#"</span>, <span class="t-val">"JavaScript"</span>],
  <span class="t-key">"hireable"</span>: <span class="t-val">true</span>
}
`
};

function initTerminal() {
  const terminalBody = document.getElementById('terminal-body');
  const tabButtons = document.querySelectorAll('.terminal-tab-btn');

  if (!terminalBody) return;

  // Set default tab
  terminalBody.innerHTML = terminalTabsData.whoami.trim();

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabKey = btn.getAttribute('data-tab');
      if (terminalTabsData[tabKey]) {
        terminalBody.style.opacity = '0';
        setTimeout(() => {
          terminalBody.innerHTML = terminalTabsData[tabKey].trim();
          terminalBody.style.opacity = '1';
        }, 120);
      }
    });
  });
}

/* ==========================================================================
   Telemetry & Live GitHub Stats
   ========================================================================== */
async function initTelemetry() {
  const reposCountEl = document.getElementById('stat-repos-count');
  const starsCountEl = document.getElementById('stat-stars-count');
  const commitsCountEl = document.getElementById('stat-commits-count');

  // Realistic verified baseline metrics
  let repoCount = 20;
  let followerCount = 8;
  
  try {
    const res = await fetch('https://api.github.com/users/gogmoussa', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.public_repos) repoCount = data.public_repos;
      if (data.followers) followerCount = data.followers;
    }
  } catch (err) {
    console.log('Using baseline GitHub telemetry cache');
  }

  if (reposCountEl) reposCountEl.textContent = `${repoCount}+`;
  if (starsCountEl) starsCountEl.textContent = '100%';
  if (commitsCountEl) commitsCountEl.textContent = '20+';
}

/* ==========================================================================
   Projects Rendering
   ========================================================================== */
function initProjects() {
  renderFlagships();
  renderProjectGrid(projectsData);
}

function renderFlagships() {
  const container = document.getElementById('flagship-container');
  if (!container) return;

  // Select top 2 flagship projects: DocuMind and Inner Compass
  const flagships = projectsData.filter(p => p.id === 'documind' || p.id === 'inner-compass');

  container.innerHTML = flagships.map(p => `
    <article class="flagship-card" data-project-id="${p.id}">
      <div class="flagship-content">
        <div>
          <div class="flagship-meta">
            <span class="badge ${p.id === 'documind' ? 'badge-purple' : 'badge-emerald'}">${p.badge}</span>
            <span class="badge">${p.metrics}</span>
          </div>
          <h3 class="flagship-title">${p.title}</h3>
          <p class="flagship-tagline">${p.tagline}</p>
          <p class="flagship-desc">${p.shortDescription}</p>

          <ul class="flagship-highlights">
            ${p.highlights.map(h => `
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>${h}</span>
              </li>
            `).join('')}
          </ul>

          <div class="tech-tag-group">
            ${p.tech.map(t => `<span class="tech-tag">${t}</span>`).join('')}
          </div>
        </div>

        <div class="card-actions">
          <a href="${p.github}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
            View Repository
          </a>
          <button class="btn btn-secondary btn-sm inspect-btn" data-project-id="${p.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Deep Dive
          </button>
        </div>
      </div>

      <div class="flagship-visual">
        <div class="blueprint-box">
          <div class="blueprint-header">
            <span>Architecture Breakdown</span>
            <span>// ${p.id.toUpperCase()}</span>
          </div>
          <div class="blueprint-step">
            <span class="blueprint-num">01</span>
            <span>${p.id === 'documind' ? 'AST Static Analysis (ts-morph parser)' : 'Expo Mobile Core + React Native Engine'}</span>
          </div>
          <div class="blueprint-step">
            <span class="blueprint-num">02</span>
            <span>${p.id === 'documind' ? 'Dependency Graph & Zonal Grouping' : 'Encrypted Offline Store & Reflection Journal'}</span>
          </div>
          <div class="blueprint-step">
            <span class="blueprint-num">03</span>
            <span>${p.id === 'documind' ? 'LLM Semantic Contextualization' : 'AI-Assisted Clarity & Decision Matrix'}</span>
          </div>
          <div class="blueprint-step">
            <span class="blueprint-num">04</span>
            <span>${p.id === 'documind' ? 'Zero-Drift Synchronized Blueprint' : 'Calm Adaptive UI & Micro-interactions'}</span>
          </div>
        </div>
      </div>
    </article>
  `).join('');
}

function renderProjectGrid(projects) {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  if (projects.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">No projects match your filter criteria.</p>
        <button class="btn btn-outline btn-sm" id="reset-filter-btn">Reset Filters</button>
      </div>
    `;
    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.querySelector('[data-filter="all"]').click();
        const searchInput = document.getElementById('project-search');
        if (searchInput) searchInput.value = '';
      });
    }
    return;
  }

  grid.innerHTML = projects.map(p => `
    <article class="project-card" data-category="${p.category}" data-project-id="${p.id}">
      <div class="card-top">
        <div class="card-header-row">
          <span class="badge ${getCategoryBadgeClass(p.category)}">${p.badge}</span>
          <a href="${p.github}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="View Code on GitHub">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
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
        <span style="font-size: 0.76rem; font-family: var(--font-mono); color: var(--text-muted);">${p.metrics}</span>
        <button class="details-btn inspect-btn" data-project-id="${p.id}">
          <span>Inspect Architecture</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </article>
  `).join('');

  attachInspectHandlers();
}

function getCategoryBadgeClass(category) {
  switch (category) {
    case 'ai': return 'badge-purple';
    case 'mobile': return 'badge-emerald';
    case 'data': return 'badge-amber';
    default: return '';
  }
}

/* ==========================================================================
   Filter & Search Functionality
   ========================================================================== */
function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const searchInput = document.getElementById('project-search');

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
function initModal() {
  const backdrop = document.getElementById('project-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  if (!backdrop) return;

  function closeModal() {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) {
      closeModal();
    }
  });

  attachInspectHandlers();
}

function attachInspectHandlers() {
  const inspectBtns = document.querySelectorAll('.inspect-btn');
  inspectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-project-id');
      const project = projectsData.find(p => p.id === id);
      if (project) {
        showProjectModal(project);
      }
    });
  });
}

function showProjectModal(p) {
  const backdrop = document.getElementById('project-modal');
  const titleEl = document.getElementById('modal-title');
  const taglineEl = document.getElementById('modal-tagline');
  const badgeEl = document.getElementById('modal-badge');
  const descEl = document.getElementById('modal-desc');
  const highlightsEl = document.getElementById('modal-highlights');
  const techEl = document.getElementById('modal-tech');
  const archEl = document.getElementById('modal-arch');
  const githubLink = document.getElementById('modal-github-link');

  if (!backdrop) return;

  if (titleEl) titleEl.textContent = p.title;
  if (taglineEl) taglineEl.textContent = p.tagline;
  if (badgeEl) {
    badgeEl.textContent = p.badge;
    badgeEl.className = `badge ${getCategoryBadgeClass(p.category)}`;
  }
  if (descEl) descEl.textContent = p.fullDescription;

  if (highlightsEl) {
    highlightsEl.innerHTML = p.highlights.map(h => `
      <li style="display: flex; align-items: flex-start; gap: 0.6rem; margin-bottom: 0.6rem; color: #cbd5e1; font-size: 0.92rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" style="flex-shrink:0; margin-top:3px;">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${h}</span>
      </li>
    `).join('');
  }

  if (techEl) {
    techEl.innerHTML = p.tech.map(t => `<span class="tech-tag">${t}</span>`).join('');
  }

  if (archEl) {
    archEl.textContent = p.architecture || 'Direct Service Integration & Processing Flow';
  }

  if (githubLink) {
    githubLink.href = p.github;
  }

  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/* ==========================================================================
   Mobile Nav & Smooth Scrolling
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  const links = document.querySelectorAll('.nav-link');

  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', () => {
    toggleBtn.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  links.forEach(link => {
    link.addEventListener('click', () => {
      toggleBtn.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });

  // Active section spy for in-page anchors
  window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 140;
      const sectionId = current.getAttribute('id');
      const activeLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);

      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        links.forEach(l => l.classList.remove('active'));
        if (activeLink) activeLink.classList.add('active');
      }
    });
  });
}

/* ==========================================================================
   Contact & Toast Notifications
   ========================================================================== */
function initContactActions() {
  const copyBtns = document.querySelectorAll('[data-copy]');
  const toast = document.getElementById('toast');

  copyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const textToCopy = btn.getAttribute('data-copy');
      if (!textToCopy) return;

      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`Copied to clipboard: ${textToCopy}`);
      }).catch(() => {
        showToast(`Selected: ${textToCopy}`);
      });
    });
  });

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }
}

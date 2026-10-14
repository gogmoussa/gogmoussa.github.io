// Smart Navigation & Site Polish Behavior for Subpages (Blog, Articles, 404)
(function () {
  let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  let scrollUpDistance = 0;
  const downThreshold = 8;
  const upThreshold = 25;
  let ticking = false;

  const progressBar = document.getElementById('read-progress');
  const navbar = document.querySelector('.navbar');
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');

  // Mobile menu toggle
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', () => {
      const open = !navLinks.classList.contains('open');
      toggleBtn.classList.toggle('open', open);
      navLinks.classList.toggle('open', open);
      toggleBtn.setAttribute('aria-expanded', String(open));
    });
  }

  // Cursor spotlight support
  if (!window.matchMedia('(hover: none)').matches) {
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.spotlight');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  function updateNavbar() {
    if (!navbar) {
      ticking = false;
      return;
    }

    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const scrollDelta = currentScrollY - lastScrollY;

    // Scrolled styling
    navbar.classList.toggle('scrolled', currentScrollY > 24);

    // Reading progress
    if (progressBar) {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const progress = total > 0 ? (currentScrollY / total) : 0;
      progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
    }

    // Never hide if mobile navigation drawer is open
    if (navLinks && navLinks.classList.contains('open')) {
      ticking = false;
      return;
    }

    // At or near top of page: always show
    if (currentScrollY <= 50) {
      navbar.classList.remove('nav-hidden');
      scrollUpDistance = 0;
    }
    // Scrolling down: hide immediately when passing threshold
    else if (scrollDelta > downThreshold) {
      navbar.classList.add('nav-hidden');
      scrollUpDistance = 0;
    }
    // Scrolling up: accumulate upward scroll distance to prevent jitter
    else if (scrollDelta < 0) {
      scrollUpDistance += Math.abs(scrollDelta);
      if (scrollUpDistance >= upThreshold) {
        navbar.classList.remove('nav-hidden');
      }
    } else {
      scrollUpDistance = 0;
    }

    lastScrollY = Math.max(0, currentScrollY);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateNavbar);
      ticking = true;
    }
  }, { passive: true });
})();

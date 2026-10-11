// Smart Navigation Behavior: Smooth Hide-on-Scroll for Mobile View
(function () {
  let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  let scrollUpDistance = 0;
  const downThreshold = 8;
  const upThreshold = 25;
  let ticking = false;

  function updateNavbar() {
    const navbar = document.querySelector('.navbar') || document.querySelector('header');
    if (!navbar) {
      ticking = false;
      return;
    }

    // Never hide if mobile navigation drawer is open
    const navLinks = document.querySelector('.nav-links');
    if (navLinks && navLinks.classList.contains('open')) {
      ticking = false;
      return;
    }

    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const scrollDelta = currentScrollY - lastScrollY;

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

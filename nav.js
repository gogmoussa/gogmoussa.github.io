// Smart Navigation Behavior
// Automatically hides top bar on mobile view when scrolling down, reveals on scroll up
(function () {
  let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
  const threshold = 8;
  let ticking = false;

  function updateNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) {
      ticking = false;
      return;
    }

    const navLinks = document.querySelector('.nav-links');
    if (navLinks && navLinks.classList.contains('open')) {
      ticking = false;
      return;
    }

    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

    if (currentScrollY <= 40) {
      navbar.classList.remove('nav-hidden');
    } else if (currentScrollY > lastScrollY + threshold) {
      navbar.classList.add('nav-hidden');
    } else if (currentScrollY < lastScrollY - threshold) {
      navbar.classList.remove('nav-hidden');
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

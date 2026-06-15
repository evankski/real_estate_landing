(function () {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  document.querySelectorAll('.portrait img').forEach((image) => {
    image.addEventListener('error', () => {
      const parent = image.closest('.portrait');
      if (parent) parent.classList.add('has-missing-image');
    });
  });

  const menuButton = document.querySelector('.mobile-menu-button');
  const navLinks = document.getElementById('primary-menu');

  if (menuButton && navLinks) {
    menuButton.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (event) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const interestSelect = document.getElementById('interestSelect');
  document.querySelectorAll('[data-interest]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!interestSelect) return;
      const valueMap = {
        'buyer-kit': 'Buyer Clarity Kit',
        'seller-report': 'Seller Breakdown',
        'home-math': 'Home Math Snapshot'
      };
      const mappedValue = valueMap[button.dataset.interest];
      if (mappedValue) interestSelect.value = mappedValue;
    });
  });

  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', () => {
      const button = form.querySelector('button[type="submit"]');
      if (button) {
        button.disabled = true;
        button.textContent = 'Sending...';
      }
    });
  }

  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealElements.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  }
})();

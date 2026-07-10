(function () {
  document.documentElement.classList.add('js');

  const CONFIG = {
    metaPixelId: '2061494168135844'
  };

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const menuButton = document.querySelector('.mobile-menu-button');
  const navLinks = document.getElementById('primary-menu');

  if (menuButton && navLinks) {
    const menuLabel = menuButton.querySelector('.sr-only');

    function setMenuState(isOpen) {
      navLinks.classList.toggle('is-open', isOpen);
      menuButton.setAttribute('aria-expanded', String(isOpen));
      document.body.classList.toggle('is-menu-open', isOpen);
      if (menuLabel) menuLabel.textContent = isOpen ? 'Close menu' : 'Open menu';
    }

    menuButton.addEventListener('click', () => {
      setMenuState(menuButton.getAttribute('aria-expanded') !== 'true');
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenuState(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || menuButton.getAttribute('aria-expanded') !== 'true') return;
      setMenuState(false);
      menuButton.focus();
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (event) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });

  const interestSelect = document.getElementById('interestSelect');
  document.querySelectorAll('[data-interest]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!interestSelect) return;
      interestSelect.value = button.dataset.interest || '';
    });
  });

  const cookieBanner = document.getElementById('cookieBanner');
  const acceptCookies = document.getElementById('acceptCookies');
  const rejectCookies = document.getElementById('rejectCookies');
  const cookieSettingsButton = document.getElementById('cookieSettingsButton');
  const doNotSellButton = document.getElementById('doNotSellButton');
  const cookieChoiceField = document.getElementById('cookieChoiceField');
  const consentKey = 'ek_cookie_tracking_choice';

  function getStoredChoice() {
    try {
      return window.localStorage ? window.localStorage.getItem(consentKey) : null;
    } catch (error) {
      return null;
    }
  }

  function saveStoredChoice(choice) {
    try {
      if (window.localStorage) window.localStorage.setItem(consentKey, choice);
    } catch (error) {
      console.warn('Cookie choice could not be saved in this browser.', error);
    }
  }

  function updateCookieField(choice) {
    if (cookieChoiceField) cookieChoiceField.value = choice || 'not selected';
  }

  function browserSendsOptOutSignal() {
    return navigator.globalPrivacyControl === true;
  }

  function hideCookieBanner() {
    if (!cookieBanner) return;
    cookieBanner.hidden = true;
    cookieBanner.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-cookie-banner');
  }

  function showCookieBanner() {
    if (!cookieBanner) return;
    if (acceptCookies) {
      const optOutIsActive = browserSendsOptOutSignal();
      acceptCookies.disabled = optOutIsActive;
      acceptCookies.textContent = optOutIsActive ? 'Browser opt-out is on' : 'Allow tracking';
    }
    cookieBanner.hidden = false;
    cookieBanner.removeAttribute('hidden');
    cookieBanner.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-cookie-banner');
  }

  function pixelIdIsReady(pixelId) {
    return Boolean(pixelId && !pixelId.includes('REPLACE') && /^\d{5,}$/.test(pixelId));
  }

  function grantMetaPixelConsent() {
    try {
      if (window.fbq) window.fbq('consent', 'grant');
    } catch (error) {
      console.warn('Meta Pixel consent grant was not available.', error);
    }
  }

  function loadMetaPixel(pixelId) {
    if (!pixelIdIsReady(pixelId)) return;

    if (window.fbq) {
      grantMetaPixelConsent();
      return;
    }

    window.fbq = function () {
      window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments);
    };
    window._fbq = window.fbq;
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = '2.0';
    window.fbq.queue = [];

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);

    grantMetaPixelConsent();
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }

  function setTrackingChoice(choice) {
    const enforcedChoice = choice === 'accepted' && browserSendsOptOutSignal() ? 'rejected' : choice;
    saveStoredChoice(enforcedChoice);
    updateCookieField(enforcedChoice);

    if (enforcedChoice === 'accepted') {
      loadMetaPixel(CONFIG.metaPixelId);
    } else if (window.fbq) {
      try {
        window.fbq('consent', 'revoke');
      } catch (error) {
        console.warn('Meta Pixel consent revoke was not available.', error);
      }
    }

    hideCookieBanner();
  }

  const existingChoice = getStoredChoice();
  const browserChoice = browserSendsOptOutSignal() ? 'rejected' : null;
  const effectiveChoice = browserChoice || existingChoice;

  updateCookieField(effectiveChoice);
  if (effectiveChoice === 'accepted') {
    loadMetaPixel(CONFIG.metaPixelId);
    hideCookieBanner();
  } else if (effectiveChoice === 'rejected') {
    hideCookieBanner();
  } else {
    showCookieBanner();
  }

  if (acceptCookies) acceptCookies.addEventListener('click', () => setTrackingChoice('accepted'));
  if (rejectCookies) rejectCookies.addEventListener('click', () => setTrackingChoice('rejected'));
  if (cookieSettingsButton) cookieSettingsButton.addEventListener('click', showCookieBanner);
  if (doNotSellButton) doNotSellButton.addEventListener('click', () => setTrackingChoice('rejected'));

  const isConfirmedLeadRedirect = document.body.dataset.leadSuccess === 'true'
    && new URLSearchParams(window.location.search).get('submitted') === '1';

  if (isConfirmedLeadRedirect && getStoredChoice() === 'accepted' && !browserSendsOptOutSignal()) {
    try {
      if (!window.sessionStorage || window.sessionStorage.getItem('ek_lead_tracked') !== 'true') {
        loadMetaPixel(CONFIG.metaPixelId);
        if (window.fbq) window.fbq('track', 'Lead');
        if (window.sessionStorage) window.sessionStorage.setItem('ek_lead_tracked', 'true');
      }
    } catch (error) {
      console.warn('Lead tracking was not available in this browser.', error);
    }
  }

  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      if (button) {
        button.disabled = true;
        button.textContent = 'Sending...';
      }
      form.setAttribute('aria-busy', 'true');
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
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  }
})();

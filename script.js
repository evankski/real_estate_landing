(function () {
  document.documentElement.classList.add('js');

  const CONFIG = {
    // Enable only after the Meta settings and launch checks in
    // launch-checklist.md are complete. Visitor permission is still required.
    metaPixelEnabled: false,
    metaPixelId: '2061494168135844'
  };

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const menuButton = document.querySelector('.mobile-menu-button');
  const navLinks = document.getElementById('primary-menu');

  if (menuButton && navLinks) {
    const menuLabel = menuButton.querySelector('.sr-only');
    const desktopMenuQuery = window.matchMedia('(min-width: 921px)');

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

    document.addEventListener('pointerdown', (event) => {
      if (menuButton.getAttribute('aria-expanded') !== 'true') return;
      if (menuButton.contains(event.target) || navLinks.contains(event.target)) return;
      setMenuState(false);
    });

    const closeMenuAtDesktop = (event) => {
      if (event.matches) setMenuState(false);
    };

    if (desktopMenuQuery.addEventListener) {
      desktopMenuQuery.addEventListener('change', closeMenuAtDesktop);
    } else {
      desktopMenuQuery.addListener(closeMenuAtDesktop);
    }
  }

  const cookieBanner = document.getElementById('cookieBanner');
  const acceptCookies = document.getElementById('acceptCookies');
  const rejectCookies = document.getElementById('rejectCookies');
  const cookieSettingsButton = document.getElementById('cookieSettingsButton');
  const doNotSellButton = document.getElementById('doNotSellButton');
  const cookieChoiceField = document.getElementById('cookieChoiceField');
  const privacyStatus = document.getElementById('privacyStatus');
  const consentKey = 'ek_cookie_tracking_choice_v2';
  const leadReceiptKey = 'ek_lead_receipt';
  let cookieReturnFocus = null;
  let confirmedLead = false;
  let leadTracked = false;

  // This receipt records an accepted inquiry-service response. The thank-you
  // query string alone is never treated as evidence that an inquiry was sent.
  if (document.body.dataset.leadSuccess === 'true') {
    try {
      const receipt = JSON.parse(window.sessionStorage.getItem(leadReceiptKey) || 'null');
      window.sessionStorage.removeItem(leadReceiptKey);
      const age = receipt ? Date.now() - receipt.acceptedAt : -1;
      confirmedLead = new URLSearchParams(window.location.search).get('submitted') === '1'
        && receipt?.status === 'accepted'
        && age >= 0
        && age < 10 * 60 * 1000;
    } catch (error) {
      confirmedLead = false;
    }

    if (confirmedLead) {
      const thanksTitle = document.getElementById('thanksTitle');
      const thanksMessage = document.getElementById('thanksMessage');
      if (thanksTitle) thanksTitle.textContent = 'Your inquiry is on its way.';
      if (thanksMessage) {
        thanksMessage.textContent = 'Thanks for reaching out. Evan will review the details and get back to you using your preferred contact method. He usually replies within an hour during the day.';
      }
    }
  }

  function getStoredChoice() {
    try {
      if (!window.localStorage) return null;
      const choice = window.localStorage.getItem(consentKey);
      if (choice === 'accepted' || choice === 'rejected') return choice;
      // Keep past opt-outs. A prior opt-in does not authorize the revised
      // measurement disclosure.
      return window.localStorage.getItem('ek_cookie_tracking_choice') === 'rejected' ? 'rejected' : null;
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
    if (privacyStatus) {
      privacyStatus.textContent = choice === 'rejected'
        ? 'Opt-out request honored for this browser. Optional advertising tracking is off.'
        : !CONFIG.metaPixelEnabled
          ? 'Optional advertising measurement is currently paused.'
          : choice === 'accepted'
            ? 'Optional advertising tracking is allowed in this browser. You can change it in Cookie settings.'
            : 'Optional advertising tracking is off until you allow it.';
    }
    if (doNotSellButton) doNotSellButton.setAttribute('aria-pressed', String(choice === 'rejected'));
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

  function showCookieBanner(moveFocus) {
    if (!cookieBanner) return;
    if (acceptCookies) {
      const optOutIsActive = browserSendsOptOutSignal();
      acceptCookies.disabled = optOutIsActive || !CONFIG.metaPixelEnabled;
      acceptCookies.textContent = optOutIsActive ? 'Browser opt-out is on'
        : !CONFIG.metaPixelEnabled ? 'Measurement is paused' : 'Allow tracking';
    }
    const bannerText = document.getElementById('cookieBannerText');
    if (bannerText) bannerText.textContent = CONFIG.metaPixelEnabled
      ? 'Allow Meta to receive page visits and successful inquiry events for advertising measurement? Your choice is optional. You can browse and contact Evan with tracking off.'
      : 'Meta advertising measurement is currently paused. No Meta Pixel script or events are loaded. You can keep tracking off and review the privacy notice below.';
    cookieBanner.hidden = false;
    cookieBanner.removeAttribute('hidden');
    cookieBanner.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-cookie-banner');
    if (moveFocus && rejectCookies) {
      cookieBanner.scrollIntoView({ block: 'center', behavior: 'auto' });
      rejectCookies.focus({ preventScroll: true });
    }
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
    if (!CONFIG.metaPixelEnabled || browserSendsOptOutSignal() || !pixelIdIsReady(pixelId)) return;

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
    window.fbq('set', 'autoConfig', false, pixelId);
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }

  function trackConfirmedLead() {
    if (!CONFIG.metaPixelEnabled || !confirmedLead || leadTracked || browserSendsOptOutSignal() || getStoredChoice() !== 'accepted') return;
    try {
      loadMetaPixel(CONFIG.metaPixelId);
      if (window.fbq) {
        window.fbq('track', 'Lead');
        leadTracked = true;
      }
    } catch (error) {
      // An unavailable analytics service must never interrupt an inquiry.
    }
  }

  function setTrackingChoice(choice) {
    if (choice === 'accepted' && !CONFIG.metaPixelEnabled) return;
    const enforcedChoice = choice === 'accepted' && browserSendsOptOutSignal() ? 'rejected' : choice;
    saveStoredChoice(enforcedChoice);
    updateCookieField(enforcedChoice);

    if (enforcedChoice === 'accepted') {
      loadMetaPixel(CONFIG.metaPixelId);
      trackConfirmedLead();
    } else if (window.fbq) {
      try {
        window.fbq('consent', 'revoke');
      } catch (error) {
        console.warn('Meta Pixel consent revoke was not available.', error);
      }
    }

    hideCookieBanner();
    if (cookieReturnFocus && document.contains(cookieReturnFocus)) {
      cookieReturnFocus.focus({ preventScroll: true });
    }
    cookieReturnFocus = null;
  }

  const existingChoice = getStoredChoice();
  const browserChoice = browserSendsOptOutSignal() ? 'rejected' : null;
  const effectiveChoice = browserChoice || existingChoice;
  if (browserChoice) saveStoredChoice('rejected');

  updateCookieField(effectiveChoice);
  if (!CONFIG.metaPixelEnabled) {
    hideCookieBanner();
  } else if (effectiveChoice === 'accepted') {
    loadMetaPixel(CONFIG.metaPixelId);
    hideCookieBanner();
  } else if (effectiveChoice === 'rejected') {
    hideCookieBanner();
  } else {
    showCookieBanner(false);
  }

  if (acceptCookies) acceptCookies.addEventListener('click', () => setTrackingChoice('accepted'));
  if (rejectCookies) rejectCookies.addEventListener('click', () => setTrackingChoice('rejected'));
  if (cookieSettingsButton) {
    cookieSettingsButton.addEventListener('click', () => {
      cookieReturnFocus = cookieSettingsButton;
      showCookieBanner(true);
    });
  }
  if (doNotSellButton) doNotSellButton.addEventListener('click', () => setTrackingChoice('rejected'));

  // Apply a choice changed in another open tab without waiting for a reload.
  window.addEventListener('storage', (event) => {
    if (event.key !== consentKey && event.key !== null) return;
    const choice = browserSendsOptOutSignal() ? 'rejected' : getStoredChoice();
    updateCookieField(choice);
    if (choice !== 'accepted' && window.fbq) window.fbq('consent', 'revoke');
    if (choice === 'accepted') {
      loadMetaPixel(CONFIG.metaPixelId);
      trackConfirmedLead();
    }
  });

  trackConfirmedLead();

  // Keep campaign context when a visitor explores an area guide before asking
  // a question. Carry only the named campaign fields in same-site links; do not
  // store a browsing history or copy arbitrary query parameters.
  const campaignFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const campaignQuery = new URLSearchParams(window.location.search);
  const campaignEntries = campaignFields.filter((key) => campaignQuery.has(key))
    .map((key) => [key, campaignQuery.get(key).slice(0, 200)]);
  if (campaignEntries.length) {
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      try {
        const destination = new URL(href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        if (!['http:', 'https:'].includes(destination.protocol)) return;
        campaignEntries.forEach(([key, value]) => {
          if (!destination.searchParams.has(key)) destination.searchParams.set(key, value);
        });
        link.setAttribute('href', destination.pathname + destination.search + destination.hash);
      } catch {
        // Invalid or non-web links keep their original destination.
      }
    });
  }

  const form = document.getElementById('contactForm');
  if (form) {
    const button = form.querySelector('button[type="submit"]');
    const originalButtonText = button ? button.textContent : '';
    const steps = Array.from(form.querySelectorAll('[data-form-step]'));
    const nextButton = form.querySelector('[data-form-next]');
    const backButton = form.querySelector('[data-form-back]');
    const stepStatus = document.getElementById('formStepStatus');
    const formStatus = document.getElementById('formStatus');
    const requestType = document.getElementById('requestType');
    const requestLabel = document.getElementById('requestLabel');
    const ctaSource = document.getElementById('ctaSourceField');
    const areaSelect = document.getElementById('areaSelect');
    const contactMethod = document.getElementById('contactMethod');
    const phone = form.elements.namedItem('phone');
    const query = new URLSearchParams(window.location.search);
    const intentValues = {
      buy: 'Buying a home',
      sell: 'Selling a home',
      both: 'Buying and selling',
      explore: 'Exploring my options'
    };
    const requestNames = {
      buy: 'Home comparison',
      sell: 'Pricing report',
      both: 'Consultation',
      explore: 'Consultation'
    };
    let currentStep = 0;
    let isSubmitting = false;
    let submissionSucceeded = false;

    function setStatus(message, state) {
      if (!formStatus) return;
      formStatus.textContent = message;
      formStatus.dataset.state = state || '';
    }

    function setStep(index, focus) {
      currentStep = index;
      steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== currentStep;
      });
      if (stepStatus) stepStatus.textContent = `Step ${index + 1} of ${steps.length} · ${index === 0 ? 'Your plans' : 'Your details'}`;
      if (nextButton) nextButton.hidden = index !== 0;
      if (backButton) backButton.hidden = index === 0;
      if (button) button.hidden = steps.length > 1 && index < steps.length - 1;
      form.dataset.currentStep = String(index + 1);
      if (focus && steps[index]) {
        form.scrollIntoView({ block: 'start', behavior: 'auto' });
        const target = steps[index].querySelector('input:not([type="hidden"]), select, textarea');
        if (target) target.focus({ preventScroll: true });
      }
    }

    function updatePhoneRequirement() {
      if (!phone || !contactMethod) return;
      phone.required = contactMethod.value === 'text' || contactMethod.value === 'call';
      phone.setAttribute('aria-required', String(phone.required));
      const hint = document.getElementById('phoneHint');
      if (hint) hint.textContent = phone.required ? 'Required so Evan can reach you this way.' : 'Optional if you prefer email.';
    }

    function validate(container) {
      const invalid = Array.from(container.querySelectorAll('input, select, textarea'))
        .find((field) => field.willValidate && !field.checkValidity());
      if (!invalid) return true;
      invalid.focus();
      invalid.reportValidity();
      return false;
    }

    function hiddenValue(name, value) {
      let field = Array.from(form.elements).find((element) => element.name === name);
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = name;
        form.appendChild(field);
      }
      field.value = value;
    }

    function captureAttribution() {
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((key) => {
        if (query.has(key)) hiddenValue(key, query.get(key).slice(0, 200));
      });
      hiddenValue('landing_page', window.location.pathname.slice(0, 200));
      let referrerOrigin = '';
      try {
        if (document.referrer) referrerOrigin = new URL(document.referrer).origin;
      } catch (error) {
        // Ignore malformed or unavailable referrers.
      }
      hiddenValue('referrer_origin', referrerOrigin.slice(0, 200));
      hiddenValue('consent_version', '2026-10-19-inquiry-v2');
    }

    function selectArea(area) {
      if (!areaSelect || !area) return;
      const option = Array.from(areaSelect.options).find((item) =>
        item.value.toLowerCase() === area.toLowerCase()
        || item.textContent.trim().toLowerCase() === area.toLowerCase());
      if (option) {
        areaSelect.value = option.value;
        return;
      }
      const guideAreas = [
        'Oakley', 'Walnut Creek', 'Concord', 'Pleasant Hill', 'Danville',
        'San Ramon', 'Dublin', 'Vallejo', 'Benicia'
      ];
      const guideArea = guideAreas.find((name) => name.toLowerCase() === area.toLowerCase());
      if (!guideArea) return;
      areaSelect.value = 'Somewhere else';
      const areaOrListing = form.elements.namedItem('area_or_listing');
      if (areaOrListing && !areaOrListing.value.trim()) areaOrListing.value = guideArea;
    }

    function selectIntent(intent, request) {
      const value = intentValues[intent] || intent;
      const inputs = form.querySelectorAll('input[name="interest"]');
      inputs.forEach((input) => { input.checked = input.value === value; });
      // Retain support for an older campaign page using a select.
      const interestSelect = document.getElementById('interestSelect');
      if (interestSelect && Array.from(interestSelect.options).some((option) => option.value === value)) {
        interestSelect.value = value;
      }
      const requestName = request || requestNames[intent] || 'Consultation';
      if (requestType) requestType.value = requestName;
      if (requestLabel) requestLabel.textContent = requestName;
    }

    function resetFormSubmitState() {
      isSubmitting = false;
      form.removeAttribute('aria-busy');
      if (nextButton) nextButton.disabled = false;
      if (backButton) backButton.disabled = false;
      if (button) {
        button.disabled = submissionSucceeded;
        button.textContent = submissionSucceeded ? 'Inquiry sent' : originalButtonText;
      }
    }

    function acceptSubmission() {
      submissionSucceeded = true;
      // Only a service-accepted response can create this short-lived receipt.
      // No contact details or campaign information are stored in the browser.
      try {
        window.sessionStorage.setItem(leadReceiptKey, JSON.stringify({
          status: 'accepted',
          acceptedAt: Date.now()
        }));
        window.location.assign(new URL('./thanks.html?submitted=1', window.location.href).href);
      } catch (error) {
        // Private browsing may block storage. Keep a useful confirmation here.
        confirmedLead = true;
        trackConfirmedLead();
        setStatus('Your inquiry is on its way. Evan will get back to you using your preferred contact method.', 'success');
        resetFormSubmitState();
      }
    }

    async function sendInquiry(payload, signal) {
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal,
        credentials: 'omit',
        referrerPolicy: 'origin'
      };
      let response = await fetch('/api/leads', options);
      let result = null;
      try {
        result = await response.json();
      } catch (error) {
        // Static hosts may return an HTML 404 for an unavailable API route.
      }
      // These responses establish that the API has not sent the inquiry. Other
      // failures may be ambiguous, so never resubmit automatically after them.
      const useEmailFallback = response.status === 404 || response.status === 405
        || (response.status === 503 && result?.code === 'NOT_CONFIGURED');
      if (useEmailFallback) {
        response = await fetch('https://formsubmit.co/ajax/evan@thewowski.com', options);
        result = await response.json();
      }
      if (!response.ok || (result?.success !== true && result?.success !== 'true')) {
        throw new Error('The inquiry service did not confirm the inquiry.');
      }
    }

    captureAttribution();
    updatePhoneRequirement();
    if (contactMethod) contactMethod.addEventListener('change', updatePhoneRequirement);
    form.querySelectorAll('input[name="interest"]').forEach((input) => {
      input.addEventListener('change', () => {
        const intent = Object.keys(intentValues).find((key) => intentValues[key] === input.value);
        selectIntent(intent || input.value);
      });
    });
    document.querySelectorAll('[data-interest]').forEach((cta) => {
      cta.addEventListener('click', () => {
        if (isSubmitting || submissionSucceeded) return;
        selectIntent(cta.dataset.interest || 'explore', cta.dataset.request);
        selectArea(cta.dataset.area);
        if (ctaSource) ctaSource.value = (cta.dataset.ctaSource || cta.dataset.source || cta.id || cta.textContent.trim()).slice(0, 120);
        if (steps.length > 1) setStep(0, false);
        setStatus('');
      });
    });
    const pageIntent = query.get('intent') || document.body.dataset.pageIntent;
    if (pageIntent && intentValues[pageIntent]) {
      selectIntent(pageIntent);
      if (ctaSource) ctaSource.value = query.has('intent') ? 'Campaign URL' : 'Campaign page';
    }
    selectArea(query.get('area'));

    // The unenhanced form remains a conventional form with all fields visible.
    // Validation is controlled here so hidden steps are revealed before errors.
    form.noValidate = true;
    if (steps.length > 1) {
      setStep(0, false);
      if (nextButton) nextButton.addEventListener('click', () => {
        if (validate(steps[currentStep])) {
          setStatus('');
          setStep(Math.min(currentStep + 1, steps.length - 1), true);
        }
      });
      if (backButton) backButton.addEventListener('click', () => {
        setStatus('');
        setStep(Math.max(currentStep - 1, 0), true);
      });
    }

    window.addEventListener('pageshow', () => {
      resetFormSubmitState();
      updatePhoneRequirement();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (isSubmitting || submissionSucceeded) return;
      updatePhoneRequirement();
      if (steps.length > 1 && currentStep === 0) {
        if (validate(steps[0])) setStep(1, true);
        return;
      }
      const invalidStep = steps.findIndex((step) =>
        Array.from(step.querySelectorAll('input, select, textarea')).some((field) =>
          field.willValidate && !field.checkValidity()));
      if (invalidStep >= 0) setStep(invalidStep, false);
      if (!validate(form)) return;
      hiddenValue('submitted_at', new Date().toISOString());
      updateCookieField(browserSendsOptOutSignal() ? 'rejected' : getStoredChoice());
      if (!window.fetch || !window.AbortController) {
        // The native HTML action remains available in older browsers. No receipt
        // is created because a redirect does not establish a successful send.
        HTMLFormElement.prototype.submit.call(form);
        return;
      }

      isSubmitting = true;
      setStatus('Sending your inquiry…', 'pending');
      form.setAttribute('aria-busy', 'true');
      if (button) {
        button.disabled = true;
        button.textContent = 'Sending…';
      }
      if (nextButton) nextButton.disabled = true;
      if (backButton) backButton.disabled = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        await sendInquiry(payload, controller.signal);
        acceptSubmission();
      } catch (error) {
        setStatus(
          error.name === 'AbortError'
            ? 'This is taking longer than expected, and delivery could not be confirmed. Your details are still here. Try again or text Evan at 925-492-7023.'
            : 'Your inquiry could not be confirmed. Your details are still here. Please try again, email evan@thewowski.com, or text 925-492-7023.',
          'error'
        );
        resetFormSubmitState();
      } finally {
        window.clearTimeout(timeout);
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
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  }
})();

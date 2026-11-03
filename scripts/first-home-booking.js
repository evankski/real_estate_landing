// Inlined only on C02. Answers stay in the form while the buyer changes steps.
// The optional calendar loads only after the buyer chooses to open it.
window.initFirstHomeBooking = function ({sendInquiry, measure, context}) {
  const el = id => document.getElementById(id);
  const form = el('c02-preparation');
  const questions = el('c02-questions');
  const contact = el('c02-contact');
  const submit = el('c02-continue');
  const edit = el('c02-edit');
  const status = el('c02-status');
  const previewDraft = el('c02-preview-draft');
  let retryPending = false, retryTimer, retryDelay = 5000;
  const manualFields = el('c02-manual-fields');
  const switchMode = el('c02-switch');
  const calendar = el('c02-calendar');
  const widget = el('c02-widget');
  const url = form.dataset.calendar;
  let manual = !url;
  let started = false;
  let busy = false;
  let finished = false;
  let calendarAttempt = 0;
  let loadTimer;
  let widgetScript;
  form.hidden = false;
  const sheet = el('contactForm');
  function reuseContact(from, to) {
    for (const key of ['name','email']) {
      const destination = to.elements.namedItem(key);
      if (!destination.value) destination.value = from.elements.namedItem(key).value;
    }
  }
  sheet.closest('details').addEventListener('toggle', event => {
    if (event.currentTarget.open) reuseContact(form, sheet);
  });
  const value = name => form.elements.namedItem(name).value.trim();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  form.elements.timezone.value = zone;
  const zoneName = new Intl.DateTimeFormat('en-US', {timeZone: zone, timeZoneName: 'longGeneric'})
    .formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value;
  el('c02-local-zone').textContent = 'Times are shown in your local time zone (' + (zoneName || zone) + ').';
  const dateInput = form.elements.appointment_date;
  const timeInput = form.elements.appointment_time;
  function setEarliestDate() {
    const today = new Date();
    dateInput.min = [today.getFullYear(), String(today.getMonth() + 1).padStart(2,'0'),
      String(today.getDate()).padStart(2,'0')].join('-');
  }
  setEarliestDate();
  for (const input of [dateInput, timeInput]) {
    input.addEventListener('input', () => timeInput.setCustomValidity(''));
  }
  function say(message, state = '') {
    status.textContent = message;
    status.dataset.state = state;
    previewDraft.hidden = true;
    previewDraft.removeAttribute('href');
  }
  form.addEventListener('input', () => {
    if (retryPending || !previewDraft.hidden) say('');
    cancelRetry();
  });
  function cancelRetry() {
    clearTimeout(retryTimer);
    retryPending = false;
    retryDelay = 5000;
  }
  function retryRequest() {
    if (!retryPending || busy || finished || contact.hidden) return;
    clearTimeout(retryTimer);
    retryPending = false;
    form.requestSubmit();
  }
  window.addEventListener('online', retryRequest);
  function stopCalendar() {
    calendarAttempt++;
    clearTimeout(loadTimer);
    calendar.hidden = true;
    widget.replaceChildren();
  }
  function setMode() {
    manualFields.hidden = !manual;
    for (const input of manualFields.querySelectorAll('input')) {
      input.required = manual && input.type !== 'hidden';
      input.disabled = !manual;
    }
    switchMode.hidden = !url || !questions.hidden;
    switchMode.textContent = manual ? 'Use the live calendar instead' : 'Request a time with Evan instead';
    el('c02-options').textContent = manual
      ? 'Pick your preferred start time. I’ll email you to confirm it or suggest another time.'
      : 'Open my calendar to see available times in your time zone.';
    submit.textContent = manual ? 'Request my 20-minute call' : 'Open available times';
  }
  function setBusy(state) {
    busy = state;
    submit.disabled = state || finished;
    edit.disabled = state || finished;
    switchMode.disabled = state || finished;
    form.setAttribute('aria-busy', String(state));
  }
  edit.addEventListener('click', () => {
    cancelRetry();
    stopCalendar();
    questions.hidden = false;
    contact.hidden = contact.disabled = true;
    switchMode.hidden = true;
    submit.textContent = 'Choose a time';
    say('');
    questions.querySelector('input').focus();
  });
  switchMode.addEventListener('click', () => {
    cancelRetry();
    stopCalendar();
    manual = !manual;
    setMode();
    say('');
    timeInput.setCustomValidity('');
    (manual ? dateInput : submit).focus();
  });
  async function emailTimeRequest() {
    const data = Object.fromEntries(new FormData(form));
    const localTime = new Date(data.appointment_date + 'T' + data.appointment_time);
    data.appointment_start = Number.isFinite(localTime.getTime()) ? localTime.toISOString() : '';
    const appointment = firstHomeAppointment(data);
    if (!appointment) {
      timeInput.setCustomValidity('Choose a future time that exists in your local time zone.');
      timeInput.reportValidity();
      return;
    }
    retryPending = false;
    clearTimeout(retryTimer);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    setBusy(true);
    contact.disabled = true;
    say('Sending your time request…', 'pending');
    try {
      const result = await sendInquiry({
        ...data, ...context(), submitted_at: new Date().toISOString(), preferred_time_one: appointment.label,
        'Open in Outlook': appointment.outlookUrl,
        campaign_id: 'C02', request_type: form.dataset.requestType, route_version: form.dataset.version,
        interest: 'Buying a home', contact_method: 'call', meeting_format: 'Phone', cta_source: 'C02 manual time request',
        _subject: 'First Home Game Plan request | ' + appointment.label, _template: 'table',
        marketing_permission: 'Inquiry response only.'
      }, controller.signal, form.dataset.intake);
      if (result === 'preview') {
        say('Local preview for ' + appointment.label + '. No email was sent or time reserved.', 'preview');
        previewDraft.href = appointment.outlookUrl;
        previewDraft.hidden = false;
      } else {
        finished = true;
        contact.hidden = true;
        submit.hidden = switchMode.hidden = true;
        const receiptTitle = el('c02-saved-title');
        receiptTitle.hidden = false;
        say('Your request for ' + appointment.label + ' is saved. I’ll email you to confirm the time, then call you from 925-492-7023 at the agreed time.', 'success');
        receiptTitle.focus();
        measure('C02ManualTimeRequested');
      }
    } catch (error) {
      if (error?.retryable || window.navigator?.onLine === false) {
        retryPending = true;
        retryTimer = setTimeout(retryRequest, retryDelay);
        retryDelay = Math.min(60000, retryDelay * 2);
        say(window.navigator?.onLine === false
          ? 'You’re offline. Keep this page open and your request will retry when you reconnect.'
          : 'Still connecting. Keep this page open; your request will retry automatically.', 'pending');
      } else {
        say('Your request hasn’t been acknowledged. Your answers are still here. Check your details and try again.', 'error');
      }
    } finally {
      clearTimeout(timer);
      contact.disabled = finished;
      setBusy(false);
    }
  }
  function loadWidgetScript() {
    if (window.Calendly?.initInlineWidget) return Promise.resolve();
    if (!widgetScript) {
      widgetScript = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://assets.calendly.com/assets/external/widget.js';
        script.onload = resolve;
        script.onerror = () => { script.remove(); widgetScript = null; reject(new Error('Calendar unavailable')); };
        document.head.append(script);
      });
    }
    return widgetScript;
  }
  function calendarFailed(attempt) {
    if (calendarAttempt !== attempt || finished) return;
    stopCalendar();
    widgetScript = null;
    setBusy(false);
    submit.textContent = 'Try the calendar again';
    say('The calendar didn’t load. Try again or email a time request. Your answers are still here.', 'error');
  }
  async function openCalendar() {
    stopCalendar();
    const attempt = calendarAttempt;
    setBusy(true);
    say('Loading available times…', 'pending');
    calendar.hidden = false;
    // A script load or iframe load alone does not establish a usable calendar.
    loadTimer = setTimeout(() => calendarFailed(attempt), 15000);
    try {
      await loadWidgetScript();
      if (attempt !== calendarAttempt) return;
      window.Calendly.initInlineWidget({
        url, parentElement: widget,
        prefill: { name: value('name'), email: value('email'), customAnswers: {
          a1: value('buying_area'), a2: value('move_timing'), a3: value('lender_status'),
          a4: value('representation_status'), a5: value('message'), a6: value('phone')
        } }
      });
      calendar.querySelector('h3').focus();
    } catch { calendarFailed(attempt); }
  }
  window.addEventListener('message', event => {
    const frame = widget.querySelector('iframe');
    if (!url || !frame || finished || calendar.hidden || event.origin !== 'https://calendly.com' || event.source !== frame.contentWindow) return;
    const name = event.data?.event;
    if (['calendly.event_type_viewed','calendly.profile_page_viewed','calendly.date_and_time_selected'].includes(name)) {
      clearTimeout(loadTimer);
      setBusy(false);
      submit.disabled = true;
      say('Choose a time in the calendar and complete its confirmation step. If no times fit, you can email a request.');
      return;
    }
    if (name !== 'calendly.event_scheduled') return;
    const uri = event.data.payload?.event?.uri;
    if (typeof uri !== 'string' || !/^https:\/\/api\.calendly\.com\/scheduled_events\/[a-zA-Z0-9-]+$/.test(uri)) return;
    clearTimeout(loadTimer);
    finished = true;
    setBusy(false);
    submit.textContent = 'Appointment confirmed';
    say('Appointment confirmed. See the calendar confirmation for your time and meeting details.', 'success');
    measure('Schedule');
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy || finished || !form.reportValidity()) return;
    if (!questions.hidden) {
      questions.hidden = true;
      contact.hidden = contact.disabled = false;
      reuseContact(sheet, form);
      setEarliestDate();
      setMode();
      contact.querySelector('legend').focus();
      if (!started) { started = true; measure('C02BookingStarted'); }
      return;
    }
    if (manual) emailTimeRequest();
    else if (calendar.hidden) openCalendar();
  });
};

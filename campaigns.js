(function () {
  // Optional enhancements only. Every offer, sample and form is server-readable HTML.
  const query = new URLSearchParams(window.location.search);
  if (query.get('view') === 'sample' && document.querySelector('[data-comparison-headline]')) {
    document.querySelector('[data-comparison-headline]').textContent = 'See exactly what the home comparison includes.';
    document.querySelector('[data-comparison-lede]').textContent = 'Review the sample, understand the process, and request help comparing up to three Brentwood or Oakley homes against your priorities.';
    const primary = document.querySelector('.campaign-actions .button');
    if (primary) {
      primary.href = '#sample';
      primary.textContent = 'View the sample ↗';
    }
    const source = document.getElementById('ctaSourceField');
    if (source) source.value = 'compare-sample-variant';
  }

  document.querySelectorAll('[data-print]').forEach(button => {
    button.addEventListener('click', () => window.print());
  });

  document.querySelectorAll('[data-event-end]').forEach(status => {
    const end = Date.parse(status.dataset.eventEnd);
    if (Number.isFinite(end) && end < Date.now()) {
      status.textContent = 'This advertised event has ended. Contact Evan for current availability or another appropriate showing arrangement.';
      status.classList.add('event-ended');
    }
  });
})();

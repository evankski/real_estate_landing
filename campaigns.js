(function () {
  // Optional enhancements only. Every offer, sample and form is server-readable HTML.
  const query = new URLSearchParams(window.location.search);
  if (query.get('view') === 'sample' && document.querySelector('[data-comparison-headline]')) {
    const headline = document.querySelector('[data-comparison-headline]');
    headline.textContent = 'See the comparison.';
    const emphasis = document.createElement('span');
    emphasis.textContent = 'Then decide if it helps.';
    headline.append(emphasis);
    document.querySelector('[data-comparison-lede]').textContent = 'See how I compare Brentwood or Oakley homes around your priorities, including the trade-offs and questions still worth asking.';
    const primary = document.querySelector('.campaign-actions .button');
    if (primary) {
      primary.href = '#sample';
      primary.textContent = 'View the sample ↗';
    }
    const source = document.getElementById('ctaSourceField');
    if (source) source.value = 'compare-sample-variant';
  }

  document.querySelectorAll('[data-video-slot]').forEach(slot => {
    const video = slot.querySelector('video');
    const play = slot.querySelector('[data-video-play]');
    const error = slot.querySelector('.video-error');
    if (!video || !play) return;
    play.hidden = false;
    play.addEventListener('click', async () => {
      try {
        await video.play();
        play.hidden = true;
        error.hidden = true;
        video.focus();
      } catch {
        error.hidden = false;
      }
    });
    video.addEventListener('play', () => { play.hidden = true; });
    video.addEventListener('ended', () => { play.hidden = false; });
    video.addEventListener('error', () => {
      error.hidden = false;
      play.hidden = true;
    });
  });

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

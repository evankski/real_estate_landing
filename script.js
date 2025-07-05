document.getElementById('contactForm').addEventListener('submit', function (e) {
  e.preventDefault();

  alert('Thanks for reaching out! I’ll be in touch shortly.');

  // Reset form after submission
  this.reset();
});

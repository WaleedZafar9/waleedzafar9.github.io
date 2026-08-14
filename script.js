// Reveal elements as they enter the viewport
const revealTargets = document.querySelectorAll('.node, .reveal, .feature-card, .stats-strip, .about-grid, .stack-grid, .contact-links');
const pipelinePath = document.querySelector('.pipeline-line path');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    }
  });
}, { threshold: 0.25 });

revealTargets.forEach((node) => revealObserver.observe(node));

// Draw the pipeline connector line as the user scrolls through the work section
function updatePipelineDraw() {
  const pipeline = document.querySelector('.pipeline');
  if (!pipeline || !pipelinePath) return;

  const rect = pipeline.getBoundingClientRect();
  const viewportH = window.innerHeight;

  const total = rect.height + viewportH;
  const scrolled = viewportH - rect.top;
  const progress = Math.min(Math.max(scrolled / total, 0), 1);

  const length = pipelinePath.getTotalLength();
  pipelinePath.style.strokeDasharray = length;
  pipelinePath.style.strokeDashoffset = length * (1 - progress);
  pipelinePath.classList.toggle('drawn', progress > 0.02);
}

window.addEventListener('scroll', updatePipelineDraw, { passive: true });
window.addEventListener('resize', updatePipelineDraw);
window.addEventListener('load', updatePipelineDraw);

// Active nav link highlight on scroll
const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const id = entry.target.getAttribute('id');
    const link = document.querySelector(`.nav-links a[href="#${id}"]`);
    if (!link) return;
    if (entry.isIntersecting) {
      navLinks.forEach((l) => l.style.color = '');
      link.style.color = 'var(--indigo)';
    }
  });
}, { rootMargin: '-40% 0px -50% 0px' });

sections.forEach((s) => navObserver.observe(s));

// Spotlight glow that follows the cursor on project cards
const spotlightCards = document.querySelectorAll('.node-card');
spotlightCards.forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  });
});

// Testimonial carousel
const track = document.querySelector('.carousel-track');
const cards = document.querySelectorAll('.testimonial-card');
const dotsWrap = document.querySelector('.carousel-dots');
const prevBtn = document.querySelector('.carousel-btn[data-dir="-1"]');
const nextBtn = document.querySelector('.carousel-btn[data-dir="1"]');
let current = 0;

if (track && cards.length) {
  cards.forEach((_, i) => {
    const dot = document.createElement('span');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  function goTo(index) {
    current = (index + cards.length) % cards.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    document.querySelectorAll('.carousel-dots span').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));
}

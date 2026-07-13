// Reveal pipeline nodes as they enter the viewport
const nodes = document.querySelectorAll('.node');
const pipelinePath = document.querySelector('.pipeline-line path');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    }
  });
}, { threshold: 0.3 });

nodes.forEach((node) => revealObserver.observe(node));

// Draw the pipeline connector line as the user scrolls through the work section
function updatePipelineDraw() {
  const pipeline = document.querySelector('.pipeline');
  if (!pipeline || !pipelinePath) return;

  const rect = pipeline.getBoundingClientRect();
  const viewportH = window.innerHeight;

  // progress from 0 (top of pipeline entering view) to 1 (bottom of pipeline passed)
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

// Active nav link highlight on scroll (subtle, optional enhancement)
const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const id = entry.target.getAttribute('id');
    const link = document.querySelector(`.nav-links a[href="#${id}"]`);
    if (!link) return;
    if (entry.isIntersecting) {
      navLinks.forEach((l) => l.style.color = '');
      link.style.color = 'var(--signal)';
    }
  });
}, { rootMargin: '-40% 0px -50% 0px' });

sections.forEach((s) => navObserver.observe(s));
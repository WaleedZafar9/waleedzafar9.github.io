/* =========================================================
   THEME TOGGLE
========================================================= */
const themeToggle = document.getElementById('themeToggle');

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
});

/* =========================================================
   SCROLL PROGRESS BAR
========================================================= */
const scrollProgress = document.getElementById('scrollProgress');
function updateScrollProgress() {
  const h = document.documentElement;
  const scrolled = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
  if (scrollProgress) scrollProgress.style.width = scrolled + '%';
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });

/* =========================================================
   BACK TO TOP BUTTON
========================================================= */
const backToTop = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
  if (backToTop) backToTop.classList.toggle('visible', window.scrollY > 600);
}, { passive: true });
if (backToTop) {
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* =========================================================
   REVEAL ON SCROLL (feature cards, pipeline nodes, sections)
========================================================= */
const revealTargets = document.querySelectorAll('.node, .reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    }
  });
}, { threshold: 0.3 });
revealTargets.forEach((el) => revealObserver.observe(el));

/* =========================================================
   PIPELINE LINE DRAW ON SCROLL
========================================================= */
const pipelinePath = document.querySelector('.pipeline-line path');
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

/* =========================================================
   ACTIVE NAV LINK ON SCROLL
========================================================= */
const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const id = entry.target.getAttribute('id');
    const link = document.querySelector(`.nav-links a[href="#${id}"]`);
    if (!link) return;
    if (entry.isIntersecting) {
      navLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
    }
  });
}, { rootMargin: '-40% 0px -50% 0px' });

sections.forEach((s) => navObserver.observe(s));

/* =========================================================
   CARD SPOTLIGHT + TILT ON HOVER (project cards)
========================================================= */
const spotlightCards = document.querySelectorAll('.node-card');

spotlightCards.forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    card.style.setProperty('--mouse-x', `${x * 100}%`);
    card.style.setProperty('--mouse-y', `${y * 100}%`);

    const tiltX = (y - 0.5) * -6;
    const tiltY = (x - 0.5) * 6;
    card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
  });
});

/* =========================================================
   COPY EMAIL ON CLICK
========================================================= */
const emailLink = document.getElementById('emailLink');
if (emailLink) {
  emailLink.addEventListener('click', (e) => {
    e.preventDefault();
    const email = emailLink.dataset.email;
    const valueEl = emailLink.querySelector('.contact-value');
    const original = valueEl.textContent;

    navigator.clipboard.writeText(email).then(() => {
      valueEl.textContent = 'Copied!';
      setTimeout(() => { valueEl.textContent = original; }, 1500);
    }).catch(() => {
      // fallback: just open mail client if clipboard fails
      window.location.href = `mailto:${email}`;
    });
  });
}

/* =========================================================
   TYPING ANIMATION — HERO TERMINAL
========================================================= */
function typeTerminal() {
  const lines = document.querySelectorAll('.type-line');
  const cursor = document.querySelector('.cursor');
  let lineIndex = 0;

  function typeNextLine() {
    if (lineIndex >= lines.length) {
      if (cursor) cursor.classList.add('show');
      return;
    }
    const el = lines[lineIndex];
    const text = el.dataset.text;
    let charIndex = 0;

    function typeChar() {
      if (charIndex <= text.length) {
        el.textContent = text.slice(0, charIndex);
        charIndex++;
        setTimeout(typeChar, 22);
      } else {
        lineIndex++;
        setTimeout(typeNextLine, 220);
      }
    }
    typeChar();
  }
  typeNextLine();
}
window.addEventListener('load', () => {
  setTimeout(typeTerminal, 300);
});

/* =========================================================
   TESTIMONIAL CAROUSEL
========================================================= */
const track = document.querySelector('.carousel-track');
const cards = document.querySelectorAll('.testimonial-card');
const dotsWrap = document.querySelector('.carousel-dots');
const carouselBtns = document.querySelectorAll('.carousel-btn');
let currentSlide = 0;

if (track && cards.length) {
  cards.forEach((_, i) => {
    const dot = document.createElement('span');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    dotsWrap.appendChild(dot);
  });

  function goToSlide(index) {
    currentSlide = (index + cards.length) % cards.length;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    document.querySelectorAll('.carousel-dots span').forEach((d, i) => {
      d.classList.toggle('active', i === currentSlide);
    });
  }

  carouselBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.dir, 10);
      goToSlide(currentSlide + dir);
    });
  });
}

/* =========================================================
   SECTION PROGRESS RAIL — active state on scroll
========================================================= */
const railLinks = document.querySelectorAll('.section-rail a');
if (railLinks.length) {
  const railSections = Array.from(railLinks).map((l) => document.getElementById(l.dataset.target)).filter(Boolean);

  const railObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = document.querySelector(`.section-rail a[data-target="${entry.target.id}"]`);
      if (!link) return;
      if (entry.isIntersecting) {
        railLinks.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px' });

  railSections.forEach((s) => railObserver.observe(s));
}

/* =========================================================
   MAGNETIC BUTTONS — pull toward cursor on hover
========================================================= */
const magneticEls = document.querySelectorAll('.btn-primary, .btn-ghost, .theme-toggle');

magneticEls.forEach((el) => {
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'translate(0, 0)';
  });
});

/* =========================================================
   COMMAND PALETTE
========================================================= */
const cmdkOverlay = document.getElementById('cmdkOverlay');
const cmdkInput = document.getElementById('cmdkInput');
const cmdkList = document.getElementById('cmdkList');
const cmdkTrigger = document.getElementById('cmdkTrigger');
let cmdkItems = [];
let cmdkActiveIndex = 0;

function refreshCmdkItems() {
  cmdkItems = Array.from(cmdkList.querySelectorAll('li')).filter((li) => !li.classList.contains('hidden'));
}

function setCmdkActive(index) {
  cmdkItems.forEach((li) => li.classList.remove('active'));
  if (!cmdkItems.length) return;
  cmdkActiveIndex = (index + cmdkItems.length) % cmdkItems.length;
  cmdkItems[cmdkActiveIndex].classList.add('active');
  cmdkItems[cmdkActiveIndex].scrollIntoView({ block: 'nearest' });
}

function openCmdk() {
  cmdkOverlay.classList.add('open');
  cmdkInput.value = '';
  cmdkList.querySelectorAll('li').forEach((li) => li.classList.remove('hidden'));
  refreshCmdkItems();
  setCmdkActive(0);
  setTimeout(() => cmdkInput.focus(), 50);
}

function closeCmdk() {
  cmdkOverlay.classList.remove('open');
}

function runCmdkAction(li) {
  const action = li.dataset.action;
  const target = li.dataset.target;

  if (action === 'scroll') {
    document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
  } else if (action === 'theme') {
    themeToggle.click();
  } else if (action === 'copy-email') {
    emailLink?.click();
  } else if (action === 'link') {
    if (target.startsWith('mailto:')) {
      window.location.href = target;
    } else {
      window.open(target, '_blank', 'noopener');
    }
  }
  closeCmdk();
}

if (cmdkTrigger) {
  cmdkTrigger.addEventListener('click', openCmdk);
}

document.addEventListener('keydown', (e) => {
  const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (e.key === '/' && !isTyping) {
    e.preventDefault();
    openCmdk();
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCmdk();
  } else if (e.key === 'Escape' && cmdkOverlay.classList.contains('open')) {
    closeCmdk();
  } else if (cmdkOverlay.classList.contains('open')) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCmdkActive(cmdkActiveIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCmdkActive(cmdkActiveIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cmdkItems[cmdkActiveIndex]) runCmdkAction(cmdkItems[cmdkActiveIndex]);
    }
  }
});

if (cmdkOverlay) {
  cmdkOverlay.addEventListener('click', (e) => {
    if (e.target === cmdkOverlay) closeCmdk();
  });
}

if (cmdkInput) {
  cmdkInput.addEventListener('input', () => {
    const query = cmdkInput.value.toLowerCase();
    cmdkList.querySelectorAll('li').forEach((li) => {
      const text = li.textContent.toLowerCase();
      li.classList.toggle('hidden', !text.includes(query));
    });
    refreshCmdkItems();
    setCmdkActive(0);
  });
}

if (cmdkList) {
  cmdkList.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => runCmdkAction(li));
    li.addEventListener('mouseenter', () => {
      refreshCmdkItems();
      setCmdkActive(cmdkItems.indexOf(li));
    });
  });
}

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
   REDUCED MOTION CHECK — gate the new motion additions
========================================================= */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
   — CSS now animates filter:blur() alongside opacity/transform,
   this logic is unchanged, it just toggles the class.
========================================================= */
const revealTargets = document.querySelectorAll('.node, .reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      if (entry.target.classList.contains('stats-strip')) {
        runStatsCountUp(entry.target);
      }
    }
  });
}, { threshold: 0.3 });
revealTargets.forEach((el) => revealObserver.observe(el));

/* =========================================================
   COUNT-UP STATS — parses the existing "3+", "5+", "100%", "∞"
   text so no HTML changes are required. Runs once per element.
========================================================= */
function runStatsCountUp(scope) {
  const valueEls = scope.querySelectorAll('.stat-value');
  valueEls.forEach((el) => {
    if (el.dataset.counted === 'true') return;
    el.dataset.counted = 'true';

    const raw = el.textContent.trim();
    const match = raw.match(/^(\d+)(.*)$/); // leading integer + trailing suffix (+, %, etc.)

    if (!match || prefersReducedMotion) {
      // No leading number (e.g. "∞") or reduced motion — leave as-is.
      return;
    }

    const target = parseInt(match[1], 10);
    const suffix = match[2] || '';
    const duration = 1100;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(target * eased);
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target + suffix;
    }
    requestAnimationFrame(tick);
  });
}

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
   ACTIVE NAV LINK ON SCROLL + SLIDING INDICATOR
========================================================= */
const sections = document.querySelectorAll('main section[id]');
const navLinksWrap = document.querySelector('.nav-links');
const navLinks = document.querySelectorAll('.nav-links a');

function positionNavIndicator(link) {
  if (!navLinksWrap || !link) return;
  const wrapRect = navLinksWrap.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  navLinksWrap.style.setProperty('--ind-x', `${linkRect.left - wrapRect.left}px`);
  navLinksWrap.style.setProperty('--ind-w', `${linkRect.width}px`);
  navLinksWrap.style.setProperty('--ind-o', '1');
}

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const id = entry.target.getAttribute('id');
    const link = document.querySelector(`.nav-links a[href="#${id}"]`);
    if (!link) return;
    if (entry.isIntersecting) {
      navLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      positionNavIndicator(link);
    }
  });
}, { rootMargin: '-40% 0px -50% 0px' });

sections.forEach((s) => navObserver.observe(s));

window.addEventListener('resize', () => {
  const active = document.querySelector('.nav-links a.active');
  if (active) positionNavIndicator(active);
});

/* =========================================================
   CARD SPOTLIGHT + TILT ON HOVER (project cards)
   — drives --mouse-x/--mouse-y (glow) and --tilt-x/--tilt-y
   (rotation) so CSS owns the transform + transition.
========================================================= */
const spotlightCards = document.querySelectorAll('.node-card');

spotlightCards.forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    card.style.setProperty('--mouse-x', `${x * 100}%`);
    card.style.setProperty('--mouse-y', `${y * 100}%`);

    if (prefersReducedMotion) return;
    const tiltX = (y - 0.5) * -6;
    const tiltY = (x - 0.5) * 6;
    card.style.setProperty('--tilt-x', `${tiltX}deg`);
    card.style.setProperty('--tilt-y', `${tiltY}deg`);
  });

  card.addEventListener('mouseleave', () => {
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
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

/* =========================================================
   HERO ENTRANCE ORCHESTRATION
   Adds .hero-run once, right before the terminal starts typing,
   so the staggered copy/terminal fade-blur-in plays on load.
========================================================= */
function runHeroEntrance() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  if (prefersReducedMotion) {
    hero.classList.add('hero-run');
    return;
  }
  requestAnimationFrame(() => hero.classList.add('hero-run'));
}

window.addEventListener('load', () => {
  runHeroEntrance();
  updatePipelineDraw();
  setTimeout(typeTerminal, 300);
  const active = document.querySelector('.nav-links a.active') || navLinks[0];
  if (active) {
    active.classList.add('active');
    positionNavIndicator(active);
  }
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
   Sets --mx/--my; CSS (transform:translate(var(--mx),var(--my)))
   owns the actual transform so it composes cleanly with each
   element's other states (e.g. theme-toggle's :active rotate).
========================================================= */
const magneticEls = document.querySelectorAll('.btn-primary, .btn-ghost, .theme-toggle, .cmdk-trigger');

if (!prefersReducedMotion) {
  magneticEls.forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.setProperty('--mx', `${x * 0.25}px`);
      el.style.setProperty('--my', `${y * 0.25}px`);
    });
    el.addEventListener('mouseleave', () => {
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    });
  });
}

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
  } else if (action === 'open-ask-ai') {
    openAskAiSidebar();
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
/* =========================================================
   ASK AI — floating sidebar toggle
========================================================= */
const askAiFab = document.getElementById('askAiFab');
const askAiFabLabel = document.getElementById('askAiFabLabel');
const askAiSidebar = document.getElementById('askAiSidebar');
const askAiBackdrop = document.getElementById('askAiBackdrop');
const askAiCloseBtn = document.getElementById('askAiClose');

function openAskAiSidebar() {
  askAiSidebar.classList.add('open');
  askAiBackdrop.classList.add('open');
  askAiFab.classList.add('open');
  askAiSidebar.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  askAiFabLabel?.classList.remove('show');
  setTimeout(() => document.getElementById('askAiInput')?.focus(), 320);
}

function closeAskAiSidebar() {
  askAiSidebar.classList.remove('open');
  askAiBackdrop.classList.remove('open');
  askAiFab.classList.remove('open');
  askAiSidebar.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function toggleAskAiSidebar() {
  askAiSidebar.classList.contains('open') ? closeAskAiSidebar() : openAskAiSidebar();
}

askAiFab?.addEventListener('click', toggleAskAiSidebar);
askAiCloseBtn?.addEventListener('click', closeAskAiSidebar);
askAiBackdrop?.addEventListener('click', closeAskAiSidebar);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && askAiSidebar?.classList.contains('open')) {
    closeAskAiSidebar();
  }
});

document.querySelectorAll('.js-open-ask-ai').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    openAskAiSidebar();
  });
});

window.addEventListener('load', () => {
  setTimeout(() => {
    askAiFabLabel?.classList.add('show');
    setTimeout(() => askAiFabLabel?.classList.remove('show'), 4000);
  }, 1800);
});
/* =========================================================
   ASK AI — chat widget
   Change WORKER_URL to your deployed Cloudflare Worker URL.
========================================================= */
const WORKER_URL = 'https://ask-waleed-ai.waleedzafar.workers.dev';
const askAiForm = document.getElementById('askAiForm');
const askAiInput = document.getElementById('askAiInput');
const askAiSend = document.getElementById('askAiSend');
const askAiMessages = document.getElementById('askAiMessages');
const askAiSuggestions = document.getElementById('askAiSuggestions');

let askAiHistory = [];
let askAiBusy = false;

function askAiAppendMessage(role, text, extraClass = '') {
  const wrap = document.createElement('div');
  wrap.className = `ask-ai-msg ask-ai-msg-${role} ${extraClass}`.trim();

  const avatar = document.createElement('span');
  avatar.className = `ask-ai-avatar ask-ai-avatar-${role}`;
  avatar.textContent = role === 'bot' ? 'AI' : 'You';

  const p = document.createElement('p');
  p.textContent = text;

  wrap.appendChild(avatar);
  wrap.appendChild(p);
  askAiMessages.appendChild(wrap);
  askAiMessages.scrollTop = askAiMessages.scrollHeight;
  return wrap;
}

function askAiAppendLoading() {
  const wrap = document.createElement('div');
  wrap.className = 'ask-ai-msg ask-ai-msg-bot ask-ai-msg-loading';
  wrap.innerHTML = `
    <span class="ask-ai-avatar ask-ai-avatar-bot">AI</span>
    <p><span class="ask-ai-dot"></span><span class="ask-ai-dot"></span><span class="ask-ai-dot"></span></p>
  `;
  askAiMessages.appendChild(wrap);
  askAiMessages.scrollTop = askAiMessages.scrollHeight;
  return wrap;
}

function askAiSetBusy(busy) {
  askAiBusy = busy;
  askAiInput.disabled = busy;
  askAiSend.disabled = busy;
  askAiSuggestions?.querySelectorAll('.ask-ai-chip').forEach((chip) => {
    chip.disabled = busy;
  });
}

async function askAiSendMessage(message) {
  if (!message || askAiBusy) return;

  askAiAppendMessage('user', message);
  askAiHistory.push({ role: 'user', content: message });
  askAiSetBusy(true);

  const loadingEl = askAiAppendLoading();

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: askAiHistory.slice(-6),
      }),
    });

    const data = await res.json();
    loadingEl.remove();

    if (!res.ok || data.error) {
      askAiAppendMessage('bot', "Sorry, I couldn't reach the AI just now. Please try again in a moment, or email waleedzafar161@gmail.com directly.", 'ask-ai-error');
      return;
    }

    askAiAppendMessage('bot', data.reply);
    askAiHistory.push({ role: 'assistant', content: data.reply });
  } catch (err) {
    loadingEl.remove();
    askAiAppendMessage('bot', "Something went wrong connecting to the AI. Please try again shortly.", 'ask-ai-error');
  } finally {
    askAiSetBusy(false);
    askAiInput.focus();
  }
}

if (askAiForm) {
  askAiForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = askAiInput.value.trim();
    if (!message) return;
    askAiInput.value = '';
    askAiSendMessage(message);
  });
}

if (askAiSuggestions) {
  askAiSuggestions.querySelectorAll('.ask-ai-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const question = chip.textContent;
      askAiSendMessage(question);
      askAiSuggestions.style.display = 'none';
    });
  });
}
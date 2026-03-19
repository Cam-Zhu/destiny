// ── State ──────────────────────────────────────────────────
let currentUser = null;   // { email, credits_remaining }

// ── Boot ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('destiny_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showForm();
    } catch { localStorage.removeItem('destiny_user'); }
  }

  // Handle Stripe redirect
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    history.replaceState({}, '', '/');
    refreshCredits().then(() => showView('success-view'));
  }
});

// ── View helpers ────────────────────────────────────────────
const VIEWS = ['auth-view','form-view','paywall-view','loading-view','reading-view','success-view'];

function showView(id) {
  VIEWS.forEach(v => document.getElementById(v).style.display = 'none');
  document.getElementById(id).style.display = 'block';
}

function showForm() {
  updateCreditsDisplay();
  showView('form-view');
  document.getElementById('user-email-display').textContent = currentUser?.email || '';
}

function logout() {
  localStorage.removeItem('destiny_user');
  currentUser = null;
  showView('auth-view');
}

function updateCreditsDisplay() {
  if (!currentUser) return;
  const c = currentUser.credits_remaining;
  const text = c === 1 ? '1 reading left' : `${c} readings left`;
  document.getElementById('credits-display').textContent = text;
  const d2 = document.getElementById('credits-display-2');
  if (d2) d2.textContent = text;
}

// ── Auth ────────────────────────────────────────────────────
async function handleAuth() {
  const email = document.getElementById('inp-email').value.trim();
  const errEl = document.getElementById('auth-error');
  errEl.style.display = 'none';

  if (!email || !email.includes('@')) {
    errEl.textContent = 'Please enter a valid email address.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Auth failed');

    currentUser = { email, credits_remaining: data.credits_remaining };
    localStorage.setItem('destiny_user', JSON.stringify(currentUser));
    showForm();
  } catch (e) {
    errEl.textContent = e.message || 'Something went wrong. Please try again.';
    errEl.style.display = 'block';
  }
}

// ── Refresh credits from server ─────────────────────────────
async function refreshCredits() {
  if (!currentUser) return;
  try {
    const res = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser.credits_remaining = data.credits_remaining;
      localStorage.setItem('destiny_user', JSON.stringify(currentUser));
      updateCreditsDisplay();
    }
  } catch {}
}

// ── Reading ─────────────────────────────────────────────────
async function getReading() {
  const name     = document.getElementById('inp-name').value.trim();
  const day      = parseInt(document.getElementById('inp-day').value);
  const month    = parseInt(document.getElementById('inp-month').value);
  const year     = parseInt(document.getElementById('inp-year').value);
  const hourRaw  = document.getElementById('inp-hour').value;
  const hour     = hourRaw !== '' ? parseInt(hourRaw) : null;
  const focus    = document.getElementById('inp-focus').value;
  const question = document.getElementById('inp-question').value.trim();

  const errEl = document.getElementById('form-error');
  errEl.style.display = 'none';

  if (!name) { errEl.textContent = 'Please enter your name.'; errEl.style.display = 'block'; return; }
  if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2025) {
    errEl.textContent = 'Please enter a valid date of birth.'; errEl.style.display = 'block'; return;
  }

  if (currentUser.credits_remaining <= 0) {
    showView('paywall-view'); return;
  }

  showView('loading-view');

  const chart = buildChart(day, month, year, hour);

  try {
    const res = await fetch('/.netlify/functions/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email, name, day, month, year, hour, focus, question, chart })
    });

    const data = await res.json();

    if (res.status === 402) {
      showView('paywall-view'); return;
    }

    if (!res.ok) throw new Error(data.error || 'Reading failed');

    currentUser.credits_remaining = data.credits_remaining;
    localStorage.setItem('destiny_user', JSON.stringify(currentUser));

    renderReading(chart, data.reading, focus, question);
  } catch (e) {
    showForm();
    document.getElementById('form-error').textContent = e.message || 'Something went wrong. Please try again.';
    document.getElementById('form-error').style.display = 'block';
  }
}

// ── Render ──────────────────────────────────────────────────
function renderReading(chart, readingText, focus, question) {
  document.getElementById('res-emoji').textContent   = chart.year.emoji;
  document.getElementById('res-sign').textContent    = chart.year.animal;
  document.getElementById('res-chinese').textContent = chart.year.animalCN;
  document.getElementById('res-element').textContent = `${chart.year.element} ${chart.year.animal} · ${chart.year.polarity}`;

  const pillars = [
    { label: 'Year',  cn: chart.year.stem + chart.year.branch,  val: `${chart.year.element} ${chart.year.animal}` },
    { label: 'Month', cn: chart.month.branch,                    val: chart.month.animal },
    { label: 'Day',   cn: chart.day.stem + chart.day.branch,     val: chart.day.element },
    { label: 'Hour',  cn: chart.hour ? chart.hour.branch : '—',  val: chart.hour ? chart.hour.animal : 'Unknown' }
  ];

  document.getElementById('pillars-grid').innerHTML = pillars.map(p => `
    <div class="pillar-card">
      <span class="pillar-label">${p.label}</span>
      <span class="pillar-chinese">${p.cn}</span>
      <div class="pillar-value">${p.val}</div>
    </div>`).join('');

  // Show focus area and question if provided
  const focusEl = document.getElementById('res-focus');
  if (focusEl) {
    focusEl.textContent = focus || 'General Destiny';
  }
  const questionEl = document.getElementById('res-question');
  if (questionEl) {
    questionEl.style.display = question ? 'block' : 'none';
    questionEl.textContent = question ? `"${question}"` : '';
  }

  const paras = readingText.split('\n').filter(s => s.trim());
  document.getElementById('reading-body').innerHTML = paras
    .map((p, i) => `<p${i === 0 ? ' class="drop-cap"' : ''}>${p}</p>`)
    .join('');

  updateCreditsDisplay();
  showView('reading-view');
}

// ── Stripe checkout ─────────────────────────────────────────
async function startCheckout() {
  try {
    const res = await fetch('/.netlify/functions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Checkout failed');
    window.location.href = data.url;
  } catch (e) {
    alert('Could not start checkout. Please try again.');
  }
}

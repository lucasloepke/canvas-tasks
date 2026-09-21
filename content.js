/* Simple Canvas Tasks
 * Replaces the Canvas "To Do" sidebar with a tabbed widget:
 *   Assignments (default) | Announcements | Calendar
 * Works on the dashboard (all courses) and on course pages (that class only).
 * Grades pages are left alone — their sidebar shows total grades.
 * Each assignment shows a live "x hours and x minutes until due" countdown.
 */
(function () {
  'use strict';

  const WIDGET_ID = 'ctp-widget';

  // The extension runs on all https sites, so first make sure this is actually
  // a Canvas page, then that it's a screen where we should replace the sidebar
  // (dashboard, or a course page — but never the grades page, which uses the
  // right sidebar for total grades).
  function isCanvas() {
    return !!(
      document.querySelector('#application.ic-app') ||
      document.querySelector('body.ic-app') ||
      document.querySelector('div.ic-app') ||
      document.querySelector('meta[name="csrf-token"][content]') &&
        document.getElementById('right-side')
    );
  }

  function isDashboard() {
    if (document.querySelector('#dashboard.ic-dashboard-app')) return true;
    // Fallback: a Canvas home page with the standard sidebar container.
    return (
      isCanvas() &&
      location.pathname === '/' &&
      !!document.getElementById('right-side')
    );
  }

  // Grades pages use #right-side for the total-grade summary — leave them alone.
  function isGradesPage() {
    return /\/courses\/\d+\/grades(?:\/|$|\?)/.test(location.pathname);
  }

  // Course id when viewing a class (e.g. /courses/384611 or /courses/384611/modules).
  function getCourseIdFromPath() {
    const m = location.pathname.match(/^\/courses\/(\d+)(?:\/|$)/);
    return m ? m[1] : null;
  }

  function shouldRun() {
    if (!isCanvas() || isGradesPage()) return false;
    if (isDashboard()) return true;
    // Course pages (widget only mounts once #right-side exists).
    return !!getCourseIdFromPath();
  }

  if (!shouldRun()) return;

  // ---- state ----
  const state = {
    assignments: [],
    announcements: [],
    calendar: [],
    customTasks: [], // user-created tasks, persisted locally
    courses: [], // [{ id, name }] in dashboard order, for the add-task picker
    courseFilter: getCourseIdFromPath(), // null on dashboard; course id when scoped
    activeTab: 'assignments',
    timePeriod: 'week',
    defaultTab: 'assignments', // tab shown when the widget first loads
    showOverdue: true, // include past-due assignments in the list
    loading: true,
    error: null,
    feedbackSynced: false,
  };

  // Time-period options for the assignments list, in days.
  const PERIODS = [
    ['day', 'Day', 1],
    ['week', 'Week', 7],
    ['2weeks', '2 Weeks', 14],
    ['month', 'Month', 30],
  ];

  let widget = null;
  let countdownInterval = null;
  let doneKeys = new Set();
  let courseColors = {}; // e.g. { course_123: "#E1185C" }

  // ---------------------------------------------------------------------------
  // "Mark as done" persistence (locally, via chrome.storage)
  // ---------------------------------------------------------------------------
  function loadDone() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['sctDone'], (res) => {
          resolve(new Set((res && res.sctDone) || []));
        });
      } catch (e) {
        resolve(new Set());
      }
    });
  }

  function saveDone() {
    try {
      chrome.storage.local.set({ sctDone: Array.from(doneKeys) });
    } catch (e) {
      /* no-op */
    }
  }

  // Clear every "Mark as done" flag and re-fetch so hidden items reappear.
  function resetDone() {
    doneKeys = new Set();
    saveDone();
    loadData()
      .catch(() => {
        /* keep whatever we have if the refetch fails */
      })
      .finally(() => {
        updateTabs();
        renderBody();
      });
  }

  // Fire a small confetti burst from a screen coordinate to celebrate a task
  // being marked as done. Pure CSS/DOM — no external libraries.
  function throwConfetti(x, y) {
    const colors = ['#f94144', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590', '#9b5de5'];
    const count = 24;
    const container = document.createElement('div');
    container.className = 'ctp-confetti';
    container.style.left = x + 'px';
    container.style.top = y + 'px';

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = 'ctp-confetti-piece';
      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 70;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - (30 + Math.random() * 40);
      piece.style.setProperty('--dx', dx.toFixed(1) + 'px');
      piece.style.setProperty('--dy', dy.toFixed(1) + 'px');
      piece.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 60).toFixed(0) + 'ms';
      container.appendChild(piece);
    }

    document.body.appendChild(container);
    setTimeout(() => container.remove(), 1100);
  }

  function markDone(id) {
    if (!id) return;
    doneKeys.add(id);
    saveDone();
    state.assignments = state.assignments.filter((a) => a.id !== id);
    // Custom tasks are stored separately; drop them from that store too so
    // they don't reappear on the next load.
    if (id.startsWith('custom:')) {
      state.customTasks = state.customTasks.filter((t) => t.id !== id);
      saveCustomTasks();
    }
    updateTabs();
    renderBody();
  }

  // ---------------------------------------------------------------------------
  // Custom (user-created) tasks — persisted locally via chrome.storage
  // ---------------------------------------------------------------------------
  function loadCustomTasks() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['sctCustom'], (res) => {
          resolve((res && Array.isArray(res.sctCustom) && res.sctCustom) || []);
        });
      } catch (e) {
        resolve([]);
      }
    });
  }

  function saveCustomTasks() {
    try {
      chrome.storage.local.set({ sctCustom: state.customTasks });
    } catch (e) {
      /* no-op */
    }
  }

  // Merge stored custom tasks into the assignments list (skipping ones already
  // marked done) and re-sort by due date. When scoped to a course, only include
  // tasks that belong to that course.
  function injectCustomTasks() {
    let active = state.customTasks.filter((t) => !doneKeys.has(t.id));
    if (state.courseFilter) {
      active = active.filter(
        (t) => t.courseId != null && String(t.courseId) === String(state.courseFilter)
      );
    }
    // Refresh each task's tint in case colors loaded after it was created.
    for (const t of active) {
      if (t.courseId != null) {
        t.color = courseColors['course_' + t.courseId] || t.color || null;
      }
    }
    state.assignments = state.assignments.concat(active);
    state.assignments.sort((a, b) => dateVal(a.date) - dateVal(b.date));
  }

  function addCustomTask({ title, courseId, due }) {
    const course = state.courses.find((c) => String(c.id) === String(courseId));
    const task = {
      id: 'custom:' + Date.now(),
      type: 'custom',
      title: title,
      course: course ? course.name : '',
      courseId: course ? course.id : null,
      url: null,
      date: due || null,
      points: null,
      color: course ? courseColors['course_' + course.id] || null : null,
      custom: true,
    };
    state.customTasks.push(task);
    saveCustomTasks();
    state.assignments.push(task);
    state.assignments.sort((a, b) => dateVal(a.date) - dateVal(b.date));
    updateTabs();
    renderBody();
  }

  // ---------------------------------------------------------------------------
  // Time-period preference (how far ahead the assignments list looks)
  // ---------------------------------------------------------------------------
  function loadPeriod() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['sctPeriod'], (res) => {
          resolve((res && res.sctPeriod) || 'week');
        });
      } catch (e) {
        resolve('week');
      }
    });
  }

  function savePeriod() {
    try {
      chrome.storage.local.set({ sctPeriod: state.timePeriod });
    } catch (e) {
      /* no-op */
    }
  }

  // General preferences (default tab + overdue visibility), persisted locally.
  function loadPrefs() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['sctDefaultTab', 'sctShowOverdue'], (res) => {
          resolve({
            defaultTab: (res && res.sctDefaultTab) || 'assignments',
            showOverdue:
              !res || res.sctShowOverdue === undefined
                ? true
                : !!res.sctShowOverdue,
          });
        });
      } catch (e) {
        resolve({ defaultTab: 'assignments', showOverdue: true });
      }
    });
  }

  function savePrefs() {
    try {
      chrome.storage.local.set({
        sctDefaultTab: state.defaultTab,
        sctShowOverdue: state.showOverdue,
      });
    } catch (e) {
      /* no-op */
    }
  }

  function periodDays() {
    const found = PERIODS.find((p) => p[0] === state.timePeriod);
    return found ? found[2] : 7;
  }

  function setPeriod(key) {
    state.timePeriod = key;
    savePeriod();
    updatePeriodMenu();
    renderBody();
  }

  // Assignments due within the selected window. Undated items are always kept
  // so nothing important silently disappears; overdue items are kept unless the
  // user has turned them off in settings.
  function visibleAssignments() {
    const now = Date.now();
    const cutoff = now + periodDays() * 86400000;
    return state.assignments.filter((a) => {
      if (!a.date) return true;
      const t = new Date(a.date).getTime();
      if (isNaN(t)) return true;
      if (!state.showOverdue && t < now) return false;
      return t <= cutoff;
    });
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function fetchPage(url) {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json+canvas-string-ids, application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' fetching ' + url);
    let text = await res.text();
    // Canvas guards some JSON responses with a "while(1);" prefix.
    if (text.startsWith('while(1);')) text = text.slice('while(1);'.length);
    const data = JSON.parse(text);

    // Parse Link header for pagination.
    let next = null;
    const link = res.headers.get('Link');
    if (link) {
      for (const part of link.split(',')) {
        if (part.includes('rel="next"')) {
          const m = part.match(/<([^>]+)>/);
          if (m) next = m[1];
        }
      }
    }
    return { data, next };
  }

  async function fetchAll(startUrl, maxPages) {
    let url = startUrl;
    let out = [];
    let pages = 0;
    while (url && pages < (maxPages || 6)) {
      const { data, next } = await fetchPage(url);
      if (Array.isArray(data)) out = out.concat(data);
      url = next;
      pages++;
    }
    return out;
  }

  function isoDaysFromNow(days) {
    return new Date(Date.now() + days * 86400000).toISOString();
  }

  async function loadColors() {
    try {
      const { data } = await fetchPage('/api/v1/users/self/colors');
      courseColors = (data && data.custom_colors) || {};
    } catch (e) {
      courseColors = {};
    }
  }

  // Load the user's courses in the same order they appear on the dashboard.
  // The dashboard-cards endpoint returns them pre-ordered ("position"), which
  // is exactly the ordering shown on the Canvas home page.
  async function loadCourses() {
    try {
      const { data } = await fetchPage('/api/v1/dashboard/dashboard_cards');
      if (Array.isArray(data)) {
        state.courses = data
          .slice()
          .sort((a, b) => {
            const pa = a.position == null ? 9999 : a.position;
            const pb = b.position == null ? 9999 : b.position;
            return pa - pb;
          })
          .map((c) => ({
            id: c.id,
            name: c.shortName || c.originalName || c.courseCode || 'Course',
          }));
      }
    } catch (e) {
      state.courses = [];
    }
  }

  async function loadData() {
    // Load the dashboard course colors + course list first so items can be
    // tinted and the add-task picker is populated.
    await loadColors();
    await loadCourses();

    // The Planner API returns assignments, quizzes, discussions, announcements,
    // and calendar events with dates in one place. On a course page, scope the
    // request to that course so the sidebar matches the class you're viewing.
    const start = encodeURIComponent(isoDaysFromNow(-21)); // catch recent announcements
    const end = encodeURIComponent(isoDaysFromNow(120));
    let url =
      '/api/v1/planner/items?start_date=' +
      start +
      '&end_date=' +
      end +
      '&per_page=50';
    if (state.courseFilter) {
      url += '&context_codes[]=course_' + encodeURIComponent(state.courseFilter);
    }
    const raw = await fetchAll(url, 6);
    categorize(raw);
  }

  const ASSIGNMENT_TYPES = [
    'assignment',
    'quiz',
    'discussion_topic',
    'wiki_page',
    'sub_assignment',
    'planner_note',
    'assessment_request',
  ];

  function categorize(raw) {
    const assignments = [];
    const announcements = [];
    const calendar = [];

    for (const it of raw) {
      const type = it.plannable_type;
      const p = it.plannable || {};
      const date = it.plannable_date || p.due_at || p.todo_date || p.start_at || null;
      const itemCourseId = it.course_id != null ? it.course_id : null;
      // Drop items we know belong to a different course. Keep null-courseId
      // items when the API already scoped via context_codes.
      if (
        state.courseFilter &&
        itemCourseId != null &&
        String(itemCourseId) !== String(state.courseFilter)
      ) {
        continue;
      }
      const base = {
        id: type + ':' + (it.plannable_id != null ? it.plannable_id : p.id),
        type,
        title: p.title || p.name || '(untitled)',
        course: it.context_name || '',
        courseId: itemCourseId,
        url: it.html_url
          ? it.html_url.startsWith('http')
            ? it.html_url
            : location.origin + it.html_url
          : null,
        date,
        points: typeof p.points_possible === 'number' ? p.points_possible : null,
        color: colorFor(it),
      };

      if (type === 'announcement') {
        announcements.push(base);
      } else if (type === 'calendar_event') {
        calendar.push(base);
      } else if (ASSIGNMENT_TYPES.includes(type)) {
        // Skip things already submitted / excused / marked complete in Canvas.
        const sub = it.submissions;
        if (sub && typeof sub === 'object' && (sub.submitted || sub.excused)) {
          continue;
        }
        const ov = it.planner_override;
        if (ov && (ov.marked_complete || ov.dismissed)) {
          continue;
        }
        // Skip things the user marked done locally.
        if (doneKeys.has(base.id)) {
          continue;
        }
        assignments.push(base);
      }
    }

    assignments.sort((a, b) => dateVal(a.date) - dateVal(b.date));
    announcements.sort((a, b) => dateVal(b.date) - dateVal(a.date));
    calendar.sort((a, b) => dateVal(a.date) - dateVal(b.date));

    state.assignments = assignments;
    state.announcements = announcements;
    state.calendar = calendar;

    // Fold in any user-created tasks.
    injectCustomTasks();
  }

  function colorFor(it) {
    let key = null;
    if (it.course_id != null) key = 'course_' + it.course_id;
    else if (it.group_id != null) key = 'group_' + it.group_id;
    return (key && courseColors[key]) || null;
  }

  function dateVal(d) {
    const t = d ? new Date(d).getTime() : NaN;
    return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  }

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------
  function pluralize(n, unit) {
    return n + ' ' + unit + (n === 1 ? '' : 's');
  }

  function formatCountdown(dateStr) {
    if (!dateStr) return { text: 'No due date', cls: 'none' };
    const diff = new Date(dateStr).getTime() - Date.now();
    if (isNaN(diff)) return { text: 'No due date', cls: 'none' };

    if (diff < 0) return { text: 'Overdue', cls: 'overdue' };

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor(diff / 60000);

    // Show only the largest meaningful unit.
    let body;
    if (days >= 1) body = pluralize(days, 'day');
    else if (hours >= 1) body = pluralize(hours, 'hour');
    else body = pluralize(mins, 'minute');

    let cls = 'normal';
    if (diff < 24 * 3600000) cls = 'soon';
    if (diff < 3 * 3600000) cls = 'urgent';
    return { text: body + ' until due', cls };
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function buildWidget() {
    const w = document.createElement('div');
    w.id = WIDGET_ID;

    const header = document.createElement('div');
    header.className = 'ctp-header';
    const title = document.createElement('h2');
    title.className = 'ctp-title';
    title.textContent = 'To-Do List';
    header.appendChild(title);

    // Header controls: the time-period picker sits just left of the gear.
    const controls = document.createElement('div');
    controls.className = 'ctp-header-controls';

    // Time-period picker: a gray box showing the current period (e.g. "Week")
    // with a little dropdown arrow.
    const settings = document.createElement('div');
    settings.className = 'ctp-settings';

    const periodBtn = document.createElement('button');
    periodBtn.type = 'button';
    periodBtn.className = 'ctp-period-btn';
    periodBtn.title = 'Time period';
    periodBtn.setAttribute('aria-label', 'Time period');
    periodBtn.setAttribute('aria-haspopup', 'true');

    const periodLabel = document.createElement('span');
    periodLabel.className = 'ctp-period-label';
    periodBtn.appendChild(periodLabel);
    periodBtn.insertAdjacentHTML(
      'beforeend',
      '<svg class="ctp-period-arrow" viewBox="0 0 24 24" width="12" ' +
        'height="12" fill="none" stroke="currentColor" stroke-width="2.5" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="6 9 12 15 18 9"></polyline>' +
        '</svg>'
    );

    const menu = document.createElement('div');
    menu.className = 'ctp-settings-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');

    PERIODS.forEach(([key, label]) => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'ctp-settings-option';
      opt.dataset.period = key;
      opt.textContent = label;
      opt.setAttribute('role', 'menuitemradio');
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        setPeriod(key);
        menu.hidden = true;
      });
      menu.appendChild(opt);
    });

    periodBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      updatePeriodMenu();
    });
    // Close the menu when clicking anywhere else.
    document.addEventListener('click', () => {
      menu.hidden = true;
    });

    settings.appendChild(periodBtn);
    settings.appendChild(menu);

    // Settings gear (kept to the right of the period picker).
    const gearBtn = document.createElement('button');
    gearBtn.type = 'button';
    gearBtn.className = 'ctp-settings-btn';
    gearBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3"></circle>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
      '</svg>';
    gearBtn.title = 'Settings';
    gearBtn.setAttribute('aria-label', 'Settings');
    gearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSettingsModal();
    });

    controls.appendChild(settings);
    controls.appendChild(gearBtn);
    header.appendChild(controls);

    const tabs = document.createElement('div');
    tabs.className = 'ctp-tabs';
    tabs.setAttribute('role', 'tablist');
    [
      ['assignments', 'Tasks'],
      ['announcements', 'Posts'],
      ['calendar', 'Calendar'],
    ].forEach(([key, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ctp-tab';
      btn.dataset.tab = key;
      btn.setAttribute('role', 'tab');
      const text = document.createElement('span');
      text.className = 'ctp-tab-label';
      text.textContent = label;
      btn.appendChild(text);
      btn.addEventListener('click', () => {
        state.activeTab = key;
        updateTabs();
        renderBody();
      });
      tabs.appendChild(btn);
    });

    const body = document.createElement('div');
    body.className = 'ctp-body';

    w.appendChild(header);
    w.appendChild(tabs);
    w.appendChild(body);
    return w;
  }

  function updateTabs() {
    if (!widget) return;
    widget.querySelectorAll('.ctp-tab').forEach((btn) => {
      const key = btn.dataset.tab;
      btn.classList.toggle('ctp-tab--active', key === state.activeTab);
    });
  }

  function updatePeriodMenu() {
    if (!widget) return;
    widget.querySelectorAll('.ctp-settings-option').forEach((opt) => {
      const active = opt.dataset.period === state.timePeriod;
      opt.classList.toggle('ctp-settings-option--active', active);
      opt.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    const labelEl = widget.querySelector('.ctp-period-label');
    if (labelEl) {
      const found = PERIODS.find((p) => p[0] === state.timePeriod);
      labelEl.textContent = found ? found[1] : 'Week';
    }
  }

  // Small DOM helpers for the settings modal.
  function row(labelText, hintText) {
    const r = document.createElement('div');
    r.className = 'ctp-modal-row';
    const text = document.createElement('div');
    text.className = 'ctp-modal-row-text';
    const label = document.createElement('div');
    label.className = 'ctp-modal-row-label';
    label.textContent = labelText;
    text.appendChild(label);
    if (hintText) {
      const hint = document.createElement('div');
      hint.className = 'ctp-modal-row-hint';
      hint.textContent = hintText;
      text.appendChild(hint);
    }
    r.appendChild(text);
    return r;
  }

  function toggle(checked, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'ctp-switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    const slider = document.createElement('span');
    slider.className = 'ctp-switch-slider';
    wrap.appendChild(input);
    wrap.appendChild(slider);
    return wrap;
  }

  function openSettingsModal() {
    // Only one modal at a time.
    if (document.querySelector('.ctp-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'ctp-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'ctp-modal ctp-modal--sm';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Settings');

    const close = () => overlay.remove();

    const head = document.createElement('div');
    head.className = 'ctp-modal-head';

    const title = document.createElement('h3');
    title.className = 'ctp-modal-title';
    title.textContent = 'Settings';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ctp-modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', close);

    head.appendChild(title);
    head.appendChild(closeBtn);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'ctp-modal-body';

    // Default tab: which list opens when the widget first loads.
    const tabRow = row('Default tab');
    const tabSelect = document.createElement('select');
    tabSelect.className = 'ctp-modal-select';
    tabSelect.setAttribute('aria-label', 'Default tab');
    [
      ['assignments', 'Tasks'],
      ['announcements', 'Posts'],
      ['calendar', 'Calendar'],
    ].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (val === state.defaultTab) opt.selected = true;
      tabSelect.appendChild(opt);
    });
    tabSelect.addEventListener('change', () => {
      state.defaultTab = tabSelect.value;
      savePrefs();
    });
    tabRow.appendChild(tabSelect);

    // Show overdue tasks toggle.
    const overdueRow = row('Show overdue tasks');
    overdueRow.appendChild(
      toggle(state.showOverdue, (on) => {
        state.showOverdue = on;
        savePrefs();
        renderBody();
      })
    );

    // Restore done items.
    const resetRow = row('Restore \'Mark as done\' items');
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'ctp-modal-btn ctp-modal-btn--secondary';
    resetBtn.textContent = 'Restore';
    resetBtn.addEventListener('click', () => {
      resetDone();
      close();
    });
    resetRow.appendChild(resetBtn);

    bodyEl.appendChild(tabRow);
    bodyEl.appendChild(overdueRow);
    bodyEl.appendChild(resetRow);

    modal.appendChild(head);
    modal.appendChild(bodyEl);
    overlay.appendChild(modal);

    // Close when clicking the backdrop or pressing Escape.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
  }

  function makeItem(it) {
    const el = document.createElement(it.url ? 'a' : 'div');
    el.className = 'ctp-item';
    if (it.url) {
      el.href = it.url;
    }
    if (it.color) {
      el.style.borderLeftColor = it.color;
    }

    const top = document.createElement('div');
    top.className = 'ctp-item-top';

    const titleEl = document.createElement('span');
    titleEl.className = 'ctp-item-title';
    titleEl.textContent = it.title;
    top.appendChild(titleEl);

    el.appendChild(top);

    if (it.course) {
      const course = document.createElement('div');
      course.className = 'ctp-item-course';
      course.textContent = it.course;
      el.appendChild(course);
    }

    if (it.type === 'announcement' || it.type === 'calendar_event') {
      const when = document.createElement('div');
      when.className = 'ctp-item-when';
      const prefix = it.type === 'announcement' ? 'Posted ' : '';
      when.textContent = prefix + formatDateTime(it.date);
      el.appendChild(when);
    } else {
      // Assignment-style: live countdown.
      const cd = document.createElement('div');
      cd.className = 'ctp-countdown';
      if (it.date) cd.dataset.due = it.date;
      const info = formatCountdown(it.date);
      cd.textContent = info.text;
      cd.dataset.cls = info.cls;
      cd.classList.add('ctp-countdown--' + info.cls);
      if (it.date) {
        const due = document.createElement('span');
        due.className = 'ctp-due-abs';
        due.textContent = ' · due ' + formatDateTime(it.date);
        cd.appendChild(due);
      }
      el.appendChild(cd);

      // "Mark as done" — small checkbox for cases Canvas didn't detect.
      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'ctp-done-btn';
      doneBtn.textContent = '\u2713'; // ✓
      doneBtn.title = 'Mark as done';
      doneBtn.setAttribute('aria-label', 'Mark as done');
      doneBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = doneBtn.getBoundingClientRect();
        throwConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        markDone(it.id);
      });
      el.appendChild(doneBtn);
    }

    return el;
  }

  function renderBody() {
    if (!widget) return;
    const body = widget.querySelector('.ctp-body');
    if (!body) return;
    body.textContent = '';

    if (state.loading) {
      body.appendChild(messageEl('Loading your Canvas items…'));
      return;
    }
    if (state.error) {
      body.appendChild(messageEl('Could not load items: ' + state.error));
      return;
    }

    const isAssignments = state.activeTab === 'assignments';
    const list = isAssignments
      ? visibleAssignments()
      : state[state.activeTab] || [];

    if (!list.length) {
      const periodLabel = (
        PERIODS.find((p) => p[0] === state.timePeriod) || [, 'week']
      )[1].toLowerCase();
      if (isAssignments) {
        const msg = messageEl('Nothing due within the next ' + periodLabel + '.');
        const emoji = document.createElement('div');
        emoji.className = 'ctp-empty-emoji';
        emoji.textContent = '🎉';
        msg.appendChild(emoji);
        body.appendChild(msg);
      } else {
        const labels = {
          announcements: 'No recent announcements.',
          calendar: 'No upcoming calendar events.',
        };
        body.appendChild(messageEl(labels[state.activeTab] || 'Nothing here.'));
      }
    } else {
      const listEl = document.createElement('div');
      listEl.className = 'ctp-list';
      for (const it of list) {
        listEl.appendChild(makeItem(it));
      }
      body.appendChild(listEl);
      updateCountdowns();
    }

    // The add-task control lives at the bottom of the Tasks list.
    if (isAssignments) {
      body.appendChild(buildAddTask());
    }
  }

  // ---------------------------------------------------------------------------
  // "Add task" control + modal
  // ---------------------------------------------------------------------------
  function buildAddTask() {
    const wrap = document.createElement('div');
    wrap.className = 'ctp-add';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ctp-add-btn';
    btn.innerHTML = '<span class="ctp-add-plus">+</span> Add task';
    btn.addEventListener('click', openAddTaskModal);
    wrap.appendChild(btn);
    return wrap;
  }

  let addModalEl = null;

  function closeAddTaskModal() {
    if (addModalEl) {
      addModalEl.remove();
      addModalEl = null;
    }
    document.removeEventListener('keydown', onAddModalKeydown);
  }

  function onAddModalKeydown(e) {
    if (e.key === 'Escape') closeAddTaskModal();
  }

  function openAddTaskModal() {
    if (addModalEl) return;

    const overlay = document.createElement('div');
    overlay.className = 'ctp-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAddTaskModal();
    });

    const modal = document.createElement('div');
    modal.className = 'ctp-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Add task');

    // Header
    const head = document.createElement('div');
    head.className = 'ctp-modal-head';
    const heading = document.createElement('h2');
    heading.className = 'ctp-modal-title';
    heading.textContent = 'Add task';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ctp-modal-close';
    closeBtn.innerHTML = '\u00d7'; // ×
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', closeAddTaskModal);
    head.appendChild(heading);
    head.appendChild(closeBtn);

    const form = document.createElement('form');
    form.className = 'ctp-add-form';

    // Title
    const titleField = fieldWrap('Title');
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'ctp-add-input';
    titleInput.placeholder = 'New Task';
    titleInput.setAttribute('aria-label', 'Task title');
    titleField.appendChild(titleInput);
    form.appendChild(titleField);

    // Course picker, ordered by the dashboard course ordering.
    const courseField = fieldWrap('Course');
    const courseSelect = document.createElement('select');
    courseSelect.className = 'ctp-add-select';
    courseSelect.setAttribute('aria-label', 'Course');
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = state.courses.length ? 'No course' : 'No courses found';
    courseSelect.appendChild(noneOpt);
    state.courses.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.name;
      if (state.courseFilter && String(c.id) === String(state.courseFilter)) {
        opt.selected = true;
      }
      courseSelect.appendChild(opt);
    });
    // On a course page, default the picker to that class.
    if (state.courseFilter) {
      courseSelect.value = String(state.courseFilter);
    }
    courseField.appendChild(courseSelect);
    form.appendChild(courseField);

    // Due date + time — default to today at 11:59 PM. A single datetime-local
    // input styled as the field; its native picker indicator is expanded (via
    // CSS) to cover the whole box, so clicking anywhere opens the picker.
    const dueField = fieldWrap('Due date');
    const dueInput = document.createElement('input');
    dueInput.type = 'datetime-local';
    dueInput.className = 'ctp-add-input ctp-add-dateinput';
    dueInput.setAttribute('aria-label', 'Due date');
    dueInput.value = defaultDueValue();
    // Picker-only: block manual typing/segment editing.
    dueInput.addEventListener('keydown', (e) => e.preventDefault());
    dueField.appendChild(dueInput);
    form.appendChild(dueField);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'ctp-add-actions';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'ctp-add-submit';
    submitBtn.textContent = 'Add task';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ctp-add-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', closeAddTaskModal);
    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        titleInput.focus();
        titleInput.classList.add('ctp-add-input--error');
        return;
      }
      // datetime-local yields a local "YYYY-MM-DDTHH:mm" string; convert to a
      // real timestamp so the countdown logic works.
      const due = dueInput.value ? new Date(dueInput.value).toISOString() : null;
      addCustomTask({ title, courseId: courseSelect.value, due });
      closeAddTaskModal();
    });

    modal.appendChild(head);
    modal.appendChild(form);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    addModalEl = overlay;
    document.addEventListener('keydown', onAddModalKeydown);

    setTimeout(() => titleInput.focus(), 0);
  }

  // Local "YYYY-MM-DDTHH:mm" for today at 11:59 PM, for the datetime-local input.
  function defaultDueValue() {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }

  function fieldWrap(labelText) {
    const wrap = document.createElement('label');
    wrap.className = 'ctp-add-field';
    const label = document.createElement('span');
    label.className = 'ctp-add-label';
    label.textContent = labelText;
    wrap.appendChild(label);
    return wrap;
  }

  function messageEl(text) {
    const m = document.createElement('div');
    m.className = 'ctp-message';
    m.textContent = text;
    return m;
  }

  function updateCountdowns() {
    if (!widget) return;
    widget.querySelectorAll('.ctp-countdown[data-due]').forEach((el) => {
      const info = formatCountdown(el.dataset.due);
      // Preserve the absolute due span, only refresh the countdown text node.
      const abs = el.querySelector('.ctp-due-abs');
      el.firstChild ? (el.firstChild.nodeValue = info.text) : (el.textContent = info.text);
      if (!el.firstChild && abs) el.appendChild(abs);
      if (el.dataset.cls !== info.cls) {
        el.classList.remove('ctp-countdown--' + el.dataset.cls);
        el.classList.add('ctp-countdown--' + info.cls);
        el.dataset.cls = info.cls;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Recent Feedback — the native section our blanket hide would otherwise cover.
  // We clone it into our widget (below the tabs) so it stays visible.
  // ---------------------------------------------------------------------------
  function syncRecentFeedback() {
    if (!widget || state.feedbackSynced) return;
    const rs = document.getElementById('right-side');
    if (!rs) return;

    // Find the native "Recent Feedback" heading.
    let heading = null;
    rs.querySelectorAll('h2, h3, .title, .todo-list-header').forEach((h) => {
      if (
        !heading &&
        h.textContent &&
        h.textContent.trim().toLowerCase() === 'recent feedback'
      ) {
        heading = h;
      }
    });
    if (!heading) return;

    // Don't pick up our own clone.
    if (widget.contains(heading)) return;

    const container =
      heading.closest('[class*="feedback" i]') || heading.parentElement;
    if (!container || widget.contains(container)) return;

    // Wait until it actually has content.
    if (!container.querySelector('a, li')) return;

    let slot = widget.querySelector('.ctp-feedback');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'ctp-feedback';
      widget.appendChild(slot);
    }
    slot.textContent = '';
    const clone = container.cloneNode(true);
    clone.classList.add('ctp-feedback-clone');
    slot.appendChild(clone);
    state.feedbackSynced = true;
  }

  // ---------------------------------------------------------------------------
  // Mounting
  // ---------------------------------------------------------------------------
  function mount() {
    // Grades (and any other page without a sidebar) — do nothing.
    if (isGradesPage()) return false;
    const rightSide = document.getElementById('right-side');
    if (!rightSide) return false;
    document.body.classList.add('ctp-active');
    if (!widget) widget = buildWidget();
    if (!document.getElementById(WIDGET_ID)) {
      rightSide.appendChild(widget);
      updateTabs();
      updatePeriodMenu();
      renderBody();
    }
    return true;
  }

  function startObserver() {
    const target = document.getElementById('right-side') || document.body;
    const obs = new MutationObserver(() => {
      // Re-attach if Canvas re-rendered the sidebar and dropped our widget.
      if (!document.getElementById(WIDGET_ID)) {
        mount();
      }
      // Pull in Recent Feedback once Canvas has rendered it.
      syncRecentFeedback();
    });
    obs.observe(target, { childList: true, subtree: true });
  }

  function init() {
    if (!mount()) {
      // #right-side not present yet; wait for it.
      const bodyObs = new MutationObserver(() => {
        if (mount()) {
          bodyObs.disconnect();
          afterMount();
        }
      });
      bodyObs.observe(document.documentElement, { childList: true, subtree: true });
      return;
    }
    afterMount();
  }

  function afterMount() {
    startObserver();
    countdownInterval = setInterval(updateCountdowns, 1000);
    syncRecentFeedback();
    // A few retries in case the native sidebar loads a bit later.
    let tries = 0;
    const fbTimer = setInterval(() => {
      syncRecentFeedback();
      if (state.feedbackSynced || ++tries > 20) clearInterval(fbTimer);
    }, 500);

    loadPeriod()
      .then((period) => {
        state.timePeriod = period;
        updatePeriodMenu();
        return loadPrefs();
      })
      .then((prefs) => {
        state.defaultTab = prefs.defaultTab;
        state.showOverdue = prefs.showOverdue;
        state.activeTab = prefs.defaultTab;
        return loadDone();
      })
      .then((set) => {
        doneKeys = set;
        return loadCustomTasks();
      })
      .then((tasks) => {
        state.customTasks = tasks;
        return loadData();
      })
      .then(() => {
        state.loading = false;
        state.error = null;
      })
      .catch((err) => {
        state.loading = false;
        state.error = err && err.message ? err.message : String(err);
      })
      .finally(() => {
        updateTabs();
        updatePeriodMenu();
        renderBody();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

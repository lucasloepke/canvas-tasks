/* Simple Canvas Tasks
 * Replaces the dashboard "To Do" sidebar with a tabbed widget:
 *   Assignments (default) | Announcements | Calendar
 * Each assignment shows a live "x hours and x minutes until due" countdown.
 */
(function () {
  'use strict';

  const WIDGET_ID = 'ctp-widget';

  // Only run on the dashboard/home screen.
  function isDashboard() {
    return location.pathname === '/' || !!document.getElementById('dashboard');
  }
  if (!isDashboard()) return;

  // ---- state ----
  const state = {
    assignments: [],
    announcements: [],
    calendar: [],
    activeTab: 'assignments',
    loading: true,
    error: null,
    feedbackSynced: false,
  };

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

  function markDone(id) {
    if (!id) return;
    doneKeys.add(id);
    saveDone();
    state.assignments = state.assignments.filter((a) => a.id !== id);
    updateTabs();
    renderBody();
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

  async function loadData() {
    // Load the dashboard course colors first so items can be tinted.
    await loadColors();

    // The Planner API returns assignments, quizzes, discussions, announcements,
    // and calendar events with dates in one place.
    const start = encodeURIComponent(isoDaysFromNow(-21)); // catch recent announcements
    const end = encodeURIComponent(isoDaysFromNow(120));
    const url =
      '/api/v1/planner/items?start_date=' +
      start +
      '&end_date=' +
      end +
      '&per_page=50';
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
      const base = {
        id: type + ':' + (it.plannable_id != null ? it.plannable_id : p.id),
        type,
        title: p.title || p.name || '(untitled)',
        course: it.context_name || '',
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
    title.textContent = 'To Do';
    header.appendChild(title);

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

    const list = state[state.activeTab] || [];
    if (!list.length) {
      const labels = {
        assignments: 'Nothing due right now. Nice! 🎉',
        announcements: 'No recent announcements.',
        calendar: 'No upcoming calendar events.',
      };
      body.appendChild(messageEl(labels[state.activeTab] || 'Nothing here.'));
      return;
    }

    const listEl = document.createElement('div');
    listEl.className = 'ctp-list';
    for (const it of list) {
      listEl.appendChild(makeItem(it));
    }
    body.appendChild(listEl);
    updateCountdowns();
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
    const rightSide = document.getElementById('right-side');
    if (!rightSide) return false;
    if (!widget) widget = buildWidget();
    if (!document.getElementById(WIDGET_ID)) {
      rightSide.appendChild(widget);
      updateTabs();
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

    loadDone()
      .then((set) => {
        doneKeys = set;
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
        renderBody();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

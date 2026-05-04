// tab switching logic (handles the url hash too)

const SECTIONS = {
  connect: {
    label: 'Connection',
    desc:  'TikTok stream & status',
    body:  'sec-connect',
    first: 'connect'
  },
  monitor: {
    label: 'Monitor',
    desc:  'Chat, gifts & rankings',
    body:  'sec-monitor',
    first: 'chat'
  },
  game: {
    label: 'Game Bridge',
    desc:  'Integrated games & gift effects',
    body:  'sec-game',
    first: null
  }
};

const TAB_LABELS = {
  connect:       'TikTok Connect',
  chat:          'Live Chat',
  tracker:       'Gift Log',
  topDonors:     'Top Donators',
  minecraft:     'Minecraft · Settings',
  commands:      'Minecraft · Gift Commands',
  isaacEffects:  'TBOI · Gift Effects',
  repoEffects:   'R.E.P.O. · Gift Effects'
};

const SECTION_LABELS = {
  connect: 'Connection',
  monitor: 'Monitor',
  game:    'Game Bridge'
};

// map tabs to their parent section
const TAB_SECTION = {
  connect:      'connect',
  chat:         'monitor',
  tracker:      'monitor',
  topDonors:    'monitor',
  minecraft:    'game',
  commands:     'game',
  isaacEffects: 'game',
  repoEffects:  'game'
};

// map tabs to their parent console accordion (if any)
const TAB_CONSOLE = {
  minecraft:    'consoleMinecraft',
  commands:     'consoleMinecraft',
  isaacEffects: 'consoleIsaac',
  repoEffects:  'consoleRepo'
};

function updateHash(sectionId, tabId) {
  const hash = `#${sectionId}/${tabId}`;
  // dont spam the back button history
  history.replaceState(null, '', hash);
}

// expand a console accordion and mark it has-active
function expandConsole(consoleId) {
  const el = document.getElementById(consoleId);
  if (!el) return;
  el.classList.add('expanded', 'has-active');
}

// collapse all consoles that don't have an active child
function syncConsoleStates() {
  document.querySelectorAll('.sub-console').forEach(consoleEl => {
    const hasActive = consoleEl.querySelector('.sub-console-item.active');
    consoleEl.classList.toggle('has-active', !!hasActive);
  });
}

function activateTab(tabId, { updateUrl = true } = {}) {
  // show/hide right panels
  document.querySelectorAll('.tab-content').forEach(p => {
    p.classList.toggle('active', p.id === `${tabId}Content`);
  });
  // highlight the active tab button (both flat sub-items and console sub-items)
  document.querySelectorAll('.sub-item[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  // if this tab lives inside an accordion, make sure it's expanded
  const consoleId = TAB_CONSOLE[tabId];
  if (consoleId) expandConsole(consoleId);
  // sync has-active state on all consoles
  syncConsoleStates();
  // update the breadcrumb text
  const bp = document.getElementById('breadPage');
  if (bp) bp.textContent = TAB_LABELS[tabId] || tabId;

  document.body.dataset.activeTab = tabId;
}

function activateSection(sectionId, tabOverride, { updateUrl = true } = {}) {
  const meta = SECTIONS[sectionId];
  if (!meta) return;

  // highlight rail icons
  document.querySelectorAll('.cat-btn[data-section]').forEach(b => {
    b.classList.toggle('active', b.dataset.section === sectionId);
  });

  // show the correct submenu section
  document.querySelectorAll('.sub-group[data-section]').forEach(g => {
    g.classList.toggle('visible', g.dataset.section === sectionId);
  });

  // update submenu title
  const label = document.getElementById('subSectionLabel');
  const desc  = document.getElementById('subSectionDesc');
  if (label) label.textContent = meta.label;
  if (desc)  desc.textContent  = meta.desc;

  // change the global accent color based on section
  document.body.classList.remove('sec-connect', 'sec-monitor', 'sec-game');
  document.body.classList.add(meta.body);

  // breadcrumb section text
  const bs = document.getElementById('breadSection');
  if (bs) bs.textContent = SECTION_LABELS[sectionId];

  // open the first tab
  const tabId = tabOverride || meta.first;
  activateTab(tabId);

  // update the url
  if (updateUrl) updateHash(sectionId, tabId);
}

function parseHash() {
  const hash = window.location.hash.slice(1); // remove '#'
  if (!hash) return null;
  const [section, tab] = hash.split('/');
  return { section, tab };
}

export function setupTabs() {
  // rail icon clicks
  document.querySelectorAll('.cat-btn[data-section]').forEach(btn => {
    btn.addEventListener('click', () => activateSection(btn.dataset.section));
  });

  // regular flat tab clicks (connect, chat, tracker, topDonors)
  document.querySelectorAll('.sub-item[data-tab]:not(.sub-console-item)').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      const sectionId = TAB_SECTION[tabId];
      if (sectionId) activateSection(sectionId, tabId);
      else activateTab(tabId);
    });
  });

  // console sub-item clicks (minecraft, commands, etc.)
  document.querySelectorAll('.sub-console-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      const sectionId = TAB_SECTION[tabId];
      if (sectionId) activateSection(sectionId, tabId);
    });
  });

  // console header toggle — expand/collapse the accordion
  document.querySelectorAll('.sub-console-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const consoleEl = btn.closest('.sub-console');
      if (!consoleEl) return;
      const isExpanded = consoleEl.classList.toggle('expanded');
      // if we just opened it, activate the first child tab automatically
      if (isExpanded) {
        const firstChild = consoleEl.querySelector('.sub-console-item[data-tab]');
        if (firstChild) {
          const tabId = firstChild.dataset.tab;
          const sectionId = TAB_SECTION[tabId];
          if (sectionId) activateSection(sectionId, tabId);
        }
      }
    });
  });

  // boot up the ui state
  const saved = parseHash();
  if (saved && SECTIONS[saved.section]) {
    activateSection(saved.section, saved.tab || undefined);
  } else {
    activateSection('connect');
  }
}

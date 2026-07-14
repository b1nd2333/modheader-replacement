chrome.runtime.onInstalled.addListener(() => refreshRules());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.groups || changes.enabled)) {
    refreshRules();
  }
});

async function refreshRules() {
  try {
    const { groups = [], enabled = true } = await chrome.storage.local.get([
      'groups',
      'enabled',
    ]);
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existing.map((r) => r.id);

    if (existingIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingIds,
      });
    }

    const addRules = [];
    let id = 1;

    if (enabled) {
      for (const group of groups) {
        if (!group.enabled || !group.urlPattern) continue;
        if (!Array.isArray(group.headers) || group.headers.length === 0) continue;

        const requestHeaders = [];
        const responseHeaders = [];

        for (const header of group.headers) {
          if (!header.enabled || !header.name) continue;

          const op = buildHeaderOperation(header);
          if (!op) continue;

          if (header.type === 'response') {
            responseHeaders.push(op);
          } else {
            requestHeaders.push(op);
          }
        }

        if (requestHeaders.length === 0 && responseHeaders.length === 0) continue;

        const action = { type: 'modifyHeaders' };
        if (requestHeaders.length > 0) action.requestHeaders = requestHeaders;
        if (responseHeaders.length > 0) action.responseHeaders = responseHeaders;

        addRules.push({
          id: id++,
          priority:
            getPatternPriorityBase(group.urlPattern) +
            (Number(group.priority) || 1) -
            1,
          action,
          condition: {
            urlFilter: group.urlPattern,
            resourceTypes: [
              'main_frame',
              'sub_frame',
              'stylesheet',
              'script',
              'image',
              'font',
              'object',
              'xmlhttprequest',
              'ping',
              'csp_report',
              'media',
              'websocket',
              'other',
            ],
          },
        });
      }
    }

    if (addRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
    }

    await chrome.storage.local.remove('lastError');
  } catch (err) {
    console.error('[Header Mod] refreshRules failed:', err);
    await chrome.storage.local.set({
      lastError: `规则更新失败：${err.message}`,
    });
  }
}

function buildHeaderOperation(header) {
  const validOps = ['set', 'append', 'remove'];
  const operation = validOps.includes(header.operation) ? header.operation : 'set';

  const op = {
    header: header.name,
    operation,
  };

  if (operation !== 'remove') {
    op.value = header.value || '';
  }

  return op;
}

function getPatternPriorityBase(pattern) {
  if (!pattern) return 100;
  if (pattern === '*://*/*') return 100; // 全局最低
  if (/:\/\/\*\./.test(pattern)) return 200; // 子域名中间
  return 300; // 精确域名最高
}

// Animated orca toolbar icon
const FRAME_COUNT = 8;
const FRAME_INTERVAL_MS = 200;
const STATIC_ICON = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
};

let animationInterval = null;
let currentFrame = 0;

async function updateIconState() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  if (enabled) {
    startIconAnimation();
  } else {
    stopIconAnimation();
    await chrome.action.setIcon({ path: STATIC_ICON }).catch(() => {});
  }
}

function startIconAnimation() {
  if (animationInterval) return;
  animationInterval = setInterval(() => {
    currentFrame = (currentFrame + 1) % FRAME_COUNT;
    const path = `icons/frame_${String(currentFrame).padStart(2, '0')}.png`;
    chrome.action.setIcon({ path }).catch(() => {});
  }, FRAME_INTERVAL_MS);
}

function stopIconAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) {
    updateIconState();
  }
});

chrome.runtime.onStartup.addListener(updateIconState);
chrome.runtime.onInstalled.addListener(updateIconState);

// Start animation when service worker wakes up
updateIconState();

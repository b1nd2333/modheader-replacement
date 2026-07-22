let groups = [];
let currentDomain = '';
let editingGroupId = null;
let editingHeaderId = null;
let showingHeaderFormForGroupId = null;
let filterText = '';
let showCurrentOnly = true;

const COMMON_HEADERS = [
  // Request headers
  'Accept',
  'Accept-Charset',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Connection',
  'Content-Length',
  'Content-Type',
  'Cookie',
  'DNT',
  'Host',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Range',
  'If-Unmodified-Since',
  'Origin',
  'Pragma',
  'Range',
  'Referer',
  'User-Agent',
  'X-Forwarded-For',
  'X-Forwarded-Host',
  'X-Forwarded-Proto',
  'X-Real-IP',
  'X-Requested-With',
  // Response headers
  'Access-Control-Allow-Credentials',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Origin',
  'Access-Control-Expose-Headers',
  'Access-Control-Max-Age',
  'Age',
  'Allow',
  'Cache-Control',
  'Connection',
  'Content-Disposition',
  'Content-Encoding',
  'Content-Length',
  'Content-Security-Policy',
  'Content-Type',
  'Date',
  'ETag',
  'Expires',
  'Last-Modified',
  'Location',
  'Referrer-Policy',
  'Server',
  'Set-Cookie',
  'Strict-Transport-Security',
  'Vary',
  'WWW-Authenticate',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'X-XSS-Protection',
];

const currentDomainEl = document.getElementById('current-domain');
const versionEl = document.getElementById('version');
const groupsList = document.getElementById('groups-list');
const groupFilter = document.getElementById('group-filter');
const currentOnlyToggle = document.getElementById('current-only-toggle');
const activeHeadersList = document.getElementById('active-headers-list');
const globalToggle = document.getElementById('global-toggle');
const rulesCountEl = document.getElementById('rules-count');
const quickForm = document.getElementById('quick-form');
const quickOperation = document.getElementById('quick-operation');
const quickValue = document.getElementById('quick-value');
const quickValueWrap = document.getElementById('quick-value-wrap');
const addGlobalBtn = document.getElementById('add-global');
const exportBtn = document.getElementById('export-rules');
const importBtn = document.getElementById('import-rules');
const importFile = document.getElementById('import-file');

async function init() {
  const manifest = chrome.runtime.getManifest();
  if (versionEl && manifest?.version) {
    versionEl.textContent = `v${manifest.version}`;
  }
  createHeaderDatalist();
  updateQuickValueVisibility();
  await loadEnabled();
  await loadCurrentDomain();
  await loadGroups();
  loadLastError();
}

function createHeaderDatalist() {
  if (document.getElementById('header-names')) return;
  const datalist = document.createElement('datalist');
  datalist.id = 'header-names';
  for (const name of COMMON_HEADERS) {
    const option = document.createElement('option');
    option.value = name;
    datalist.appendChild(option);
  }
  document.body.appendChild(datalist);
}

async function loadCurrentDomain() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      currentDomain = extractDomain(tab.url) || '当前标签页';
    } else {
      currentDomain = '当前标签页';
    }
  } catch {
    currentDomain = '当前标签页';
  }
  currentDomainEl.textContent = currentDomain;
}

function extractDomain(url) {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch {
    return '';
  }
}

function getBaseDomain(domain) {
  if (!domain || domain === '当前标签页') return '';
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  // 去掉最左边一级子域，保留主域名
  return parts.slice(1).join('.');
}

function domainToPattern(domain, includeSubdomains = false) {
  if (!domain || domain === '当前标签页') return '*://*/*';
  const target = includeSubdomains ? getBaseDomain(domain) : domain;
  if (!target) return '*://*/*';
  if (includeSubdomains) {
    return `*://*.${target}/*`;
  }
  return `*://${target}/*`;
}

async function loadEnabled() {
  const stored = await chrome.storage.local.get('enabled');
  globalToggle.checked = stored.enabled !== false;
}

async function saveEnabled(enabled) {
  await chrome.storage.local.set({ enabled });
}

async function loadGroups() {
  const stored = await chrome.storage.local.get('groups');
  groups = stored.groups || [];
  renderGroups();
}

async function saveGroups() {
  await chrome.storage.local.set({ groups });
}

function countActiveHeaders() {
  let count = 0;
  for (const group of groups) {
    if (!group.enabled) continue;
    for (const header of group.headers) {
      if (header.enabled) count++;
    }
  }
  return count;
}

function updateRulesCount() {
  const count = countActiveHeaders();
  const total = groups.reduce((sum, g) => sum + g.headers.length, 0);
  const globalEnabled = globalToggle.checked;
  rulesCountEl.textContent = globalEnabled
    ? `${count} 条生效 / 共 ${total}`
    : `已暂停 (${count})`;
}

function isValidUrlPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') return false;
  // declarativeNetRequest urlFilter basic check
  try {
    // Disallow obviously invalid patterns
    if (/\s/.test(pattern)) return false;
    if (pattern.includes('\\')) return false;
    // Must have a scheme wildcard or specific scheme
    if (!/^([a-zA-Z][a-zA-Z0-9+.-]*|\*)::?\/\//.test(pattern)) return false;
    return true;
  } catch {
    return false;
  }
}

async function loadLastError() {
  const { lastError } = await chrome.storage.local.get('lastError');
  if (lastError) {
    showToast(lastError, 'error');
    await chrome.storage.local.remove('lastError');
  }
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

function groupMatchesFilter(group, text) {
  if (!text) return true;
  const t = text.toLowerCase();
  if ((group.name || '').toLowerCase().includes(t)) return true;
  if ((group.urlPattern || '').toLowerCase().includes(t)) return true;
  return group.headers.some((h) => {
    if ((h.name || '').toLowerCase().includes(t)) return true;
    if ((h.value || '').toLowerCase().includes(t)) return true;
    if ((h.operation || '').toLowerCase().includes(t)) return true;
    return false;
  });
}

function isGroupRelatedToCurrent(group) {
  if (group.urlPattern === '*://*/*') return true;
  return matchesDomain(group.urlPattern, currentDomain);
}

function renderGroups() {
  groupsList.innerHTML = '';

  let filtered = groups.filter((g) => groupMatchesFilter(g, filterText));
  if (showCurrentOnly) {
    filtered = filtered.filter(isGroupRelatedToCurrent);
  }

  if (filtered.length === 0) {
    groupsList.innerHTML =
      '<div class="empty">没有匹配的域名分组。</div>';
    updateRulesCount();
    renderActiveHeaders();
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    const aCurrent = matchesDomain(a.urlPattern, currentDomain) ? 0 : 1;
    const bCurrent = matchesDomain(b.urlPattern, currentDomain) ? 0 : 1;
    if (aCurrent !== bCurrent) return aCurrent - bCurrent;
    const aGlobal = a.urlPattern === '*://*/*' ? 0 : 1;
    const bGlobal = b.urlPattern === '*://*/*' ? 0 : 1;
    if (aGlobal !== bGlobal) return aGlobal - bGlobal;
    return (a.name || '').localeCompare(b.name || '');
  });

  for (const group of sorted) {
    const el = document.createElement('div');
    el.className = `group${group.enabled ? '' : ' disabled'}`;
    el.dataset.groupId = group.id;

    const isEditingGroup = editingGroupId === group.id;
    const showAddHeaderForm = showingHeaderFormForGroupId === group.id && !editingHeaderId;

    const headerCount = group.headers.length;
    const enabledCount = group.headers.filter((h) => h.enabled).length;

    let html = `
      <div class="group-header">
        <div class="group-info">
          <div class="group-title">
            ${escapeHtml(group.name || '未命名')}
            ${group.urlPattern === '*://*/*' ? '<span class="badge global">全局</span>' : ''}
            ${matchesDomain(group.urlPattern, currentDomain) && group.urlPattern !== '*://*/*' ? '<span class="badge current">当前</span>' : ''}
          </div>
          <div class="group-meta">
            ${escapeHtml(group.urlPattern)} · ${enabledCount}/${headerCount} 条 Header
            ${group.enabled ? '' : '· 已停用'}
          </div>
        </div>
        <div class="group-actions">
          <label class="inline toggle-enable" title="${group.enabled ? '停用分组' : '启用分组'}">
            <input type="checkbox" class="toggle-group-enabled" data-group-id="${group.id}" ${group.enabled ? 'checked' : ''} />
          </label>
          <button type="button" class="toggle-group small" data-group-id="${group.id}">
            ${isEditingGroup ? '关闭' : '编辑'}
          </button>
          <button type="button" class="danger delete-group small" data-group-id="${group.id}">×</button>
        </div>
      </div>
    `;

    if (isEditingGroup) {
      html += '<div class="group-body">';
      if (group.headers.length === 0) {
        html += '<div class="empty small">还没有 Header</div>';
      } else {
        for (const h of group.headers) {
          html += renderHeaderRow(group, h);
        }
      }
      html += '</div>';

      if (showAddHeaderForm) {
        html += renderHeaderForm(group);
      } else {
        html += `<button type="button" class="add-header small" data-group-id="${group.id}">+ Header</button>`;
      }

      html += renderGroupEdit(group);
    }

    el.innerHTML = html;
    groupsList.appendChild(el);
  }
  updateRulesCount();
  renderActiveHeaders();
}

function getEffectiveHeaders() {
  if (!globalToggle.checked) return [];

  const candidates = [];
  for (const group of groups) {
    if (!group.enabled) continue;
    const isGlobal = group.urlPattern === '*://*/*';
    const matchesCurrent = matchesDomain(group.urlPattern, currentDomain);
    if (!isGlobal && !matchesCurrent) continue;

    const priority = getHeaderRulePriority(group);
    for (const header of group.headers) {
      if (!header.enabled) continue;
      candidates.push({ group, header, priority, isGlobal });
    }
  }

  // 优先级高的排在前面
  candidates.sort((a, b) => b.priority - a.priority);

  // 同名同类型的 Header 只保留优先级最高的一个
  const seen = new Set();
  const effective = [];
  for (const item of candidates) {
    const key = `${item.header.type}:${item.header.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    effective.push(item);
  }

  return effective;
}

function getHeaderRulePriority(group) {
  let base = 100;
  if (group.urlPattern === '*://*/*') {
    base = 100;
  } else if (/:\/\/\*\./.test(group.urlPattern)) {
    base = 200;
  } else {
    base = 300;
  }
  return base + (Number(group.priority) || 1) - 1;
}

function renderActiveHeaders() {
  if (!activeHeadersList) return;
  activeHeadersList.innerHTML = '';

  const effective = getEffectiveHeaders();

  if (effective.length === 0) {
    activeHeadersList.innerHTML =
      '<div class="empty small">当前页面没有生效的 Header</div>';
    return;
  }

  for (const { group, header, isGlobal } of effective) {
    const el = document.createElement('div');
    el.className = `active-header-row${header.enabled ? '' : ' disabled'}`;
    el.innerHTML = `
      <div class="active-header-info">
        <div class="active-header-title">
          <span class="badge ${header.type}">${header.type}</span>
          <span class="badge ${header.operation}">${header.operation}</span>
          <strong>${escapeHtml(header.name)}</strong>
          ${header.operation === 'remove' ? '' : '= ' + escapeHtml(header.value || '')}
        </div>
        <div class="active-header-domain">
          ${isGlobal ? '<span class="badge global">全局</span>' : ''}
          ${escapeHtml(group.name || group.urlPattern)}
        </div>
      </div>
      <button type="button" class="edit-active-header small" data-group-id="${group.id}" data-header-id="${header.id}">编辑</button>
    `;
    activeHeadersList.appendChild(el);
  }
}

function matchesDomain(pattern, domain) {
  if (!pattern || !domain) return false;
  if (pattern === '*://*/*') return false;
  const re = patternToRegex(pattern);
  return re.test(`https://${domain}/`) || re.test(`http://${domain}/`);
}

function patternToRegex(pattern) {
  // Chrome 匹配模式中 *.example.com 同时匹配主域名与子域名，
  // 与 background 的规则生成保持一致：把 ://*. 转成可选的子域名前缀。
  const TOKEN = '\0';
  const hasWildcardSubdomain = pattern.includes('://*.');
  const normalized = hasWildcardSubdomain
    ? pattern.replace('://*.', `://${TOKEN}`)
    : pattern;
  let re = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  if (hasWildcardSubdomain) {
    re = re.replace(TOKEN, '(.*\\.)?');
  }
  return new RegExp('^' + re + '$');
}

function renderHeaderRow(group, h) {
  const isEditing = editingHeaderId === h.id && editingGroupId === group.id;
  if (isEditing) {
    return `<div class="header-row editing">${renderHeaderForm(group, h)}</div>`;
  }
  return `
    <div class="header-row${h.enabled ? '' : ' disabled'}" data-header-id="${h.id}">
      <div class="header-info">
        <span class="badge ${h.type}">${h.type}</span>
        <span class="badge ${h.operation}">${h.operation}</span>
        <strong>${escapeHtml(h.name)}</strong>
        ${h.operation === 'remove' ? '' : '= ' + escapeHtml(h.value || '')}
      </div>
      <div class="header-actions">
        <label class="inline toggle-enable" title="${h.enabled ? '停用' : '启用'}">
          <input type="checkbox" class="toggle-header-enabled" data-group-id="${group.id}" data-header-id="${h.id}" ${h.enabled ? 'checked' : ''} />
        </label>
        <button type="button" class="edit-header small" data-group-id="${group.id}" data-header-id="${h.id}">编辑</button>
        <button type="button" class="danger delete-header small" data-group-id="${group.id}" data-header-id="${h.id}">×</button>
      </div>
    </div>
  `;
}

function renderHeaderForm(group, header = null) {
  const type = header ? header.type : 'request';
  const operation = header ? header.operation : 'set';
  const name = header ? escapeHtml(header.name) : '';
  const value = header ? escapeHtml(header.value) : '';
  const enabled = header ? header.enabled : true;

  return `
    <form class="header-form nested" data-group-id="${group.id}">
      <input type="hidden" class="header-id" value="${header ? header.id : ''}" />
      <div class="row">
        <select class="header-type" required>
          <option value="request" ${type === 'request' ? 'selected' : ''}>请求头</option>
          <option value="response" ${type === 'response' ? 'selected' : ''}>响应头</option>
        </select>
        <select class="header-operation" required>
          <option value="set" ${operation === 'set' ? 'selected' : ''}>设置</option>
          <option value="append" ${operation === 'append' ? 'selected' : ''}>追加</option>
          <option value="remove" ${operation === 'remove' ? 'selected' : ''}>删除</option>
        </select>
      </div>
      <input type="text" class="header-name" list="header-names" placeholder="Header 名称" required value="${name}" />
      <div class="header-value-wrap">
        <input type="text" class="header-value" placeholder="Header 值" value="${value}" />
      </div>
      <label class="inline">
        <input type="checkbox" class="header-enabled" ${enabled ? 'checked' : ''} />
        已启用
      </label>
      <div class="actions">
        <button type="submit" class="primary small">保存 Header</button>
        <button type="button" class="cancel-header small">取消</button>
      </div>
    </form>
  `;
}

function renderGroupEdit(group) {
  return `
    <form class="group-edit" data-group-id="${group.id}">
      <label>
        分组名称
        <input type="text" class="group-name" value="${escapeHtml(group.name)}" required />
      </label>
      <label>
        URL 匹配模式
        <input type="text" class="group-url" value="${escapeHtml(group.urlPattern)}" required />
      </label>
      <label>
        优先级
        <input type="number" class="group-priority" value="${group.priority || 1}" min="1" />
      </label>
      <label class="inline">
        <input type="checkbox" class="group-enabled" ${group.enabled ? 'checked' : ''} />
        已启用
      </label>
      <div class="actions">
        <button type="submit" class="primary small">保存分组</button>
        <button type="button" class="cancel-edit small">取消</button>
      </div>
    </form>
  `;
}

function getGroupById(id) {
  return groups.find((g) => g.id === id);
}

function getOrCreateGroup(urlPattern, name) {
  let group = groups.find((g) => g.urlPattern === urlPattern);
  if (!group) {
    group = {
      id: generateId(),
      name: name || urlPattern,
      urlPattern,
      priority: 1,
      enabled: true,
      headers: [],
    };
    groups.push(group);
  }
  return group;
}

function updateQuickValueVisibility() {
  const isRemove = quickOperation.value === 'remove';
  quickValueWrap.classList.toggle('hidden', isRemove);
  if (isRemove) {
    quickValue.removeAttribute('required');
  } else {
    quickValue.setAttribute('required', 'required');
  }
}

// Quick add form
quickOperation.addEventListener('change', updateQuickValueVisibility);

quickForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('quick-name').value.trim();
  const value = quickOperation.value === 'remove' ? '' : document.getElementById('quick-value').value;
  const type = document.getElementById('quick-type').value;
  const operation = document.getElementById('quick-operation').value;
  const scope = document.querySelector('input[name="scope"]:checked').value;

  let urlPattern;
  let groupName;
  if (scope === 'all') {
    urlPattern = '*://*/*';
    groupName = '所有域名';
  } else if (scope === 'subdomains') {
    urlPattern = domainToPattern(currentDomain, true);
    groupName = getBaseDomain(currentDomain) || currentDomain;
  } else {
    urlPattern = domainToPattern(currentDomain, false);
    groupName = currentDomain;
  }
  if (!isValidUrlPattern(urlPattern)) {
    showToast('无法识别当前域名，请改用“所有域名”。', 'error');
    return;
  }

  const group = getOrCreateGroup(urlPattern, groupName);
  const existing = group.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase() && h.type === type
  );

  const header = {
    id: existing ? existing.id : generateId(),
    type,
    operation,
    name,
    value,
    enabled: true,
  };

  if (existing) {
    Object.assign(existing, header);
  } else {
    group.headers.push(header);
  }

  await saveGroups();
  quickForm.reset();
  quickOperation.value = 'set';
  updateQuickValueVisibility();

  renderGroups();
  showToast('Header 已添加', 'info');
});

function updateHeaderValueVisibility(form) {
  const operation = form.querySelector('.header-operation').value;
  const wrap = form.querySelector('.header-value-wrap');
  const input = form.querySelector('.header-value');
  const isRemove = operation === 'remove';
  wrap.classList.toggle('hidden', isRemove);
  if (isRemove) {
    input.removeAttribute('required');
  } else {
    input.setAttribute('required', 'required');
  }
}

// Groups list event delegation
groupsList.addEventListener('click', (e) => {
  const target = e.target;
  const groupId = target.dataset.groupId;

  const groupEl = target.closest('.group');
  if (groupEl && target.closest('.group-header') && !target.closest('button')) {
    const id = groupEl.dataset.groupId;
    editingGroupId = editingGroupId === id ? null : id;
    showingHeaderFormForGroupId = null;
    editingHeaderId = null;
    renderGroups();
    return;
  }

  if (target.classList.contains('toggle-group')) {
    editingGroupId = editingGroupId === groupId ? null : groupId;
    showingHeaderFormForGroupId = null;
    editingHeaderId = null;
    renderGroups();
    return;
  }

  if (target.classList.contains('delete-group')) {
    groups = groups.filter((g) => g.id !== groupId);
    if (editingGroupId === groupId) {
      editingGroupId = null;
      showingHeaderFormForGroupId = null;
      editingHeaderId = null;
    }
    saveGroups().then(renderGroups);
    return;
  }

  if (target.classList.contains('add-header')) {
    showingHeaderFormForGroupId = groupId;
    editingHeaderId = null;
    renderGroups();
    return;
  }

  if (target.classList.contains('cancel-header')) {
    showingHeaderFormForGroupId = null;
    editingHeaderId = null;
    renderGroups();
    return;
  }

  if (target.classList.contains('cancel-edit')) {
    editingGroupId = null;
    showingHeaderFormForGroupId = null;
    editingHeaderId = null;
    renderGroups();
    return;
  }

  if (target.classList.contains('edit-header')) {
    showingHeaderFormForGroupId = groupId;
    editingHeaderId = target.dataset.headerId;
    renderGroups();
    return;
  }

  if (target.classList.contains('delete-header')) {
    const headerId = target.dataset.headerId;
    const group = getGroupById(groupId);
    if (group) {
      group.headers = group.headers.filter((h) => h.id !== headerId);
      saveGroups().then(renderGroups);
    }
  }
});

groupsList.addEventListener('change', (e) => {
  const target = e.target;

  if (target.classList.contains('toggle-group-enabled')) {
    const group = getGroupById(target.dataset.groupId);
    if (group) {
      group.enabled = target.checked;
      saveGroups().then(renderGroups);
    }
    return;
  }

  if (target.classList.contains('toggle-header-enabled')) {
    const group = getGroupById(target.dataset.groupId);
    if (group) {
      const header = group.headers.find((h) => h.id === target.dataset.headerId);
      if (header) {
        header.enabled = target.checked;
        saveGroups().then(renderGroups);
      }
    }
    return;
  }

  if (target.classList.contains('header-operation')) {
    const form = target.closest('.header-form');
    if (form) updateHeaderValueVisibility(form);
  }
});

// Group form submit
groupsList.addEventListener('submit', async (e) => {
  const form = e.target;

  if (form.classList.contains('group-edit')) {
    e.preventDefault();
    const groupId = form.dataset.groupId;
    const group = getGroupById(groupId);
    if (!group) return;

    group.name = form.querySelector('.group-name').value.trim();
    const urlPattern = form.querySelector('.group-url').value.trim();
    if (!isValidUrlPattern(urlPattern)) {
      showToast('URL 匹配模式格式不正确，请使用类似 *://api.example.com/* 的格式', 'error');
      return;
    }
    group.urlPattern = urlPattern;
    group.priority = Number(form.querySelector('.group-priority').value) || 1;
    group.enabled = form.querySelector('.group-enabled').checked;

    await saveGroups();
    editingGroupId = null;
    showingHeaderFormForGroupId = null;
    editingHeaderId = null;
    renderGroups();
    return;
  }

  if (form.classList.contains('header-form')) {
    e.preventDefault();
    const groupId = form.dataset.groupId;
    const group = getGroupById(groupId);
    if (!group) return;

    const headerId = form.querySelector('.header-id').value || generateId();
    const operation = form.querySelector('.header-operation').value;
    const header = {
      id: headerId,
      type: form.querySelector('.header-type').value,
      operation,
      name: form.querySelector('.header-name').value.trim(),
      value: operation === 'remove' ? '' : form.querySelector('.header-value').value,
      enabled: form.querySelector('.header-enabled').checked,
    };

    const index = group.headers.findIndex((h) => h.id === headerId);
    if (index >= 0) {
      group.headers[index] = header;
    } else {
      group.headers.push(header);
    }

    await saveGroups();
    editingHeaderId = null;
    showingHeaderFormForGroupId = null;
    renderGroups();
  }
});

activeHeadersList.addEventListener('click', (e) => {
  const target = e.target;
  if (target.classList.contains('edit-active-header')) {
    editingGroupId = target.dataset.groupId;
    showingHeaderFormForGroupId = target.dataset.groupId;
    editingHeaderId = target.dataset.headerId;
    renderGroups();
    // 滚动到对应分组
    const groupEl = groupsList.querySelector(
      `.group[data-group-id="${editingGroupId}"]`
    );
    if (groupEl) groupEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

// Global group
addGlobalBtn.addEventListener('click', () => {
  const group = getOrCreateGroup('*://*/*', '所有域名');
  editingGroupId = group.id;
  showingHeaderFormForGroupId = null;
  editingHeaderId = null;
  renderGroups();
});

// Export / Import
exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(groups, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `header-mod-groups-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('文件格式错误：应为数组');

    groups = imported.map((g) => ({
      id: g.id || generateId(),
      name: String(g.name || ''),
      urlPattern: String(g.urlPattern || '*://*/*'),
      priority: Number(g.priority) || 1,
      enabled: Boolean(g.enabled),
      headers: (g.headers || []).map((h) => ({
        id: h.id || generateId(),
        type: h.type === 'response' ? 'response' : 'request',
        operation: h.operation === 'remove' ? 'remove' : 'set',
        name: String(h.name || ''),
        value: String(h.value || ''),
        enabled: Boolean(h.enabled),
      })),
    }));

    await saveGroups();
    editingGroupId = null;
    showingHeaderFormForGroupId = null;
    editingHeaderId = null;
    renderGroups();
  } catch (err) {
    alert('导入失败： ' + err.message);
  } finally {
    importFile.value = '';
  }
});

globalToggle.addEventListener('change', async () => {
  await saveEnabled(globalToggle.checked);
  updateRulesCount();
  renderActiveHeaders();
  showToast(globalToggle.checked ? '扩展已启用' : '扩展已暂停', 'info');
});

currentOnlyToggle.addEventListener('change', () => {
  showCurrentOnly = currentOnlyToggle.checked;
  renderGroups();
});

groupFilter.addEventListener('input', (e) => {
  filterText = e.target.value.trim();
  renderGroups();
});

init();

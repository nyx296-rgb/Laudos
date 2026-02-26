/**
 * Laudo Técnico Generator — Frontend Logic
 */

// ============================================================
// STATE
// ============================================================
let tasyData = [];          // All rows from the Excel
let equipCount = 0;         // Counter for equipment rows
let activeTasyInput = null; // The input that triggered the dropdown
let currentUser = {
  username: '',
  role: '',
  fullName: '',
  requires_password_change: false
};
let visibleColumns = new Set(['data', 'tipo', 'unidade', 'item_defeito']);
let selectedListCategory = 'unidades';

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initApp();

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('tasyDropdown');
    const customDropdown = document.getElementById('customDropdown');
    if (dropdown && !dropdown.contains(e.target) && e.target !== activeTasyInput) {
      hideDropdown();
    }
    if (customDropdown && !customDropdown.contains(e.target) && !e.target.classList.contains('autocomplete-field') && !e.target.closest('.field')) {
      hideCustomDropdown();
    }
  });
});

// ============================================================
// TASY DATA
// ============================================================
async function loadTasyData() {
  try {
    const res = await fetch('/api/tasy');
    const json = await res.json();
    if (json.success) {
      tasyData = json.data;
      console.log(`Tasy: ${tasyData.length} itens carregados`);
    }
  } catch (err) {
    showToast('Erro ao carregar dados Tasy: ' + err.message, 'error');
  }
}

// ============================================================
// EQUIPMENT ROWS
// ============================================================
function addEquipamento(prefill = null) {
  equipCount++;
  const container = document.getElementById('equipamentos-container');

  // Exit if we're not on a page with equipment container (e.g., config page)
  if (!container) return;

  // Remove empty state if present
  const empty = container.querySelector('.empty-equip');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = 'equipamento-row';
  div.dataset.index = equipCount;

  const situacoes = [
    'Em uso', 'Inativo', 'Em manutenção', 'Defeituoso',
    'Fidelização', 'Baixa patrimonial', 'Aguardando descarte'
  ];

  const sitOptions = situacoes
    .map(s => `<option value="${s}" ${prefill?.situacao === s ? 'selected' : ''}>${s}</option>`)
    .join('');

  div.innerHTML = `
    <div class="equip-row-header">
      <span class="equip-row-num">Item ${equipCount}</span>
      <button class="btn-remove" onclick="removeEquipamento(this)" title="Remover">✕</button>
    </div>

    <div class="equip-grid">
      <div class="field">
        <label>Código Tasy</label>
        <div class="tasy-field-wrap">
          <input type="text"
            class="tasy-input"
            placeholder="Ex: 56888"
            value="${prefill?.tasy || ''}"
            autocomplete="off"
            oninput="onTasyInput(this)"
            onfocus="onTasyFocus(this)"
            onblur="onTasyBlur(this)" />
          <button class="tasy-search-btn" title="Buscar no Tasy" onclick="openTasyForInput(this)">Buscar</button>
        </div>
      </div>

      <div class="field">
        <label>Descrição / Item</label>
        <input type="text" class="item-input" value="${prefill?.item || ''}" 
          placeholder="Descrição automática via Tasy ou manual" autocomplete="off" />
      </div>

      <div class="field">
        <label>Quantidade</label>
        <input type="number" class="qtd-input" min="1" value="${prefill?.quantidade || 1}" />
      </div>
    </div>
  `;

  container.appendChild(div);
  renumberRows();
}

function removeEquipamento(btn) {
  const row = btn.closest('.equipamento-row');
  if (row) {
    row.style.animation = 'none';
    row.style.opacity = '0';
    row.style.transform = 'translateY(-8px)';
    row.style.transition = 'all .2s';
    setTimeout(() => {
      row.remove();
      renumberRows();

      // Show empty state if no rows left
      const container = document.getElementById('equipamentos-container');
      if (!container.querySelector('.equipamento-row')) {
        container.innerHTML = `
          <div class="empty-equip">
            <span class="icon">🖥️</span>
            <strong>Nenhum item adicionado</strong>
            Clique em "+ Adicionar Item" para começar.
          </div>`;
      }
    }, 200);
  }
}

function getEquipamentos() {
  const rows = document.querySelectorAll('.equipamento-row');
  const globalMarca = document.getElementById('marca')?.value?.trim() || '';
  const globalModelo = document.getElementById('modelo')?.value?.trim() || '';
  const globalSerie = document.getElementById('serie')?.value?.trim() || '';
  const globalSituacao = document.getElementById('situacao')?.value || '';

  return Array.from(rows).map(row => {
    return {
      tasy: row.querySelector('.tasy-input')?.value?.trim() || '',
      item: row.querySelector('.item-input')?.value?.trim() || '',
      marca: globalMarca,
      modelo: globalModelo,
      serie: globalSerie,
      quantidade: row.querySelector('.qtd-input')?.value?.trim() || '1',
      situacao: globalSituacao,
    };
  });
}

/**
 * Renumbers all equipment rows sequentially and updates their labels.
 */
function renumberRows() {
  const rows = document.querySelectorAll('.equipamento-row');
  equipCount = 0;
  rows.forEach((row, idx) => {
    equipCount++;
    row.dataset.index = equipCount;
    const label = row.querySelector('.equip-row-num');
    if (label) label.textContent = `ITEM ${equipCount}`;
  });
}



// ============================================================
// CUSTOM DROPDOWNS (Unidades, Setores, etc.)
// ============================================================
let activeCustomInput = null;
let activeCategory = null;
let customFilteredItems = [];

async function onCustomFocus(input, category) {
  const dataOptions = await loadDataOptions();
  activeCustomInput = input;
  activeCategory = category;
  showCustomDropdown(input, dataOptions[category]);
}

async function onCustomInput(input, category) {
  const dataOptions = await loadDataOptions();
  activeCustomInput = input;
  activeCategory = category;
  const query = _normalize(input.value.trim());

  customFilteredItems = (dataOptions[category] || []).filter(opt => {
    const label = opt.nome || opt.name || opt;
    return _normalize(label).includes(query);
  });

  renderCustomDropdown(customFilteredItems);
  showCustomDropdown(input, customFilteredItems);
}

function showCustomDropdown(inputEl, items) {
  const dropdown = document.getElementById('customDropdown');
  _positionDropdown(dropdown, inputEl);
  dropdown.classList.remove('hidden');
  renderCustomDropdown(items);
}

/**
 * Positions a dropdown container below an input element reliably.
 * Flips above the input if there's not enough space below.
 */
function _positionDropdown(dropdown, inputEl) {
  const rect = inputEl.getBoundingClientRect();
  if (rect.width === 0) return;

  const dropMaxHeight = 340;
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;

  dropdown.style.position = 'fixed';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.width = Math.max(240, rect.width) + 'px';
  dropdown.style.zIndex = '10001';
  dropdown.style.maxHeight = Math.min(dropMaxHeight, Math.max(spaceBelow, spaceAbove) - 4) + 'px';

  if (spaceBelow >= Math.min(dropMaxHeight, 200) || spaceBelow >= spaceAbove) {
    // Show below
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.bottom = '';
  } else {
    // Flip above
    dropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    dropdown.style.top = '';
  }
}

function renderCustomDropdown(items) {
  const list = document.getElementById('customDropdownList');
  if (!items || !items.length) {
    list.innerHTML = '<div class="dropdown-empty">Nenhum resultado</div>';
    return;
  }

  list.innerHTML = items.map((opt, idx) => {
    // opt could be a string or a Tasy object {code, name, cat}
    const label = opt.nome || opt.name || opt;
    const sub = opt.cargo || opt.code || "";
    const valueStr = categorySafe(label);
    const subStr = categorySafe(sub.toString());

    return `
      <div class="dropdown-item" onclick="selectCustomItem('${valueStr}', '${subStr}')">
        <div class="d-header">
          <span class="d-name">${label}</span>
          ${sub ? `<span class="d-cat">${sub}</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

function categorySafe(str) {
  return str.replace(/'/g, "\\'");
}

function selectCustomItem(value, subValue = '') {
  if (activeCustomInput) {
    activeCustomInput.value = value;

    const row = activeCustomInput.closest('.equipamento-row');

    // If we selected a Tasy item, fill the Tasy code
    if (activeCategory === 'itens' && subValue && /^\d+/.test(subValue)) {
      const tasyInput = row?.querySelector('.tasy-input');
      if (tasyInput) tasyInput.value = subValue;
    }

    // Auto-fill cargo if applicable (check both select and fallback)
    if (activeCategory === 'analistas' && subValue && !/^\d+/.test(subValue)) {
      const cargoInput = document.getElementById('cargo_analista');
      if (cargoInput) {
        // If the subValue exists in our options, select it, otherwise set to Outros or keep it
        const hasOption = Array.from(cargoInput.options).some(opt => opt.value === subValue);
        if (hasOption) cargoInput.value = subValue;
      }
    }
  }
  hideCustomDropdown();
}

async function handleAddNewOption() {
  if (activeCustomInput && activeCategory) {
    const val = activeCustomInput.value.trim();
    const dataOptions = await loadDataOptions();

    if (val && !dataOptions[activeCategory].some(i => (typeof i === 'object' ? i.nome : i) === val)) {
      let extra = null;
      if (activeCategory === 'analistas') {
        const cargo = document.getElementById('cargo_analista')?.value || 'Analista de TI';
        extra = { cargo: cargo };
      }

      const success = await addDataOption(activeCategory, val, extra);
      if (success) {
        showToast('Item adicionado às suas listas!', 'success');
      }
    }
  }
  hideCustomDropdown();
}

function hideCustomDropdown() {
  const dropdown = document.getElementById('customDropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

// Close dropdowns on click outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.field') && !e.target.closest('.dropdown-container')) {
    hideDropdown();
    hideCustomDropdown();
  }
});

// ============================================================
// TASY DROPDOWN
// ============================================================
let filteredItems = [];

/**
 * Standardize text for searching (remove accents, lowercase).
 */
function _normalize(str) {
  if (!str) return "";
  return str.toString().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Standardize item data to avoid brittle Object.values access.
 */
function _getTasyItemProps(item) {
  const code = (item["Código Tasy"] || item["codigo"] || Object.values(item)[0] || "").toString();
  const name = (item["Descrição"] || item["descricao"] || Object.values(item)[1] || "").toString();
  const cat = (item["Tipo"] || item["classificacao"] || Object.values(item)[2] || "").toString();

  // Clean code: "59487.0" -> "59487"
  const cleanCode = code.endsWith(".0") ? code.slice(0, -2) : code;

  return { code: cleanCode, name, cat };
}

function onTasyInput(input) {
  activeTasyInput = input;
  const query = _normalize(input.value.trim());

  if (!query) { hideDropdown(); return; }

  filteredItems = tasyData.filter(item => {
    const { code, name } = _getTasyItemProps(item);
    return _normalize(code).includes(query) || _normalize(name).includes(query);
  }).slice(0, 100);

  // Check for EXACT match to auto-fill description
  const exactMatch = tasyData.find(item => {
    const { code } = _getTasyItemProps(item);
    return code === query;
  });

  if (exactMatch) {
    const { name } = _getTasyItemProps(exactMatch);
    const row = input.closest('.equipamento-row');
    const nameInput = row?.querySelector('.item-input');
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = name;
    }
  }

  console.log(`Busca Tasy: "${query}" -> ${filteredItems.length} resultados`);
  showDropdownBelow(input, filteredItems);
}

function onTasyBlur(input) {
  const query = input.value.trim();
  if (!query) return;

  // Try to find exact match in tasyData
  const match = tasyData.find(item => {
    const { code } = _getTasyItemProps(item);
    return code === query;
  });

  if (match) {
    const { name } = _getTasyItemProps(match);
    const row = input.closest('.equipamento-row');
    const nameInput = row.querySelector('.item-input');
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = name;
      showToast('Descrição preenchida automaticamente', 'info');
    }
  }
}

function onTasyFocus(input) {
  activeTasyInput = input;
  if (input.value.trim()) onTasyInput(input);
}

function openTasyForInput(btn) {
  activeTasyInput = btn.previousElementSibling;
  filteredItems = tasyData.slice(0, 100);
  showDropdownBelow(activeTasyInput, filteredItems);
  const dsearch = document.getElementById('dropdownSearch');
  if (dsearch) {
    dsearch.value = '';
    setTimeout(() => dsearch.focus(), 50);
  }
}

function filterDropdown(query) {
  const q = _normalize(query);
  filteredItems = tasyData.filter(item => {
    const { code, name } = _getTasyItemProps(item);
    return _normalize(code).includes(q) || _normalize(name).includes(q);
  }).slice(0, 100);
  renderDropdownItems(filteredItems);
}

function showDropdownBelow(inputEl, items) {
  const dropdown = document.getElementById('tasyDropdown');
  _positionDropdown(dropdown, inputEl);
  dropdown.classList.remove('hidden');

  if (items && items.length > 0) {
    renderDropdownItems(items);
  }
}

function renderDropdownItems(items) {
  const list = document.getElementById('dropdownList');
  if (!items.length) {
    list.innerHTML = '<div class="dropdown-empty">Nenhum resultado encontrado</div>';
    return;
  }

  list.innerHTML = items.map((item, idx) => {
    const { code, name, cat } = _getTasyItemProps(item);
    return `
      <div class="dropdown-item" onclick="selectTasyItem(${idx})">
        <div class="d-header">
           <span class="d-code">${code}</span>
           <span class="d-cat">${cat}</span>
        </div>
        <span class="d-name">${name}</span>
      </div>`;
  }).join('');
}

function selectTasyItem(idx) {
  const item = filteredItems[idx];
  if (!item) return;

  const { code, name } = _getTasyItemProps(item);

  // If no active input (e.g. from global search), create new row
  if (!activeTasyInput) {
    addEquipamento();
    const rows = document.querySelectorAll('.equipamento-row');
    const lastRow = rows[rows.length - 1];
    activeTasyInput = lastRow.querySelector('.tasy-input');
  }

  const row = activeTasyInput.closest('.equipamento-row');
  if (row) {
    const tasyInput = row.querySelector('.tasy-input');
    if (tasyInput) tasyInput.value = code;

    const itemInput = row.querySelector('.item-input');
    if (itemInput) itemInput.value = name;

    // Smooth scroll to row
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  hideDropdown();
}

function hideDropdown() {
  const dd = document.getElementById('tasyDropdown');
  if (dd) dd.classList.add('hidden');
  activeTasyInput = null;
}


// ============================================================
// SOLICITAÇÃO DE COMPRA MODE (Persisted)
// ============================================================
let isPurchaseMode = localStorage.getItem('laudo_app_mode') === 'purchase';

/**
 * Switches the operational mode (Laudo vs Purchase)
 * and refreshes UI components like equipment lists.
 */
function setAppMode(mode) {
  isPurchaseMode = (mode === 'purchase');
  localStorage.setItem('laudo_app_mode', mode);
  applyUIMode();
  populateFormOptions();
  showToast(`Modo alterado para: ${isPurchaseMode ? 'Compra' : 'Laudo'}`, 'success');
}

/**
 * Applies visual theme and field visibility based on isPurchaseMode.
 */
function applyUIMode() {
  const title = document.querySelector('.app-title');
  const problemField = document.getElementById('problem_field');
  const body = document.body;

  if (isPurchaseMode) {
    body.classList.add('purchase-mode');
    if (title) title.textContent = 'Solicitações de Compra';
    if (problemField) problemField.classList.add('hidden');
  } else {
    body.classList.remove('purchase-mode');
    if (title) title.textContent = 'Laudos Técnicos';
    if (problemField) problemField.classList.remove('hidden');
  }

  // Toggle field visibility (Marca, Modelo, Serial, etc)
  ['marca', 'modelo', 'serie', 'situacao', 'item_defeito'].forEach(id => {
    const field = document.getElementById(id)?.parentElement;
    if (field) {
      if (isPurchaseMode) field.classList.add('hidden');
      else field.classList.remove('hidden');
    }
  });
}

/**
 * Manage Active State in Header Navigation
 */
function updateNavActive(activeId) {
  document.querySelectorAll('.header-nav .btn-nav').forEach(btn => {
    btn.classList.toggle('active', btn.id === activeId);
  });
}

/**
 * Main View/Mode Navigation
 */
function gotoGenerator() {
  hideAllPages();
  const mainGen = document.getElementById('mainGenerator');
  if (mainGen) mainGen.classList.remove('hidden');
  setAppMode('laudo');
  updateNavActive('btnNavGen');
}

function gotoPurchaseMode() {
  hideAllPages();
  const mainGen = document.getElementById('mainGenerator');
  if (mainGen) mainGen.classList.remove('hidden');
  setAppMode('purchase');
  updateNavActive('btnNavPurchase');
}

async function toggleDashboard() {
  const dash = document.getElementById('dashboardPage');
  if (!dash) {
    console.warn('Dashboard page element not found');
    return;
  }

  if (!dash.classList.contains('hidden')) {
    if (currentUser && currentUser.role === 'viewer') return;
    gotoGenerator();
    return;
  }

  hideAllPages();
  dash.classList.remove('hidden');
  updateNavActive('btnNavDashboard');

  let ok = false;
  if (currentUser && currentUser.username) {
    ok = true;
  } else {
    ok = await checkServerAuth();
  }

  if (ok) {
    showStatsSection();
    fetchStats();
  } else {
    showLoginSection();
  }
}

async function toggleConfig() {
  try {
    // Check authentication first
    const ok = await checkServerAuth();
    if (!ok) {
      window.location.href = '/';
      return;
    }

    // Redirect to config page
    window.location.href = '/config';
  } catch (err) {
    alert("Erro crítico em toggleConfig: " + err.message);
    console.error(err);
  }
}

function hideAllPages() {
  const mainGen = document.getElementById('mainGenerator');
  if (mainGen) mainGen.classList.add('hidden');
  const dashPage = document.getElementById('dashboardPage');
  if (dashPage) dashPage.classList.add('hidden');
  const cfgPage = document.getElementById('configPage');
  if (cfgPage) cfgPage.classList.add('hidden');
  const legacyOnly = document.getElementById('legacyOnlyPage');
  if (legacyOnly) legacyOnly.classList.add('hidden');
  const viewerDashboard = document.getElementById('viewerDashboardPage');
  if (viewerDashboard) viewerDashboard.classList.add('hidden');
}

/**
 * Apply Role-Based Access Control to the UI.
 */
function applyRbacUI() {
  if (!currentUser) return;
  const role = currentUser.role;
  const isMaster = role === 'master';
  const isAdmin = role === 'admin';
  const canManageUsers = isMaster || isAdmin;
  const isViewer = role === 'viewer';

  // Nav Buttons
  const btnGen = document.getElementById('btnNavGen');
  if (btnGen) btnGen.classList.toggle('hidden', isViewer);

  const btnNavDashboard = document.getElementById('btnNavDashboard');
  if (btnNavDashboard) btnNavDashboard.classList.toggle('hidden', isViewer);

  // Purchase Nav
  const btnPurchase = document.getElementById('btnNavPurchase');
  if (btnPurchase) btnPurchase.classList.toggle('hidden', isViewer);

  // Config Nav - Viewers NEED to see configs to see legacy laudos
  const btnConfig = document.getElementById('btnNavConfig');
  if (btnConfig) {
    btnConfig.classList.toggle('hidden', isViewer);
    if (isViewer) {
      btnConfig.textContent = 'Consultas';
      btnConfig.title = "Consultas e Laudos Antigos";
    } else {
      btnConfig.textContent = 'Configurações';
      btnConfig.title = "Configurações e Consultas";
    }
  }

  // Hide the back-to-generator buttons for viewers
  const btnBackDash = document.getElementById('btnBackDashboard');
  if (btnBackDash) btnBackDash.classList.toggle('hidden', isViewer);

  const btnBackCfg = document.getElementById('btnBackConfig');
  if (btnBackCfg) btnBackCfg.classList.toggle('hidden', isViewer);

  // Exclusively for viewers: Make full-screen dashboard and config pages render as relative inline
  // so the main top navigation always remains accessible, without altering the Master layout.
  const dashPage = document.getElementById('dashboardPage');
  const cfgPage = document.getElementById('configPage');
  if (dashPage || cfgPage) {
    if (isViewer) {
      if (dashPage) {
        dashPage.style.position = 'relative';
        dashPage.style.zIndex = 'auto';
      }
      if (cfgPage) {
        cfgPage.style.position = 'relative';
        cfgPage.style.zIndex = 'auto';
      }
      // Also hide the duplicate Sair buttons in the overlay headers since global header is visible
      document.querySelectorAll('.dashboard-header .btn-secondary').forEach(b => b.style.display = 'none');
    } else {
      if (dashPage) {
        dashPage.style.position = '';
        dashPage.style.zIndex = '';
      }
      if (cfgPage) {
        cfgPage.style.position = '';
        cfgPage.style.zIndex = '';
      }
      document.querySelectorAll('.dashboard-header .btn-secondary').forEach(b => b.style.display = '');
    }
  }

  // Hide the "Listas" section in configurations for viewers
  const groupListsLabel = document.getElementById('groupListsLabel');
  if (groupListsLabel) groupListsLabel.classList.toggle('hidden', isViewer);

  // Completely hide the configuration sidebar for viewers to allow the Legacy View to go full-width
  const cfgSidebar = document.querySelector('.lists-sidebar');
  if (cfgSidebar) cfgSidebar.classList.toggle('hidden', isViewer);

  const listsNav = document.getElementById('lists_categories_nav');
  if (listsNav) listsNav.classList.toggle('hidden', isViewer);

  // Generate button
  const btnGerar = document.getElementById('btnGerar');
  if (btnGerar) btnGerar.classList.toggle('hidden', isViewer);

  // User/Config Management Tabs
  const btnCatUsers = document.getElementById('btnCatUsers');
  if (btnCatUsers) btnCatUsers.classList.toggle('hidden', !canManageUsers);

  const btnCatBackup = document.getElementById('btnCatBackup');
  if (btnCatBackup) btnCatBackup.classList.toggle('hidden', !canManageUsers);

  const btnCatProfile = document.getElementById('btnCatProfile');
  if (btnCatProfile) btnCatProfile.classList.toggle('hidden', false); // Profile visible for all non-viewers

  // Hide entire Admin Section for viewers
  const adminSectionConfig = document.getElementById('adminSectionConfig');
  if (adminSectionConfig) adminSectionConfig.classList.toggle('hidden', isViewer);

  // Hide System Data Section for non-admin/master
  const systemDataSection = document.getElementById('systemDataSection');
  if (systemDataSection) systemDataSection.classList.toggle('hidden', !canManageUsers);

  // Hide Manage Laudos Section for viewers
  const manageLaudosSection = document.getElementById('manageLaudosSection');
  if (manageLaudosSection) manageLaudosSection.classList.toggle('hidden', isViewer);

  // Management actions
  document.querySelectorAll('.btn-action.btn-delete, .btn-action[onclick*="toggleTest"]').forEach(btn => {
    btn.classList.toggle('hidden', isViewer);
  });
}

async function initApp() {
  console.log('Iniciando aplicativo...');
  applyUIMode();
  const authed = await checkServerAuth();
  if (!authed) {
    const loginSec = document.getElementById('globalLoginSection');
    const appCont = document.getElementById('appContent');
    if (loginSec) loginSec.classList.remove('hidden');
    if (appCont) appCont.classList.add('hidden');
    return;
  }
  onLoginSuccess();
}

/**
 * Handle Global Login from the new premium overlay
 */
async function handleGlobalLogin() {
  const userEl = document.getElementById('globalUsername');
  const passEl = document.getElementById('globalPassword');
  const errorEl = document.getElementById('loginErrorMsg');

  const username = userEl.value;
  const password = passEl.value;

  if (!username || !password) {
    if (errorEl) {
      errorEl.textContent = 'Preencha todos os campos';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      currentUser.username = data.username || '';
      currentUser.role = data.role || '';
      currentUser.fullName = data.full_name || '';
      onLoginSuccess();
    } else {
      if (errorEl) {
        errorEl.textContent = data.error || 'Credenciais inválidas';
        errorEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    showToast('Erro de conexão', 'error');
  }
}

async function onAfterLogin() {
  await checkServerAuth(); // Refresh currentUser state

  // Set default date to today
  const dataInput = document.getElementById('data');
  if (dataInput && !dataInput.value) {
    const today = new Date();
    dataInput.value = today.toISOString().split('T')[0];
  }

  // Only load data if we're on the main page (has equipamentos-container)
  const container = document.getElementById('equipamentos-container');
  if (container) {
    // Load backend data ONLY after auth
    await loadTasyData();
    await populateFormOptions();

    if (equipCount === 0) addEquipamento();
    fetchNextLaudoNum();
  }
}

/**
 * Checks whether the user has an active session on the server.
 */
async function checkServerAuth() {
  try {
    const res = await fetch('/api/me', { cache: 'no-store' });
    if (res.status === 401) {
      if (currentUser) {
        currentUser.username = '';
        currentUser.role = '';
        currentUser.fullName = '';
      }
      return false;
    }

    if (res.ok) {
      const me = await res.json();
      if (me.success) {
        if (!currentUser) currentUser = {};
        currentUser.username = me.username || '';
        currentUser.role = me.role || '';
        currentUser.fullName = me.full_name || '';
        currentUser.requires_password_change = me.requires_password_change || false;
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Auth check failed:", err);
    return false;
  }
}

/**
 * Called after a successful login
 */
function onLoginSuccess() {
  const loginSec = document.getElementById('globalLoginSection');
  const appCont = document.getElementById('appContent');
  if (loginSec) loginSec.classList.add('hidden');
  if (appCont) appCont.classList.remove('hidden');

  const nameDisp = document.getElementById('userNameDisplay');
  const roleDisp = document.getElementById('userRoleDisplay');
  if (nameDisp) nameDisp.textContent = currentUser.fullName || currentUser.username || 'Usuário';
  if (roleDisp) roleDisp.textContent = currentUser.role || '';

  if (currentUser.requires_password_change) {
    const pwModal = document.getElementById('passwordResetModal');
    if (pwModal) pwModal.classList.remove('hidden');
    return;
  }

  if (currentUser.role === 'viewer') {
    try { window.location.href = '/viewer'; } catch (e) { }
    return;
  }

  applyRbacUI();
  awaitOnAfterLogin();
}

// helper to call onAfterLogin without blocking or causing unhandled promise rejections
function awaitOnAfterLogin() {
  onAfterLogin().catch(err => console.error('onAfterLogin failed:', err));
}

async function handlePasswordReset() {
  const password = document.getElementById('resetPassword').value;
  const confirmPassword = document.getElementById('resetConfirmPassword').value;

  if (!password || !confirmPassword) {
    showToast('Por favor, preencha todos os campos.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showToast('As senhas não coincidem.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Senha alterada com sucesso!', 'success');
      document.getElementById('passwordResetModal').classList.add('hidden');
      currentUser.requires_password_change = false;
      onLoginSuccess();
    } else {
      showToast(data.error || 'Erro ao alterar a senha.', 'error');
    }
  } catch (err) {
    showToast('Erro de conexão.', 'error');
  }
}

/**
 * Fetches the next available laudo number from the server.
 */
async function fetchNextLaudoNum() {
  const laudoInput = document.getElementById('id_laudo');
  if (!laudoInput) return;
  try {
    const res = await fetch('/api/next-laudo-num');
    const data = await res.json();
    if (data.success) {
      laudoInput.value = data.next_id;
    }
  } catch (err) {
    autoGenerateLaudoNumber();
  }
}

/**
 * Generates a laudo number automatically based on the current year.
 */
function autoGenerateLaudoNumber() {
  const laudoInput = document.getElementById('id_laudo');
  if (laudoInput && !laudoInput.value) {
    const year = new Date().getFullYear();
    const lastNum = localStorage.getItem('last_laudo_num') || "000";
    const nextNum = (parseInt(lastNum) + 1).toString().padStart(3, '0');
    laudoInput.value = `${nextNum}/${year}`;
  }
}

async function gerarLaudo() {
  let idLaudoInput = document.getElementById('id_laudo');
  let idLaudo = idLaudoInput.value.trim();

  if (!idLaudo || idLaudo === 'Gerando...') {
    await fetchNextLaudoNum();
    idLaudo = idLaudoInput.value.trim();
  }

  if (!idLaudo || idLaudo === 'Gerando...') {
    showToast('Não foi possível obter o número do laudo.', 'error');
    return;
  }

  const data = document.getElementById('data').value.trim();
  const descricaoProblema = document.getElementById('descricao_problema')?.value?.trim() || "";
  const chamado = document.getElementById('chamado')?.value?.trim() || "";

  const equipamentos = getEquipamentos();
  if (!equipamentos.length) {
    showToast('Adicione ao menos um equipamento.', 'error');
    return;
  }

  let dataFormatada = data;
  if (data) {
    const [y, m, d] = data.split('-');
    dataFormatada = `${d}/${m}/${y}`;
  }

  const payload = {
    id_laudo: idLaudo,
    data: dataFormatada,
    local: document.getElementById('local').value.trim(),
    unidade: document.getElementById('unidade').value.trim(),
    setor: document.getElementById('setor').value.trim(),
    marca: document.getElementById('marca')?.value?.trim() || '',
    modelo: document.getElementById('modelo')?.value?.trim() || '',
    serie: document.getElementById('serie')?.value?.trim() || '',
    situacao: document.getElementById('situacao')?.value || '',
    item_defeito: document.getElementById('item_defeito')?.value?.trim() || (isPurchaseMode && equipamentos.length > 0 ? equipamentos[0].item : ''),
    nome_analista: document.getElementById('nome_analista').value.trim(),
    cargo_analista: document.getElementById('cargo_analista').value.trim(),
    descricao_problema: isPurchaseMode ? "" : descricaoProblema,
    chamado: chamado,
    tipo: isPurchaseMode ? 'compra' : 'laudo',
    is_test: document.getElementById('is_test')?.checked || false,
    verificacao_url: `${isPurchaseMode ? 'Solicitação de Compra' : 'Laudo Técnico'} Nº ${idLaudo} | Data: ${dataFormatada} | Autenticidade confirmada pelo setor de TI`,
  };

  showLoading(true);

  try {
    const res = await fetch('/api/gerar-laudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const dataRes = await res.json();
    if (!dataRes.success) {
      throw new Error(dataRes.error || "Erro ao gerar arquivo");
    }

    const filename = dataRes.filename;

    showPostGenModal(filename, isPurchaseMode ? "Solicitação criada com sucesso!" : "Documento criado com sucesso!");
    fetchNextLaudoNum();
  } catch (err) {
    showToast('Erro: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

let generatedFilename = "";

function showPostGenModal(filename, msg) {
  generatedFilename = filename;
  const msgEl = document.getElementById('postGenMessage');
  if (msgEl) msgEl.textContent = msg;

  const btnVis = document.getElementById('btnPostGenVisualizar');
  const btnBx = document.getElementById('btnPostGenBaixar');

  btnVis.onclick = () => {
    closePostGenModal();
    const frame = document.getElementById('pdfModalFrame');
    if (frame) frame.src = `/api/view-pdf/${encodeURIComponent(filename)}`;
    document.getElementById('pdfViewerModal').classList.remove('hidden');
  };

  btnBx.onclick = () => {
    window.location.href = `/api/view-pdf/${encodeURIComponent(filename)}?download=1`;
  };

  document.getElementById('postGenModal').classList.remove('hidden');
}

function closePostGenModal() {
  document.getElementById('postGenModal').classList.add('hidden');
  if (document.getElementById('is_test') && !document.getElementById('is_test').checked) {
    const equipCont = document.getElementById('equipamentos-container');
    if (equipCont) {
      equipCont.innerHTML = '';
      equipCount = 0;
      addEquipamento();
    }
    const descProb = document.getElementById('descricao_problema');
    if (descProb) descProb.value = '';
  }
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function showLoading(show) {
  const overlay = document.getElementById('loading');
  if (overlay) overlay.classList.toggle('hidden', !show);
}

function switchDashTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.tab-btn[onclick*="'${tab}'"]`);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.tab-item-content').forEach(content => content.classList.add('hidden'));
  const activeContent = document.getElementById(`tab-content-${tab}`);
  if (activeContent) activeContent.classList.remove('hidden');

  if (tab === 'stats') fetchStats();
  if (tab === 'reports') fetchIncidenceReport();
}


/**
 * Lists Management Logic
 */
async function renderListManagement() {
  const options = await loadDataOptions();
  const items = options[selectedListCategory] || [];
  const listEl = document.getElementById('items_dynamic_list');
  const titleEl = document.getElementById('current_list_title');

  const titles = {
    unidades: "Unidades",
    setores: "Setores",
    locais: "Locais",
    cargos: "Cargos",
    marcas: "Marcas",
    modelos: "Modelos",
    itens: "Itens de Defeito",
    analistas: "Analistas"
  };

  if (titleEl) titleEl.textContent = `Gerenciar: ${titles[selectedListCategory]}`;

  if (listEl) {
    if (items.length === 0) {
      listEl.innerHTML = '<li class="dynamic-item"><span>Nenhum item cadastrado</span></li>';
      return;
    }
    listEl.innerHTML = items.map((item, idx) => {
      const val = item.nome || item;
      const id = item.id || null;
      const sub = item.cargo ? item.cargo : (item.code ? `Tasy: ${item.code}` : '');
      const idAttr = id ? `data-id="${id}"` : '';
      const extra = item.cargo ? JSON.stringify({ cargo: item.cargo }) : (item.code ? JSON.stringify({ code: item.code }) : 'null');
      return `
        <li class="dynamic-item" data-idx="${idx}" ${idAttr}>
          <div class="item-info">
            <strong class="item-val-display">${val}</strong>
            ${sub ? `<small class="item-sub-display">${sub}</small>` : ''}
          </div>
          <div class="item-actions">
            <button class="btn-edit-item" onclick="editListItem(${id}, ${idx}, this)" title="Editar">✏️</button>
            <button class="btn-del-item" onclick="deleteListItem(${id}, ${idx})" title="Remover">✕</button>
          </div>
        </li>
      `;
    }).join('');
  }
}

async function selectListCategory(cat) {
  // Exit if not on config page
  const view = document.getElementById('listManagementView');
  if (!view) return;

  selectedListCategory = cat;
  hideAllConfigViews();
  view.classList.remove('hidden');

  // Update UI active state
  document.querySelectorAll('.list-cat-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.list-cat-btn[onclick*="'${cat}'"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Show/hide panels
  _showConfigPanel('listManagementView');

  try {
    await renderListManagement();
  } catch (err) {
    console.error("Erro ao renderizar lista:", err);
    showToast('Erro ao carreggar configurações', 'error');
  }
}

function showBackupSettings() {
  document.querySelectorAll('.list-cat-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('btnCatBackup').classList.add('active');
  _showConfigPanel('backupSettingsView');
  loadNetworkPath();
}

function showManageView() {
  document.querySelectorAll('.list-cat-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('btnCatManage').classList.add('active');
  _showConfigPanel('manageLaudosView');
  fetchManagementData();
}

function showLegacyView() {
  try {
    document.querySelectorAll('.list-cat-btn').forEach(btn => btn.classList.remove('active'));
    const btnLegacy = document.getElementById('btnCatLegacy');
    if (btnLegacy) btnLegacy.classList.add('active');
    _showConfigPanel('legacyPdfsView');
    fetchLegacyPdfs();
  } catch (err) {
    alert('Erro em showLegacyView: ' + err.message);
  }
}

/** Hides all config panels and shows the given one */
function _showConfigPanel(id) {
  const views = [
    'listManagementView', 'manageLaudosView', 'legacyPdfsView',
    'backupSettingsView', 'usersManagementView', 'profileUpdateView'
  ];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
  // always scroll panel into view so user doesn't have to scroll down
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function addNewListItem() {
  const input = document.getElementById('newListEntry');
  const val = input.value.trim();
  if (!val) return;

  let extra = null;
  if (selectedListCategory === 'analistas') {
    const cargo = document.getElementById('cargo_analista')?.value || 'Analista de TI';
    extra = { cargo: cargo };
  }

  const success = await addDataOption(selectedListCategory, val, extra);
  if (success) {
    input.value = '';
    await renderListManagement();
    showToast('Item adicionado!', 'success');
  } else {
    showToast('Erro ao adicionar item', 'error');
  }
}

async function deleteListItem(id, index) {
  if (!confirm('Excluir este item da lista?')) return;

  if (id) {
    const success = await removeDataOption(id);
    if (success) {
      showToast('Item removido!', 'success');
    } else {
      showToast('Erro ao remover item', 'error');
    }
  } else {
    showToast('Erro: Item sem ID. Tente recarregar a página.', 'error');
    return;
  }
  await renderListManagement();
}

function editListItem(id, idx, btn) {
  if (!id) { showToast('Erro: Item sem ID. Tente recarregar a página.', 'error'); return; }

  const li = btn.closest('li.dynamic-item');
  const itemInfo = li.querySelector('.item-info');
  const itemActions = li.querySelector('.item-actions');
  const currentVal = li.querySelector('.item-val-display').textContent.trim();
  const subEl = li.querySelector('.item-sub-display');
  const currentSub = subEl ? subEl.textContent.trim() : '';

  itemInfo.innerHTML = `
    <input class="inline-edit-input" id="inlineEdit_${idx}" value="${currentVal}" placeholder="Novo valor..." />
    ${currentSub ? `<input class="inline-edit-sub" id="inlineEditSub_${idx}" value="${currentSub}" placeholder="Cargo/detalhe..." />` : ''}
  `;
  itemActions.innerHTML = `
    <button class="btn-save-item" onclick="saveListItemEdit(${id}, ${idx})" title="Salvar">Salvar</button>
    <button class="btn-cancel-item" onclick="renderListManagement()" title="Cancelar">Cancelar</button>
  `;
  document.getElementById(`inlineEdit_${idx}`)?.focus();
}

async function saveListItemEdit(id, idx) {
  const input = document.getElementById(`inlineEdit_${idx}`);
  const subInput = document.getElementById(`inlineEditSub_${idx}`);
  const newVal = input?.value.trim();
  if (!newVal) { showToast('O campo não pode estar vazio.', 'error'); return; }

  let extra = null;
  if (subInput) {
    const subVal = subInput.value.trim();
    if (selectedListCategory === 'analistas') extra = { cargo: subVal };
    else extra = { code: subVal };
  }

  try {
    const res = await fetch(`/api/options/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newVal, extra })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Item atualizado!', 'success');
      await renderListManagement();
    } else {
      showToast(data.error || 'Erro ao salvar', 'error');
    }
  } catch (err) {
    showToast('Erro de conexão', 'error');
  }
}


/**
 * Settings Management
 */
async function loadNetworkPath() {
  const settings = await loadSettings();
  const input = document.getElementById('networkPathInput');
  if (input && settings.network_path) {
    input.value = settings.network_path;
  }
}

async function triggerBackupNow() {
  const statusDiv = document.getElementById('backupStatus');
  if (!statusDiv) return;

  statusDiv.textContent = 'Iniciando backup...';
  statusDiv.style.color = 'var(--info)';

  try {
    const response = await fetch('/api/backup-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();

    if (data.success) {
      statusDiv.textContent = `Backup concluído: ${data.files_count} arquivos copiados`;
      statusDiv.style.color = 'var(--success)';
      showToast('Backup executado com sucesso!', 'success');

      // Atualizar histórico
      const historyDiv = document.getElementById('backupHistory');
      if (historyDiv) {
        const now = new Date().toLocaleString('pt-BR');
        historyDiv.innerHTML = `<p>Último backup: ${now}</p><p>Total de arquivos: ${data.files_count}</p>`;
      }
    } else {
      statusDiv.textContent = `Erro: ${data.message}`;
      statusDiv.style.color = 'var(--danger)';
      showToast(data.message || 'Erro ao executar backup', 'error');
    }
  } catch (err) {
    console.error('Erro ao fazer backup:', err);
    statusDiv.textContent = 'Erro ao conectar com servidor';
    statusDiv.style.color = 'var(--danger)';
    showToast('Erro ao executar backup', 'error');
  }
}

async function saveNetworkPath() {
  const input = document.getElementById('networkPathInput');
  const val = input.value.trim();
  if (!val) return;

  const success = await saveSetting('network_path', val);
  if (success) {
    showToast('Caminho de rede salvo com sucesso!', 'success');
  } else {
    showToast('Erro ao salvar caminho de rede', 'error');
  }
}

/**
 * Form Population Logic
 */
async function populateFormOptions() {
  const options = await loadDataOptions();

  // Populate Cargo Select
  const cargoSelect = document.getElementById('cargo_analista');
  if (cargoSelect) {
    const currentVal = cargoSelect.value;
    cargoSelect.innerHTML = options.cargos.map(c => {
      const val = c.nome || c;
      return `<option value="${val}">${val}</option>`;
    }).join('') + '<option value="Outros">Outros</option>';

    const possibleValues = options.cargos.map(c => c.nome || c);
    if (currentVal && possibleValues.includes(currentVal)) {
      cargoSelect.value = currentVal;
    }
  }

  // Also load settings if in config mode
  const cfgPage = document.getElementById('configPage');
  if (cfgPage && !cfgPage.classList.contains('hidden')) {
    await loadNetworkPath();
  }
}

function showLoginSection() {
  const globalLogin = document.getElementById('globalLoginSection');
  if (globalLogin) globalLogin.classList.remove('hidden');

  const stats = document.getElementById('statsSection');
  if (stats) stats.classList.add('hidden');
}

function showStatsSection() {
  const stats = document.getElementById('statsSection');
  if (stats) stats.classList.remove('hidden');
  switchDashTab('stats');
}

/** Hides all config panels within the configuration view */
function hideAllConfigViews() {
  _showConfigPanel('');
}

function showConfigLogin() {
  document.getElementById('configLoginSection').classList.remove('hidden');
  document.getElementById('configMainSection').classList.add('hidden');
}

function showConfigMain() {
  try {
    document.getElementById('configLoginSection').classList.add('hidden');
    document.getElementById('configMainSection').classList.remove('hidden');

    if (currentUser && currentUser.role === 'viewer') {
      // Viewers only need to see the Legacy Pdfs. We route them directly here and bypass the sidebar.
      showLegacyView();
      return;
    }

    const activeBtn = document.querySelector('.list-cat-btn.active');
    if (!activeBtn) {
      selectListCategory('unidades');
      return;
    }

    // Refresh current view based on active sidebar button
    if (activeBtn.id === 'btnCatUsers') {
      fetchUsers();
    } else if (activeBtn.id === 'btnCatProfile') {
      showProfileView();
    } else if (activeBtn.id === 'btnCatManage') {
      showManageView();
    } else if (activeBtn.id === 'btnCatLegacy') {
      showLegacyView();
    } else if (activeBtn.id === 'btnCatBackup') {
      showBackupSettings();
    } else {
      // If it's a list category
      renderListManagement();
    }
  } catch (err) {
    alert("Erro em showConfigMain: " + err.message);
  }
}

function showUsersView() {
  document.querySelectorAll('.list-cat-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btnCatUsers').classList.add('active');
  _showConfigPanel('usersManagementView');
  fetchUsers();
}

function showProfileView() {
  document.querySelectorAll('.list-cat-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btnCatProfile').classList.add('active');
  _showConfigPanel('profileUpdateView');

  // Fill current data
  document.getElementById('profileFullName').value = currentUser.fullName || '';
  document.getElementById('profilePassword').value = '';
  document.getElementById('profileConfirmPassword').value = '';
}

/**
 * User Management Logic
 */
async function fetchUsers() {
  try {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) {
      renderUsersTable(data.data);
    }
  } catch (err) {
    showToast('Erro ao carregar usuários', 'error');
  }
}

/**
 * Renders the users table with premium styling and status chips
 */
function renderUsersTable(users) {
  const tbody = document.getElementById('users_table_body');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 40px;">Nenhum usuário encontrado</td></tr>';
    return;
  }

  const canDelete = currentUser.role === 'master';

  tbody.innerHTML = users.map(u => {
    const isTargetMaster = u.role === 'master';
    const statusClass = u.is_active ? 'active' : 'inactive';
    const statusText = u.is_active ? 'Ativo' : 'Inativo';
    const statusDot = u.is_active ? '●' : '○';

    const roleLabels = {
      'master': 'Administrador Geral',
      'admin': 'Administrador',
      'suporte': 'Suporte Técnico',
      'viewer': 'Visualizador'
    };

    return `
      <tr>
        <td>
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 600; color: var(--text-primary);">@${u.username}</span>
            <span style="font-size: 11px; color: var(--text-secondary);">ID: ${u.id || 'N/A'}</span>
          </div>
        </td>
        <td>${u.full_name || '—'}</td>
        <td>
          <span class="badge-role" style="font-size: 11px;">${roleLabels[u.role] || u.role}</span>
        </td>
        <td>
          <span class="status-chip ${statusClass}">
            <span>${statusDot}</span>
            ${statusText}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-edit-small" onclick="showEditUserModal(${JSON.stringify(u).replace(/"/g, '&quot;')})" title="Editar Usuário">
              <span>✏️</span>
            </button>
            ${(canDelete && !isTargetMaster) ? `
              <button class="btn-del-small" onclick="deleteUser(${u.id})" title="Excluir Usuário">
                <span>Excluir</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function showAddUserModal() {
  document.getElementById('userModalTitle').textContent = 'Novo Usuário';
  document.getElementById('modalUserId').value = '';
  document.getElementById('modalUsername').value = '';
  document.getElementById('modalUsername').disabled = false;
  document.getElementById('modalPassword').value = '';
  document.getElementById('modalPasswordGroup').classList.remove('hidden');
  document.getElementById('modalFullName').value = '';
  document.getElementById('modalRole').value = 'suporte';
  document.getElementById('modalIsActive').checked = true;
  document.getElementById('modalActiveGroup').classList.add('hidden'); // No active toggle for new users

  document.getElementById('userModal').classList.remove('hidden');
}

function showEditUserModal(user) {
  document.getElementById('userModalTitle').textContent = 'Editar Usuário';
  document.getElementById('modalUserId').value = user.id;
  document.getElementById('modalUsername').value = user.username;
  document.getElementById('modalUsername').disabled = true;
  document.getElementById('modalPassword').value = '';
  document.getElementById('modalPasswordGroup').classList.add('hidden'); // Hide password in quick edit
  document.getElementById('modalFullName').value = user.full_name || '';
  document.getElementById('modalRole').value = user.role;
  document.getElementById('modalIsActive').checked = user.is_active;
  document.getElementById('modalActiveGroup').classList.remove('hidden');

  document.getElementById('userModal').classList.remove('hidden');
}

function hideUserModal() {
  document.getElementById('userModal').classList.add('hidden');
}

async function saveUserModal() {
  const id = document.getElementById('modalUserId').value;
  const username = document.getElementById('modalUsername').value;
  const password = document.getElementById('modalPassword').value;
  const fullName = document.getElementById('modalFullName').value;
  const role = document.getElementById('modalRole').value;
  const isActive = document.getElementById('modalIsActive').checked;

  const isEdit = !!id;
  const url = isEdit ? `/api/admin/users/${id}` : '/api/admin/users';
  const method = isEdit ? 'PUT' : 'POST';

  const bodyData = {
    full_name: fullName,
    role: role,
    is_active: isActive
  };
  if (!isEdit) {
    bodyData.username = username;
    bodyData.password = password;
  }

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEdit ? 'Usuário atualizado!' : 'Usuário criado!', 'success');
      hideUserModal();
      fetchUsers();
    } else {
      showToast(data.error || 'Erro ao salvar usuário', 'error');
    }
  } catch (err) {
    showToast('Erro de conexão', 'error');
  }
}

async function deleteUser(id) {
  if (!confirm('Excluir este usuário permanentemente?')) return;
  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Usuário excluído', 'success');
      fetchUsers();
    } else {
      showToast(data.error || 'Erro ao excluir', 'error');
    }
  } catch (err) {
    showToast('Erro de conexão', 'error');
  }
}

/**
 * Profile Update Logic
 */
async function handleProfileUpdate() {
  const fullName = document.getElementById('profileFullName').value;
  const pass = document.getElementById('profilePassword').value;
  const confirmPass = document.getElementById('profileConfirmPassword').value;

  if (pass && pass !== confirmPass) {
    showToast('As senhas não coincidem', 'error');
    return;
  }

  const bodyData = { full_name: fullName };
  if (pass) bodyData.password = pass;

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Perfil atualizado!', 'success');
      currentUser.fullName = fullName;
      const nameDisp = document.getElementById('userNameDisplay');
      if (nameDisp) nameDisp.textContent = fullName || currentUser.username;
    } else {
      showToast(data.error || 'Erro ao atualizar perfil', 'error');
    }
  } catch (err) {
    showToast('Erro de conexão', 'error');
  }
}


async function performLogin(username, password) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      onLoginSuccess(data);
      showToast('Login realizado com sucesso!', 'success');
    } else {
      showToast(data.error || 'Erro ao logar', 'error');
    }
  } catch (err) {
    showToast('Erro de conexão', 'error');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('isLoggedIn');
    currentUser = { username: '', role: '', fullName: '' };

    // Hide app, show global login
    document.getElementById('appContent').classList.add('hidden');
    document.getElementById('globalLoginSection').classList.remove('hidden');

    // Reset specific views
    const dashPage = document.getElementById('dashboardPage');
    const confPage = document.getElementById('configPage');
    if (dashPage) dashPage.classList.add('hidden');
    if (confPage) confPage.classList.add('hidden');

    showToast('Sessão encerrada', 'success');
  } catch (err) {
    showToast('Erro ao sair', 'error');
  }
}

let chartInstances = {};

async function fetchStats(isViewer = false) {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (data.success) {
      if (isViewer) {
        const recentBody = document.getElementById('viewer_recent_laudos_body');
        recentBody.innerHTML = data.recent.map(r => {
          const safeId = r[0].replace(/\//g, '_');
          const pdfUrl = `/api/view-pdf/Laudo_${safeId}.pdf`;
          return `
                <tr>
                <td><a href="${pdfUrl}" target="_blank" class="pdf-link" title="Ver PDF" style="font-weight:bold; color:var(--primary);">${r[0]}</a></td>
                <td>${r[1]}</td>
                <td>${r[2]}</td>
                <td>
                    ${r[5] === 'compra' ? '<span class="status-purchase">COMPRA</span>' : '<small class="status-official">LAUDO</small>'}
                    ${r[4] ? '<span class="is-test-badge">TESTE</span>' : ''}
                </td>
                </tr>
            `;
        }).join('');
        return
      }
      document.getElementById('stat_total').textContent = data.total;
      document.getElementById('stat_compras').textContent = data.total_compras || 0;
      document.getElementById('stat_units_count').textContent = data.unidades.length;
      document.getElementById('stat_items_count').textContent = data.itens.length;

      const unitBody = document.getElementById('unit_stats_body');
      unitBody.innerHTML = data.unidades.slice(0, 5).map(u => `
        <tr><td>${u[0]}</td><td><strong>${u[1]}</strong></td></tr>
      `).join('');

      const recentBody = document.getElementById('recent_laudos_body');
      recentBody.innerHTML = data.recent.map(r => {
        const safeId = r[0].replace(/\//g, '_');
        const pdfUrl = `/api/view-pdf/Laudo_${safeId}.pdf`;
        return `
        <tr>
          <td><a href="${pdfUrl}" target="_blank" class="pdf-link" title="Ver PDF" style="font-weight:bold; color:var(--primary);">${r[0]}</a></td>
          <td>${r[1]}</td>
          <td>${r[2]}</td>
          <td>
            ${r[5] === 'compra' ? '<span class="status-purchase">COMPRA</span>' : '<small class="status-official">LAUDO</small>'}
            ${r[4] ? '<span class="is-test-badge">TESTE</span>' : ''}
          </td>
        </tr>
      `;
      }).join('');

      // Render Charts
      if (data.analistas) renderPieChart('chartAnalistas', data.analistas, 'Analistas');
      if (data.unidades) renderPieChart('chartUnidades', data.unidades.slice(0, 6), 'Unidades');
      if (data.itens) renderPieChart('chartItens', data.itens, 'Equipamentos');
    }
  } catch (err) {
    console.error('Erro ao buscar stats:', err);
  }
}

function renderPieChart(canvasId, rawData, label) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  // Destroy existing chart if any
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  const labels = rawData.map(d => d[0]);
  const values = rawData.map(d => d[1]);

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(61, 142, 240, 0.85)', // accent (blue)
          'rgba(63, 185, 80, 0.85)',  // success (green)
          'rgba(210, 153, 34, 0.85)', // warning (yellow)
          'rgba(163, 113, 247, 0.85)',// purple neon
          'rgba(248, 81, 73, 0.85)',  // danger (red)
          'rgba(255, 123, 114, 0.85)',// light red
          'rgba(139, 148, 158, 0.85)' // secondary
        ],
        borderColor: '#161b22',
        borderWidth: 2,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: { size: 11 },
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#fff',
          bodyColor: '#94a3b8',
          padding: 12,
          cornerRadius: 8,
          displayColors: false
        }
      }
    }
  });
}

async function fetchIncidenceReport() {
  try {
    const res = await fetch('/api/reports/incidences');
    const data = await res.json();
    if (data.success) {
      const body = document.getElementById('incidence_report_body');
      body.innerHTML = data.incidences.map(i => `
        <tr>
          <td style="font-weight: 500; color: var(--text-primary);">${i[0]}</td>
          <td><span class="status-purchase" style="background: rgba(248, 81, 73, 0.15); color: var(--danger);">${i[1]}</span></td>
          <td style="font-size: 12px; color: var(--text-secondary); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${i[2] || '-'}">${i[2] || '-'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    showToast('Erro ao carregar relatório');
  }
}

function downloadExport(format) {
  const dataInicio = document.getElementById('exportDataInicio').value;
  const dataFim = document.getElementById('exportDataFim').value;
  const tipo = document.getElementById('exportTipo').value;

  let url = '/api/reports/export?';
  const params = new URLSearchParams();
  if (dataInicio) params.append('inicio', dataInicio);
  if (dataFim) params.append('fim', dataFim);
  if (tipo) params.append('tipo', tipo);
  params.append('format', format || 'csv');

  url += params.toString();
  window.open(url, '_blank');
}

let allLaudos = [];

async function fetchManagementData() {
  try {
    const typeFilter = document.getElementById('manageTypeFilter')?.value || '';
    const url = typeFilter ? `/api/laudos?tipo=${typeFilter}` : '/api/laudos';
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      allLaudos = json.data;
      renderManagementTable(allLaudos);
    }
  } catch (err) {
    showToast('Erro ao carregar dados');
  }
}

function toggleColumn(colName) {
  if (visibleColumns.has(colName)) {
    visibleColumns.delete(colName);
  } else {
    visibleColumns.add(colName);
  }
  renderManagementTable(allLaudos);
}

function renderManagementTable(data) {
  const theadRow = document.getElementById('management_thead_row');
  const body = document.getElementById('management_table_body');

  const colNames = {
    'id_laudo': 'ID',
    'data': 'Data',
    'tipo': 'Tipo',
    'unidade': 'Unidade',
    'item_defeito': 'Equipamento',
    'descricao_problema': 'Descrição',
    'nome_analista': 'Analista',
    'situacao': 'Situação',
    'chamado': 'Chamado'
  };

  const isViewer = currentUser.role === 'viewer';
  const isAdmin = currentUser.role === 'master' || currentUser.role === 'admin';

  // Always show ID and Actions
  let htmlHead = `<th>ID</th>`;
  visibleColumns.forEach(col => {
    htmlHead += `<th>${colNames[col] || col}</th>`;
  });
  htmlHead += `<th>Ações</th>`;
  theadRow.innerHTML = htmlHead;

  body.innerHTML = data.map(r => {
    const safeId = r.id_laudo.replace(/\//g, '_');
    const pdfUrl = `/api/view-pdf/Laudo_${safeId}.pdf`;

    let rowHtml = `<td>
      <a href="${pdfUrl}" target="_blank" class="pdf-link" title="Ver PDF">
        ${r.id_laudo}
      </a>
      ${r.is_test ? '<span class="is-test-badge">T</span>' : ''}
    </td>`;

    visibleColumns.forEach(col => {
      let val = r[col] || '-';
      if (col === 'data') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          val = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } else if (typeof val === 'string' && val.includes('/')) {
          const [day, month, year] = val.split('/');
          const d2 = new Date(`${year}-${month}-${day}`);
          val = (!isNaN(d2.getTime())) ? d2.toLocaleDateString('pt-BR') : val;
        }
      }
      if (col === 'descricao_problema') {
        rowHtml += `<td class="desc-cell">${val.substring(0, 100)}${val.length > 100 ? '...' : ''}</td>`;
      } else if (col === 'tipo') {
        const typeLabel = val === 'compra' ? 'COMPRA' : 'LAUDO';
        const typeClass = val === 'compra' ? 'status-purchase' : 'status-official';
        rowHtml += `<td><span class="${typeClass}" style="font-size: 0.7rem; padding: 2px 6px;">${typeLabel}</span></td>`;
      } else {
        rowHtml += `<td>${val}</td>`;
      }
    });

    rowHtml += `
      <td>
        <div style="display: flex; gap: 4px;">
          ${!isViewer ? `<button class="btn-action-small" onclick="toggleTest(${r.id})" title="Alternar Modo Teste">Teste</button>` : ''}
          ${isAdmin ? `<button class="btn-action-small btn-delete" onclick="deleteLaudo(${r.id})" title="Excluir">Excluir</button>` : ''}
        </div>
      </td>
    `;
    return `<tr>${rowHtml}</tr>`;
  }).join('');
}

function filterManagementTable() {
  const query = _normalize(document.getElementById('manageSearch').value);
  const filtered = allLaudos.filter(r =>
    _normalize(r.id_laudo).includes(query) ||
    _normalize(r.unidade).includes(query) ||
    _normalize(r.item_defeito).includes(query) ||
    _normalize(r.descricao_problema).includes(query) ||
    _normalize(r.chamado).includes(query)
  );
  renderManagementTable(filtered);
}

async function toggleTest(id) {
  if (!confirm('Deseja alternar o status de teste deste laudo?')) return;
  try {
    const res = await fetch(`/api/laudos/${id}/toggle-test`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Status alterado!', 'success');
      fetchManagementData();
    }
  } catch (err) {
    showToast('Erro ao alterar status');
  }
}

async function deleteLaudo(id) {
  if (!confirm('TEM CERTEZA? Esta ação não pode ser desfeita.')) return;
  try {
    const res = await fetch(`/api/laudos/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Laudo excluído!', 'success');
      fetchManagementData();
    }
  } catch (err) {
    showToast('Erro ao excluir');
  }
}

// ============================================================
// LEGACY PDF VIEWER (Master/Admin in Config View)
// ============================================================
let allLegacyFiles = [];

// ============================================================
// LEGACY PDF VIEWER (Viewer Dedicated Page)
// ============================================================

function toggleLegacyOnlyPage() {
  hideAllPages();
  const legacyOnly = document.getElementById('legacyOnlyPage');
  if (legacyOnly) legacyOnly.classList.remove('hidden');
  updateNavActive('btnNavConfig'); // Highlight the Consultas button
  fetchLegacyOnlyPdfs();
}

async function fetchLegacyOnlyPdfs() {
  const container = document.getElementById('legacyOnlyFileList');
  if (!container) return;
  container.innerHTML = '<div class="legacy-loading">Carregando arquivos...</div>';

  try {
    const res = await fetch('/api/legacy-pdfs');
    const data = await res.json();
    if (data.success) {
      allLegacyFiles = data.files;
      renderLegacyOnlyList(allLegacyFiles);
    } else {
      container.innerHTML = '<div class="legacy-loading">Erro ao carregar arquivos.</div>';
    }
  } catch (err) {
    container.innerHTML = '<div class="legacy-loading">Erro de conexão.</div>';
  }
}

function filterLegacyOnlyList() {
  const q = _normalize(document.getElementById('legacyOnlySearch')?.value || '');
  const filtered = allLegacyFiles.filter(f => _normalize(f.name).includes(q));
  renderLegacyOnlyList(filtered);
}

function renderLegacyOnlyList(files) {
  const container = document.getElementById('legacyOnlyFileList');
  if (!container) return;

  if (!files.length) {
    container.innerHTML = '<div class="legacy-loading">Nenhum arquivo encontrado.</div>';
    return;
  }

  container.innerHTML = files.map((f, idx) => {
    const shortName = f.name.replace(/\.pdf$/i, '');
    const sizeKb = (f.size / 1024).toFixed(0);
    const safeName = f.name.replace(/'/g, "\\'");
    return `
      <div class="legacy-file-item" data-index="${idx}">
        <div class="legacy-file-icon">📄</div>
        <div class="legacy-file-info">
          <span class="legacy-file-name">${shortName}</span>
          <span class="legacy-file-meta">${sizeKb} KB</span>
        </div>
        <div class="legacy-file-actions">
          <button class="btn-legacy-view" onclick="openPdfModal('${safeName}')" title="Visualizar PDF">
            Visualizar Arquivo
          </button>
        </div>
      </div>`;
  }).join('');
}

async function fetchLegacyPdfs() {
  const container = document.getElementById('legacyFileList');
  if (!container) return;
  container.innerHTML = '<div class="legacy-loading">Carregando arquivos...</div>';

  try {
    const res = await fetch('/api/legacy-pdfs');
    const data = await res.json();
    if (data.success) {
      allLegacyFiles = data.files;
      renderLegacyList(allLegacyFiles);
    } else {
      container.innerHTML = '<div class="legacy-loading">Erro ao carregar arquivos.</div>';
    }
  } catch (err) {
    container.innerHTML = '<div class="legacy-loading">Erro de conexão.</div>';
  }
}

function filterLegacyList() {
  const q = _normalize(document.getElementById('legacySearch')?.value || '');
  const filtered = allLegacyFiles.filter(f => _normalize(f.name).includes(q));
  renderLegacyList(filtered);
}

function renderLegacyList(files) {
  const container = document.getElementById('legacyFileList');
  if (!container) return;

  if (!files.length) {
    container.innerHTML = '<div class="legacy-loading">Nenhum arquivo encontrado.</div>';
    return;
  }

  container.innerHTML = files.map((f, idx) => {
    const shortName = f.name.replace(/\.pdf$/i, '');
    const sizeKb = (f.size / 1024).toFixed(0);
    const safeName = f.name.replace(/'/g, "\\'");
    return `
      <div class="legacy-file-item" data-index="${idx}">
        <div class="legacy-file-info">
          <span class="legacy-file-name">${shortName}</span>
          <span class="legacy-file-meta">${sizeKb} KB</span>
        </div>
        <div class="legacy-file-actions">
          <button class="btn-legacy-view" onclick="openPdfModal('${safeName}')" title="Visualizar">
            Visualizar
          </button>
          <button class="btn-legacy-del" onclick="deleteLegacyPdf('${safeName}')" title="Excluir do disco">
            Excluir
          </button>
        </div>
      </div>`;
  }).join('');
}

function openPdfModal(filename) {
  const modal = document.getElementById('pdfViewerModal');
  const frame = document.getElementById('pdfModalFrame');
  const title = document.getElementById('pdfModalTitle');
  if (!modal || !frame) return;

  const url = `/api/view-legacy-pdf/${encodeURIComponent(filename)}`;
  title.textContent = filename.replace(/\.pdf$/i, '');
  frame.src = url;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePdfModal() {
  const modal = document.getElementById('pdfViewerModal');
  const frame = document.getElementById('pdfModalFrame');
  if (modal) modal.classList.add('hidden');
  if (frame) frame.src = '';
  document.body.style.overflow = '';
}

async function deleteLegacyPdf(filename) {
  if (!confirm(`Excluir permanentemente "${filename}" do disco?\n\nEsta ação não pode ser desfeita.`)) return;
  try {
    const res = await fetch(`/api/legacy-pdfs/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Arquivo excluído do disco!', 'success');
      await fetchLegacyPdfs();
    } else {
      showToast(data.error || 'Erro ao excluir arquivo', 'error');
    }
  } catch (err) {
    showToast('Erro de conexão', 'error');
  }
}

// ============================================================
// VIEWER DASHBOARD
// ============================================================

function showViewerDashboard() {
  hideAllPages();
  document.getElementById('viewerDashboardPage').classList.remove('hidden');
  updateNavActive('btnNavDashboard');
  fetchStats(true);
  fetchViewerData();
  fetchViewerLegacyPdfs();
}

function switchViewerTab(tab) {
  document.querySelectorAll('#viewerDashboardPage .tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.tab-btn[onclick*="'${tab}'"]`);
  if (activeBtn) activeBtn.classList.add('active');

  if (tab === 'viewer-main') {
    document.getElementById('viewerMain').classList.remove('hidden');
    document.getElementById('viewerLegacy').classList.add('hidden');
  } else {
    document.getElementById('viewerMain').classList.add('hidden');
    document.getElementById('viewerLegacy').classList.remove('hidden');
  }
}

async function fetchViewerData() {
  try {
    const typeFilter = document.getElementById('viewerTypeFilter')?.value || '';
    const url = typeFilter ? `/api/laudos?tipo=${typeFilter}` : '/api/laudos';
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      allLaudos = json.data;
      renderViewerTable(allLaudos);
    }
  } catch (err) {
    showToast('Erro ao carregar dados');
  }
}

function renderViewerTable(data) {
  const theadRow = document.getElementById('viewer_management_thead_row');
  const body = document.getElementById('viewer_management_table_body');

  const colNames = {
    'id_laudo': 'ID',
    'data': 'Data',
    'tipo': 'Tipo',
    'unidade': 'Unidade',
    'item_defeito': 'Equipamento',
    'descricao_problema': 'Descrição',
    'nome_analista': 'Analista',
    'situacao': 'Situação',
    'chamado': 'Chamado'
  };

  let visibleCols = ['tipo', 'unidade', 'item_defeito', 'descricao_problema', 'nome_analista', 'situacao', 'chamado'];

  let htmlHead = `<th>ID</th>`;
  visibleCols.forEach(col => {
    htmlHead += `<th>${colNames[col] || col}</th>`;
  });
  htmlHead += `<th>Ações</th>`;
  theadRow.innerHTML = htmlHead;

  body.innerHTML = data.map(r => {
    const safeId = r.id_laudo.replace(/\//g, '_');
    const pdfUrl = `/api/view-pdf/Laudo_${safeId}.pdf`;

    let rowHtml = `<td>
      <a href="${pdfUrl}" target="_blank" class="pdf-link" title="Ver PDF">
        ${r.id_laudo}
      </a>
      ${r.is_test ? '<span class="is-test-badge">T</span>' : ''}
    </td>`;

    visibleCols.forEach(col => {
      let val = r[col] || '-';
      if (col === 'data') {
        if (typeof val === 'string' && val.includes('/')) {
          const parts = val.split('/');
          if (parts.length === 3) {
            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            val = (isNaN(d.getTime())) ? val : d.toLocaleDateString('pt-BR');
          }
        } else {
          const d = new Date(val);
          val = (isNaN(d.getTime())) ? val : d.toLocaleDateString('pt-BR');
        }
      }
      if (col === 'descricao_problema') {
        rowHtml += `<td class="desc-cell">${val.substring(0, 100)}${val.length > 100 ? '...' : ''}</td>`;
      } else if (col === 'tipo') {
        const typeLabel = val === 'compra' ? 'COMPRA' : 'LAUDO';
        const typeClass = val === 'compra' ? 'status-purchase' : 'status-official';
        rowHtml += `<td><span class="${typeClass}" style="font-size: 0.7rem; padding: 2px 6px;">${typeLabel}</span></td>`;
      } else {
        rowHtml += `<td>${val}</td>`;
      }
    });

    rowHtml += `
      <td>
        <div style="display: flex; gap: 4px;">
            <a href="${pdfUrl}" target="_blank" class="btn-action-small" title="Ver PDF">Visualizar</a>
        </div>
      </td>
    `;
    return `<tr>${rowHtml}</tr>`;
  }).join('');
}

function filterViewerTable() {
  const query = _normalize(document.getElementById('viewerSearch').value);
  const filtered = allLaudos.filter(r =>
    _normalize(r.id_laudo).includes(query) ||
    _normalize(r.unidade).includes(query) ||
    _normalize(r.item_defeito).includes(query) ||
    _normalize(r.descricao_problema).includes(query) ||
    _normalize(r.chamado).includes(query)
  );
  renderViewerTable(filtered);
}


async function fetchViewerLegacyPdfs() {
  const container = document.getElementById('viewerLegacyFileList');
  if (!container) return;
  container.innerHTML = '<div class="legacy-loading">Carregando arquivos...</div>';

  try {
    const res = await fetch('/api/legacy-pdfs');
    const data = await res.json();
    if (data.success) {
      allLegacyFiles = data.files;
      renderViewerLegacyList(allLegacyFiles);
    } else {
      container.innerHTML = '<div class="legacy-loading">Erro ao carregar arquivos.</div>';
    }
  } catch (err) {
    container.innerHTML = '<div class="legacy-loading">Erro de conexão.</div>';
  }
}

function filterViewerLegacyList() {
  const q = _normalize(document.getElementById('viewerLegacySearch')?.value || '');
  const filtered = allLegacyFiles.filter(f => _normalize(f.name).includes(q));
  renderViewerLegacyList(filtered);
}

function renderViewerLegacyList(files) {
  const container = document.getElementById('viewerLegacyFileList');
  if (!container) return;

  if (!files.length) {
    container.innerHTML = '<div class="legacy-loading">Nenhum arquivo encontrado.</div>';
    return;
  }

  container.innerHTML = files.map((f, idx) => {
    const shortName = f.name.replace(/\.pdf$/i, '');
    const sizeKb = (f.size / 1024).toFixed(0);
    const safeName = f.name.replace(/'/g, "\\'");
    return `
      <div class="legacy-file-item" data-index="${idx}">
        <div class="legacy-file-info">
          <span class="legacy-file-name">${shortName}</span>
          <span class="legacy-file-meta">${sizeKb} KB</span>
        </div>
        <div class="legacy-file-actions">
          <button class="btn-legacy-view" onclick="openPdfModal('${safeName}')" title="Visualizar PDF">
            Visualizar Arquivo
          </button>
        </div>
      </div>`;
  }).join('');
}

// Close PDF modal when clicking outside content
document.addEventListener('click', (e) => {
  const modal = document.getElementById('pdfViewerModal');
  if (modal && !modal.classList.contains('hidden') && e.target === modal) {
    closePdfModal();
  }
});

// Close PDF modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePdfModal();
});

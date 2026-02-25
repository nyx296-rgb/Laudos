/**
 * Laudo Técnico Generator — Viewer Frontend Logic
 */

// ============================================================
// STATE
// ============================================================
let currentUser = {
    username: '',
    role: '',
    fullName: '',
    requires_password_change: false
};
let allLaudos = [];
let allLegacyFiles = [];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    console.log('Iniciando aplicativo do visualizador...');
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
 * Checks whether the user has an active session on the server.
 */
async function checkServerAuth() {
    try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (res.status === 401) {
            currentUser = { username: '', role: '', fullName: '', requires_password_change: false };
            return false;
        }

        if (res.ok) {
            const me = await res.json();
            if (me.success) {
                currentUser.username = me.username || '';
                currentUser.role = me.role || '';
                currentUser.fullName = me.full_name || '';
                currentUser.requires_password_change = me.requires_password_change || false;

                // Redirect if not a viewer
                if (currentUser.role !== 'viewer') {
                    window.location.href = '/';
                    return false;
                }
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
    document.getElementById('globalLoginSection').classList.add('hidden');
    document.getElementById('appContent').classList.remove('hidden');

    const nameDisp = document.getElementById('userNameDisplay');
    const roleDisp = document.getElementById('userRoleDisplay');
    if (nameDisp) nameDisp.textContent = currentUser.fullName || currentUser.username || 'Usuário';
    if (roleDisp) roleDisp.textContent = currentUser.role || '';

    if (currentUser.requires_password_change) {
        document.getElementById('passwordResetModal').classList.remove('hidden');
    } else {
        onAfterLogin();
    }
}

async function onAfterLogin() {
    showViewerDashboard();
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
            currentUser.requires_password_change = data.requires_password_change || false;
            
            if (currentUser.role !== 'viewer') {
                window.location.href = '/';
                return;
            }

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


async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = { username: '', role: '', fullName: '' };

        // Hide app, show global login
        document.getElementById('appContent').classList.add('hidden');
        document.getElementById('globalLoginSection').classList.remove('hidden');

        showToast('Sessão encerrada', 'success');
    } catch (err) {
        showToast('Erro ao sair', 'error');
    }
}


// ============================================================
// VIEWER DASHBOARD
// ============================================================

function showViewerDashboard() {
    fetchStats(true);
    fetchViewerData();
    fetchViewerLegacyPdfs();
    renderViewerCharts();
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
        'situacao': 'Situação'
    };

    let visibleCols = ['data', 'tipo', 'unidade', 'item_defeito', 'descricao_problema', 'nome_analista', 'situacao'];

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
            <a href="${pdfUrl}" target="_blank" class="btn-action" title="Ver PDF">👁️</a>
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
        _normalize(r.descricao_problema).includes(query)
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
        const safeName = f.name.replace(/'/g, "'");
        return `
        <div class="legacy-file-item" data-index="${idx}">
          <div class="legacy-file-icon">📄</div>
          <div class="legacy-file-info">
            <span class="legacy-file-name">${shortName}</span>
            <span class="legacy-file-meta">${sizeKb} KB</span>
          </div>
          <div class="legacy-file-actions">
            <button class="btn-legacy-view" onclick="openPdfModal('${safeName}')" title="Visualizar PDF">
              👁️ Visualizar Arquivo
            </button>
          </div>
        </div>`;
    }).join('');
}

function openPdfModal(filename) {
    const url = `/api/view-legacy-pdf/${encodeURIComponent(filename)}`;
    window.open(url, '_blank');
}

function showToast(msg, type = '') {
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hidden');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function _normalize(str) {
    if (!str) return "";
    return str.toString().toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

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
        }
    } catch (err) {
        console.error('Erro ao buscar stats:', err);
    }
}

// ============================================================
// VIEWER CHARTS (Unidades e Equipamentos)
// ============================================================

let chartUnidadeInstance = null;
let chartEquipamentosInstance = null;

async function renderViewerCharts() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        if (!data.success) return;

        // Chart: Unidades
        const unidadesLabels = data.unidades.map(u => u[0]);
        const unidadesData = data.unidades.map(u => u[1]);
        
        const ctxUnidade = document.getElementById('viewerChartUnidade');
        if (ctxUnidade) {
            if (chartUnidadeInstance) chartUnidadeInstance.destroy();
            chartUnidadeInstance = new Chart(ctxUnidade, {
                type: 'bar',
                data: {
                    labels: unidadesLabels,
                    datasets: [{
                        label: 'Atendimentos',
                        data: unidadesData,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    indexAxis: 'y',
                    plugins: {
                        legend: {
                            display:false
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // Chart: Equipamentos
        const equipLabels = (data.itens || []).slice(0, 10).map(i => i[0]);
        const equipData = (data.itens || []).slice(0, 10).map(i => i[1]);
        
        const ctxEquip = document.getElementById('viewerChartEquipamentos');
        if (ctxEquip) {
            if (chartEquipamentosInstance) chartEquipamentosInstance.destroy();
            chartEquipamentosInstance = new Chart(ctxEquip, {
                type: 'doughnut',
                data: {
                    labels: equipLabels,
                    datasets: [{
                        data: equipData,
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.6)',
                            'rgba(54, 162, 235, 0.6)',
                            'rgba(255, 206, 86, 0.6)',
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(153, 102, 255, 0.6)',
                            'rgba(255, 159, 64, 0.6)',
                            'rgba(199, 199, 199, 0.6)',
                            'rgba(83, 102, 255, 0.6)',
                            'rgba(255, 99, 255, 0.6)',
                            'rgba(99, 255, 132, 0.6)'
                        ],
                        borderColor: '#fff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 10,
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (err) {
        console.error('Erro ao renderizar gráficos:', err);
    }
}


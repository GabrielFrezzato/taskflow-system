/**
 * TaskFlow — Frontend Application
 * Vanilla JavaScript SPA com integração à API REST + WebSocket
 */

// ══════════════════════════════════════════════
//  CONFIGURAÇÃO
// ══════════════════════════════════════════════
const API = {
  BASE: 'http://localhost:8000/api',
  WS:   'ws://localhost:8001/ws',
};

// ══════════════════════════════════════════════
//  ESTADO DA APLICAÇÃO
// ══════════════════════════════════════════════
const state = {
  token:          localStorage.getItem('tf_token'),
  user:           null,
  tasks:          [],
  filtered:       [],
  filterStatus:   'all',
  filterPriority: 'all',
  searchQuery:    '',
  deleteTargetId: null,
  ws:             null,
};

// ══════════════════════════════════════════════
//  SELEÇÃO DE ELEMENTOS
// ══════════════════════════════════════════════
const el = {
  // Seções
  authSection:  document.getElementById('auth-section'),
  appSection:   document.getElementById('app-section'),

  // Auth
  loginTab:        document.getElementById('login-tab'),
  registerTab:     document.getElementById('register-tab'),
  loginUsername:   document.getElementById('login-username'),
  loginPassword:   document.getElementById('login-password'),
  btnLogin:        document.getElementById('btn-login'),
  loginError:      document.getElementById('login-error'),
  regUsername:     document.getElementById('reg-username'),
  regEmail:        document.getElementById('reg-email'),
  regPassword:     document.getElementById('reg-password'),
  btnRegister:     document.getElementById('btn-register'),
  registerError:   document.getElementById('register-error'),

  // App
  userName:        document.getElementById('user-name'),
  userAvatar:      document.getElementById('user-avatar'),
  btnLogout:       document.getElementById('btn-logout'),
  wsStatus:        document.getElementById('ws-status'),
  searchInput:     document.getElementById('search-input'),
  btnNewTask:      document.getElementById('btn-new-task'),
  taskList:        document.getElementById('task-list'),
  emptyState:      document.getElementById('empty-state'),
  loadingState:    document.getElementById('loading-state'),
  sidebar:         document.getElementById('sidebar'),
  sidebarToggle:   document.getElementById('sidebar-toggle'),

  // Stats
  statTotal:       document.getElementById('stat-total'),
  statPending:     document.getElementById('stat-pending'),
  statDone:        document.getElementById('stat-done'),
  statHigh:        document.getElementById('stat-high'),
  badgeAll:        document.getElementById('badge-all'),
  badgePending:    document.getElementById('badge-pending'),
  badgeCompleted:  document.getElementById('badge-completed'),

  // Modal de tarefa
  taskModal:   document.getElementById('task-modal'),
  modalTitle:  document.getElementById('modal-title'),
  taskId:      document.getElementById('task-id'),
  taskTitle:   document.getElementById('task-title'),
  taskDesc:    document.getElementById('task-desc'),
  taskPriority:document.getElementById('task-priority'),
  taskDue:     document.getElementById('task-due'),
  modalError:  document.getElementById('modal-error'),
  modalClose:  document.getElementById('modal-close'),
  btnCancel:   document.getElementById('btn-cancel'),
  btnSave:     document.getElementById('btn-save'),

  // Modal de confirmação
  confirmModal:     document.getElementById('confirm-modal'),
  btnCancelDelete:  document.getElementById('btn-cancel-delete'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete'),

  // Notificações
  notifications: document.getElementById('notifications'),
};

// ══════════════════════════════════════════════
//  API — FUNÇÕES DE REQUISIÇÃO
// ══════════════════════════════════════════════
async function request(path, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${API.BASE}${path}`, opts);
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique se o backend está rodando.');
  }

  if (res.status === 401) { logout(); throw new Error('Sessão expirada.'); }
  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`);
  return data;
}

// ══════════════════════════════════════════════
//  AUTENTICAÇÃO
// ══════════════════════════════════════════════
async function login(username, password) {
  const params = new URLSearchParams({ username, password });
  let res;
  try {
    res = await fetch(`${API.BASE}/users/login?${params}`, { method: 'POST' });
  } catch {
    throw new Error('Sem conexão com o servidor.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Credenciais inválidas');
  state.token = data.access_token;
  localStorage.setItem('tf_token', state.token);
}

async function register(username, email, password) {
  return request('/users/register', 'POST', { username, email, password });
}

function logout() {
  state.token = null;
  state.user  = null;
  state.tasks = [];
  localStorage.removeItem('tf_token');
  disconnectWS();
  showSection('auth');
}

async function loadCurrentUser() {
  state.user = await request('/users/me');
  el.userName.textContent = state.user.username;
  el.userAvatar.textContent = state.user.username[0].toUpperCase();
}

// ══════════════════════════════════════════════
//  TAREFAS — CRUD
// ══════════════════════════════════════════════
async function loadTasks() {
  el.loadingState.style.display = 'flex';
  el.taskList.innerHTML = '';
  el.emptyState.classList.add('hidden');
  try {
    state.tasks = await request('/tasks/');
    applyFilters();
  } finally {
    el.loadingState.style.display = 'none';
  }
}

async function createTask(data) {
  const task = await request('/tasks/', 'POST', data);
  state.tasks.unshift(task);
  applyFilters();
  return task;
}

async function updateTask(id, data) {
  const task = await request(`/tasks/${id}`, 'PUT', data);
  const idx = state.tasks.findIndex(t => t.id === id);
  if (idx !== -1) state.tasks[idx] = task;
  applyFilters();
  return task;
}

async function deleteTask(id) {
  await request(`/tasks/${id}`, 'DELETE');
  state.tasks = state.tasks.filter(t => t.id !== id);
  applyFilters();
}

async function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  await updateTask(id, { completed: !task.completed });
}

// ══════════════════════════════════════════════
//  FILTROS E RENDERIZAÇÃO
// ══════════════════════════════════════════════
function applyFilters() {
  let list = [...state.tasks];

  // Filtro de status
  if (state.filterStatus === 'pending')   list = list.filter(t => !t.completed);
  if (state.filterStatus === 'completed') list = list.filter(t =>  t.completed);

  // Filtro de prioridade
  if (state.filterPriority !== 'all')
    list = list.filter(t => t.priority === state.filterPriority);

  // Busca
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }

  state.filtered = list;
  renderTasks();
  updateStats();
}

function renderTasks() {
  el.taskList.innerHTML = '';

  if (state.filtered.length === 0) {
    el.emptyState.classList.remove('hidden');
    return;
  }
  el.emptyState.classList.add('hidden');

  state.filtered.forEach(task => {
    el.taskList.appendChild(buildTaskCard(task));
  });
}

function buildTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card priority-${task.priority} ${task.completed ? 'completed' : ''}`;
  card.dataset.id = task.id;

  const due = task.due_date ? formatDue(task.due_date) : null;
  const overdue = due && isOverdue(task.due_date) && !task.completed;

  const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };

  card.innerHTML = `
    <div class="task-card-header">
      <div class="task-check ${task.completed ? 'checked' : ''}" data-action="toggle">
        ${task.completed ? '✓' : ''}
      </div>
      <span class="task-title">${escHtml(task.title)}</span>
    </div>
    ${task.description ? `<p class="task-desc">${escHtml(task.description)}</p>` : ''}
    <div class="task-meta">
      <span class="priority-dot dot-${task.priority}"></span>
      <span class="priority-badge badge-${task.priority}">${priorityLabels[task.priority]}</span>
      ${due ? `<span class="task-due ${overdue ? 'overdue' : ''}">📅 ${due}</span>` : ''}
      <div class="task-actions">
        <button class="btn-task-action btn-edit" data-action="edit">Editar</button>
        <button class="btn-task-action btn-delete" data-action="delete">Excluir</button>
      </div>
    </div>
  `;

  // Event listeners na card
  card.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset?.action;
    if (!action) return;
    if (action === 'toggle') handleToggle(task.id);
    if (action === 'edit')   openEditModal(task);
    if (action === 'delete') openConfirmDelete(task.id);
  });

  return card;
}

function updateStats() {
  const total   = state.tasks.length;
  const done    = state.tasks.filter(t => t.completed).length;
  const pending = total - done;
  const high    = state.tasks.filter(t => t.priority === 'high' && !t.completed).length;

  el.statTotal.textContent   = total;
  el.statPending.textContent = pending;
  el.statDone.textContent    = done;
  el.statHigh.textContent    = high;

  el.badgeAll.textContent       = total;
  el.badgePending.textContent   = pending;
  el.badgeCompleted.textContent = done;
}

// ══════════════════════════════════════════════
//  MODAIS
// ══════════════════════════════════════════════
function openNewModal() {
  el.modalTitle.textContent = 'Nova Tarefa';
  el.taskId.value = '';
  el.taskTitle.value = '';
  el.taskDesc.value = '';
  el.taskPriority.value = 'medium';
  el.taskDue.value = '';
  el.modalError.classList.add('hidden');
  el.taskModal.classList.remove('hidden');
  el.taskTitle.focus();
}

function openEditModal(task) {
  el.modalTitle.textContent = 'Editar Tarefa';
  el.taskId.value = task.id;
  el.taskTitle.value = task.title;
  el.taskDesc.value = task.description || '';
  el.taskPriority.value = task.priority;
  el.taskDue.value = task.due_date ? task.due_date.substring(0, 10) : '';
  el.modalError.classList.add('hidden');
  el.taskModal.classList.remove('hidden');
  el.taskTitle.focus();
}

function closeTaskModal() {
  el.taskModal.classList.add('hidden');
}

function openConfirmDelete(id) {
  state.deleteTargetId = id;
  el.confirmModal.classList.remove('hidden');
}

function closeConfirmDelete() {
  state.deleteTargetId = null;
  el.confirmModal.classList.add('hidden');
}

async function handleSaveTask() {
  const title = el.taskTitle.value.trim();
  if (!title) {
    showModalError('O título é obrigatório.');
    return;
  }

  const data = {
    title,
    description: el.taskDesc.value.trim(),
    priority:    el.taskPriority.value,
    due_date:    el.taskDue.value ? new Date(el.taskDue.value).toISOString() : null,
  };

  el.btnSave.disabled = true;
  el.btnSave.textContent = 'Salvando...';

  try {
    const id = el.taskId.value;
    if (id) {
      await updateTask(parseInt(id), data);
      toast('Tarefa atualizada!', 'success');
    } else {
      await createTask(data);
      toast('Tarefa criada!', 'success');
    }
    closeTaskModal();
  } catch (err) {
    showModalError(err.message);
  } finally {
    el.btnSave.disabled = false;
    el.btnSave.textContent = 'Salvar tarefa';
  }
}

async function handleToggle(id) {
  try {
    await toggleTask(id);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function showModalError(msg) {
  el.modalError.textContent = msg;
  el.modalError.classList.remove('hidden');
}

// ══════════════════════════════════════════════
//  WEBSOCKET
// ══════════════════════════════════════════════
function connectWS() {
  if (!state.user) return;
  try {
    state.ws = new WebSocket(`${API.WS}?user_id=${state.user.id}`);

    state.ws.onopen = () => {
      setWSStatus(true);
    };

    state.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWSMessage(msg);
      } catch { /* ignore */ }
    };

    state.ws.onclose = () => {
      setWSStatus(false);
      // Reconectar após 5s
      setTimeout(() => { if (state.token) connectWS(); }, 5000);
    };

    state.ws.onerror = () => {
      setWSStatus(false);
    };
  } catch { setWSStatus(false); }
}

function disconnectWS() {
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }
  setWSStatus(false);
}

function setWSStatus(online) {
  el.wsStatus.textContent = online ? '● online' : '● offline';
  el.wsStatus.classList.toggle('online', online);
}

function handleWSMessage(msg) {
  if (msg.type === 'task_created') {
    toast(`Nova tarefa via sync: "${msg.payload?.title || ''}"`, 'info');
    loadTasks();
  }
  if (msg.type === 'task_updated') {
    loadTasks();
  }
  if (msg.type === 'broadcast') {
    toast(msg.payload || 'Atualização recebida', 'info');
  }
}

// ══════════════════════════════════════════════
//  NOTIFICAÇÕES TOAST
// ══════════════════════════════════════════════
function toast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'i' };
  const div = document.createElement('div');
  div.className = `toast toast-${type}`;
  div.innerHTML = `<span class="toast-icon">${icons[type] || 'i'}</span><span>${escHtml(message)}</span>`;
  el.notifications.appendChild(div);

  const remove = () => {
    div.classList.add('toast-out');
    div.addEventListener('animationend', () => div.remove(), { once: true });
  };
  setTimeout(remove, 3500);
  div.addEventListener('click', remove);
}

// ══════════════════════════════════════════════
//  SEÇÕES
// ══════════════════════════════════════════════
function showSection(name) {
  if (name === 'app') {
    el.authSection.classList.add('hidden');
    el.appSection.classList.remove('hidden');
  } else {
    el.appSection.classList.add('hidden');
    el.authSection.classList.remove('hidden');
  }
}

// ══════════════════════════════════════════════
//  UTILITÁRIOS
// ══════════════════════════════════════════════
function escHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDue(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function isOverdue(isoString) {
  return new Date(isoString) < new Date();
}

function setActiveFilter(type, value) {
  if (type === 'status') {
    state.filterStatus = value;
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === value);
    });
  }
  if (type === 'priority') {
    state.filterPriority = value;
    document.querySelectorAll('.chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.priority === value);
    });
  }
  applyFilters();
}

// ══════════════════════════════════════════════
//  INICIALIZAÇÃO E EVENT LISTENERS
// ══════════════════════════════════════════════
async function initApp() {
  if (!state.token) { showSection('auth'); return; }
  try {
    await loadCurrentUser();
    await loadTasks();
    showSection('app');
    connectWS();
  } catch {
    logout();
  }
}

// ── AUTH TABS ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
  });
});

// ── LOGIN ──
el.btnLogin.addEventListener('click', async () => {
  const username = el.loginUsername.value.trim();
  const password = el.loginPassword.value;
  if (!username || !password) {
    el.loginError.textContent = 'Preencha todos os campos.';
    el.loginError.classList.remove('hidden');
    return;
  }
  el.btnLogin.disabled = true;
  el.btnLogin.textContent = 'Entrando...';
  el.loginError.classList.add('hidden');
  try {
    await login(username, password);
    await loadCurrentUser();
    await loadTasks();
    showSection('app');
    connectWS();
    toast(`Bem-vindo, ${state.user.username}!`, 'success');
  } catch (err) {
    el.loginError.textContent = err.message;
    el.loginError.classList.remove('hidden');
  } finally {
    el.btnLogin.disabled = false;
    el.btnLogin.textContent = 'Entrar';
  }
});

el.loginPassword.addEventListener('keydown', e => {
  if (e.key === 'Enter') el.btnLogin.click();
});

// ── REGISTER ──
el.btnRegister.addEventListener('click', async () => {
  const username = el.regUsername.value.trim();
  const email    = el.regEmail.value.trim();
  const password = el.regPassword.value;

  if (!username || !email || !password) {
    el.registerError.textContent = 'Preencha todos os campos.';
    el.registerError.classList.remove('hidden');
    return;
  }
  if (password.length < 8) {
    el.registerError.textContent = 'A senha deve ter no mínimo 8 caracteres.';
    el.registerError.classList.remove('hidden');
    return;
  }

  el.btnRegister.disabled = true;
  el.btnRegister.textContent = 'Criando conta...';
  el.registerError.classList.add('hidden');

  try {
    await register(username, email, password);
    await login(username, password);
    await loadCurrentUser();
    await loadTasks();
    showSection('app');
    connectWS();
    toast('Conta criada com sucesso!', 'success');
  } catch (err) {
    el.registerError.textContent = err.message;
    el.registerError.classList.remove('hidden');
  } finally {
    el.btnRegister.disabled = false;
    el.btnRegister.textContent = 'Criar conta';
  }
});

// ── LOGOUT ──
el.btnLogout.addEventListener('click', () => {
  logout();
  toast('Você saiu da sua conta.', 'info');
});

// ── NAV FILTERS ──
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => setActiveFilter('status', btn.dataset.filter));
});

document.querySelectorAll('.chip').forEach(btn => {
  btn.addEventListener('click', () => setActiveFilter('priority', btn.dataset.priority));
});

// ── SEARCH ──
el.searchInput.addEventListener('input', () => {
  state.searchQuery = el.searchInput.value.trim();
  applyFilters();
});

// ── NOVA TAREFA ──
el.btnNewTask.addEventListener('click', openNewModal);

// ── MODAL TAREFA ──
el.modalClose.addEventListener('click', closeTaskModal);
el.btnCancel.addEventListener('click', closeTaskModal);
el.btnSave.addEventListener('click', handleSaveTask);
el.taskTitle.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSaveTask();
});

// ── CONFIRM DELETE ──
el.btnCancelDelete.addEventListener('click', closeConfirmDelete);
el.btnConfirmDelete.addEventListener('click', async () => {
  if (!state.deleteTargetId) return;
  try {
    await deleteTask(state.deleteTargetId);
    toast('Tarefa excluída.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
  closeConfirmDelete();
});

// ── FECHAR MODAL CLICANDO FORA ──
[el.taskModal, el.confirmModal].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
});

// ── SIDEBAR TOGGLE (mobile) ──
el.sidebarToggle.addEventListener('click', () => {
  el.sidebar.classList.toggle('open');
});

// Fecha sidebar ao clicar fora no mobile
document.addEventListener('click', e => {
  if (
    el.sidebar.classList.contains('open') &&
    !el.sidebar.contains(e.target) &&
    e.target !== el.sidebarToggle
  ) {
    el.sidebar.classList.remove('open');
  }
});

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    el.taskModal.classList.add('hidden');
    el.confirmModal.classList.add('hidden');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    el.searchInput.focus();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !el.taskModal.classList.contains('hidden') === false) {
    e.preventDefault();
    openNewModal();
  }
});

// ── INIT ──
initApp();

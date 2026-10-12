let csrfToken = '';

export class ApiError extends Error {
  constructor(message, status = 500, fields = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

async function refreshCsrf() {
  const response = await fetch('/api/csrf', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.csrfToken) throw new ApiError('Không thể khởi tạo phiên an toàn. Hãy tải lại trang. ', response.status);
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function apiRequest(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken) await refreshCsrf();
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(url, { ...options, method, headers, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 403 && String(data.error || '').includes('Phiên bảo vệ')) {
      csrfToken = '';
    }
    throw new ApiError(data.error || 'Đã xảy ra lỗi. Vui lòng thử lại.', response.status, data.fields || {});
  }
  return data;
}

export function showToast(message, type = 'success') {
  let region = document.getElementById('toastRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toastRegion';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

export function showAlert(element, message) {
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
}

export function clearAlert(element) {
  if (!element) return;
  element.textContent = '';
  element.classList.remove('show');
}

export async function currentUser() {
  const data = await apiRequest('/api/auth/me');
  return data.authenticated ? data.user : null;
}

export async function logout() {
  await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  window.location.assign('/');
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

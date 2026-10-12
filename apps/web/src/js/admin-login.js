import { apiRequest, showAlert, clearAlert } from './api.js';
const form = document.getElementById('adminLoginForm');
const alertBox = document.getElementById('formAlert');
const button = form.querySelector('button[type="submit"]');
try {
  const me = await apiRequest('/api/auth/me');
  if (me.authenticated && me.user.role === 'admin') window.location.replace('/admin.html');
} catch { /* The form will surface errors when the user submits. */ }
form.addEventListener('submit', async (event) => {
  event.preventDefault(); clearAlert(alertBox);
  button.disabled = true;
  button.querySelector('.submit-label').textContent = 'Đang xác thực…';
  try {
    const data = await apiRequest('/api/auth/admin/login', { method: 'POST', body: JSON.stringify({ username: document.getElementById('username').value.trim(), password: document.getElementById('password').value }) });
    window.location.assign(data.redirect || '/admin.html');
  } catch (error) { showAlert(alertBox, error.message || 'Không thể đăng nhập quản trị.'); }
  finally { button.disabled = false; button.querySelector('.submit-label').textContent = 'Đăng nhập quản trị'; }
});

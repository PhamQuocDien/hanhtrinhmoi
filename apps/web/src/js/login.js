import { apiRequest, showAlert, clearAlert, showToast } from './api.js';

const form = document.getElementById('loginForm');
const alertBox = document.getElementById('formAlert');
const submitButton = form.querySelector('button[type="submit"]');
document.getElementById('showPassword').addEventListener('change', (event) => {
  document.getElementById('password').type = event.target.checked ? 'text' : 'password';
});

try {
  const me = await apiRequest('/api/auth/me');
  if (me.authenticated) window.location.replace(me.user.role === 'admin' ? '/admin.html' : me.user.role === 'teacher' ? '/teacher.html' : '/dashboard.html');
} catch { /* Keep sign-in visible if the service is temporarily unavailable. */ }

form.addEventListener('submit', async (event) => {
  event.preventDefault(); clearAlert(alertBox);
  form.querySelectorAll('.field-error').forEach((node) => { node.textContent = ''; });
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  submitButton.disabled = true;
  const label = submitButton.querySelector('.submit-label');
  label.textContent = 'Đang đăng nhập…';
  try {
    const data = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    showToast(data.message || 'Đăng nhập thành công.');
    window.location.assign(data.redirect || '/dashboard.html');
  } catch (error) {
    showAlert(alertBox, error.message || 'Không thể đăng nhập.');
    for (const [key, message] of Object.entries(error.fields || {})) {
      const node = form.querySelector(`[data-error="${key}"]`);
      if (node) node.textContent = message;
    }
  } finally {
    submitButton.disabled = false;
    label.textContent = 'Đăng nhập';
  }
});

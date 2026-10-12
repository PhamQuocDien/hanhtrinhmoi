import { apiRequest } from './api.js';

const menuButton = document.getElementById('mobileMenu');
const nav = document.querySelector('.main-nav');
menuButton?.addEventListener('click', () => {
  const isOpen = nav?.classList.toggle('open') || false;
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.textContent = isOpen ? '×' : '☰';
});
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => nav.classList.remove('open')));

try {
  const data = await apiRequest('/api/auth/me');
  if (data.authenticated) {
    document.querySelectorAll('a[href="/register.html"]').forEach((link) => {
      link.href = data.user.role === 'admin' ? '/admin.html' : '/dashboard.html';
      const text = link.querySelector('span[aria-hidden="true"]');
      link.textContent = data.user.role === 'admin' ? 'Mở quản trị' : 'Tiếp tục học';
      if (text) link.append(text);
    });
  }
} catch {
  // A public landing page remains usable while the API is unavailable.
}

import { apiRequest, showAlert, clearAlert } from './api.js';

const form = document.getElementById('registerForm');
const alertBox = document.getElementById('formAlert');
const submitButton = form.querySelector('button[type="submit"]');
const roleInput = document.getElementById('role');
const passwordInput = document.getElementById('password');
const passwordConfirm = document.getElementById('passwordConfirm');
const teacherInviteField = document.getElementById('teacherInviteField');
const teacherRegistrationCode = document.getElementById('teacherRegistrationCode');

function updateRoleFields() {
  const grade = document.getElementById('gradeField');
  grade.querySelector('label').textContent = roleInput.value === 'teacher' ? 'Môn / bộ môn giảng dạy' : roleInput.value === 'university_student' ? 'Ngành / năm học' : 'Lớp';
  document.getElementById('grade').placeholder = roleInput.value === 'teacher' ? 'Ví dụ: Tin học, Toán' : roleInput.value === 'university_student' ? 'Ví dụ: CNTT, năm 2' : 'Ví dụ: Lớp 7 hoặc Lớp 11';
  const isTeacher = roleInput.value === 'teacher';
  teacherInviteField.hidden = !isTeacher;
  teacherRegistrationCode.required = isTeacher;
}
roleInput.addEventListener('change', updateRoleFields);
updateRoleFields();

form.addEventListener('submit', async (event) => {
  event.preventDefault(); clearAlert(alertBox);
  form.querySelectorAll('.field-error').forEach((node) => { node.textContent = ''; });
  if (passwordInput.value !== passwordConfirm.value) {
    form.querySelector('[data-error="passwordConfirm"]').textContent = 'Hai mật khẩu chưa khớp.';
    passwordConfirm.focus();
    return;
  }
  if (!document.getElementById('agree').checked) {
    showAlert(alertBox, 'Vui lòng xác nhận thông tin trước khi tạo tài khoản.');
    return;
  }
  const body = {
    fullName: document.getElementById('fullName').value.trim(),
    email: document.getElementById('email').value.trim(),
    role: roleInput.value,
    school: document.getElementById('school').value.trim(),
    grade: document.getElementById('grade').value.trim(),
    password: passwordInput.value,
    teacherRegistrationCode: teacherRegistrationCode.value
  };
  submitButton.disabled = true;
  submitButton.querySelector('.submit-label').textContent = 'Đang tạo tài khoản…';
  try {
    const data = await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
    window.location.assign(data.redirect || '/dashboard.html');
  } catch (error) {
    showAlert(alertBox, error.message || 'Không thể tạo tài khoản.');
    for (const [key, message] of Object.entries(error.fields || {})) {
      const node = form.querySelector(`[data-error="${key}"]`);
      if (node) node.textContent = message;
    }
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('.submit-label').textContent = 'Tạo tài khoản';
  }
});

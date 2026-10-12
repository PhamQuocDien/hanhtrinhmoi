import { apiRequest, currentUser, logout, showAlert, showToast, escapeHtml } from './api.js';

const alertBox = document.getElementById('dashboardAlert');
const roleLabels = { student: 'Học sinh', university_student: 'Sinh viên', teacher: 'Giáo viên', admin: 'Quản trị viên' };
const topicLabels = { cpp: 'C++', javascript: 'JavaScript', css_html: 'HTML/CSS', java: 'Java', csharp: 'C#', python: 'Python', math: 'Toán', english: 'Tiếng Anh', toeic: 'TOEIC', mos: 'MOS', soft_skills: 'Kỹ năng mềm', school_subjects: 'Môn phổ thông' };

async function init() {
  try {
    const user = await currentUser();
    if (!user) return window.location.replace('/login.html');
    if (user.role === 'admin') return window.location.replace('/admin.html');
    if (user.role === 'teacher') return window.location.replace('/teacher.html');
    document.getElementById('userName').textContent = user.fullName;
    document.getElementById('userAvatar').textContent = (user.fullName.trim()[0] || 'H').toLocaleUpperCase('vi-VN');
    document.getElementById('welcomeTitle').textContent = `Chào ${user.fullName.split(/\s+/).slice(-2).join(' ')}!`;
    document.getElementById('roleStat').textContent = roleLabels[user.role] || 'Người học';
    const survey = await apiRequest('/api/survey/me');
    if (survey.completed && survey.response) {
      document.getElementById('surveyStat').textContent = 'Đã xong';
      document.getElementById('surveyStatNote').textContent = 'Câu trả lời đã được lưu';
      document.getElementById('topicStat').textContent = String(survey.response.topics?.length || 0);
      document.getElementById('welcomeDescription').textContent = 'Khảo sát đầu vào đã được lưu. Bạn có thể bắt đầu lộ trình phổ thông lớp 1–12 V5, học từng phần, làm đề ngẫu nhiên theo đúng chủ đề và theo dõi tiến độ.';
      document.getElementById('primaryAction').textContent = 'Bắt đầu học ↗';
      document.getElementById('primaryAction').href = '/learning.html';
      document.getElementById('nextSteps').innerHTML = `<div class="mini-list-item"><span class="mini-list-icon">✓</span><div><strong>Đã lưu mục tiêu học tập</strong><p>Mục tiêu: ${escapeHtml(survey.response.goal)} · Trình độ: ${escapeHtml(survey.response.currentLevel)}.</p></div></div><div class="mini-list-item"><span class="mini-list-icon">02</span><div><strong>Lĩnh vực bạn quan tâm</strong><p>${(survey.response.topics || []).map((topic) => escapeHtml(topicLabels[topic] || topic)).join(' · ') || 'Chưa có dữ liệu'}</p></div></div><div class="mini-list-item"><span class="mini-list-icon">03</span><div><strong>Đi tới lộ trình học</strong><p>Chọn chương trình sách, lớp và môn; mỗi phần có kiểm tra ngắn và bài kế tiếp chỉ mở khi đạt điểm yêu cầu.</p><a href="/learning.html">Mở lộ trình học →</a></div></div>`;
    } else {
      document.getElementById('surveyStat').textContent = 'Chưa xong';
      document.getElementById('surveyStatNote').textContent = 'Khoảng 3 phút để hoàn thành';
      document.getElementById('topicStat').textContent = '0';
    }
  } catch (error) { showAlert(alertBox, error.message || 'Không tải được bảng điều khiển.'); }
}

document.getElementById('logoutButton').addEventListener('click', async () => {
  try { await logout(); } catch (error) { showToast(error.message, 'error'); }
});
init();

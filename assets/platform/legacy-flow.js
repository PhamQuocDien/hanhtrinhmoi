'use strict';
(function(){
  const api=window.HanhTrinhApi;
  const page=document.body?.dataset.legacyFlow||'';
  const esc=value=>String(value??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  const nav=[['index.html','Tổng quan','hub'],['lo-trinh-hoc-tap.html','Lộ trình','learning'],['bai-kiem-tra.html','Kỳ thi','test'],['survey.html','Khảo sát','survey'],['placement.html','Placement','placement'],['thong-bao.html','Thông báo','notifications'],['giai-dau.html','Giải đấu','tournaments'],['profile.html','Hồ sơ','profile']];
  function injectBar(){
    const bar=document.createElement('nav');bar.className='platform-legacy-bar';bar.innerHTML=`<a class="platform-legacy-brand" href="index.html"><span class="platform-legacy-mark">HT</span><span>Hành Trình Mới</span></a><div class="platform-legacy-links">${nav.map(([href,label,key])=>`<a class="${page===key?'is-current':''}" href="${href}">${label}</a>`).join('')}</div><div class="platform-legacy-account"><span id="legacy-account-label">Đang tải…</span><a href="profile.html">Hồ sơ</a></div>`;document.body.prepend(bar);document.body.classList.add('platform-legacy-page');
  }
  function context(text,detail,link){const el=document.createElement('section');el.className='platform-legacy-context';el.innerHTML=`<b>${esc(text)}</b><span class="context-muted">${esc(detail||'')}</span>${link?`<a href="${link.href}">${esc(link.label)} →</a>`:''}`;const bar=document.querySelector('.platform-legacy-bar');(bar?.nextSibling?document.body.insertBefore(el,bar.nextSibling):document.body.append(el));}
  async function load(){
    if(!api)return;injectBar();
    try{const profile=await api.profile();const account=profile?.account||{};const person=profile?.profile||{};const name=person.fullName||account.username||'bạn';const label=document.getElementById('legacy-account-label');if(label)label.innerHTML=`Xin chào, <strong>${esc(name)}</strong>`;}catch(error){const label=document.getElementById('legacy-account-label');if(label)label.textContent=error.status===401?'Chưa đăng nhập':'Không thể tải hồ sơ';}
    try{
      if(page==='learning'){const [dash,assign]=await Promise.all([api.learningDashboard(),api.learningAssignments()]);context('Learning workspace',`${dash?.minutesThisWeek||0} phút tuần này • ${dash?.activeDaysThisWeek||0} ngày hoạt động • ${(assign?.completed||0)}/${(assign?.total||0)} nhiệm vụ`,{href:'index.html',label:'Về Learning Hub'});}
      else if(page==='test'){const catalog=await api.testCatalog();context('Assessment workspace',`${catalog?.totalQuestions||0} câu hỏi • ${catalog?.catalog?.length||0} môn • server chấm điểm`,{href:'lo-trinh-hoc-tap.html',label:'Mở lộ trình'});}
      else if(page==='notifications'){const items=await api.notificationsList();context('Notification center',`${Array.isArray(items)?items.length:0} thông báo mới từ hệ thống`,{href:'index.html',label:'Về Learning Hub'});}
      else if(page==='quests'){const user=await api.userProgress();context('Mission & achievement flow',`${user?.quests?.length||0} nhiệm vụ • ${user?.score||0} điểm hoạt động`,{href:'ngoi-nha-cua-be.html',label:'Xem thành tích'});}
      else if(page==='tournaments'){const tours=await api.tournaments('active');const items=Array.isArray(tours)?tours:(tours?.items||[]);context('Community competition flow',`${items.length} giải đang mở • điểm đấu trường không quy đổi`,{href:'nhiem-vu.html',label:'Xem nhiệm vụ'});}
      else if(page==='parent'){context('Family learning flow','Theo dõi tiến độ, mastery và hoạt động gần đây của các tài khoản đã liên kết',{href:'index.html',label:'Về Learning Hub'});}
      else if(page==='achievements'){const data=await api.achievements();const unlocked=Array.isArray(data?.unlocked)?data.unlocked.length:0;context('Milestones & achievements',`${unlocked} cột mốc đã mở khóa`,{href:'index.html',label:'Về Learning Hub'});}
    }catch(error){context('Platform data flow','Không thể đồng bộ dữ liệu lúc này',null);const node=document.querySelector('.platform-legacy-context');if(node)node.classList.add('context-error');}
  }
  document.addEventListener('DOMContentLoaded',()=>{load();const script=document.createElement('script');script.src='assets/platform/account-menu.js';document.body.append(script)});
})();
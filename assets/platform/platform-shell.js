'use strict';
(function(){
  const api=window.HanhTrinhApi;
  const $=id=>document.getElementById(id);
  const list=value=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.data)?value.data:[];
  const text=value=>String(value??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  function set(id,value){const el=$(id);if(el)el.textContent=value}
  function renderPlan(plan){const items=list(plan?.weeklyPlan||plan?.week||plan?.items);const wrap=$('weekly-plan');if(!wrap)return;if(!items.length){wrap.innerHTML='<p class="muted">Chưa có kế hoạch tuần. Hoàn thành khảo sát và placement để tạo kế hoạch.</p>';return}wrap.innerHTML=items.slice(0,5).map((item,i)=>`<div class="plan-row"><b>${['◷','◈','◇','▣','✦'][i%5]}</b><span><strong>${text(item.title||item.name||item.subject||`Nhiệm vụ ${i+1}`)}</strong><small>${text(item.description||item.skill||item.duration||'Hoạt động học tập cá nhân hóa')}</small></span></div>`).join('')}
  function renderMastery(items){const wrap=$('weak-skills');if(!wrap)return;if(!items.length){wrap.innerHTML='<p class="muted">Chưa có dữ liệu mastery. Kết quả bài học sẽ được cập nhật tại đây.</p>';return}wrap.innerHTML=items.slice(0,5).map(item=>`<div class="skill-row"><b>${text(item.skill||item.name||item.subject||'Kỹ năng')}</b><span>${text(item.level||item.masteryLevel||item.score||'Đang luyện')}</span></div>`).join('')}
  function renderAchievements(value){const wrap=$('achievements');if(!wrap)return;const catalog=list(value?.catalog||value);const unlocked=new Set(list(value?.unlocked).map(x=>String(x.achievementId||x._id)));if(!catalog.length){wrap.innerHTML='<p class="muted">Chưa có thành tích mới.</p>';return}wrap.innerHTML=catalog.slice(0,4).map(item=>`<div class="achievement-row"><b>${unlocked.has(String(item._id))?'🏅':'○'}</b><span><strong>${text(item.name||item.code||'Achievement')}</strong><small>${text(item.description||'Tiếp tục học để mở khóa thành tích.')}</small></span></div>`).join('')}
  async function load(){
    if(!api||document.body?.dataset.platformPage!=='hub')return;
    try{
      const [profile,plan,mastery,achievements]=await Promise.all([api.get('/api/profile'),api.get('/api/learning-platform/plan'),api.mastery(),api.achievements()]);
      const account=profile?.account||{}, person=profile?.profile||{}, education=profile?.education||{};
      const name=person.fullName||account.username||'bạn';set('greeting',`Chào mừng trở lại, ${name}`);set('avatar-link',(name[0]||'?').toUpperCase());set('verification-chip',account.verificationStatus==='VERIFIED'?'Đã xác minh':(account.verificationStatus||'Chưa xác minh'));
      const level=plan?.currentLevel||plan?.level||education.educationGrade||'—';const target=plan?.target||plan?.goal||'mục tiêu đang được thiết lập';const gap=plan?.gap??plan?.scoreGap??'—';set('current-level',level);set('current-target',target);set('learning-gap',gap);set('hero-progress',`${Math.round(Number(plan?.progress||0))}%`);set('next-title',plan?.nextLesson?.title||plan?.nextLesson?.name||'Sẵn sàng cho bài học đầu tiên');set('next-description',plan?.nextLesson?.description||'Mở lộ trình để chọn môn học và bài học phù hợp với cấp lớp của bạn.');set('next-subject',plan?.nextLesson?.subject||plan?.nextLesson?.skill||'Learning path');set('next-duration',plan?.nextLesson?.duration?`${plan.nextLesson.duration} phút`:'Theo kế hoạch');const progress=$('next-progress');if(progress)progress.style.width=`${Math.min(100,Math.max(0,Number(plan?.nextLesson?.progress||plan?.progress||0)))}%`;
      renderPlan(plan);renderMastery(list(mastery));renderAchievements(achievements);set('plan-status',plan?.status||'Đã đồng bộ');
      const onboarding=$('onboarding');if(onboarding){const hasPersonalization=Boolean(plan?.id||plan?._id||list(plan?.subjects).length||plan?.nextLesson);onboarding.hidden=hasPersonalization}
    }catch(error){const alert=$('hub-alert');if(alert){alert.hidden=false;alert.textContent=error.status===401?'Vui lòng đăng nhập để mở Learning Hub.':`Chưa thể tải dữ liệu học tập: ${error.message}`}if(error.status===401)setTimeout(()=>{window.location.href='login.html'},900)}
  }
  document.addEventListener('DOMContentLoaded',()=>{load();const script=document.createElement('script');script.src='assets/platform/account-menu.js';document.body.append(script)});
})();
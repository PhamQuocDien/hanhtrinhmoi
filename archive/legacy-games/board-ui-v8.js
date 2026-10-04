(()=>{'use strict';
document.body.classList.add('board-page');
const storageKey='boardUiPreferencesV9';
let prefs={contrast:false,largeControls:false};
try{prefs={...prefs,...JSON.parse(localStorage.getItem(storageKey)||'{}')}}catch{}
function savePrefs(){localStorage.setItem(storageKey,JSON.stringify(prefs))}
function applyPrefs(){document.body.classList.toggle('board-high-contrast',Boolean(prefs.contrast));document.body.classList.toggle('board-large-controls',Boolean(prefs.largeControls));contrast.textContent=prefs.contrast?'◐ Tương phản: Bật':'◐ Tương phản';large.textContent=prefs.largeControls?'Aa Nút lớn: Bật':'Aa Nút lớn'}
const tools=document.createElement('div');tools.className='board-v8-tools';tools.setAttribute('aria-label','Công cụ hỗ trợ bàn cờ');
const full=document.createElement('button');full.type='button';full.textContent='⛶ Toàn màn hình';full.title='Mở hoặc thoát toàn màn hình';full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();setTimeout(()=>window.dispatchEvent(new Event('resize')),80)}catch{boardNotice('Thiết bị không cho phép mở toàn màn hình.')}};
const contrast=document.createElement('button');contrast.type='button';contrast.onclick=()=>{prefs.contrast=!prefs.contrast;savePrefs();applyPrefs()};
const large=document.createElement('button');large.type='button';large.onclick=()=>{prefs.largeControls=!prefs.largeControls;savePrefs();applyPrefs()};
const top=document.createElement('button');top.type='button';top.textContent='↑ Đầu trang';top.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
tools.append(full,contrast,large,top);document.body.append(tools);
const banner=document.createElement('div');banner.className='board-network hidden';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');document.body.append(banner);
const notice=document.createElement('div');notice.className='board-notice hidden';notice.setAttribute('role','status');notice.setAttribute('aria-live','assertive');document.body.append(notice);
let timer,noticeTimer;
function showNetwork(online){banner.classList.remove('hidden','online');banner.classList.toggle('online',online);banner.textContent=online?'✓ Đã kết nối lại':'⚠ Mất kết nối mạng';clearTimeout(timer);if(online)timer=setTimeout(()=>banner.classList.add('hidden'),1800)}
function boardNotice(message,duration=3200){notice.textContent=String(message||'');notice.classList.remove('hidden');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.add('hidden'),duration)}
window.boardNotice=boardNotice;
window.addEventListener('online',()=>showNetwork(true));window.addEventListener('offline',()=>showNetwork(false));
document.querySelectorAll('canvas,.board,.othello-grid,#myBoard,#main-board').forEach(el=>{el.addEventListener('contextmenu',event=>event.preventDefault());el.setAttribute('tabindex',el.getAttribute('tabindex')||'0')});
window.addEventListener('orientationchange',()=>setTimeout(()=>window.dispatchEvent(new Event('resize')),180));document.addEventListener('fullscreenchange',()=>setTimeout(()=>window.dispatchEvent(new Event('resize')),100));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});if(event.key.toLowerCase()==='h')boardNotice('Mẹo: dùng nút Toàn màn hình, Tương phản hoặc Nút lớn ở góc dưới.')});
applyPrefs();
})();

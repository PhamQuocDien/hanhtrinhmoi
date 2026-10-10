(()=>{
'use strict';
const BLOCK=50;
const CENTER={x:2350,z:-2700};
const RADIUS=7;
const MIN_Y=-12;
const BEDROCK_Y=-13;
const TYPE_INFO={
 grass:{id:'floor_grass',name:'Khối cỏ',color:'#5eaa58',hardness:1,tier:0,icon:'🌿'},
 dirt:{id:'floor_dirt',name:'Đất',color:'#795238',hardness:1,tier:0,icon:'🟤'},
 stone:{id:'survival_stone',name:'Đá',color:'#747d8c',hardness:2,tier:1,icon:'🪨'},
 deepstone:{id:'survival_deepslate',name:'Đá sâu',color:'#45505c',hardness:3.4,tier:1,icon:'⬛'},
 foundation:{id:'survival_deepslate',name:'Móng đá cổ',color:'#2f3542',hardness:4,tier:2,icon:'🧱'},
 coal:{id:'voxel_coal',name:'Than',color:'#343a40',hardness:2,tier:1,icon:'⚫'},
 copper:{id:'voxel_copper',name:'Đồng',color:'#bd6c43',hardness:2,tier:1,icon:'🟠'},
 iron:{id:'voxel_iron',name:'Sắt',color:'#b8c1c8',hardness:3,tier:1,icon:'⛏️'},
 gold:{id:'voxel_gold',name:'Vàng',color:'#e8b923',hardness:3,tier:2,icon:'🟡'},
 emerald:{id:'voxel_emerald',name:'Ngọc lục bảo',color:'#27ae60',hardness:4,tier:2,icon:'🟢'},
 diamond:{id:'voxel_diamond',name:'Kim cương',color:'#54bfe2',hardness:5,tier:3,icon:'💎'},
 amethyst:{id:'voxel_amethyst',name:'Thạch anh tím',color:'#8e5ac8',hardness:4,tier:2,icon:'🟣'},
 log:{id:'survival_log',name:'Gỗ thô',color:'#875a31',hardness:2,tier:0,icon:'🪵'},
 leaves:{id:'survival_berry',name:'Tán lá',color:'#3f9148',hardness:1,tier:0,icon:'🍃'}
};
const TOOL_INFO={
 '':{name:'Tay không',tier:0,power:1},
 tool_wood_pickaxe:{name:'Cuốc gỗ',tier:1,power:1.6},
 tool_stone_pickaxe:{name:'Cuốc đá',tier:2,power:2.35},
 tool_iron_pickaxe:{name:'Cuốc sắt',tier:3,power:3.4}
};
const RECIPES={
 wood_pickaxe:{name:'Cuốc gỗ',icon:'⛏️',needs:'3 Gỗ thô'},
 stone_pickaxe:{name:'Cuốc đá',icon:'⛏️',needs:'2 Gỗ + 3 Đá'},
 iron_pickaxe:{name:'Cuốc sắt',icon:'⚒️',needs:'2 Gỗ + 3 Sắt'},
 torch:{name:'4 Đuốc',icon:'🔥',needs:'1 Gỗ + 1 Than'},
 bread:{name:'Bánh mì',icon:'🍞',needs:'3 Quả rừng'}
};
let active=false;
let generated=false;
let terrain=[];
const liveKeys=new Map();
let removed=new Set();
let damage=new Map();
let state={health:100,hunger:100,stamina:100,xp:0,level:1,deaths:0,equippedTool:''};
let lastVitalsSync=0;
let tickTimer=null;
let statusTimer=null;
let craftingOpen=false;
let serverOnline=false;
let hud;
const materialCache=new Map();
function hash(x,y,z){let value=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);value=Math.imul(value^(value>>>13),1274126177);value^=value>>>16;return(value>>>0)/4294967295}
async function api(url,options={}){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options,signal:controller.signal});const type=r.headers.get('content-type')||'';const d=type.includes('application/json')?await r.json().catch(()=>({})):{};if(!r.ok){const message=r.status===401?'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.':r.status===503?'Máy chủ đang khởi động hoặc mất kết nối cơ sở dữ liệu.':d.message||`Không thể thực hiện (${r.status})`;throw new Error(message)}return d}catch(error){if(error.name==='AbortError')throw new Error('Máy chủ phản hồi quá lâu. Hãy bấm Kết nối lại.');if(error instanceof TypeError)throw new Error('Không thể kết nối máy chủ. Hãy kiểm tra Render rồi thử lại.');throw error}finally{clearTimeout(timeout)}}
function safeNumber(v,fallback=0){v=Number(v);return Number.isFinite(v)?v:fallback}
function applyState(next={}){state={...state,...next};state.health=Math.max(0,Math.min(100,safeNumber(state.health,100)));state.hunger=Math.max(0,Math.min(100,safeNumber(state.hunger,100)));state.stamina=Math.max(0,Math.min(100,safeNumber(state.stamina,100)));state.xp=Math.max(0,safeNumber(state.xp));state.level=Math.max(1,safeNumber(state.level,1));renderHUD()}
function currentTool(){const selected=hotbarSlots?.[selectedHotbarIndex]||'';const id=TOOL_INFO[selected]?selected:'';return{id,...TOOL_INFO[id]}}
function notify(message,error=false){if(typeof showNotification==='function')showNotification(message,error)}
function ensureUI(){
 if(document.getElementById('survival-hud-v11'))return;
 hud=document.createElement('aside');hud.id='survival-hud-v11';hud.innerHTML=`
  <div class="survival-title"><span>🏕️ Sinh tồn</span><b id="survival-level-v11">Cấp 1</b><button type="button" data-action="collapse" aria-label="Thu gọn bảng sinh tồn">−</button></div>
  <div class="survival-connection"><span id="survival-online-v12">● Đang kết nối</span><button type="button" data-action="reconnect">Kết nối lại</button></div>
  <div class="survival-bar"><label>❤️ Máu</label><i><b id="survival-health-v11"></b></i><span id="survival-health-text-v11">100</span></div>
  <div class="survival-bar"><label>🍗 Đói</label><i><b id="survival-hunger-v11"></b></i><span id="survival-hunger-text-v11">100</span></div>
  <div class="survival-bar"><label>⚡ Thể lực</label><i><b id="survival-stamina-v11"></b></i><span id="survival-stamina-text-v11">100</span></div>
  <div class="survival-meta"><span id="survival-tool-v11">✋ Tay không</span><span id="survival-xp-v11">0 XP</span></div>
  <div class="survival-depth"><span>⛏️ Độ sâu</span><b id="survival-depth-v12">Mặt đất</b></div>
  <div class="survival-actions"><button type="button" data-action="craft">🛠️ Chế tạo</button><button type="button" data-action="eat">🍞 Ăn</button><button type="button" data-action="leave">🏠 Về làng</button></div>`;
 document.body.append(hud);
 const craft=document.createElement('section');craft.id='survival-craft-v11';craft.setAttribute('aria-hidden','true');craft.innerHTML=`<header><b>🛠️ Bàn chế tạo</b><button type="button" aria-label="Đóng">×</button></header><p>Nguyên liệu được lấy trực tiếp từ ba lô. Công thức được kiểm tra trên máy chủ.</p><div class="craft-grid">${Object.entries(RECIPES).map(([id,r])=>`<button type="button" data-recipe="${id}"><span>${r.icon}</span><b>${r.name}</b><small>${r.needs}</small></button>`).join('')}</div><button type="button" class="reset-world-v11">Tạo lại đảo sinh tồn</button>`;
 document.body.append(craft);
 hud.querySelector('[data-action=craft]').addEventListener('click',toggleCraft);
 hud.querySelector('[data-action=eat]').addEventListener('click',eatSelected);
 hud.querySelector('[data-action=leave]').addEventListener('click',leaveSurvival);
 hud.querySelector('[data-action=reconnect]').addEventListener('click',reconnectServer);
 hud.querySelector('[data-action=collapse]').addEventListener('click',()=>{const collapsed=hud.classList.toggle('collapsed');hud.querySelector('[data-action=collapse]').textContent=collapsed?'+':'−';localStorage.setItem('survival-hud-collapsed-v12',collapsed?'1':'0')});
 if(localStorage.getItem('survival-hud-collapsed-v12')==='1'){hud.classList.add('collapsed');hud.querySelector('[data-action=collapse]').textContent='+'}
 craft.querySelector('header button').addEventListener('click',toggleCraft);
 craft.querySelectorAll('[data-recipe]').forEach(button=>button.addEventListener('click',()=>craftItem(button.dataset.recipe)));
 craft.querySelector('.reset-world-v11').addEventListener('click',resetWorld);
 const modes=document.querySelector('.room-mode-v10');
 if(modes&&!modes.querySelector('[data-survival-v11]')){
   const button=document.createElement('button');button.type='button';button.dataset.survivalV11='1';button.textContent='🏕️ Sinh tồn';button.addEventListener('click',enterSurvival);modes.append(button);
 }
 const help=document.querySelector('.room-help-v10');if(help)help.innerHTML='<b>Sinh tồn:</b> trái đào • phải đặt • <b>V:</b> về làng • <b>C:</b> chế tạo • <b>F:</b> ăn';
 renderHUD();
}
function renderHUD(){
 if(!hud)return;
 const values=[['health',state.health],['hunger',state.hunger],['stamina',state.stamina]];
 values.forEach(([key,value])=>{const bar=document.getElementById(`survival-${key}-v11`),text=document.getElementById(`survival-${key}-text-v11`);if(bar)bar.style.width=`${value}%`;if(text)text.textContent=Math.round(value)});
 const tool=currentTool();
 const level=document.getElementById('survival-level-v11'),toolEl=document.getElementById('survival-tool-v11'),xp=document.getElementById('survival-xp-v11');
 if(level)level.textContent=`Cấp ${state.level}`;if(toolEl)toolEl.textContent=`${tool.id?'⛏️':'✋'} ${tool.name}`;if(xp)xp.textContent=`${Math.round(state.xp)} XP`;const depth=document.getElementById('survival-depth-v12');if(depth&&typeof controls!=='undefined'){const gy=Math.floor((controls.getObject().position.y-BLOCK/2)/BLOCK);depth.textContent=gy>=0?'Mặt đất':gy<=MIN_Y+1?`Tầng móng ${Math.abs(gy)}`:`Tầng ${Math.abs(gy)}`}
 const online=document.getElementById('survival-online-v12');if(online){online.textContent=serverOnline?'● Đã kết nối':'● Ngoại tuyến';online.classList.toggle('online',serverOnline);online.classList.toggle('offline',!serverOnline)}
 hud.classList.toggle('show',active);
}
function blockMaterial(type){if(materialCache.has(type))return materialCache.get(type);const mat=createBlockMaterial(TYPE_INFO[type]?.color||'#777');materialCache.set(type,mat);return mat}
function topLevel(gx,gz){const n=hash(gx,19,gz);return n>.82?2:n>.48?1:0}
function isCaveAt(gx,gy,gz){if(gy>-2||gy<=MIN_Y+1)return false;const primary=hash(gx*3+gy,gy*5-gz,gz*3-gx),secondary=hash(gx+91,gy-37,gz+53);return primary>.89&&secondary>.34}
function typeAt(gx,gy,gz,top){if(gy===top)return'grass';if(gy>=top-2)return'dirt';if(isCaveAt(gx,gy,gz))return null;const r=hash(gx,gy,gz);if(gy<=-8&&r>.985)return'diamond';if(gy<=-6&&r>.971)return'emerald';if(gy<=-5&&r>.948)return'amethyst';if(gy<=-4&&r>.91)return'gold';if(gy<=-3&&r>.84)return'iron';if(gy<=-2&&r>.76)return'copper';if(r>.64)return'coal';if(gy<=MIN_Y+1)return'foundation';if(gy<=-7)return'deepstone';return'stone'}
function keyOf(gx,gy,gz){return`${gx}:${gy}:${gz}`}
function addBlock(gx,gy,gz,type,{bedrock=false}={}){
 if(!bedrock&&!type)return null;const key=keyOf(gx,gy,gz);if((!bedrock&&removed.has(key))||liveKeys.has(key))return null;
 const mesh=new THREE.Mesh(sharedBlockGeo,bedrock?createBlockMaterial('#20252b'):blockMaterial(type));
 mesh.position.set(CENTER.x+gx*BLOCK,gy*BLOCK+BLOCK/2,CENTER.z+gz*BLOCK);mesh.castShadow=graphicsPreset?.shadows!==false;mesh.receiveShadow=true;mesh.updateMatrixWorld(true);
 mesh.userData={id:bedrock?'survival_bedrock':TYPE_INFO[type]?.id,bbox:new THREE.Box3().setFromObject(mesh),survivalBlock:!bedrock,survivalBedrock:bedrock,blockType:type,blockKey:key,hardness:TYPE_INFO[type]?.hardness||1,requiredTier:TYPE_INFO[type]?.tier||0};
 scene.add(mesh);objects.push(mesh);terrain.push(mesh);liveKeys.set(key,mesh);return mesh
}
function addTree(gx,gz,base){
 if(Math.abs(gx)<2&&Math.abs(gz)<2)return;if(hash(gx,77,gz)<.72)return;
 const trunkHeight=3+(hash(gx,78,gz)>.65?1:0);
 for(let i=1;i<=trunkHeight;i++)addBlock(gx,base+i,gz,'log');
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let dy=trunkHeight-1;dy<=trunkHeight+1;dy++){if(Math.abs(dx)+Math.abs(dz)+Math.abs(dy-trunkHeight)>3)continue;addBlock(gx+dx,base+dy+1,gz+dz,'leaves')}
}
function clearTerrain(){terrain.forEach(mesh=>{scene.remove(mesh);const i=objects.indexOf(mesh);if(i>=0)objects.splice(i,1)});terrain=[];liveKeys.clear();generated=false}
function generateTerrain(){
 clearTerrain();
 for(let gx=-RADIUS;gx<=RADIUS;gx++)for(let gz=-RADIUS;gz<=RADIUS;gz++){
   const edge=Math.max(Math.abs(gx),Math.abs(gz));if(edge===RADIUS&&hash(gx,3,gz)>.62)continue;
   const top=topLevel(gx,gz);
   addBlock(gx,BEDROCK_Y,gz,'stone',{bedrock:true});
   for(let gy=MIN_Y;gy<=top;gy++){const type=typeAt(gx,gy,gz,top);if(type)addBlock(gx,gy,gz,type)}
   if(edge<RADIUS-2&&top>=0&&hash(gx,41,gz)>.92)addTree(gx,gz,top);
 }
 generated=true;
}
async function loadState(){try{const data=await api('/api/survival/state');serverOnline=true;removed=new Set(data.state?.removedBlocks||[]);applyState(data.state||{});return data}catch(error){serverOnline=false;renderHUD();notify(`⚠️ ${error.message}`,true);return null}}
async function reconnectServer(){const data=await loadState();if(data){if(active)generateTerrain();notify('✅ Đã kết nối lại và đồng bộ thế giới.')}return Boolean(data)}
async function enterSurvival(){
 active=true;document.body.classList.add('survival-mode-v11');ensureUI();await loadState();generateTerrain();
 controls.getObject().position.set(CENTER.x,320,CENTER.z);velocity.set(0,0,0);isGameRunning=true;
 document.querySelectorAll('.room-mode-v10 button').forEach(b=>b.classList.toggle('active',Boolean(b.dataset.survivalV11)));
 notify(serverOnline?'🏕️ Đã vào đảo sinh tồn. Có thể đào cả móng đá đến lớp đá nền cuối cùng.':'🏕️ Đang xem thế giới ngoại tuyến. Hãy kết nối lại trước khi đào.');renderHUD();startTicks();
}
function leaveSurvival(){active=false;document.body.classList.remove('survival-mode-v11');clearTerrain();craftingOpen=false;document.getElementById('survival-craft-v11')?.classList.remove('show');controls.getObject().position.set(0,180,-250);velocity.set(0,0,0);window.RoomModesV10?.selectMode?.(document.querySelector('.room-mode-v10 [data-room-mode=explore]'));window.RoomModesV10?.setBaseHelp?.();renderHUD();syncVitals(true);notify('🏠 Đã trở về Làng Mơ Ước.')}
function toggleCraft(){craftingOpen=!craftingOpen;const panel=document.getElementById('survival-craft-v11');panel?.classList.toggle('show',craftingOpen);panel?.setAttribute('aria-hidden',String(!craftingOpen));if(craftingOpen&&!isMobile)controls.unlock()}
async function craftItem(recipeId){try{const data=await api('/api/survival/craft',{method:'POST',body:JSON.stringify({recipeId})});if(data.state)applyState(data.state);if(data.output){for(let i=0;i<(data.quantity||1);i++)houseState.inventory.push(data.output);if(TOOL_INFO[data.output]&&!hotbarSlots.includes(data.output)){const empty=hotbarSlots.indexOf(null);if(empty>=0)hotbarSlots[empty]=data.output}}renderHotbarUI();updateUI();notify(`🛠️ ${data.message}`)}catch(error){notify(`❌ ${error.message}`,true)}}
async function eatSelected(){const selected=hotbarSlots?.[selectedHotbarIndex];const food=['survival_berry','survival_bread'].includes(selected)?selected:houseState.inventory.includes('survival_bread')?'survival_bread':houseState.inventory.includes('survival_berry')?'survival_berry':'';if(!food)return notify('🍽️ Ba lô chưa có quả rừng hoặc bánh mì.',true);try{const data=await api('/api/survival/eat',{method:'POST',body:JSON.stringify({itemId:food})});const index=houseState.inventory.indexOf(food);if(index>=0)houseState.inventory.splice(index,1);applyState(data.state);renderHotbarUI();updateUI();notify(data.message)}catch(error){notify(`❌ ${error.message}`,true)}}
async function resetWorld(){if(!confirm('Tạo lại đảo sẽ phục hồi toàn bộ khối đã đào và đặt lại cấp sinh tồn. Tiếp tục?'))return;try{await api('/api/survival/reset',{method:'POST',body:'{}'});removed.clear();applyState({health:100,hunger:100,stamina:100,xp:0,level:1,deaths:0});generateTerrain();notify('🌍 Đã tạo lại đảo sinh tồn.')}catch(error){notify(`❌ ${error.message}`,true)}}
function toolCanMine(block){const tool=currentTool();if(block.userData.requiredTier>tool.tier){notify(`⛏️ Cần công cụ bậc ${block.userData.requiredTier}. Hãy chế tạo cuốc tốt hơn.`,true);return false}return true}
async function mineBlock(block){
 if(!active)return false;if(!serverOnline){notify('📡 Chưa kết nối máy chủ nên chưa thể đào. Bấm Kết nối lại.',true);return true}if(block.userData.survivalBedrock){notify('⬛ Đây là lớp đá nền cuối cùng của thế giới.',true);return true}if(!block.userData.survivalBlock)return false;if(!toolCanMine(block))return true;if(state.stamina<4){notify('⚡ Hết thể lực. Hãy chờ hồi phục.',true);return true}
 const tool=currentTool();const key=block.userData.blockKey;const current=(damage.get(key)||0)+tool.power;const need=block.userData.hardness*1.8;state.stamina=Math.max(0,state.stamina-2.5);damage.set(key,current);renderHUD();
 if(current<need){const pct=Math.min(99,Math.round(current/need*100));const el=document.getElementById('survival-tool-v11');if(el)el.textContent=`⛏️ Đang đào ${TYPE_INFO[block.userData.blockType]?.name||'khối'} ${pct}%`;return true}
 damage.delete(key);
 try{
   const data=await api('/api/survival/mine',{method:'POST',body:JSON.stringify({blockType:block.userData.blockType,blockKey:key,toolId:tool.id})});
   removed.add(key);liveKeys.delete(key);scene.remove(block);const oi=objects.indexOf(block);if(oi>=0)objects.splice(oi,1);const ti=terrain.indexOf(block);if(ti>=0)terrain.splice(ti,1);
   if(data.dropId){houseState.inventory.push(data.dropId);const empty=hotbarSlots.indexOf(null);if(!hotbarSlots.includes(data.dropId)&&empty>=0)hotbarSlots[empty]=data.dropId}
   applyState({xp:data.xp,level:data.level});renderHotbarUI();updateUI();playSFX('break');
   const label=TYPE_INFO[block.userData.blockType]?.name||'khối';notify(data.dropId?`📦 Đào được ${label}.`:`🍃 Đã phá ${label}, lần này không rơi vật phẩm.`);
 }catch(error){serverOnline=false;renderHUD();notify(`⚠️ ${error.message}`,true)}
 return true
}
function handleAction(type,hit){const target=hit?.object?.userData?.parentGroup||hit?.object;if(!target)return false;if(type==='break'&&(target.userData.survivalBlock||target.userData.survivalBedrock)){mineBlock(target);return true}if(type==='break'&&target.userData.isIndestructible&&active){notify('🏕️ Khu làng vẫn được bảo vệ. Hãy đào các khối trên đảo sinh tồn.',true);return true}return false}
async function syncVitals(force=false,died=false){if(!active&&!force)return;const now=Date.now();if(!force&&now-lastVitalsSync<12000)return;lastVitalsSync=now;try{const data=await api('/api/survival/sync',{method:'POST',body:JSON.stringify({health:state.health,hunger:state.hunger,stamina:state.stamina,equippedTool:currentTool().id,died})});applyState(data.state||{})}catch(error){console.warn('Survival sync:',error.message)}}
function startTicks(){if(tickTimer)return;tickTimer=setInterval(()=>{if(!active)return;state.hunger=Math.max(0,state.hunger-.55);state.stamina=Math.min(100,state.stamina+4);if(state.hunger<=0)state.health=Math.max(0,state.health-2);else if(state.hunger>72&&state.health<100)state.health=Math.min(100,state.health+.5);if(state.health<=0){state.health=100;state.hunger=70;state.stamina=100;controls.getObject().position.set(CENTER.x,320,CENTER.z);syncVitals(true,true);notify('💫 Bạn đã kiệt sức và hồi sinh tại trại.',true)}renderHUD();syncVitals(false)},5000);statusTimer=setInterval(async()=>{if(active&&generated&&!terrain.some(m=>m.parent===scene))generateTerrain();if(active&&!serverOnline)await reconnectServer()},10000)}
function setupKeys(){document.addEventListener('keydown',event=>{if(event.code==='KeyV'){event.preventDefault();active?leaveSurvival():enterSurvival()}if(event.code==='KeyC'&&active){event.preventDefault();toggleCraft()}if(event.code==='KeyF'&&active){event.preventDefault();eatSelected()}})}
function setup(){ensureUI();setupKeys();loadState();window.addEventListener('beforeunload',()=>syncVitals(true));window.SurvivalV11={handleAction,enter:enterSurvival,leave:leaveSurvival,reconnect:reconnectServer,isActive:()=>active,isFoundationHole:()=>false}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();

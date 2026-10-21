'use strict';
const BIZ={name:'Powerwall Dolly Hire',email:'Powerliftmcr@gmail.com',phone:'+44 7729 246809',web:'powerwalldollyhire.co.uk'};
// Source: powerwalldollyhire.co.uk/hire-terms, clause 9.2 "Damage and missing-item charges"
const CHECKS=[{name:'Damage to tyre',charge:'£60 each'},{name:'Loss of or damage to ratchet strap',charge:'£50 each'},{name:'Damage to lifting mechanism',charge:'£600'},{name:'Damage to clamp mechanism',charge:'£200'},{name:'Damage to lifting bar',charge:'£250 each'},{name:'Damage to brakes or brake components',charge:'£100'},{name:'Missing Powerwall lifting bar',charge:'£300 each'},{name:'Missing lifting socket',charge:'£30'},{name:'Tracker broken, removed, lost or damaged',charge:'£200'}];
// Google Drive folders the driver should pick when sharing a PDF
const DRIVE={Delivery:'Driver Deliveries',Collection:'Driver Collections'};
// ---------- storage (IndexedDB key-value) ----------
// Existing keys (unchanged): customers, items, hires, drivers. New keys: lastDriver, draft-delivery, draft-collection.
const DB=new Promise((res,rej)=>{const r=indexedDB.open('pdh',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function get(k,d){const db=await DB;return new Promise(r=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>r(q.result===undefined||q.result===null?d:q.result);q.onerror=()=>r(d)})}
async function put(k,v){const db=await DB;return new Promise((r,j)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=r;t.onerror=()=>j(t.error)})}
async function del(k){const db=await DB;return new Promise((r,j)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=r;t.onerror=()=>j(t.error)})}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const pad2=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`};
const nowTime=()=>{const d=new Date();return`${pad2(d.getHours())}:${pad2(d.getMinutes())}`};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=s=>document.querySelector(s);
const app=$('#app');
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3000)}
async function items(){let it=await get('items');if(!it){it=[{id:uid(),name:'Powerwall Dolly 1'},{id:uid(),name:'Powerwall Dolly 2'}];await put('items',it)}return it}
function fmt(d){if(!d)return'';const[y,m,dd]=d.split('-');return`${dd}/${m}/${y}`}
function addDays(s,n){const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
// ---------- hire length ----------
// Hire length = end date minus start date (collection day not charged), minimum 1: 21->22 Oct = 1 day, 2->6 Nov = 4 days, same day = 1 day.
function hireDays(start,end){if(!start||!end)return 0;const n=Math.round((new Date(end+'T00:00:00Z')-new Date(start+'T00:00:00Z'))/864e5);return Math.max(1,n)}
function hireTypeOf(days){return days>=7?'week':'day'}
// Always recomputed from the dates (older records may hold a hire type or an exclusive day count; both are ignored for display).
function hireLabel(h){const d=hireDays(h.start,h.end);return d?`${d} day${d>1?'s':''}`:'-'}
// ---------- navigation ----------
// A simple back stack so ← returns to the screen you came from (e.g. Settings -> the form you left).
let cur='home';const stack=[];let form=null;
function setHeader(t,back){$('#title').textContent=t;$('#back').hidden=!back}
async function leaveOk(){if(!form||!form.hasContent())return true;await form.flush();
 if(!confirm('Leave this form? Your progress is saved as a draft and will be restored when you come back.'))return false;form=null;return true}
async function go(v,...a){if(v===cur&&v!=='home')return;if(!await leaveOk())return;if(v==='home')stack.length=0;else if(cur!=='saved')stack.push(cur);cur=v;history.pushState({v},'');await VIEWS[v](...a)}
async function back(fromPop){if(!await leaveOk()){if(fromPop)history.pushState({v:cur},'');return}let v=stack.pop()||'home';while(v===cur&&stack.length)v=stack.pop();if(v===cur)v='home';cur=v;await VIEWS[v]()}
$('#back').onclick=()=>back(false);$('#settingsBtn').onclick=()=>go('settings');
addEventListener('popstate',()=>{if(cur!=='home')back(true)});
addEventListener('beforeunload',e=>{if(form&&form.dirty){form.flush();e.preventDefault();e.returnValue=''}});
// ---------- shared UI pieces ----------
function seg(name,opts,val){return `<div class="seg" data-seg="${name}">${opts.map(([v,l])=>`<button type="button" data-v="${v}" class="${v===val?'on':''}${v===val&&(v==='defect'||v==='worse')?' bad':''}">${l}</button>`).join('')}</div>`}
function segVal(n){const b=app.querySelector(`[data-seg="${n}"] .on`);return b?b.dataset.v:''}
function setSeg(n,v){app.querySelectorAll(`[data-seg="${n}"] button`).forEach(b=>{b.classList.toggle('on',b.dataset.v===v);b.classList.toggle('bad',b.dataset.v===v&&(v==='defect'||v==='worse'))})}
function bindSegs(onchange){app.querySelectorAll('.seg').forEach(s=>s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setSeg(s.dataset.seg,b.dataset.v);onchange&&onchange(s.dataset.seg,b.dataset.v)}))}
// pre = delivery record when used at collection, so items already defective at delivery are shown as pre-existing
function preDefect(pre,c){if(!pre||!pre.checks)return null;return pre.checks.find(k=>k.name===c.name&&k.status==='defect')||null}
function conditionHTML(pre){return `<div class="card"><h2>Condition checklist</h2><p class="hint">Standard charges from the hire terms (clause 9.2)${pre?'. Items marked at delivery are pre-existing: they are only charged if marked Worsened.':''}</p>${CHECKS.map((c,i)=>{const p=preDefect(pre,c);
 return `<div class="row"><span>${esc(c.name)}<br><small class="hint">${esc(c.charge)}</small>${p?`<br><small class="pre">Defect at delivery: ${esc(p.note||pre.notes||'no note')}</small>`:''}</span>${p?seg('chk'+i,[['same','Unchanged'],['worse','Worsened']],'same'):seg('chk'+i,[['ok','OK'],['defect','Defect']],'ok')}</div>
 <input id="cnote${i}" class="cnote" placeholder="${p?'What has got worse?':'Note for this defect (optional)'}" hidden>`}).join('')}
<label>Defect notes</label><textarea id="notes" placeholder="Describe any damage or missing parts"></textarea>
<label>Defect photos</label><input type="file" id="photoIn" accept="image/*" capture="environment" multiple><div class="photos" id="photos"></div></div>`}
function syncNotes(){CHECKS.forEach((c,i)=>{const v=segVal('chk'+i);const e=$('#cnote'+i);if(e)e.hidden=!(v==='defect'||v==='worse')})}
function sigHTML(){return `<div class="card"><h2>Customer signature</h2><label>Customer printed name</label><input id="custSigName"><canvas class="sig" id="custSig"></canvas><button type="button" class="btn sec" data-clear="custSig">Clear</button></div>
<div class="card"><h2>Driver signature</h2><label>Driver printed name</label><input id="drvSigName"><canvas class="sig" id="drvSig"></canvas><button type="button" class="btn sec" data-clear="drvSig">Clear</button></div>`}
async function driverHTML(dateLabel,dateHTML,timeLabel){const d=await get('drivers',[]);const last=await get('lastDriver',d[0]||'');
 return `<div class="card"><h2>Driver &amp; time</h2><label>Driver</label><select id="driver">${d.map(n=>`<option${n===last?' selected':''}>${esc(n)}</option>`).join('')}<option value="__new"${d.length?'':' selected'}>+ New driver...</option></select>
 <div id="driverNewWrap" hidden><label>New driver name</label><input id="driverNew" autocomplete="off"></div>
 ${dateHTML}<label>${timeLabel}</label><input type="time" id="time" value="${nowTime()}"></div>`}
function driverName(){const v=$('#driver').value;return v==='__new'?$('#driverNew').value.trim():v}
function bindDriver(){const s=()=>{$('#driverNewWrap').hidden=$('#driver').value!=='__new';const n=driverName();if(n&&!$('#drvSigName').dataset.edited)$('#drvSigName').value=n};
 $('#driver').addEventListener('change',s);$('#driverNew').addEventListener('input',s);$('#drvSigName').addEventListener('input',()=>$('#drvSigName').dataset.edited=1);s()}
let photos=[];
function bindPhotos(){photos=[];$('#photoIn').onchange=async e=>{for(const f of e.target.files)photos.push(await shrink(f));e.target.value='';drawPhotos();form&&form.touch()}}
function drawPhotos(){$('#photos').innerHTML=photos.map((p,i)=>`<div><img src="${p}"><button type="button" data-del="${i}">&times;</button></div>`).join('');$('#photos').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{photos.splice(+b.dataset.del,1);drawPhotos();form&&form.touch()})}
function shrink(file){return new Promise(res=>{const img=new Image();img.onload=()=>{const m=1200,s=Math.min(1,m/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=img.width*s;c.height=img.height*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);res(c.toDataURL('image/jpeg',0.7))};img.src=URL.createObjectURL(file)})}
// Each signature pad has its own canvas, context and state object; pads are rebuilt every time a form is drawn.
let pads={};
function makePad(id){const c=$('#'+id),r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;c.width=Math.max(1,r.width*dpr);c.height=Math.max(1,r.height*dpr);const x=c.getContext('2d');x.scale(dpr,dpr);x.lineWidth=2.5;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#000';
 const p={id,drawn:false,c,x};let down=false;const pt=e=>{const b=c.getBoundingClientRect();return[e.clientX-b.left,e.clientY-b.top]};
 c.onpointerdown=e=>{down=true;try{c.setPointerCapture(e.pointerId)}catch(_){}const[a,b]=pt(e);x.beginPath();x.moveTo(a,b);x.lineTo(a+.1,b+.1);x.stroke();p.drawn=true};
 c.onpointermove=e=>{if(!down)return;const[a,b]=pt(e);x.lineTo(a,b);x.stroke()};c.onpointerup=c.onpointercancel=()=>{if(down){down=false;form&&form.touch()}};
 p.clear=()=>{x.save();x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,c.width,c.height);x.restore();p.drawn=false};
 p.load=src=>new Promise(res=>{const i=new Image();i.onload=()=>{p.clear();x.save();x.setTransform(1,0,0,1,0,0);x.drawImage(i,0,0,c.width,c.height);x.restore();p.drawn=true;res()};i.onerror=res;i.src=src});
 p.data=()=>{const o=document.createElement('canvas');o.width=c.width;o.height=c.height;const ox=o.getContext('2d');ox.fillStyle='#fff';ox.fillRect(0,0,o.width,o.height);ox.drawImage(c,0,0);return o.toDataURL('image/jpeg',0.85)};
 return p}
function bindSigs(){pads={custSig:makePad('custSig'),drvSig:makePad('drvSig')};app.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{pads[b.dataset.clear].clear();form&&form.touch()})}
function readCond(pre){return{checks:CHECKS.map((c,i)=>{const v=segVal('chk'+i),note=($('#cnote'+i)||{}).value||'';const p=preDefect(pre,c);
  if(p)return{name:c.name,charge:c.charge,status:'defect',pre:true,preNote:p.note||'',change:v,note:v==='worse'?note.trim():''};
  return{name:c.name,charge:c.charge,status:v,note:v==='defect'?note.trim():''}}),notes:$('#notes').value.trim(),photos:[...photos]}}
function readSigs(err){if(!pads.custSig.drawn)err.push('Customer signature');if(!pads.drvSig.drawn)err.push('Driver signature');if(!$('#custSigName').value.trim())err.push('Customer printed name');if(!$('#drvSigName').value.trim())err.push('Driver printed name');
 const cs=pads.custSig.drawn?pads.custSig.data():'',ds=pads.drvSig.drawn?pads.drvSig.data():'';
 return{custSig:cs,drvSig:ds,custSigName:$('#custSigName').value.trim(),drvSigName:$('#drvSigName').value.trim()}}
async function rememberDriver(n){if(!n)return;const d=await get('drivers',[]);if(!d.includes(n)){d.push(n);await put('drivers',d)}await put('lastDriver',n)}
async function saveSerial(itemId,serial){const its=await items();const it=its.find(i=>i.id===itemId);if(it&&(it.serial||'')!==serial){it.serial=serial;await put('items',its)}}
// ---------- drafts (autosave of an in-progress form) ----------
function captureForm(){const f={v:{},segs:{},photos:[...photos],sigs:{}};
 app.querySelectorAll('input[id],select[id],textarea[id]').forEach(e=>{if(e.type==='file'||e.readOnly)return;f.v[e.id]=e.type==='checkbox'?e.checked:e.value});
 app.querySelectorAll('[data-seg]').forEach(s=>f.segs[s.dataset.seg]=segVal(s.dataset.seg));
 for(const k in pads)if(pads[k].drawn)f.sigs[k]=pads[k].data();
 if($('#drvSigName')&&$('#drvSigName').dataset.edited)f.drvEdited=1;return f}
async function applyForm(f,skip=[]){for(const[id,v]of Object.entries(f.v||{})){if(skip.includes(id))continue;const e=app.querySelector('#'+CSS.escape(id));if(!e)continue;if(e.type==='checkbox')e.checked=v;else e.value=v}
 for(const[n,v]of Object.entries(f.segs||{}))if(v)setSeg(n,v);
 photos=[...(f.photos||[])];if($('#photos'))drawPhotos();
 if(f.drvEdited&&$('#drvSigName'))$('#drvSigName').dataset.edited=1;
 for(const[k,src]of Object.entries(f.sigs||{}))if(pads[k])await pads[k].load(src)}
function startForm(key,extra){let timer=null;const F={key,dirty:false,restored:false,extra:extra||{},
 hasContent(){return F.dirty||F.restored},
 async flush(){clearTimeout(timer);if(!F.dirty||form!==F)return;const data=captureForm();Object.assign(data,F.extra.capture?F.extra.capture():{});await put(key,{savedAt:new Date().toISOString(),data})},
 touch(){if(form!==F)return;F.dirty=true;clearTimeout(timer);timer=setTimeout(()=>F.flush(),500)},
 async discard(){clearTimeout(timer);F.dirty=false;F.restored=false;await del(key)}};
 form=F;return F}
// one set of listeners for every form: any edit marks the current form dirty and schedules a draft save
app.addEventListener('input',()=>form&&form.touch());app.addEventListener('change',()=>form&&form.touch());app.addEventListener('click',e=>{if(form&&e.target.closest('.seg button'))form.touch()});
function draftBanner(d){const t=new Date(d.savedAt);return`<div class="card draft" id="draftBar"><b>Draft restored</b> <span class="hint">(saved ${pad2(t.getDate())}/${pad2(t.getMonth()+1)} ${pad2(t.getHours())}:${pad2(t.getMinutes())})</span><button type="button" class="btn sec" id="discardDraft">Discard draft</button></div>`}
// ---------- home ----------
async function home(){cur='home';form=null;setHeader('Powerwall Dolly Hire',false);const hires=await get('hires',[]);const act=hires.filter(h=>!h.collection).length;
 const dd=await get('draft-delivery'),dc=await get('draft-collection');
 app.innerHTML=`<button class="big del" id="goDel">Delivery${dd?'<div style="font-size:15px;font-weight:500;margin-top:6px">Draft in progress</div>':''}</button><button class="big col" id="goCol">Collection<div style="font-size:15px;font-weight:500;margin-top:6px">${act} active hire${act===1?'':'s'}${dc?' &middot; draft in progress':''}</div></button>
 <p class="hint" style="text-align:center">${BIZ.email} &middot; ${BIZ.phone}</p>`;
 $('#goDel').onclick=()=>go('delivery');$('#goCol').onclick=()=>go('collection');scrollTo(0,0)}
// ---------- delivery ----------
async function delivery(){setHeader('Delivery',true);form=null;const custs=await get('customers',[]);const its=await items();const draft=await get('draft-delivery');
 app.innerHTML=`${draft?draftBanner(draft):''}<div class="card"><h2>Customer</h2>${seg('custType',[['existing','Existing'],['new','New']],custs.length?'existing':'new')}
 <div id="custExisting"><label>Select customer</label><select id="custSel"><option value="">-- choose --</option>${custs.map(c=>`<option value="${c.id}">${esc(c.name)}${c.company?' ('+esc(c.company)+')':''}</option>`).join('')}</select></div>
 <div id="custNew"><label>Name</label><input id="cName" autocomplete="off"><label>Company</label><input id="cCompany"><label>Phone</label><input id="cPhone" type="tel"><label>Email</label><input id="cEmail" type="email"><label>Address</label><textarea id="cAddr"></textarea></div></div>
 <div class="card"><h2>Payment</h2><label>Prepaid?</label>${seg('prepaid',[['yes','Yes'],['no','No']],'')}
 <div id="payYes" hidden><label>Invoice number</label><input id="invoice"></div>
 <div id="payNo" hidden><label>Payment method</label><select id="payMethod"><option value="">-- choose --</option><option>BACS</option><option>Card</option><option>Cash</option></select>
 <label class="chk"><input type="checkbox" id="payConf"> Payment confirmed</label></div></div>
 <div class="card"><h2>Hire</h2><label>Item</label><select id="item"><option value="">-- choose --</option>${its.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select>
 <label>Dolly serial number</label><input id="serial" autocomplete="off" placeholder="Fills in from the saved item">
 <label>Fulfilment</label><select id="fulfil"><option value="delivery">Delivery</option><option value="self">Self-collection</option></select>
 <div id="addrWrap"><label>Delivery address</label><textarea id="delAddr"></textarea></div>
 <label>Hire start</label><input type="date" id="start" value="${today()}"><label>Hire end</label><input type="date" id="end" value="${today()}">
 <div class="quick"><button type="button" class="btn sec" data-quick="1">End +1 day</button><button type="button" class="btn sec" data-quick="7">End +1 week</button></div>
 <label>Hire length</label><input id="hireLen" readonly></div>
 ${await driverHTML('','<label>Delivery date</label><input id="delDate" readonly><p class="hint">The delivery date is the hire start date.</p>','Delivery time')}
 ${conditionHTML(null)}${sigHTML()}<div id="errs" class="err"></div><div class="save"><button class="btn" id="saveBtn">Save &amp; download PDF</button></div>`;
 const showCust=t=>{$('#custExisting').hidden=t!=='existing';$('#custNew').hidden=t!=='new'};
 const showPay=v=>{$('#payYes').hidden=v!=='yes';$('#payNo').hidden=v!=='no'};
 const len=()=>{const s=$('#start').value,e=$('#end').value;$('#delDate').value=fmt(s);$('#hireLen').value=s&&e?(e<s?'End date is before start date':hireLabel({start:s,end:e})):''};
 const sync=()=>{showCust(segVal('custType'));showPay(segVal('prepaid'));$('#addrWrap').hidden=$('#fulfil').value!=='delivery';len();syncNotes()};
 bindSegs((n,v)=>{if(n==='custType')showCust(v);if(n==='prepaid')showPay(v);syncNotes()});
 app.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{if(!$('#start').value)return;$('#end').value=addDays($('#start').value,+b.dataset.quick);len();form.touch()});
 $('#start').onchange=()=>{if($('#end').value&&$('#end').value<$('#start').value)$('#end').value=$('#start').value;len()};$('#end').onchange=len;
 $('#fulfil').onchange=()=>$('#addrWrap').hidden=$('#fulfil').value!=='delivery';
 $('#custSel').onchange=()=>{const c=custs.find(c=>c.id===$('#custSel').value);if(c){$('#delAddr').value=c.address||''}};
 $('#cAddr').oninput=()=>$('#delAddr').value=$('#cAddr').value;
 $('#item').onchange=()=>{const it=its.find(i=>i.id===$('#item').value);$('#serial').value=it&&it.serial||''};
 bindPhotos();bindSigs();bindDriver();
 const F=startForm('draft-delivery');
 if(draft){await applyForm(draft.data);F.restored=true;$('#driver').dispatchEvent(new Event('change'))}
 sync();
 if(draft)$('#discardDraft').onclick=async()=>{if(!confirm('Discard this draft and start a blank form?'))return;await F.discard();form=null;delivery()};
 $('#saveBtn').onclick=async()=>{const err=[];let cust;const ct=segVal('custType');
  if(ct==='existing'){cust=custs.find(c=>c.id===$('#custSel').value);if(!cust)err.push('Customer')}
  else{cust={id:uid(),name:$('#cName').value.trim(),company:$('#cCompany').value.trim(),phone:$('#cPhone').value.trim(),email:$('#cEmail').value.trim(),address:$('#cAddr').value.trim()};if(!cust.name)err.push('Customer name')}
  const pre=segVal('prepaid');if(!pre)err.push('Prepaid yes/no');if(pre==='yes'&&!$('#invoice').value.trim())err.push('Invoice number');if(pre==='no'&&!$('#payMethod').value)err.push('Payment method');
  const item=its.find(i=>i.id===$('#item').value);if(!item)err.push('Item');
  if($('#fulfil').value==='delivery'&&!$('#delAddr').value.trim())err.push('Delivery address');
  if(!$('#start').value||!$('#end').value)err.push('Hire dates');else if($('#end').value<$('#start').value)err.push('End date is before start date');
  const drv=driverName();if(!drv)err.push('Driver');if(!$('#time').value)err.push('Delivery time');
  const sig=readSigs(err);if(err.length){$('#errs').textContent='Please complete: '+err.join(', ');$('#errs').scrollIntoView({behavior:'smooth'});return}
  $('#errs').textContent='';const serial=$('#serial').value.trim();const days=hireDays($('#start').value,$('#end').value);
  const rec={id:uid(),createdAt:new Date().toISOString(),customer:cust,payment:{prepaid:pre==='yes',invoice:$('#invoice').value.trim(),method:pre==='no'?$('#payMethod').value:'',confirmed:pre==='no'&&$('#payConf').checked},
   item:{id:item.id,name:item.name,serial},fulfilment:$('#fulfil').value,address:$('#fulfil').value==='delivery'?$('#delAddr').value.trim():'',hireType:hireTypeOf(days),days,start:$('#start').value,end:$('#end').value,
   delivery:{date:$('#start').value,time:$('#time').value,savedAt:new Date().toISOString(),driver:drv,...readCond(null),...sig},collection:null};
  if(ct==='new'){custs.push(cust);await put('customers',custs)}
  const hires=await get('hires',[]);hires.push(rec);await put('hires',hires);await rememberDriver(drv);await saveSerial(item.id,serial);
  await F.discard();form=null;done(await makePdf(rec,'Delivery'),'Delivery')}}
// ---------- collection ----------
async function collection(){setHeader('Collection',true);form=null;const hires=await get('hires',[]);const act=hires.filter(h=>!h.collection);let draft=await get('draft-collection');
 if(draft&&!act.find(h=>h.id===draft.data.hireId)){await del('draft-collection');draft=null}
 app.innerHTML=`${draft?draftBanner(draft):''}<div class="card"><h2>Active hires</h2>${act.length?`<select id="hireSel"><option value="">-- choose hire --</option>${act.map(h=>`<option value="${h.id}">${esc(h.customer.name)} - ${esc(h.item.name)} (${fmt(h.start)} to ${fmt(h.end)})</option>`).join('')}</select>`:'<p class="hint">No active hires. Save a delivery first.</p>'}
 <div id="hireInfo"></div></div><div id="rest"></div>`;
 if(!act.length)return;let h=null;const its=await items();
 const F=startForm('draft-collection',{capture:()=>({hireId:h?h.id:'',qty:{...qty},dmgOverride})});
 let qty={},dmgOverride=false;
 if(draft){$('#discardDraft').onclick=async()=>{if(!confirm('Discard this draft and start a blank form?'))return;await F.discard();form=null;collection()}}
 const render=async(fromDraft)=>{h=act.find(x=>x.id===$('#hireSel').value);qty={};dmgOverride=false;pads={};
  if(!h){$('#rest').innerHTML='';$('#hireInfo').innerHTML='';return}
  const c=h.customer,p=h.payment||{},d=h.delivery||{};
  $('#hireInfo').innerHTML=`<label>Customer</label><input value="${esc(c.name+(c.company?' ('+c.company+')':''))}" readonly><label>Item</label><input value="${esc(h.item.name)}" readonly>
  <label>Hire dates</label><input value="${fmt(h.start)} to ${fmt(h.end)} - ${esc(hireLabel(h))}" readonly>
  <label>Payment</label><input value="${p.prepaid?'Prepaid'+(p.invoice?' (invoice '+esc(p.invoice)+')':'')+' - no hire balance due':'Not prepaid'+(p.method?' - '+esc(p.method):'')+(p.confirmed?', payment confirmed':', payment not confirmed')}" readonly>`;
  const serial=h.item.serial||((its.find(i=>i.id===h.item.id)||{}).serial)||'';
  $('#rest').innerHTML=`${await driverHTML('','<label>Collection date</label><input type="date" id="colDate">','Collection time')}
  <div class="card"><h2>Dolly</h2><label>Dolly serial number</label><input id="serial" value="${esc(serial)}"></div>
  ${conditionHTML(d)}
  <div class="card"><h2>Collected late?</h2><p class="hint" id="lateHint"></p>${seg('late',[['no','No'],['yes','Yes']],'no')}</div>
  ${sigHTML()}<div class="card" id="dmgCard" hidden><h2>Balance owed for damages</h2><p class="hint">Only new defects and items marked Worsened are charged. Pre-existing unchanged defects are £0. Adjust quantities or override the total if needed.</p><div id="dmgList"></div>
  <label>Calculated total</label><input id="dmgCalc" readonly><label>Amount owed (£) - edit to override</label><input id="dmgAmt" type="number" inputmode="decimal" step="0.01" min="0"><label>Damage notes</label><textarea id="dmgNotes"></textarea><label>Invoice to be raised?</label>${seg('dmgInv',[['yes','Yes'],['no','No']],'yes')}</div>
  <div id="errs" class="err"></div><div class="save"><button class="btn" id="saveBtn">Save &amp; download PDF</button></div>`;
  $('#colDate').value=h.end||today();
  const sugg=()=>{const late=$('#colDate').value>h.end;$('#lateHint').textContent=`Hire end: ${fmt(h.end)}. Suggested: ${late?'YES - late':'No - on time'}.`;setSeg('late',late?'yes':'no')};
  bindSegs(n=>{if(n.startsWith('chk')){syncNotes();dmgUpdate()}});
  bindPhotos();bindSigs();bindDriver();$('#custSigName').value='';
  $('#colDate').onchange=sugg;$('#dmgAmt').oninput=()=>dmgOverride=$('#dmgAmt').value!=='';
  if(fromDraft){const fd=draft.data;qty=fd.qty||{};await applyForm(fd,['hireSel']);dmgOverride=!!fd.dmgOverride;$('#driver').dispatchEvent(new Event('change'))}else sugg();
  syncNotes();dmgUpdate(fromDraft);if(fromDraft&&draft.data.v&&draft.data.v.dmgAmt!==undefined&&dmgOverride)$('#dmgAmt').value=draft.data.v.dmgAmt;
  $('#saveBtn').onclick=save};
 const dmgItems=()=>CHECKS.map((c,i)=>({...c,i,v:segVal('chk'+i),pre:!!preDefect(h.delivery,c)})).filter(c=>c.pre?c.v==='worse':c.v==='defect').map(c=>{const unit=parseFloat(c.charge.replace(/[^0-9.]/g,''))||0,each=/each/i.test(c.charge),q=each?(qty[c.i]||1):1;return{name:c.name,charge:c.charge,unit,qty:q,each,amount:unit*q,worsened:c.pre,i:c.i}});
 const dmgUpdate=()=>{const it=dmgItems();$('#dmgCard').hidden=!it.length;
  $('#dmgList').innerHTML=it.map(d=>`<div class="row"><span>${esc(d.name)}${d.worsened?' <b class="pre">(worsened)</b>':' <b class="pre">(new)</b>'}<br><small class="hint">${esc(d.charge)}</small></span>${d.each?`<input type="number" min="1" value="${d.qty}" data-q="${d.i}" style="width:70px;flex:0 0 70px">`:''}<b style="min-width:70px;text-align:right">£${d.amount.toFixed(2)}</b></div>`).join('');
  $('#dmgList').querySelectorAll('[data-q]').forEach(e=>e.onchange=()=>{qty[e.dataset.q]=Math.max(1,parseInt(e.value)||1);dmgUpdate()});
  const tot=it.reduce((a,d)=>a+d.amount,0);$('#dmgCalc').value='£'+tot.toFixed(2);if(!dmgOverride)$('#dmgAmt').value=tot.toFixed(2)};
 const save=async()=>{const err=[];const drv=driverName();if(!drv)err.push('Driver');if(!$('#colDate').value)err.push('Collection date');if(!$('#time').value)err.push('Collection time');
  const sig=readSigs(err);if(err.length){$('#errs').textContent='Please complete: '+err.join(', ');$('#errs').scrollIntoView({behavior:'smooth'});return}
  const all=await get('hires',[]);const rec=all.find(x=>x.id===h.id);if(!rec){toast('This hire no longer exists');return}
  const di=dmgItems(),calc=di.reduce((a,d)=>a+d.amount,0),amt=di.length?(parseFloat($('#dmgAmt').value)||0):0;const serial=$('#serial').value.trim();
  rec.collection={date:$('#colDate').value,time:$('#time').value,savedAt:new Date().toISOString(),driver:drv,serial,late:segVal('late')==='yes',
   damages:{items:di.map(({i,...d})=>d),calculated:calc,amount:amt,overridden:di.length>0&&Math.abs(amt-calc)>0.001,notes:di.length?$('#dmgNotes').value.trim():'',invoice:di.length?segVal('dmgInv')==='yes':false},...readCond(h.delivery),...sig};
  if(serial&&!rec.item.serial)rec.item.serial=serial;
  await put('hires',all);await rememberDriver(drv);if(serial)await saveSerial(h.item.id,serial);await F.discard();form=null;done(await makePdf(rec,'Collection'),'Collection')};
 $('#hireSel').onchange=()=>render(false);
 if(draft){$('#hireSel').value=draft.data.hireId;await render(true);F.restored=true}}
// ---------- after save ----------
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function canShareFile(f){try{return!!(navigator.canShare&&navigator.share&&navigator.canShare({files:[f]}))}catch(_){return false}}
function done({blob,name},kind){cur='saved';stack.length=0;form=null;setHeader('Saved',true);const url=URL.createObjectURL(blob);const file=new File([blob],name,{type:'application/pdf'});const share=canShareFile(file);
 app.innerHTML=`<div class="card"><h2>Saved &#10003;</h2><p>${esc(name)} has been downloaded.</p>
 <p><button class="btn wide" id="shareBtn">${share?'Share PDF':'Download PDF to save to Drive'}</button></p>
 <p class="hint" id="shareHint">${share?'Choose the Google Drive app, then pick':'Then upload it in the Google Drive app to'} the <b>${DRIVE[kind]}</b> folder.</p>
 <p><a class="btn wide sec" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${url}" download="${esc(name)}" id="dlAgain">Download PDF again</a></p>
 <p><button class="btn wide sec" id="homeBtn">Back to home</button></p></div>`;
 $('#homeBtn').onclick=()=>go('home');
 $('#shareBtn').onclick=async()=>{if(canShareFile(file)){try{await navigator.share({files:[file],title:name,text:`Save to Google Drive > ${DRIVE[kind]}`})}catch(e){if(e&&e.name!=='AbortError')download(blob,name)}}else download(blob,name)};
 download(blob,name);scrollTo(0,0)}
// ---------- PDF ----------
async function makePdf(h,kind){const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4',compress:true});const W=210,M=14,BOT=284;let y=0;
 const isDel=kind==='Delivery';const r=(isDel?h.delivery:h.collection)||{};const c=h.customer||{};
 const date=isDel?(h.start||r.date):r.date;const time=r.time||'';const driver=r.driver||r.drvSigName||'';
 const serial=(isDel?(h.item&&h.item.serial):(r.serial||(h.item&&h.item.serial)))||'';
 const head=()=>{doc.setFillColor(31,37,45);doc.rect(0,0,W,26,'F');doc.setFillColor(180,99,43);doc.rect(0,26,W,1.2,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text(BIZ.name,M,12);
  doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(`${BIZ.email}  |  ${BIZ.phone}  |  ${BIZ.web}`,M,20);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(kind.toUpperCase()+' FORM',W-M,12,{align:'right'});doc.setTextColor(0);y=34};
 const need=n=>{if(y+n>BOT){doc.addPage();head();return true}return false};
 const sect=t=>{need(14);doc.setFillColor(238,240,243);doc.rect(M,y-4.5,W-2*M,7,'F');doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(31,37,45);doc.text(t,M+2,y);doc.setTextColor(0);y+=7};
 const field=(l,v)=>{const lines=doc.splitTextToSize(String(v||'-'),W-2*M-50);need(lines.length*4.6+2);doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text(l,M+2,y);doc.setFont('helvetica','normal');doc.text(lines,M+50,y);y+=lines.length*4.6+1.2};
 // two columns of label/value pairs, each with its own heading
 const cw=(W-2*M-6)/2,lw=30;
 const colH=arr=>arr.reduce((a,[,v])=>a+doc.splitTextToSize(String(v||'-'),cw-lw-2).length*4.4+1,0);
 const twoCols=(lt,left,rt,right)=>{doc.setFontSize(9.5);const hh=Math.max(colH(left),colH(right))+8;need(hh);
  [[lt,left,M],[rt,right,M+cw+6]].forEach(([t,arr,x])=>{let yy=y;doc.setFillColor(238,240,243);doc.rect(x,yy-4.5,cw,7,'F');doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(31,37,45);doc.text(t,x+2,yy);doc.setTextColor(0);yy+=7;
   doc.setFontSize(9.5);for(const[l,v]of arr){const lines=doc.splitTextToSize(String(v||'-'),cw-lw-2);doc.setFont('helvetica','bold');doc.text(l,x+2,yy);doc.setFont('helvetica','normal');doc.text(lines,x+lw,yy);yy+=lines.length*4.4+1}});y+=hh+2};
 head();
 // top line: reference, date, time, driver
 doc.setFontSize(9.5);const top=[['Reference',h.id.toUpperCase()],[kind+' date',fmt(date)],[kind+' time',time||'-'],['Driver',driver||'-']];
 top.forEach(([l,v],i)=>{const x=M+2+i*((W-2*M)/4);doc.setFont('helvetica','normal');doc.setTextColor(90);doc.setFontSize(8);doc.text(l.toUpperCase(),x,y);doc.setTextColor(0);doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(String(v),x,y+5)});y+=13;
 const p=h.payment||{};
 const cust=[['Name',c.name],['Company',c.company],['Phone',c.phone],['Email',c.email],['Address',c.address]];
 const hire=[['Item',h.item&&h.item.name],['Serial no.',serial||'-'],['Hire start',fmt(h.start)],['Hire end',fmt(h.end)],['Hire length',hireLabel(h)],['Fulfilment',h.fulfilment==='delivery'?'Delivery':'Self-collection']];
 if(h.fulfilment==='delivery')hire.push(['Delivery address',h.address]);
 if(isDel){cust.push(['Prepaid',p.prepaid?'Yes':'No']);if(p.prepaid)cust.push(['Invoice no.',p.invoice]);else{cust.push(['Payment method',p.method]);cust.push(['Payment conf.',p.confirmed?'Yes':'No'])}}
 else{cust.push(['Payment',p.prepaid?'Prepaid'+(p.invoice?' (inv. '+p.invoice+')':'')+' - no hire balance due':'Not prepaid'+(p.method?', '+p.method:'')+(p.confirmed?', confirmed':', not confirmed')]);
  hire.push(['Delivered',fmt(h.start||(h.delivery&&h.delivery.date))+(h.delivery&&h.delivery.time?' '+h.delivery.time:'')]);hire.push(['Collected late',r.late?'YES':'No'])}
 twoCols('Customer',cust,'Hire',hire);
 sect('Condition checklist (hire terms cl. 9.2)');doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(90);doc.text('Item',M+2,y);doc.text('Standard charge',M+100,y);doc.text('Status',M+135,y);doc.setTextColor(0);y+=5;
 (r.checks||[]).forEach(k=>{need(6);doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(k.name,M+2,y);doc.text(k.charge||'',M+100,y);
  let st,col;if(k.pre){if(k.change==='worse'){st='WORSENED (charged)';col=[192,57,43]}else{st='PRE-EXISTING - unchanged';col=[110,110,110]}}
  else if(k.status==='defect'){st=!isDel&&r.savedAt?'NEW DEFECT':'DEFECT';col=[192,57,43]}else{st='OK';col=[27,127,75]}
  doc.setFont('helvetica','bold');doc.setTextColor(...col);doc.text(st,M+135,y);doc.setTextColor(0);y+=5;
  const notes=[];if(k.pre)notes.push('At delivery: '+(k.preNote||(h.delivery&&h.delivery.notes)||'no note'));if(k.note)notes.push((k.pre?'Now: ':'')+k.note);
  if(notes.length){doc.setFont('helvetica','italic');doc.setFontSize(8.5);doc.setTextColor(80);const ls=doc.splitTextToSize(notes.join('  |  '),W-2*M-10);need(ls.length*4);doc.text(ls,M+6,y-0.8);y+=ls.length*4;doc.setTextColor(0)}});
 y+=1;field('Defect notes',r.notes||'None');
 // defect photos: in a box, keeping aspect ratio; shrink to fit the page before spilling over
 const ph=r.photos||[];if(ph.length){need(50);sect('Defect photos');const n=ph.length,cols=n===1?1:(n===2||n===4)?2:3,gap=4,inner=W-2*M-6,cellW=(inner-(cols-1)*gap)/cols,maxH=cols===1?90:cols===2?75:55;
  const dm=[];for(const s of ph)dm.push(await dims(s));let boxTop=y-1;
  const closeBox=yy=>{doc.setDrawColor(200);doc.setLineWidth(0.3);doc.roundedRect(M,boxTop,W-2*M,yy-boxTop,1.5,1.5,'S')};
  for(let i=0;i<n;i+=cols){const row=dm.slice(i,i+cols).map(d=>{const s=Math.min(cellW/d.w,maxH/d.h);return{w:d.w*s,h:d.h*s}});let rh=Math.max(...row.map(d=>d.h));
   if(y+3+rh>BOT){const avail=BOT-y-3;if(avail>=40&&i===0){const k=avail/rh;row.forEach(d=>{d.w*=k;d.h*=k});rh=avail}else{closeBox(y);doc.addPage();head();boxTop=y-1}}
   row.forEach((d,j)=>{const x=M+3+j*(cellW+gap)+(cellW-d.w)/2;doc.addImage(ph[i+j],'JPEG',x,y+2,d.w,d.h,`photo-${kind}-${i+j}`,'FAST')});y+=rh+gap}
  closeBox(y);y+=6}
 if(!isDel){const dm=r.damages;const chargeable=dm&&dm.items&&dm.items.length;
  if(!chargeable){field('Damage charges','None - £0.00'+((r.checks||[]).some(k=>k.pre)?' (pre-existing defects unchanged, not charged)':''))}else{sect('Balance owed for damages');
   doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(90);doc.text('Item',M+2,y);doc.text('Standard charge',M+100,y);doc.text('Qty',M+140,y);doc.text('Amount',W-M-2,y,{align:'right'});doc.setTextColor(0);y+=5.5;
   dm.items.forEach(d=>{need(7);doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(d.name+(d.worsened?' (worsened)':''),M+2,y);doc.text(d.charge,M+100,y);doc.text(String(d.qty),M+140,y);doc.text('£'+d.amount.toFixed(2),W-M-2,y,{align:'right'});y+=5.5});
   need(8);doc.setDrawColor(150);doc.line(M+100,y-3,W-M,y-3);doc.setFont('helvetica','bold');doc.text('Standard charges total',M+100,y+1);doc.text('£'+dm.calculated.toFixed(2),W-M-2,y+1,{align:'right'});y+=7;
   if(dm.overridden){field('Adjusted amount','£'+dm.amount.toFixed(2)+' (manually adjusted)')}
   need(9);doc.setFillColor(253,236,234);doc.rect(M,y-5,W-2*M,8,'F');doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(192,57,43);doc.text('TOTAL OWED FOR DAMAGES',M+2,y);doc.text('£'+dm.amount.toFixed(2),W-M-2,y,{align:'right'});doc.setTextColor(0);y+=9;
   field('Invoice to be raised',dm.invoice?'Yes':'No');if(dm.notes)field('Damage notes',dm.notes)}}
 need(60);sect('Signatures');const sw=(W-2*M-10)/2;const signed='Signed '+fmt(date)+(time?' '+time:'');
 // each signature gets its own image alias so the PDF can never reuse one image for both
 [['Customer',r.custSig,r.custSigName,'cust'],['Driver',r.drvSig,r.drvSigName,'drv']].forEach(([l,img,n,a],i)=>{const x=M+i*(sw+10);doc.setDrawColor(150);doc.rect(x,y,sw,32);if(img&&img.startsWith('data:image'))doc.addImage(img,'JPEG',x+1,y+1,sw-2,30,`sig-${kind}-${a}-${h.id}`);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(`${l}: ${n||'-'}`,x,y+38);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text(signed,x,y+43)});y+=48;
 const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(120);doc.text(`${BIZ.name} - ${kind} form - page ${i} of ${n}`,W/2,292,{align:'center'})}
 const name=`${kind}_${(c.name||'Customer').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')}_${date||today()}.pdf`;return{blob:doc.output('blob'),name}}
function dims(src){return new Promise(r=>{const i=new Image();i.onload=()=>r({w:i.width||1,h:i.height||1});i.onerror=()=>r({w:4,h:3});i.src=src})}
// ---------- settings ----------
async function settings(){setHeader('Settings',true);form=null;let its=await items();const custs=await get('customers',[]);const hires=await get('hires',[]);let drivers=await get('drivers',[]);
 const list=[...hires].sort((a,b)=>(b.start||'').localeCompare(a.start||'')||(b.createdAt||'').localeCompare(a.createdAt||''));
 app.innerHTML=`<div class="card"><h2>Hire items</h2><p class="hint">Serial numbers fill in automatically on the delivery form.</p><div class="list" id="itemList"></div><button class="btn sec" id="addItem">+ Add item</button> <button class="btn" id="saveItems">Save items</button></div>
 <div class="card"><h2>Drivers</h2><div id="drvList"></div><div class="list"><div class="item"><input id="newDrv" placeholder="Driver name"><button class="btn" id="addDrv">Add</button></div></div></div>
 <div class="card"><h2>Hire records (${hires.length})</h2>${list.map(h=>`<div class="row hirerow"><span>${esc(h.customer&&h.customer.name)} - ${esc(h.item&&h.item.name)}<br><small class="hint">${fmt(h.start)} to ${fmt(h.end)} &middot; ${h.collection?'Collected':'<b>Active</b>'}</small></span>
  <button class="btn sec" data-pdf="${h.id}" data-kind="Delivery">PDF</button>${h.collection?`<button class="btn sec" data-pdf="${h.id}" data-kind="Collection">Col. PDF</button>`:''}<button class="btn sec delbtn" data-dh="${h.id}">Delete</button></div>`).join('')||'<p class="hint">None yet</p>'}</div>
 <div class="card"><h2>Saved customers (${custs.length})</h2>${custs.map(c=>`<div class="row"><span>${esc(c.name)}${c.company?' - '+esc(c.company):''}</span><button class="btn sec" data-dc="${c.id}">Delete</button></div>`).join('')||'<p class="hint">None yet</p>'}</div>
 <div class="card"><h2>Data</h2><p class="hint">${hires.length} hire records stored on this device only (${hires.filter(h=>!h.collection).length} active). Back up regularly.</p>
 <button class="btn sec wide" id="exp">Export backup (JSON)</button><label>Restore backup</label><input type="file" id="imp" accept="application/json"></div>`;
 const draw=()=>{$('#itemList').innerHTML=its.map((i,k)=>`<div class="item"><input value="${esc(i.name)}" data-k="${k}" placeholder="Item name"><input value="${esc(i.serial||'')}" data-s="${k}" placeholder="Serial no." style="flex:0 0 32%"><button class="btn sec" data-rm="${k}">&times;</button></div>`).join('');
  app.querySelectorAll('[data-k]').forEach(e=>e.oninput=()=>its[e.dataset.k].name=e.value);app.querySelectorAll('[data-s]').forEach(e=>e.oninput=()=>its[e.dataset.s].serial=e.value.trim());app.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{its.splice(+b.dataset.rm,1);draw()})};draw();
 $('#addItem').onclick=()=>{its.push({id:uid(),name:''});draw()};$('#saveItems').onclick=async()=>{its=its.filter(i=>i.name.trim());await put('items',its);toast('Items saved');draw()};
 const drawDrv=()=>{$('#drvList').innerHTML=drivers.map((d,k)=>`<div class="row"><span>${esc(d)}</span><button class="btn sec" data-rd="${k}">Remove</button></div>`).join('')||'<p class="hint">No drivers yet</p>';
  app.querySelectorAll('[data-rd]').forEach(b=>b.onclick=async()=>{if(!confirm(`Remove driver ${drivers[+b.dataset.rd]}?`))return;drivers.splice(+b.dataset.rd,1);await put('drivers',drivers);drawDrv()})};drawDrv();
 $('#addDrv').onclick=async()=>{const n=$('#newDrv').value.trim();if(!n)return;if(!drivers.includes(n)){drivers.push(n);await put('drivers',drivers)}$('#newDrv').value='';drawDrv();toast('Driver added')};
 app.querySelectorAll('[data-dh]').forEach(b=>b.onclick=async()=>{const h=hires.find(x=>x.id===b.dataset.dh);if(!h)return;
  if(!confirm(`Delete this hire record?\n\n${h.customer&&h.customer.name} - ${h.item&&h.item.name}\n${fmt(h.start)} to ${fmt(h.end)} (${h.collection?'collected':'ACTIVE'})\n\nThis cannot be undone.`))return;
  const all=await get('hires',[]);await put('hires',all.filter(x=>x.id!==h.id));const dc=await get('draft-collection');if(dc&&dc.data&&dc.data.hireId===h.id)await del('draft-collection');toast('Hire deleted');settings()});
 app.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=async()=>{const h=hires.find(x=>x.id===b.dataset.pdf);if(!h)return;const o=await makePdf(h,b.dataset.kind);download(o.blob,o.name)});
 app.querySelectorAll('[data-dc]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this customer?'))return;await put('customers',custs.filter(c=>c.id!==b.dataset.dc));settings()});
 $('#exp').onclick=async()=>{const data={customers:await get('customers',[]),items:await get('items',[]),hires:await get('hires',[]),drivers:await get('drivers',[])};download(new Blob([JSON.stringify(data)],{type:'application/json'}),`pdh-backup-${today()}.json`)};
 $('#imp').onchange=async e=>{const f=e.target.files[0];if(!f||!confirm('Replace all data on this device with this backup?'))return;const d=JSON.parse(await f.text());for(const k of['customers','items','hires','drivers'])if(d[k])await put(k,d[k]);toast('Backup restored');settings()}}
const VIEWS={home,delivery,collection,settings};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
history.replaceState({v:'home'},'');home();

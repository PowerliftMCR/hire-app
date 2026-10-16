'use strict';
const BIZ={name:'Powerwall Dolly Hire',email:'Powerliftmcr@gmail.com',phone:'+44 7729 246809',web:'powerwalldollyhire.co.uk'};
// Source: powerwalldollyhire.co.uk/hire-terms, clause 9.2 "Damage and missing-item charges"
const CHECKS=[{name:'Damage to tyre',charge:'£60 each'},{name:'Loss of or damage to ratchet strap',charge:'£50 each'},{name:'Damage to lifting mechanism',charge:'£600'},{name:'Damage to clamp mechanism',charge:'£200'},{name:'Damage to lifting bar',charge:'£250 each'},{name:'Damage to brakes or brake components',charge:'£100'},{name:'Missing Powerwall lifting bar',charge:'£300 each'},{name:'Missing lifting socket',charge:'£30'},{name:'Tracker broken, removed, lost or damaged',charge:'£200'}];
// ---------- storage (IndexedDB key-value) ----------
const DB=new Promise((res,rej)=>{const r=indexedDB.open('pdh',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function get(k,d){const db=await DB;return new Promise(r=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>r(q.result===undefined?d:q.result);q.onerror=()=>r(d)})}
async function put(k,v){const db=await DB;return new Promise((r,j)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=r;t.onerror=()=>j(t.error)})}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=s=>document.querySelector(s);
const app=$('#app');
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3000)}
async function items(){let it=await get('items');if(!it){it=[{id:uid(),name:'Powerwall Dolly 1'},{id:uid(),name:'Powerwall Dolly 2'}];await put('items',it)}return it}
function setHeader(t,back){$('#title').textContent=t;$('#back').hidden=!back}
$('#back').onclick=()=>home();$('#settingsBtn').onclick=()=>settings();
// ---------- shared UI pieces ----------
function seg(name,opts,val){return `<div class="seg" data-seg="${name}">${opts.map(([v,l])=>`<button type="button" data-v="${v}" class="${v===val?'on':''}">${l}</button>`).join('')}</div>`}
function segVal(n){const b=app.querySelector(`[data-seg="${n}"] .on`);return b?b.dataset.v:''}
function bindSegs(onchange){app.querySelectorAll('.seg').forEach(s=>s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;s.querySelectorAll('button').forEach(x=>x.classList.remove('on','bad'));b.classList.add('on');if(b.dataset.v==='defect')b.classList.add('bad');onchange&&onchange(s.dataset.seg,b.dataset.v)}))}
function conditionHTML(){return `<div class="card"><h2>Condition checklist</h2><p class="hint">Standard charges from the hire terms (clause 9.2)</p>${CHECKS.map((c,i)=>`<div class="row"><span>${esc(c.name)}<br><small class="hint">${esc(c.charge)}</small></span>${seg('chk'+i,[['ok','OK'],['defect','Defect']],'ok')}</div>`).join('')}
<label>Defect notes</label><textarea id="notes" placeholder="Describe any damage or missing parts"></textarea>
<label>Defect photos</label><input type="file" id="photoIn" accept="image/*" capture="environment" multiple><div class="photos" id="photos"></div></div>`}
function sigHTML(){return `<div class="card"><h2>Customer signature</h2><label>Customer printed name</label><input id="custSigName"><canvas class="sig" id="custSig"></canvas><button type="button" class="btn sec" data-clear="custSig">Clear</button></div>
<div class="card"><h2>Driver signature</h2><label>Driver printed name</label><input id="drvSigName" list="drivers"><datalist id="drivers"></datalist><canvas class="sig" id="drvSig"></canvas><button type="button" class="btn sec" data-clear="drvSig">Clear</button></div>`}
const photos=[];
function bindPhotos(){photos.length=0;$('#photoIn').onchange=async e=>{for(const f of e.target.files)photos.push(await shrink(f));e.target.value='';drawPhotos()}}
function drawPhotos(){$('#photos').innerHTML=photos.map((p,i)=>`<div><img src="${p}"><button type="button" data-del="${i}">&times;</button></div>`).join('');$('#photos').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{photos.splice(+b.dataset.del,1);drawPhotos()})}
function shrink(file){return new Promise(res=>{const img=new Image();img.onload=()=>{const m=1200,s=Math.min(1,m/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=img.width*s;c.height=img.height*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);res(c.toDataURL('image/jpeg',0.7))};img.src=URL.createObjectURL(file)})}
const pads={};
function pad(id){const c=$('#'+id),r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;c.width=r.width*dpr;c.height=r.height*dpr;const x=c.getContext('2d');x.scale(dpr,dpr);x.lineWidth=2.5;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#000';
 const p={drawn:false,c};let down=false;const pt=e=>{const b=c.getBoundingClientRect();return[e.clientX-b.left,e.clientY-b.top]};
 c.onpointerdown=e=>{down=true;c.setPointerCapture(e.pointerId);const[a,b]=pt(e);x.beginPath();x.moveTo(a,b);x.lineTo(a+.1,b+.1);x.stroke();p.drawn=true};
 c.onpointermove=e=>{if(!down)return;const[a,b]=pt(e);x.lineTo(a,b);x.stroke()};c.onpointerup=c.onpointercancel=()=>down=false;
 p.clear=()=>{x.clearRect(0,0,c.width,c.height);p.drawn=false};
 p.data=()=>{const o=document.createElement('canvas');o.width=c.width;o.height=c.height;const ox=o.getContext('2d');ox.fillStyle='#fff';ox.fillRect(0,0,o.width,o.height);ox.drawImage(c,0,0);return o.toDataURL('image/jpeg',0.85)};
 pads[id]=p}
async function bindSigs(){pad('custSig');pad('drvSig');app.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>pads[b.dataset.clear].clear());
 const d=await get('drivers',[]);$('#drivers').innerHTML=d.map(n=>`<option value="${esc(n)}">`).join('');if(d[0])$('#drvSigName').value=d[0]}
function readCond(){return{checks:CHECKS.map((c,i)=>({name:c.name,charge:c.charge,status:segVal('chk'+i)})),notes:$('#notes').value.trim(),photos:[...photos]}}
function readSigs(err){if(!pads.custSig.drawn)err.push('Customer signature');if(!pads.drvSig.drawn)err.push('Driver signature');if(!$('#custSigName').value.trim())err.push('Customer printed name');if(!$('#drvSigName').value.trim())err.push('Driver printed name');
 return{custSig:pads.custSig.data(),drvSig:pads.drvSig.data(),custSigName:$('#custSigName').value.trim(),drvSigName:$('#drvSigName').value.trim()}}
async function rememberDriver(n){let d=await get('drivers',[]);d=[n,...d.filter(x=>x!==n)].slice(0,10);await put('drivers',d)}
// ---------- home ----------
async function home(){setHeader('Powerwall Dolly Hire',false);const hires=await get('hires',[]);const act=hires.filter(h=>!h.collection).length;
 app.innerHTML=`<button class="big del" id="goDel">Delivery</button><button class="big col" id="goCol">Collection<div style="font-size:15px;font-weight:500;margin-top:6px">${act} active hire${act===1?'':'s'}</div></button>
 <p class="hint" style="text-align:center">${BIZ.email} &middot; ${BIZ.phone}</p>`;
 $('#goDel').onclick=delivery;$('#goCol').onclick=collection;scrollTo(0,0)}
// ---------- delivery ----------
async function delivery(){setHeader('Delivery',true);const custs=await get('customers',[]);const its=await items();
 app.innerHTML=`<div class="card"><h2>Customer</h2>${seg('custType',[['existing','Existing'],['new','New']],custs.length?'existing':'new')}
 <div id="custExisting"><label>Select customer</label><select id="custSel"><option value="">-- choose --</option>${custs.map(c=>`<option value="${c.id}">${esc(c.name)}${c.company?' ('+esc(c.company)+')':''}</option>`).join('')}</select></div>
 <div id="custNew"><label>Name</label><input id="cName" autocomplete="off"><label>Company</label><input id="cCompany"><label>Phone</label><input id="cPhone" type="tel"><label>Email</label><input id="cEmail" type="email"><label>Address</label><textarea id="cAddr"></textarea></div></div>
 <div class="card"><h2>Payment</h2><label>Prepaid?</label>${seg('prepaid',[['yes','Yes'],['no','No']],'')}
 <div id="payYes" hidden><label>Invoice number</label><input id="invoice"></div>
 <div id="payNo" hidden><label>Payment method</label><select id="payMethod"><option value="">-- choose --</option><option>BACS</option><option>Card</option><option>Cash</option></select>
 <label class="chk"><input type="checkbox" id="payConf"> Payment confirmed</label></div></div>
 <div class="card"><h2>Hire</h2><label>Item</label><select id="item"><option value="">-- choose --</option>${its.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select>
 <label>Fulfilment</label><select id="fulfil"><option value="delivery">Delivery</option><option value="self">Self-collection</option></select>
 <div id="addrWrap"><label>Delivery address</label><textarea id="delAddr"></textarea></div>
 <label>Hire type</label><select id="hireType"><option value="day">Day hire</option><option value="week">Week hire</option></select>
 <label>Hire start</label><input type="date" id="start" value="${today()}"><label>Hire end</label><input type="date" id="end"></div>
 ${conditionHTML()}${sigHTML()}<div id="errs" class="err"></div><div class="save"><button class="btn" id="saveBtn">Save &amp; download PDF</button></div>`;
 const showCust=t=>{$('#custExisting').hidden=t!=='existing';$('#custNew').hidden=t!=='new'};showCust(segVal('custType'));
 const setEnd=()=>{const s=$('#start').value;if(!s)return;const d=new Date(s);d.setDate(d.getDate()+($('#hireType').value==='week'?7:1));$('#end').value=d.toISOString().slice(0,10)};setEnd();
 bindSegs((n,v)=>{if(n==='custType')showCust(v);if(n==='prepaid'){$('#payYes').hidden=v!=='yes';$('#payNo').hidden=v!=='no'}});
 $('#hireType').onchange=setEnd;$('#start').onchange=setEnd;
 $('#fulfil').onchange=()=>$('#addrWrap').hidden=$('#fulfil').value!=='delivery';
 $('#custSel').onchange=()=>{const c=custs.find(c=>c.id===$('#custSel').value);if(c){$('#delAddr').value=c.address||''}};
 $('#cAddr').oninput=()=>$('#delAddr').value=$('#cAddr').value;
 bindPhotos();await bindSigs();
 $('#saveBtn').onclick=async()=>{const err=[];let cust;const ct=segVal('custType');
  if(ct==='existing'){cust=custs.find(c=>c.id===$('#custSel').value);if(!cust)err.push('Customer')}
  else{cust={id:uid(),name:$('#cName').value.trim(),company:$('#cCompany').value.trim(),phone:$('#cPhone').value.trim(),email:$('#cEmail').value.trim(),address:$('#cAddr').value.trim()};if(!cust.name)err.push('Customer name')}
  const pre=segVal('prepaid');if(!pre)err.push('Prepaid yes/no');if(pre==='yes'&&!$('#invoice').value.trim())err.push('Invoice number');if(pre==='no'&&!$('#payMethod').value)err.push('Payment method');
  const item=its.find(i=>i.id===$('#item').value);if(!item)err.push('Item');
  if($('#fulfil').value==='delivery'&&!$('#delAddr').value.trim())err.push('Delivery address');
  if(!$('#start').value||!$('#end').value)err.push('Hire dates');else if($('#end').value<$('#start').value)err.push('End date is before start date');
  const sig=readSigs(err);if(err.length){$('#errs').textContent='Please complete: '+err.join(', ');$('#errs').scrollIntoView({behavior:'smooth'});return}
  $('#errs').textContent='';
  const rec={id:uid(),createdAt:new Date().toISOString(),customer:cust,payment:{prepaid:pre==='yes',invoice:$('#invoice').value.trim(),method:pre==='no'?$('#payMethod').value:'',confirmed:pre==='no'&&$('#payConf').checked},
   item:{id:item.id,name:item.name},fulfilment:$('#fulfil').value,address:$('#fulfil').value==='delivery'?$('#delAddr').value.trim():'',hireType:$('#hireType').value,start:$('#start').value,end:$('#end').value,
   delivery:{date:today(),...readCond(),...sig},collection:null};
  if(ct==='new'){custs.push(cust);await put('customers',custs)}
  const hires=await get('hires',[]);hires.push(rec);await put('hires',hires);await rememberDriver(sig.drvSigName);
  done(await makePdf(rec,'Delivery'))}}
// ---------- collection ----------
async function collection(){setHeader('Collection',true);const hires=await get('hires',[]);const act=hires.filter(h=>!h.collection);
 app.innerHTML=`<div class="card"><h2>Active hires</h2>${act.length?`<select id="hireSel"><option value="">-- choose hire --</option>${act.map(h=>`<option value="${h.id}">${esc(h.customer.name)} - ${esc(h.item.name)} (${fmt(h.start)} to ${fmt(h.end)})</option>`).join('')}</select>`:'<p class="hint">No active hires. Save a delivery first.</p>'}
 <div id="hireInfo"></div></div><div id="rest" hidden>${conditionHTML()}
 <div class="card"><h2>Collected late?</h2><p class="hint" id="lateHint"></p>${seg('late',[['no','No'],['yes','Yes']],'no')}<label>Collection date</label><input type="date" id="colDate" value="${today()}"></div>
 ${sigHTML()}<div class="card" id="dmgCard" hidden><h2>Balance owed for damages</h2><p class="hint">Standard charges from the hire terms (clause 9.2). Adjust quantities or override the total if needed.</p><div id="dmgList"></div>
 <label>Calculated total</label><input id="dmgCalc" readonly><label>Amount owed (£) - edit to override</label><input id="dmgAmt" type="number" inputmode="decimal" step="0.01" min="0"><label>Damage notes</label><textarea id="dmgNotes"></textarea><label>Invoice to be raised?</label>${seg('dmgInv',[['yes','Yes'],['no','No']],'yes')}</div>
 <div id="errs" class="err"></div><div class="save"><button class="btn" id="saveBtn">Save &amp; download PDF</button></div></div>`;
 if(!act.length)return;let h;
 const sugg=()=>{const late=$('#colDate').value>h.end;$('#lateHint').textContent=`Hire end: ${fmt(h.end)}. Suggested: ${late?'YES - late':'No - on time'}.`;app.querySelectorAll('[data-seg="late"] button').forEach(b=>b.classList.toggle('on',b.dataset.v===(late?'yes':'no')))};
 $('#hireSel').onchange=async()=>{h=act.find(x=>x.id===$('#hireSel').value);if(!h){$('#rest').hidden=true;$('#hireInfo').innerHTML='';return}
  const c=h.customer;$('#hireInfo').innerHTML=`<label>Customer</label><input value="${esc(c.name+(c.company?' ('+c.company+')':''))}" readonly><label>Item</label><input value="${esc(h.item.name)}" readonly>
  <label>Hire dates</label><input value="${fmt(h.start)} to ${fmt(h.end)} (${h.hireType==='week'?'Week':'Day'} hire)" readonly>`;
  $('#rest').hidden=false;if(!pads.inited){bindSegs(n=>{if(n.startsWith('chk'))dmgUpdate()});bindPhotos();await bindSigs();pads.inited=true}$('#custSigName').value='';sugg()};
 $('#colDate').onchange=()=>h&&sugg();pads.inited=false;
 let dmgOverride=false;const qty={};
 const dmgItems=()=>CHECKS.map((c,i)=>({...c,i})).filter(c=>segVal('chk'+c.i)==='defect').map(c=>{const unit=parseFloat(c.charge.replace(/[^0-9.]/g,''))||0,each=/each/i.test(c.charge),q=each?(qty[c.i]||1):1;return{name:c.name,charge:c.charge,unit,qty:q,each,amount:unit*q,i:c.i}});
 const dmgUpdate=()=>{const it=dmgItems();$('#dmgCard').hidden=!it.length;
  $('#dmgList').innerHTML=it.map(d=>`<div class="row"><span>${esc(d.name)}<br><small class="hint">${esc(d.charge)}</small></span>${d.each?`<input type="number" min="1" value="${d.qty}" data-q="${d.i}" style="width:70px;flex:0 0 70px">`:''}<b style="min-width:70px;text-align:right">£${d.amount.toFixed(2)}</b></div>`).join('');
  $('#dmgList').querySelectorAll('[data-q]').forEach(e=>e.onchange=()=>{qty[e.dataset.q]=Math.max(1,parseInt(e.value)||1);dmgUpdate()});
  const tot=it.reduce((a,d)=>a+d.amount,0);$('#dmgCalc').value='£'+tot.toFixed(2);if(!dmgOverride)$('#dmgAmt').value=tot.toFixed(2)};
 $('#dmgAmt').oninput=()=>dmgOverride=$('#dmgAmt').value!=='';
 $('#saveBtn').onclick=async()=>{const err=[];const sig=readSigs(err);if(err.length){$('#errs').textContent='Please complete: '+err.join(', ');return}
  const all=await get('hires',[]);const rec=all.find(x=>x.id===h.id);const di=dmgItems(),calc=di.reduce((a,d)=>a+d.amount,0),amt=di.length?(parseFloat($('#dmgAmt').value)||0):0;
  rec.collection={date:$('#colDate').value,late:segVal('late')==='yes',damages:{items:di.map(({i,...d})=>d),calculated:calc,amount:amt,overridden:di.length>0&&Math.abs(amt-calc)>0.001,notes:di.length?$('#dmgNotes').value.trim():'',invoice:di.length?segVal('dmgInv')==='yes':false},...readCond(),...sig};
  await put('hires',all);await rememberDriver(sig.drvSigName);done(await makePdf(rec,'Collection'))}}
function fmt(d){if(!d)return'';const[y,m,dd]=d.split('-');return`${dd}/${m}/${y}`}
// ---------- after save ----------
function done({blob,name}){setHeader('Saved',true);const url=URL.createObjectURL(blob);
 app.innerHTML=`<div class="card"><h2>Saved &#10003;</h2><p>${esc(name)} has been downloaded.</p>
 <p><a class="btn wide" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${url}" download="${esc(name)}" id="dlAgain">Download PDF again</a></p>
 ${navigator.canShare?'<p><button class="btn wide sec" id="shareBtn">Share / save to Drive</button></p>':''}<p><button class="btn wide sec" id="homeBtn">Back to home</button></p></div>`;
 $('#homeBtn').onclick=home;const sb=$('#shareBtn');if(sb)sb.onclick=()=>{const f=new File([blob],name,{type:'application/pdf'});if(navigator.canShare({files:[f]}))navigator.share({files:[f],title:name}).catch(()=>{});else toast('Sharing not supported')};
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();scrollTo(0,0)}
// ---------- PDF ----------
async function makePdf(h,kind){const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4',compress:true});const W=210,M=14;let y=0;
 const head=()=>{doc.setFillColor(31,37,45);doc.rect(0,0,W,26,'F');doc.setFillColor(180,99,43);doc.rect(0,26,W,1.2,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text(BIZ.name,M,12);
  doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(`${BIZ.email}  |  ${BIZ.phone}  |  ${BIZ.web}`,M,20);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(kind.toUpperCase()+' FORM',W-M,12,{align:'right'});doc.setTextColor(0);y=34};
 const need=n=>{if(y+n>285){doc.addPage();head()}};
 const sect=t=>{need(14);doc.setFillColor(238,240,243);doc.rect(M,y-5,W-2*M,8,'F');doc.setFont('helvetica','bold');doc.setFontSize(11.5);doc.setTextColor(31,37,45);doc.text(t,M+2,y);doc.setTextColor(0);y+=8};
 const field=(l,v)=>{const lines=doc.splitTextToSize(String(v||'-'),W-2*M-50);need(lines.length*5+2);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(l,M+2,y);doc.setFont('helvetica','normal');doc.text(lines,M+50,y);y+=lines.length*5+1.5};
 head();const c=h.customer,r=kind==='Delivery'?h.delivery:h.collection;
 field('Reference',h.id.toUpperCase());field(kind+' date',fmt(r.date));
 sect('Customer');field('Name',c.name);field('Company',c.company);field('Phone',c.phone);field('Email',c.email);field('Address',c.address);
 sect('Hire');field('Item',h.item.name);field('Hire type',h.hireType==='week'?'Week hire':'Day hire');field('Hire start',fmt(h.start));field('Hire end',fmt(h.end));
 field('Fulfilment',h.fulfilment==='delivery'?'Delivery':'Self-collection');if(h.fulfilment==='delivery')field('Delivery address',h.address);
 if(kind==='Delivery'){sect('Payment');field('Prepaid',h.payment.prepaid?'Yes':'No');if(h.payment.prepaid)field('Invoice number',h.payment.invoice);else{field('Payment method',h.payment.method);field('Payment confirmed',h.payment.confirmed?'Yes':'No')}}
 else{sect('Return');field('Collection date',fmt(r.date));field('Collected late',r.late?'YES':'No')}
 sect('Condition checklist (hire terms cl. 9.2)');doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(90);doc.text('Item',M+2,y);doc.text('Standard charge',M+105,y);doc.text('Status',M+150,y);doc.setTextColor(0);y+=6;r.checks.forEach(k=>{need(7);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(k.name,M+2,y);doc.text(k.charge||'',M+105,y);const bad=k.status==='defect';doc.setFont('helvetica','bold');doc.setTextColor(bad?192:27,bad?57:127,bad?43:75);doc.text(bad?'DEFECT':'OK',M+150,y);doc.setTextColor(0);y+=6});
 field('Defect notes',r.notes||'None');
 if(r.photos.length){sect('Defect photos');const pw=(W-2*M-8)/3;let col=0;for(const p of r.photos){const im=await dims(p);const ph=Math.min(pw*im.h/im.w,70);if(col===0)need(ph+4);doc.addImage(p,'JPEG',M+col*(pw+4),y,pw,ph);col++;if(col===3){col=0;y+=ph+4}else if(col===1)doc._rowH=ph;doc._rowH=Math.max(doc._rowH||0,ph)}if(col)y+=doc._rowH+4;doc._rowH=0}
 if(kind==='Collection'){const dm=r.damages;sect('Balance owed for damages');
  if(!dm||!dm.items.length){field('Damage charges','No damage charges')}else{
   doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(90);doc.text('Item',M+2,y);doc.text('Standard charge',M+105,y);doc.text('Qty',M+140,y);doc.text('Amount',W-M-2,y,{align:'right'});doc.setTextColor(0);y+=6;
   dm.items.forEach(d=>{need(7);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(d.name,M+2,y);doc.text(d.charge,M+105,y);doc.text(String(d.qty),M+140,y);doc.text('£'+d.amount.toFixed(2),W-M-2,y,{align:'right'});y+=6});
   need(8);doc.setDrawColor(150);doc.line(M+100,y-3,W-M,y-3);doc.setFont('helvetica','bold');doc.text('Standard charges total',M+105,y+1);doc.text('£'+dm.calculated.toFixed(2),W-M-2,y+1,{align:'right'});y+=7;
   if(dm.overridden){field('Adjusted amount','£'+dm.amount.toFixed(2)+' (manually adjusted)')}
   need(9);doc.setFillColor(253,236,234);doc.rect(M,y-5,W-2*M,8,'F');doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(192,57,43);doc.text('TOTAL OWED FOR DAMAGES',M+2,y);doc.text('£'+dm.amount.toFixed(2),W-M-2,y,{align:'right'});doc.setTextColor(0);y+=9;
   field('Invoice to be raised',dm.invoice?'Yes':'No');if(dm.notes)field('Damage notes',dm.notes)}}
 need(62);sect('Signatures');const sw=(W-2*M-10)/2;
 [[`Customer`,r.custSig,r.custSigName],[`Driver`,r.drvSig,r.drvSigName]].forEach(([l,img,n],i)=>{const x=M+i*(sw+10);doc.setDrawColor(150);doc.rect(x,y,sw,32);doc.addImage(img,'JPEG',x+1,y+1,sw-2,30);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(`${l}: ${n}`,x,y+38);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text('Signed '+new Date().toLocaleString('en-GB'),x,y+43)});y+=48;
 const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(120);doc.text(`${BIZ.name} - ${kind} form - page ${i} of ${n}`,W/2,292,{align:'center'})}
 const name=`${kind}_${(c.name||'Customer').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')}_${r.date||today()}.pdf`;return{blob:doc.output('blob'),name}}
function dims(src){return new Promise(r=>{const i=new Image();i.onload=()=>r({w:i.width,h:i.height});i.src=src})}
// ---------- settings ----------
async function settings(){setHeader('Settings',true);let its=await items();const custs=await get('customers',[]);const hires=await get('hires',[]);
 app.innerHTML=`<div class="card"><h2>Hire items</h2><div class="list" id="itemList"></div><button class="btn sec" id="addItem">+ Add item</button> <button class="btn" id="saveItems">Save items</button></div>
 <div class="card"><h2>Saved customers (${custs.length})</h2>${custs.map(c=>`<div class="row"><span>${esc(c.name)}${c.company?' - '+esc(c.company):''}</span><button class="btn sec" data-dc="${c.id}">Delete</button></div>`).join('')||'<p class="hint">None yet</p>'}</div>
 <div class="card"><h2>Data</h2><p class="hint">${hires.length} hire records stored on this device only (${hires.filter(h=>!h.collection).length} active). Back up regularly.</p>
 <button class="btn sec wide" id="exp">Export backup (JSON)</button><label>Restore backup</label><input type="file" id="imp" accept="application/json"></div>`;
 const draw=()=>{$('#itemList').innerHTML=its.map((i,k)=>`<div class="item"><input value="${esc(i.name)}" data-k="${k}"><button class="btn sec" data-rm="${k}">&times;</button></div>`).join('');
  app.querySelectorAll('[data-k]').forEach(e=>e.oninput=()=>its[e.dataset.k].name=e.value);app.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{its.splice(+b.dataset.rm,1);draw()})};draw();
 $('#addItem').onclick=()=>{its.push({id:uid(),name:''});draw()};$('#saveItems').onclick=async()=>{its=its.filter(i=>i.name.trim());await put('items',its);toast('Items saved');draw()};
 app.querySelectorAll('[data-dc]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this customer?'))return;await put('customers',custs.filter(c=>c.id!==b.dataset.dc));settings()});
 $('#exp').onclick=async()=>{const data={customers:await get('customers',[]),items:await get('items',[]),hires:await get('hires',[]),drivers:await get('drivers',[])};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.download=`pdh-backup-${today()}.json`;a.click()};
 $('#imp').onchange=async e=>{const f=e.target.files[0];if(!f||!confirm('Replace all data on this device with this backup?'))return;const d=JSON.parse(await f.text());for(const k of['customers','items','hires','drivers'])if(d[k])await put(k,d[k]);toast('Backup restored');settings()}}
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
home();

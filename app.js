let db;
let items = [];
let currentSort = { key: null, asc: true };
let longPressTimer = null;
let startX = 0;
let currentTab = 0;
const tabs = document.querySelectorAll('.tab');

// ---------- IndexedDB ----------
const request = indexedDB.open("ChecklistDB_v3", 1);
request.onupgradeneeded = e => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("items")) {
    db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
  }
};
request.onsuccess = e => { db = e.target.result; loadItems(); };

// ---------- تاریخ شمسی ----------
function toJalali(gy, gm, gd) {
  const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy=(gy<=1600)?0:979; gy-=(gy<=1600)?621:1600;
  let gy2=(gm>2)?(gy+1):gy;
  let days=(365*gy)+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)-80+gd+g_d_m[gm-1];
  jy+=33*Math.floor(days/12053);
  days%=12053; jy+=4*Math.floor(days/1461);
  days%=1461; if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}
  let jm=(days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30);
  let jd=1+((days<186)?(days%31):((days-186)%30));
  return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
}
function getShamsiDate(){ const d=new Date(); return toJalali(d.getFullYear(), d.getMonth()+1,d.getDate()); }

// ---------- Load ----------
function loadItems(){
  const tx=db.transaction("items","readonly");
  tx.objectStore("items").getAll().onsuccess=e=>{
    items=e.target.result||[];
    renderList();
  };
}

// ---------- Add ----------
function addItem(){
  const title=document.getElementById('title').value.trim();
  const desc=document.getElementById('desc').value.trim();
  const status=document.getElementById('status').value.trim();
  const name=document.getElementById('name').value.trim();
  const phone=document.getElementById('phone').value.trim();
  const address=document.getElementById('address').value.trim();

  if(!title) return alert('عنوان لازم است');

  const item={title,desc,status,name,phone,address,date:getShamsiDate(),timestamp:Date.now(),image:null};

  const tx=db.transaction("items","readwrite");
  tx.objectStore("items").add(item).onsuccess=()=>{
    loadItems();
    document.getElementById('title').value='';
    document.getElementById('desc').value='';
    document.getElementById('status').value='در انتظار';
    document.getElementById('name').value='';
    document.getElementById('phone').value='';
    document.getElementById('address').value='';
  };
}

// ---------- Tab ----------
function showTab(n){
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active',i===n));
}

// ---------- Sort ----------
function sortBy(key){
  if(currentSort.key===key) currentSort.asc=!currentSort.asc;
  else {currentSort.key=key;currentSort.asc=true;}
  renderList();
}

// ---------- Render ----------
function renderList(){
  const search=document.getElementById('search').value.toLowerCase();
  let data=items.filter(i=>{
    return (i.title||'').toLowerCase().includes(search) ||
           (i.desc||'').toLowerCase().includes(search) ||
           (i.status||'').toLowerCase().includes(search) ||
           (i.name||'').toLowerCase().includes(search) ||
           (i.phone||'').toLowerCase().includes(search) ||
           (i.address||'').toLowerCase().includes(search);
  });

  if(currentSort.key){
    data.sort((a,b)=>{
      const A=(a[currentSort.key]??'').toString();
      const B=(b[currentSort.key]??'').toString();
      return currentSort.asc? A.localeCompare(B,'fa'): B.localeCompare(A,'fa');
    });
  }

  const tbody0=document.getElementById('list-0');
  const tbody1=document.getElementById('list-1');
  tbody0.innerHTML=''; tbody1.innerHTML='';

  data.forEach(i=>{
    const tr0=document.createElement('tr');
    tr0.id=`row-${i.id}-0`;
    tr0.innerHTML=`
      <td>${i.title}</td>
      <td>${i.desc}</td>
      <td>${i.date}</td>
      <td>${i.status}</td>
      <td>
        <img src="${i.image||'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg=='}"
             class="op-img" onclick="pickImage(${i.id})">
        <input type="file" id="file-${i.id}" hidden accept="image/*">
      </td>
    `;
    attachRowEvents(tr0,i.id);
    tbody0.appendChild(tr0);

    const tr1=document.createElement('tr');
    tr1.id=`row-${i.id}-1`;
    tr1.innerHTML=`
      <td>${i.name}</td>
      <td>${i.phone}</td>
      <td>${i.address}</td>
    `;
    attachRowEvents(tr1,i.id,true);
    tbody1.appendChild(tr1);
  });
}

// ---------- Row Events ----------
function attachRowEvents(tr,id,isPage2=false){
  tr.addEventListener('touchstart',()=>{longPressTimer=setTimeout(()=>showContextMenu(id,isPage2),600);});
  tr.addEventListener('touchend',clearLongPress);
  tr.addEventListener('touchmove',clearLongPress);
  tr.addEventListener('contextmenu',e=>{e.preventDefault(); showContextMenu(id,isPage2);});
}
function clearLongPress(){ if(longPressTimer){clearTimeout(longPressTimer); longPressTimer=null;} }

// ---------- Context Menu ----------
function showContextMenu(id,isPage2=false){
  hideContextMenu();
  const menu=document.createElement('div');
  menu.id='contextMenu';
  menu.innerHTML=`<button onclick="editItemInline(${id},${isPage2})">ویرایش</button><button onclick="deleteItem(${id})">حذف</button>`;
  document.body.appendChild(menu);
  setTimeout(()=>{document.addEventListener('click',hideContextMenu,{once:true});},0);
}
function hideContextMenu(){ const menu=document.getElementById('contextMenu'); if(menu) menu.remove(); }

// ---------- Edit Inline ----------
function editItemInline(id,isPage2=false){
  hideContextMenu();
  const row=document.getElementById(`row-${id}-${isPage2?1:0}`);
  const item=items.find(i=>i.id===id);
  if(isPage2){
    row.innerHTML=`
      <td><input value="${item.name}"></td>
      <td><input value="${item.phone}"></td>
      <td><input value="${item.address}"></td>
      <td><button onclick="saveEdit(${id}, this, true)">💾</button></td>
    `;
  }else{
    row.innerHTML=`
      <td><input value="${item.title}"></td>
      <td><input value="${item.desc}"></td>
      <td>${item.date}</td>
      <td><input value="${item.status}"></td>
      <td>
        <img src="${item.image||'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg=='}"
             class="op-img" onclick="pickImage(${item.id})">
      </td>
      <td><button onclick="saveEdit(${id}, this, false)">💾</button></td>
    `;
  }
}
function saveEdit(id,btn,isPage2=false){
  const row=btn.closest('tr');
  const inputs=row.querySelectorAll('input');
  const item=items.find(i=>i.id===id);

  let updated;

  if(isPage2){
    // صفحه دوم: فقط نام، تلفن، آدرس
    updated={
      ...item,
      name: inputs[0]?.value.trim() ?? item.name,
      phone: inputs[1]?.value.trim() ?? item.phone,
      address: inputs[2]?.value.trim() ?? item.address
    };
  }else{
    // صفحه اول: فقط عنوان، توضیح، وضعیت
    updated={
      ...item,
      title: inputs[0]?.value.trim() ?? item.title,
      desc: inputs[1]?.value.trim() ?? item.desc,
      status: inputs[2]?.value.trim() ?? item.status
    };
  }

  db.transaction("items","readwrite")
    .objectStore("items")
    .put(updated)
    .onsuccess=loadItems;
}


// ---------- Delete ----------
function deleteItem(id){ hideContextMenu(); db.transaction("items","readwrite").objectStore("items").delete(id).onsuccess=loadItems; }

// ---------- Image ----------
function pickImage(id){
  const fileInput=document.getElementById(`file-${id}`);
  fileInput.click();
  fileInput.onchange=()=>{
    const file=fileInput.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      const item=items.find(i=>i.id===id);
      db.transaction("items","readwrite").objectStore("items").put({...item,image:reader.result}).onsuccess=loadItems;
    };
    reader.readAsDataURL(file);
  };
}

// ---------- Export Excel ----------
async function exportExcel(){
  if(!items.length) return alert('داده‌ای وجود ندارد');
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet("Checklist");

  ws.columns=[
    {header:"عنوان",key:"title",width:25},
    {header:"توضیح",key:"desc",width:30},
    {header:"تاریخ",key:"date",width:15},
    {header:"وضعیت",key:"status",width:15},
    {header:"عکس",key:"image",width:15},
    {header:"نام",key:"name",width:25},
    {header:"شماره تلفن",key:"phone",width:20},
    {header:"آدرس",key:"address",width:30}
  ];

  for(let i=0;i<items.length;i++){
    const it=items[i];
    const row=ws.addRow({title:it.title,desc:it.desc,date:it.date,status:it.status,name:it.name,phone:it.phone,address:it.address});
    if(it.image){
      const imageId=wb.addImage({base64:it.image,extension:'png'});
      ws.addImage(imageId,{tl:{col:4,row:row.number-1},br:{col:5,row:row.number}});
      ws.getRow(row.number).height=80; ws.getColumn(5).width=15;
    }
  }
  wb.xlsx.writeBuffer().then(buf=>{
    saveAs(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"checklist.xlsx");
  });
}
function initSwipe() {
  tabs.forEach((tab, index) => {
    tab.addEventListener('mousedown', e => startSwipe(e, index));
    tab.addEventListener('touchstart', e => startSwipe(e, index));
  });

  document.addEventListener('mousemove', onSwipeMove);
  document.addEventListener('touchmove', onSwipeMove);
  document.addEventListener('mouseup', endSwipe);
  document.addEventListener('touchend', endSwipe);
}

function startSwipe(e, index){
  currentTab = index;
  startX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
}

function onSwipeMove(e){
  if(startX === null) return;
  const x = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
  const dx = x - startX;
  // اگر کشیدن بیش از 50px باشه
  if(dx > 50 && currentTab > 0){ showTab(currentTab-1); startX=null; }
  if(dx < -50 && currentTab < tabs.length-1){ showTab(currentTab+1); startX=null; }
}
window.addEventListener('DOMContentLoaded', initSwipe);

function endSwipe(){ startX = null; }

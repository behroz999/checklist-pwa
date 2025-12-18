let db;
let items = [];
let currentSort = { key: null, asc: true };
let longPressTimer = null;

// ---------- IndexedDB ----------
const request = indexedDB.open("ChecklistDB_v2", 1);

request.onupgradeneeded = e => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("items")) {
    db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
  }
};

request.onsuccess = e => {
  db = e.target.result;
  loadItems();
};

// ---------- تاریخ شمسی ----------
function toJalali(gy, gm, gd) {
  const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3)/4)
    - Math.floor((gy2 + 99)/100)
    + Math.floor((gy2 + 399)/400)
    - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days/12053);
  days %= 12053;
  jy += 4 * Math.floor(days/1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days-1)/365); days = (days-1)%365; }
  let jm = (days < 186) ? 1 + Math.floor(days/31) : 7 + Math.floor((days-186)/30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days-186) % 30));
  return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
}

function getShamsiDate() {
  const d = new Date();
  return toJalali(d.getFullYear(), d.getMonth()+1, d.getDate());
}

// ---------- Load Items ----------
function loadItems() {
  const tx = db.transaction("items", "readonly");
  tx.objectStore("items").getAll().onsuccess = e => {
    items = e.target.result || [];
    renderList();
  };
}

// ---------- Add Item ----------
function addItem() {
  const titleEl = document.getElementById('title');
  const descEl = document.getElementById('desc');
  const statusEl = document.getElementById('status');

  const title = titleEl.value.trim();
  const desc = descEl.value.trim();
  const status = statusEl.value.trim();

  if (!title) return alert('عنوان لازم است');

  const item = {
    title,
    desc,
    status,
    date: getShamsiDate(),
    timestamp: Date.now(),
    image: null
  };

  const tx = db.transaction("items", "readwrite");
  tx.objectStore("items").add(item).onsuccess = () => {
    loadItems();
    titleEl.value = '';
    descEl.value = '';
    statusEl.value = '';
  };
}

// ---------- Sort ----------
function sortBy(key) {
  if (currentSort.key === key) currentSort.asc = !currentSort.asc;
  else { currentSort.key = key; currentSort.asc = true; }
  renderList();
}

// ---------- Render List ----------
function renderList() {
  const tbody = document.getElementById('list');
  tbody.innerHTML = '';

  const search = document.getElementById('search').value.toLowerCase();

  let data = items.filter(i =>
    (i.title || '').toLowerCase().includes(search) ||
    (i.desc || '').toLowerCase().includes(search) ||
    (i.status || '').toLowerCase().includes(search)
  );

  if (currentSort.key) {
    data.sort((a, b) => {
      const A = (a[currentSort.key] ?? '').toString();
      const B = (b[currentSort.key] ?? '').toString();
      return currentSort.asc ? A.localeCompare(B,'fa') : B.localeCompare(A,'fa');
    });
  }

  data.forEach(i => {
    const tr = document.createElement('tr');
    tr.id = `row-${i.id}`;

    tr.innerHTML = `
      <td>${i.title}</td>
      <td>${i.desc}</td>
      <td>${i.date}</td>
      <td>${i.status}</td>
      <td>
        <img src="${i.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg=='}"
             class="op-img" onclick="pickImage(${i.id})">
        <input type="file" id="file-${i.id}" hidden accept="image/*">
      </td>
    `;

    tr.addEventListener('touchstart', () => { longPressTimer = setTimeout(() => showContextMenu(i.id),600); });
    tr.addEventListener('touchend', clearLongPress);
    tr.addEventListener('touchmove', clearLongPress);

    tr.addEventListener('contextmenu', e => { e.preventDefault(); showContextMenu(i.id); });

    tbody.appendChild(tr);
  });
}

function clearLongPress() { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer=null; } }

// ---------- Context Menu ----------
function showContextMenu(id) {
  hideContextMenu();
  const menu = document.createElement('div');
  menu.id = 'contextMenu';
  menu.innerHTML = `<button onclick="editItemInline(${id})">ویرایش</button><button onclick="deleteItem(${id})">حذف</button>`;
  document.body.appendChild(menu);
  setTimeout(() => { document.addEventListener('click', hideContextMenu, { once:true }); },0);
}
function hideContextMenu() { const menu = document.getElementById('contextMenu'); if(menu) menu.remove(); }

// ---------- Edit Inline ----------
function editItemInline(id) {
  hideContextMenu();
  const row = document.getElementById(`row-${id}`);
  const item = items.find(i=>i.id===id);
  row.innerHTML = `
    <td><input value="${item.title}"></td>
    <td><input value="${item.desc}"></td>
    <td>${item.date}</td>
    <td><input value="${item.status}"></td>
    <td><button onclick="saveEdit(${id}, this)">💾</button></td>
  `;
}
function saveEdit(id, btn){
  const row = btn.closest('tr');
  const inputs = row.querySelectorAll('input');
  const item = items.find(i=>i.id===id);
  const updated = {...item, title:inputs[0].value.trim(), desc:inputs[1].value.trim(), status:inputs[2].value.trim()};
  const tx=db.transaction("items","readwrite");
  tx.objectStore("items").put(updated).onsuccess=loadItems;
}

// ---------- Delete ----------
function deleteItem(id) { hideContextMenu(); db.transaction("items","readwrite").objectStore("items").delete(id).onsuccess=loadItems; }

// ---------- Image ----------
function pickImage(id){
  const fileInput=document.getElementById(`file-${id}`);
  fileInput.click();
  fileInput.onchange=()=>{
    const file=fileInput.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      const item=items.find(i=>i.id===id);
      db.transaction("items","readwrite").objectStore("items").put({...item,image:reader.result}).onsuccess=loadItems;
    };
    reader.readAsDataURL(file);
  };
}

// ---------- Export Excel با عکس واقعی ----------
async function exportExcel() {
  if(!items.length) return alert('داده‌ای وجود ندارد');

  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet("Checklist");

  ws.columns=[
    {header:"عنوان", key:"title", width:25},
    {header:"توضیح", key:"desc", width:30},
    {header:"تاریخ", key:"date", width:15},
    {header:"وضعیت", key:"status", width:15},
    {header:"عکس", key:"image", width:15}
  ];

  for(let i=0;i<items.length;i++){
    const it=items[i];
    const row=ws.addRow({title:it.title, desc:it.desc, date:it.date, status:it.status});
    if(it.image){
      const imageId=wb.addImage({base64: it.image, extension:'png'});
      ws.addImage(imageId, {tl:{col:4, row:row.number-1}, br:{col:5, row:row.number}});
      ws.getRow(row.number).height=80;
      ws.getColumn(5).width=15;
    }
  }

  wb.xlsx.writeBuffer().then(buf=>{
    const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    saveAs(blob,"checklist.xlsx");
  });
}

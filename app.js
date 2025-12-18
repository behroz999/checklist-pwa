let db;
let items = [];
let currentSort = { key: 'timestamp', asc: false };
let longPressTimer = null;

// ---------- IndexedDB ----------
const request = indexedDB.open("ChecklistDB_v2", 1);

request.onupgradeneeded = e => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("items")) {
    const store = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
    store.createIndex("timestamp", "timestamp");
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

// ---------- CRUD ----------
function loadItems() {
  const tx = db.transaction("items", "readonly");
  tx.objectStore("items").getAll().onsuccess = e => {
    items = e.target.result;
    renderList();
  };
}

function addItem() {
  const titleInput = document.getElementById('title');
  const descInput = document.getElementById('desc');
  const title = titleInput.value.trim();
  const desc = descInput.value.trim();
  if (!title) return alert('عنوان لازم است');

  const item = {
    title,
    desc,
    date: getShamsiDate(),
    timestamp: Date.now()
  };

  const tx = db.transaction("items", "readwrite");
  tx.objectStore("items").add(item).onsuccess = () => {
    loadItems();
    titleInput.value = '';
    descInput.value = '';
  };
}

function deleteItem(id) {
  const tx = db.transaction("items", "readwrite");
  tx.objectStore("items").delete(id).onsuccess = () => {
    hideContextMenu();
    loadItems();
  };
}

function editItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  const newTitle = prompt("عنوان:", item.title);
  if (newTitle === null) return;
  const newDesc = prompt("توضیح:", item.desc);
  if (newDesc === null) return;

  const tx = db.transaction("items", "readwrite");
  tx.objectStore("items").put({ ...item, title: newTitle, desc: newDesc }).onsuccess = loadItems;
}

// ---------- Sort + Search ----------
function sortBy(key) {
  currentSort.asc = currentSort.key === key ? !currentSort.asc : true;
  currentSort.key = key;
  renderList();
}

function renderList() {
  const tbody = document.getElementById('list');
  tbody.innerHTML = '';

  const search = document.getElementById('search').value.toLowerCase();

  const filtered = items
    .filter(i =>
      i.title.toLowerCase().includes(search) ||
      i.desc.toLowerCase().includes(search)
    )
    .sort((a, b) => {
      const valA = a[currentSort.key];
      const valB = b[currentSort.key];
      if (typeof valA === 'string') return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return currentSort.asc ? valA - valB : valB - valA;
    });

  for (const i of filtered) {
    const tr = document.createElement('tr');
    tr.id = `row-${i.id}`;

    tr.innerHTML = `
      <td>${i.title}</td>
      <td>${i.desc}</td>
      <td>${i.date}</td>
    `;

    tr.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => showContextMenu(i.id), 600);
    });
    tr.addEventListener('touchend', clearLongPress);
    tr.addEventListener('touchmove', clearLongPress);

    tbody.appendChild(tr);
  }
}

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

// ---------- Context Menu ----------
function showContextMenu(id) {
  hideContextMenu();

  const menu = document.createElement('div');
  menu.id = 'contextMenu';
  menu.innerHTML = `
    <button onclick="editItem(${id})">ویرایش</button>
    <button onclick="deleteItem(${id})">حذف</button>
  `;

  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 0);
}

function hideContextMenu() {
  const menu = document.getElementById('contextMenu');
  if (menu) menu.remove();
}

// ---------- Export ----------
function exportJSON() {
  const data = "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(items, null, 2));
  const a = document.createElement('a');
  a.href = data;
  a.download = 'checklist_backup.json';
  a.click();
}

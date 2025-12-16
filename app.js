// دیتابیس IndexedDB
let db;
const request = indexedDB.open("ChecklistDB_v2", 1);

request.onerror = function(event) { console.error("خطا در باز کردن دیتابیس", event); };
request.onsuccess = function(event) { db = event.target.result; loadItems(); };
request.onupgradeneeded = function(event) {
  db = event.target.result;
  if(!db.objectStoreNames.contains("items")) {
    const objectStore = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
    objectStore.createIndex("timestamp", "timestamp", { unique: false });
  }
};

// آرایه در حافظه
let items = [];

// تبدیل میلادی به شمسی
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
  return [jy, jm, jd];
}
function getShamsiDate() {
  const g = new Date();
  const [jy, jm, jd] = toJalali(g.getFullYear(), g.getMonth()+1, g.getDate());
  return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
}

// بارگذاری آیتم‌ها
function loadItems() {
  const transaction = db.transaction(["items"], "readonly");
  const objectStore = transaction.objectStore("items");
  const request = objectStore.getAll();
  request.onsuccess = function(event) { items = event.target.result; renderList(); };
}

// اضافه کردن آیتم جدید
function addItem() {
  const title = document.getElementById('title').value.trim();
  const desc = document.getElementById('desc').value.trim();
  if (!title) return alert('عنوان را وارد کنید');

  const item = {
    title, desc,
    date: getShamsiDate(),
    timestamp: new Date().getTime()
  };

  const transaction = db.transaction(["items"], "readwrite");
  const objectStore = transaction.objectStore("items");
  const requestAdd = objectStore.add(item);

  requestAdd.onsuccess = function() {
    loadItems();
    document.getElementById('title').value = '';
    document.getElementById('desc').value = '';
  };
}

// نمایش لیست و حذف آیتم‌ها
function renderList() {
  const ul = document.getElementById('list');
  ul.innerHTML = '';
  items.sort((a,b)=>b.timestamp - a.timestamp); // جدیدترین بالا
  for (let i of items) {
    const li = document.createElement('li');
    const textSpan = document.createElement('span');
    textSpan.innerText = `${i.date} - ${i.title}: ${i.desc}`;
    li.appendChild(textSpan);

    const delBtn = document.createElement('button');
    delBtn.innerText = 'حذف';
    delBtn.onclick = function() {
      const transaction = db.transaction(["items"], "readwrite");
      const objectStore = transaction.objectStore("items");
      const requestDelete = objectStore.delete(i.id);
      requestDelete.onsuccess = function() { loadItems(); };
      requestDelete.onerror = function(e) { console.error("خطا در حذف آیتم:", e); };
    };
    li.appendChild(delBtn);
    ul.appendChild(li);
  }
}

// خروجی JSON
function exportJSON() {
  const transaction = db.transaction(["items"], "readonly");
  const objectStore = transaction.objectStore("items");
  const request = objectStore.getAll();
  request.onsuccess = function(event) {
    const allItems = event.target.result;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allItems, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "checklist_backup.json");
    dlAnchor.click();
  };
}

// ============================
// آماده PWA
// ============================

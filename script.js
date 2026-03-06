const APP_VERSION = "3.5.0", STORAGE_KEY = 'wos_st_manage_data', DUR = 72 * 3600000;
let MASTER_DATA = {}, ALL_STATIONS = [], userState = { selectedIds: [], timers: {}, modes: {} };

async function init() {
    document.getElementById('js-version-tag').innerText = APP_VERSION;
    // マイグレーション
    const OLD_KEYS = ['wos_v300_master', 'wos_v340_data'];
    for(let k of OLD_KEYS) {
        const old = localStorage.getItem(k);
        if(old && !localStorage.getItem(STORAGE_KEY)) { localStorage.setItem(STORAGE_KEY, old); break; }
    }
    const res = await fetch('station.json'); MASTER_DATA = await res.json();
    Object.entries(MASTER_DATA).forEach(([k, cat]) => {
        cat.coords.forEach((c, i) => ALL_STATIONS.push({ id:`${k}-${c.lv}-${i}`, typeKey:k, typeName:cat.name, lv:c.lv, x:c.x, y:c.y }));
    });
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved) userState = JSON.parse(saved);
    const typeSel = document.getElementById('f-type');
    Object.entries(MASTER_DATA).forEach(([k, v]) => typeSel.innerHTML += `<option value="${k}">${v.name}</option>`);
    render(); setInterval(tick, 1000);
}

function tick() {
    const sorted = [...userState.selectedIds].sort((a, b) => ((userState.timers[a] || 0) + DUR - Date.now()) - ((userState.timers[b] || 0) + DUR - Date.now()));
    render(sorted);
}

function render(sortedIds) {
    const list = document.getElementById('station-list'), summaryList = document.getElementById('summary-list');
    list.innerHTML = ''; summaryList.innerHTML = '';
    (sortedIds || userState.selectedIds).forEach(id => {
        const s = ALL_STATIONS.find(x => x.id === id), m = userState.modes[id] || 'none';
        const diff = (userState.timers[id] || 0) + DUR - Date.now(), isExpired = diff <= 0;
        const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m_ = Math.floor((diff % 3600000) / 60000), s_ = Math.floor((diff % 60000) / 1000);
        const timeStr = isExpired ? "争奪中" : (d > 0 ? `${d}d ` : "") + `${h.toString().padStart(2,'0')}:${m_.toString().padStart(2,'0')}:${s_.toString().padStart(2,'0')}`;
        
        list.innerHTML += `<div class="station-card ${m}"><div>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</div><div style="font-size:1.4rem; margin:10px 0;">${timeStr}</div><div style="display:flex; gap:5px;"><button class="btn" onclick="sync('${id}')">同期</button><button class="btn" onclick="removeStation('${id}')">削除</button><button class="btn" onclick="setMode('${id}')">同盟:${m==='self'?'自':m==='other'?'他':'なし'}</button></div></div>`;
        if (isExpired || diff <= 24 * 3600000) {
            const dateStr = isExpired ? "争奪中" : new Date(Date.now() + diff).toLocaleString('ja-JP', {month:'numeric', day:'numeric', weekday:'short', hour:'2-digit', minute:'2-digit'});
            summaryList.innerHTML += `<div>[${m==='self'?'自':'他'}] ${s.typeName}Lv.${s.lv}: ${dateStr}</div>`;
        }
    });
}

function sync(id) {
    const val = prompt("残り時間を入力 (例: 1d 09 37 50)"); if(!val) return;
    let sec = 0, d = val.match(/(\d+)d/i); if(d) sec += parseInt(d[1])*86400;
    const n = val.replace(/\d+d/i,'').trim().split(/[:：\s]+/u).map(Number);
    if(n.length === 3) sec += n[0]*3600 + n[1]*60 + n[2]; else if(n.length === 4) sec += n[0]*86400 + n[1]*3600 + n[2]*60 + n[3]; else if(n.length === 2) sec += n[0]*3600 + n[1]*60;
    userState.timers[id] = Date.now() + (sec*1000) - DUR; save(); tick();
}

function exportData() {
    const blob = new Blob([JSON.stringify(userState)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'station_data.json'; a.click();
}
function importData(e) {
    const reader = new FileReader(); reader.onload = (e) => { userState = JSON.parse(e.target.result); save(); tick(); };
    reader.readAsText(e.target.files[0]);
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userState)); }
function setMode(id) { userState.modes[id] = userState.modes[id] === 'self' ? 'other' : 'self'; save(); tick(); }
function removeStation(id) { userState.selectedIds = userState.selectedIds.filter(x=>x!==id); delete userState.timers[id]; delete userState.modes[id]; save(); tick(); }
function addStation(id) { userState.selectedIds.push(id); userState.modes[id] = 'self'; save(); tick(); renderModalList(); }
function showModal() { document.getElementById('modal').style.display = 'block'; renderModalList(); }
function hideModal() { document.getElementById('modal').style.display = 'none'; }
function updateLvFilters() {
    const type = document.getElementById('f-type').value, lvSel = document.getElementById('f-lv');
    lvSel.innerHTML = '<option value="">全Lv</option>';
    if(type) [...new Set(MASTER_DATA[type].coords.map(c => c.lv))].sort((a,b)=>a-b).forEach(l => lvSel.innerHTML += `<option value="${l}">Lv.${l}</option>`);
    renderModalList();
}
function renderModalList() {
    const ml = document.getElementById('modal-list'), type = document.getElementById('f-type').value, lv = document.getElementById('f-lv').value;
    ml.innerHTML = '';
    ALL_STATIONS.filter(s => (!type || s.typeKey === type) && (!lv || s.lv == lv) && !userState.selectedIds.includes(s.id)).forEach(s => {
        ml.innerHTML += `<div class="modal-item"><span>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</span> <button class="btn" onclick="addStation('${s.id}')">追加</button></div>`;
    });
}
function shareURL() { const d = btoa(JSON.stringify(userState)); navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?data=" + d).then(() => alert("URLをコピーしました")); }
init();

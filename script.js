const APP_VERSION = "3.2.0";

let MASTER_DATA = {}, ALL_STATIONS = [], userState = { selectedIds: [], timers: {}, modes: {} };
const STORAGE_KEY = 'wos_v300_master', DUR = 72 * 3600000;

async function init() {
    document.getElementById('js-version-tag').innerText = APP_VERSION;
    const res = await fetch('station.json');
    MASTER_DATA = await res.json();
    Object.entries(MASTER_DATA).forEach(([k, cat]) => {
        cat.coords.forEach((c, i) => ALL_STATIONS.push({ id:`${k}-${c.lv}-${i}`, typeKey:k, typeName:cat.name, lv:c.lv, x:c.x, y:c.y }));
    });
    
    // URLデータ復元
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has('data')) {
        try { userState = JSON.parse(atob(urlParams.get('data'))); save(); window.history.replaceState({}, '', window.location.pathname); } 
        catch(e) { console.error(e); }
    } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if(saved) userState = JSON.parse(saved);
    }

    // フィルタ初期化
    const typeSel = document.getElementById('f-type');
    Object.entries(MASTER_DATA).forEach(([k, v]) => typeSel.innerHTML += `<option value="${k}">${v.name}</option>`);
    
    render(); setInterval(tick, 1000);
}

function updateLvFilters() {
    const type = document.getElementById('f-type').value;
    const lvSel = document.getElementById('f-lv');
    lvSel.innerHTML = '<option value="">全Lv</option>';
    if(type) {
        const lvs = [...new Set(MASTER_DATA[type].coords.map(c => c.lv))].sort((a,b)=>a-b);
        lvs.forEach(l => lvSel.innerHTML += `<option value="${l}">Lv.${l}</option>`);
    }
    renderModalList();
}

function renderModalList() {
    const ml = document.getElementById('modal-list'), type = document.getElementById('f-type').value, lv = document.getElementById('f-lv').value;
    ml.innerHTML = '';
    ALL_STATIONS.filter(s => (!type || s.typeKey === type) && (!lv || s.lv == lv) && !userState.selectedIds.includes(s.id)).forEach(s => {
        ml.innerHTML += `<div style="padding:8px; border-bottom:1px solid #444;">${s.typeName} Lv.${s.lv} (${s.x},${s.y}) <button class="btn" onclick="addStation('${s.id}')">追加</button></div>`;
    });
}

function addStation(id) {
    userState.selectedIds.push(id); userState.modes[id] = 'none'; save(); render(); renderModalList();
}

function sync(id) {
    const val = prompt("残り時間を入力 (例: 1d 09 37 50)");
    if(!val) return;
    let sec = 0;
    const d = val.match(/(\d+)d/i); if(d) sec += parseInt(d[1])*86400;
    const nums = val.replace(/\d+d/i,'').trim().split(/[:：\s]+/u).filter(x => x !== "").map(Number);
    if(nums.length === 3) sec += nums[0]*3600 + nums[1]*60 + nums[2];
    else if(nums.length === 4) sec += nums[0]*86400 + nums[1]*3600 + nums[2]*60 + nums[3];
    else if(nums.length === 2) sec += nums[0]*3600 + nums[1]*60;
    userState.timers[id] = Date.now() + (sec*1000) - DUR;
    save(); render();
}

function tick() {
    const sorted = [...userState.selectedIds].sort((a,b) => {
        const diffA = (userState.timers[a] || 0) + DUR - Date.now();
        const diffB = (userState.timers[b] || 0) + DUR - Date.now();
        return diffA - diffB;
    });
    render(sorted);
}

function render(sortedIds) {
    const list = document.getElementById('station-list');
    list.innerHTML = '';
    (sortedIds || userState.selectedIds).forEach(id => {
        const s = ALL_STATIONS.find(x => x.id === id), m = userState.modes[id] || 'none';
        const diff = (userState.timers[id] || 0) + DUR - Date.now();
        const card = document.createElement('div');
        card.className = `station-card ${m==='self'?'self':''} ${m==='other'?'other':''}`;
        card.innerHTML = `<div>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</div>
            <div class="countdown ${diff <= 0 ? 'cd-danger' : (diff <= 3600000 ? 'cd-warning' : 'cd-safe')}" id="t-${id}">
                ${diff <= 0 ? "争奪中" : Math.floor(diff/86400000)+'d '+Math.floor((diff%86400000)/3600000).toString().padStart(2,'0')+':'+Math.floor((diff%3600000)/60000).toString().padStart(2,'0')+':'+Math.floor((diff%60000)/1000).toString().padStart(2,'0')}
            </div>
            <button class="btn" onclick="sync('${id}')">同期</button>
            <button class="btn" onclick="removeStation('${id}')">削除</button>
            <button class="btn" onclick="setMode('${id}')">同盟:${m==='self'?'自':m==='other'?'他':'なし'}</button>`;
        list.appendChild(card);
    });
}

function setMode(id) {
    const m = userState.modes[id];
    userState.modes[id] = m === 'self' ? 'other' : (m === 'other' ? 'none' : 'self');
    save(); render();
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userState)); }
function removeStation(id) { userState.selectedIds = userState.selectedIds.filter(x=>x!==id); delete userState.timers[id]; delete userState.modes[id]; save(); render(); }
function showModal() { document.getElementById('modal').style.display = 'block'; renderModalList(); }
function hideModal() { document.getElementById('modal').style.display = 'none'; }
init();

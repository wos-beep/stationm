const APP_VERSION = "3.4.0";
let MASTER_DATA = {}, ALL_STATIONS = [], userState = { selectedIds: [], timers: {}, modes: {} };
const STORAGE_KEY = 'wos_v340_data', DUR = 72 * 3600000;

async function init() {
    document.getElementById('js-version-tag').innerText = APP_VERSION;
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
    const sorted = [...userState.selectedIds].sort((a, b) => {
        const diffA = (userState.timers[a] || 0) + DUR - Date.now();
        const diffB = (userState.timers[b] || 0) + DUR - Date.now();
        // 争奪中は負の値。値が小さい（＝争奪開始から時間が経過している）方を優先
        return diffA - diffB;
    });
    render(sorted);
}

function render(sortedIds) {
    const list = document.getElementById('station-list');
    list.innerHTML = '';
    const summaryList = document.getElementById('summary-list');
    summaryList.innerHTML = '';

    (sortedIds || userState.selectedIds).forEach(id => {
        const s = ALL_STATIONS.find(x => x.id === id), m = userState.modes[id] || 'none';
        const diff = (userState.timers[id] || 0) + DUR - Date.now();
        const isExpired = diff <= 0;
        
        // カード描画
        const card = document.createElement('div');
        card.className = `station-card ${m==='self'?'self':''} ${m==='other'?'other':''}`;
        card.innerHTML = `<div>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</div>
            <div style="font-size:1.4rem; margin:10px 0;">${isExpired ? "争奪中" : Math.floor(diff/86400000)+'d '+new Date(diff+(72*3600000)).toISOString().substr(11,8)}</div>
            <div class="card-btns">
                <button class="btn" onclick="sync('${id}')">同期</button>
                <button class="btn" onclick="removeStation('${id}')">削除</button>
                <button class="btn" onclick="setMode('${id}')">同盟:${m==='self'?'自':m==='other'?'他':'なし'}</button>
            </div>`;
        list.appendChild(card);

        // サマリー表示
        if (isExpired || diff <= 24 * 3600000) {
            const dateStr = isExpired ? "争奪中" : new Date(Date.now() + diff).toLocaleString('ja-JP', {month:'n', day:'numeric', weekday:'short', hour:'2-digit', minute:'2-digit'});
            summaryList.innerHTML += `<div>[${m==='self'?'自':'他'}] ${s.typeName}Lv.${s.lv}: ${dateStr}</div>`;
        }
    });
}

function copySummaryText() {
    const txt = document.getElementById('summary-list').innerText;
    navigator.clipboard.writeText(txt).then(() => alert("コピーしました"));
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
    save(); tick();
}

function renderModalList() {
    const ml = document.getElementById('modal-list'), type = document.getElementById('f-type').value, lv = document.getElementById('f-lv').value;
    ml.innerHTML = '';
    ALL_STATIONS.filter(s => (!type || s.typeKey === type) && (!lv || s.lv == lv) && !userState.selectedIds.includes(s.id)).forEach(s => {
        ml.innerHTML += `<div class="modal-item"><span>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</span> <button class="btn" onclick="addStation('${s.id}')">追加</button></div>`;
    });
}

function setMode(id) { userState.modes[id] = (userState.modes[id] === 'self' ? 'other' : 'self'); save(); tick(); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userState)); }
function removeStation(id) { userState.selectedIds = userState.selectedIds.filter(x=>x!==id); delete userState.timers[id]; delete userState.modes[id]; save(); tick(); }
function addStation(id) { userState.selectedIds.push(id); userState.modes[id] = 'self'; save(); tick(); renderModalList(); }
function showModal() { document.getElementById('modal').style.display = 'block'; renderModalList(); }
function hideModal() { document.getElementById('modal').style.display = 'none'; }
function shareURL() { const data = btoa(JSON.stringify(userState)); navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?data=" + data).then(() => alert("URLをコピーしました")); }
init();

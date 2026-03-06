const APP_VERSION = "3.1.0"; // v3.1.0: 入力柔軟化、動的ソート、同盟切替機能

let MASTER_DATA = {}, ALL_STATIONS = [], userState = { selectedIds: [], timers: {}, modes: {} };
const STORAGE_KEY = 'wos_v300_master', DUR = 72 * 3600000, EPOCH = 1735689600;

// 

async function init() {
    const res = await fetch('station.json');
    MASTER_DATA = await res.json();
    Object.entries(MASTER_DATA).forEach(([k, cat]) => {
        cat.coords.forEach((c, i) => ALL_STATIONS.push({ id:`${k}-${c.lv}-${i}`, typeKey:k, typeName:cat.name, lv:c.lv, x:c.x, y:c.y }));
    });
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved) userState = JSON.parse(saved);
    setInterval(tick, 1000);
}

function sync(id) {
    const val = prompt("残り時間を入力 (例: 1d 09 37 50 または 09 37 50)");
    if(!val) return;
    let sec = 0;
    const d = val.match(/(\d+)d/i); if(d) sec += parseInt(d[1])*86400;
    // 「:」「：」またはスペースで分割して数値を取得
    const nums = val.replace(/\d+d/i,'').trim().split(/[:：\s]+/u).filter(x => x !== "").map(Number);
    if(nums.length === 3) sec += nums[0]*3600 + nums[1]*60 + nums[2];
    else if(nums.length === 4) sec += nums[0]*86400 + nums[1]*3600 + nums[2]*60 + nums[3];
    else if(nums.length === 2) sec += nums[0]*3600 + nums[1]*60;
    
    userState.timers[id] = Date.now() + (sec*1000) - DUR;
    save();
}

function tick() {
    // 期限順にソート（争奪中を先頭に）
    const sorted = [...userState.selectedIds].sort((a,b) => {
        const diffA = (userState.timers[a] || 0) + DUR - Date.now();
        const diffB = (userState.timers[b] || 0) + DUR - Date.now();
        return diffA - diffB;
    });

    // 順序が変更された場合のみ再描画（または毎秒更新）
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
        card.innerHTML = `
            <div>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</div>
            <div class="countdown ${diff <= 0 ? 'cd-danger' : (diff <= 3600000 ? 'cd-warning' : 'cd-safe')}" id="t-${id}">--:--:--</div>
            <div id="jst-${id}">--</div>
            <button class="btn" onclick="setMode('${id}')">同盟:${m==='self'?'自':m==='other'?'他':'なし'}</button>
            <button class="btn" onclick="sync('${id}')">同期</button>
            <button class="btn" onclick="removeStation('${id}')">削除</button>`;
        list.appendChild(card);
        
        // カウントダウンと日時の更新
        const el = card.querySelector('.countdown');
        if(diff <= 0) el.innerText = "争奪中";
        else {
            const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
            el.innerText = `${d}d ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }
    });
}

function setMode(id) {
    const m = userState.modes[id];
    userState.modes[id] = m === 'self' ? 'other' : (m === 'other' ? 'none' : 'self');
    save();
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userState)); }
function removeStation(id) { userState.selectedIds = userState.selectedIds.filter(x=>x!==id); delete userState.timers[id]; delete userState.modes[id]; save(); }
init();

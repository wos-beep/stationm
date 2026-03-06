let MASTER_DATA = {}, ALL_STATIONS = [], userState = { selectedIds: [], timers: {}, modes: {} };
const STORAGE_KEY = 'wos_v300_master', DUR = 72 * 3600000, EPOCH = 1735689600;

async function init() {
    const res = await fetch('station.json');
    MASTER_DATA = await res.json();
    Object.entries(MASTER_DATA).forEach(([k, cat]) => {
        cat.coords.forEach((c, i) => ALL_STATIONS.push({ id:`${k}-${c.lv}-${i}`, typeKey:k, typeName:cat.name, lv:c.lv, x:c.x, y:c.y }));
    });
    const saved = localStorage.getItem('wos_v255_master') || localStorage.getItem(STORAGE_KEY);
    if(saved) {
        userState = JSON.parse(saved);
        Object.keys(userState.modes).forEach(id => {
            if(userState.modes[id] === 'own') userState.modes[id] = 'self';
            if(userState.modes[id] === 'enemy') userState.modes[id] = 'other';
        });
    }
    render(); setInterval(tick, 1000);
}

function sync(id) {
    const val = prompt("残り時間を入力 (例: 1d 09:11:27)");
    if(!val) return;
    let sec = 0;
    const d = val.match(/(\d+)d/i); if(d) sec += d[1]*86400;
    const t = val.replace(/\d+d/i,'').trim().split(/[:：]/);
    if(t.length===3) sec += t[0]*3600 + t[1]*60 + t[2]*1;
    userState.timers[id] = Date.now() + (sec*1000) - DUR;
    save(); render();
}

function tick() {
    userState.selectedIds.forEach(id => {
        const el = document.getElementById(`t-${id}`), jstEl = document.getElementById(`jst-${id}`);
        if(!el) return;
        const diff = (userState.timers[id] || 0) + DUR - Date.now();
        if(diff <= 0) { el.innerText = "争奪中"; el.className = "countdown cd-danger"; }
        else {
            const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
            el.innerText = `${d}d ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
            el.className = "countdown " + (diff <= 3600000 ? "cd-warning" : "cd-safe");
        }
        if(jstEl) {
            const date = new Date((userState.timers[id] || 0) + DUR);
            jstEl.innerText = `${date.getMonth()+1}/${date.getDate()}(${['日','月','火','水','木','金','土'][date.getDay()]}) ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
        }
    });
}

function render() {
    const list = document.getElementById('station-list'); list.innerHTML = '';
    userState.selectedIds.forEach(id => {
        const s = ALL_STATIONS.find(x => x.id === id), m = userState.modes[id] || 'none';
        const card = document.createElement('div');
        card.className = `station-card ${m==='self'?'self':''} ${m==='other'?'other':''}`;
        card.innerHTML = `<div>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</div>
            <div class="countdown" id="t-${id}">--:--:--</div><div id="jst-${id}">--</div>
            <button class="btn" onclick="sync('${id}')">同期</button><button class="btn" onclick="removeStation('${id}')">削除</button>`;
        list.appendChild(card);
    });
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userState)); }
function removeStation(id) { userState.selectedIds = userState.selectedIds.filter(x=>x!==id); save(); render(); }
function showModal() { document.getElementById('modal').style.display = 'block'; }
function hideModal() { document.getElementById('modal').style.display = 'none'; }
init();

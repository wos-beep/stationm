let MASTER_DATA = {};
let userState = { selectedIds: [], timers: {}, modes: {} };

async function init() {
    try {
        const res = await fetch('station.json');
        MASTER_DATA = await res.json();
        const saved = localStorage.getItem('wos_data');
        if (saved) userState = JSON.parse(saved);
        render();
        setInterval(render, 1000);
    } catch (e) { console.error("データ読み込み失敗", e); }
}

function render() {
    const list = document.getElementById('station-list');
    const protItems = document.getElementById('protection-items');
    list.innerHTML = '';
    protItems.innerHTML = '';

    userState.selectedIds.forEach(id => {
        const [k, lv, i] = id.split('-');
        const s = MASTER_DATA[k].coords[i];
        const endTime = userState.timers[id] || 0;
        const diff = endTime - Date.now();
        
        const div = document.createElement('div');
        div.className = `station-card ${userState.modes[id] || ''}`;
        div.innerHTML = `
            <div>${MASTER_DATA[k].name} Lv.${s.lv} (${s.x},${s.y})</div>
            <div style="font-size:1.2em; font-weight:bold">${diff > 0 ? formatTime(diff) : (endTime > 0 ? formatDate(endTime) : "争奪中")}</div>
            <button onclick="setMode('${id}', 'own')">自</button>
            <button onclick="setMode('${id}', 'enemy')">他</button>
            <button onclick="syncTimer('${id}')">同期</button>
            <button onclick="removeStation('${id}')">削除</button>
        `;
        list.appendChild(div);

        if (diff > 0 && diff < 86400000) {
            const p = document.createElement('div');
            p.className = 'prot-item';
            p.innerHTML = `<span>${MASTER_DATA[k].name} (${s.x},${s.y}) ${formatDate(endTime)}</span>`;
            protItems.appendChild(p);
        }
    });
}

function formatTime(ms) {
    const s = Math.floor(ms/1000);
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${s%60}s`;
}

function formatDate(ts) {
    const d = new Date(ts);
    const day = ["日","月","火","水","木","金","土"][d.getDay()];
    return `${d.getMonth()+1}/${d.getDate()}(${day}) ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
}

function setMode(id, mode) { userState.modes[id] = mode; save(); render(); }
function removeStation(id) { userState.selectedIds = userState.selectedIds.filter(i => i !== id); save(); render(); }
function syncTimer(id) { 
    const input = prompt("残り時間を入力 (例: 1d 09:11:27)");
    if(!input) return;
    let ms = 0;
    const d = input.match(/(\d+)d/); if(d) ms += d[1]*86400000;
    const h = input.match(/(\d+)h/); if(h) ms += h[1]*3600000;
    const m = input.match(/(\d+)m/); if(m) ms += m[1]*60000;
    const s = input.match(/(\d+)s/); if(s) ms += s[1]*1000;
    userState.timers[id] = Date.now() + ms;
    save(); render();
}
function save() { localStorage.setItem('wos_data', JSON.stringify(userState)); }
function showModal() { 
    document.getElementById('modal').style.display = 'block';
    const mList = document.getElementById('modal-list');
    mList.innerHTML = '';
    Object.entries(MASTER_DATA).forEach(([k, cat]) => {
        cat.coords.forEach((c, i) => {
            const id = `${k}-${c.lv}-${i}`;
            mList.innerHTML += `<button onclick="addStation('${id}')">${cat.name} Lv.${c.lv} (${c.x},${c.y})</button><br>`;
        });
    });
}
function addStation(id) { if(!userState.selectedIds.includes(id)) userState.selectedIds.push(id); save(); render(); hideModal(); }
function hideModal() { document.getElementById('modal').style.display = 'none'; }
function exportData() {
    const blob = new Blob([JSON.stringify(userState)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'wos_backup.json'; a.click();
}
function importData(e) {
    const reader = new FileReader();
    reader.onload = (ev) => { userState = JSON.parse(ev.target.result); save(); render(); };
    reader.readAsText(e.target.files[0]);
}
function copyProtectionList() {
    const items = Array.from(document.querySelectorAll('.prot-item')).map(el => el.innerText).join('\n');
    navigator.clipboard.writeText(items).then(() => alert("コピーしました"));
}
window.onload = init;

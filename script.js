const APP_VERSION = "v2.6.2-ported";
let MASTER_DATA = {}, ALL_STATIONS = [], userState = { selectedIds: [], timers: {}, modes: {} };

async function init() {
    document.getElementById('version-display').innerText = "Ver: " + APP_VERSION;
    const res = await fetch('station.json');
    MASTER_DATA = await res.json();
    Object.entries(MASTER_DATA).forEach(([k, cat]) => {
        cat.coords.forEach((c, i) => ALL_STATIONS.push({ id:`${k}-${c.lv}-${i}`, typeName:cat.name, lv:c.lv, x:c.x, y:c.y }));
    });
    const saved = localStorage.getItem('wos_data_v291');
    if (saved) userState = JSON.parse(saved);
    render();
    setInterval(render, 1000);
}

function render() {
    const list = document.getElementById('station-list');
    list.innerHTML = '';
    userState.selectedIds.forEach(id => {
        const s = ALL_STATIONS.find(x => x.id === id);
        if(!s) return;
        const time = userState.timers[id] || 0;
        const mode = userState.modes[id] || 'none';
        const div = document.createElement('div');
        div.className = `station-card ${mode}`;
        div.innerHTML = `
            <div>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</div>
            <div>${time ? new Date(time).toLocaleString() : '未設定'}</div>
            <button onclick="setMode('${id}', 'own')">自軍</button>
            <button onclick="setMode('${id}', 'enemy')">敵軍</button>
            <button onclick="removeStation('${id}')">削除</button>
        `;
        list.appendChild(div);
    });
}

function setMode(id, mode) { userState.modes[id] = mode; save(); render(); }
function removeStation(id) { userState.selectedIds = userState.selectedIds.filter(i => i !== id); save(); render(); }
function save() { localStorage.setItem('wos_data_v291', JSON.stringify(userState)); }
function importData(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        userState = JSON.parse(ev.target.result);
        save(); render();
    };
    reader.readAsText(e.target.files[0]);
}
function exportData() {
    const blob = new Blob([JSON.stringify(userState)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'wos_backup.json'; a.click();
}
window.onload = init;

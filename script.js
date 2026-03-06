const APP_VERSION = "v2.9.4";
let MASTER_DATA = {}, ALL_STATIONS = [], userState = { selectedIds: [], timers: {}, modes: {} };

async function init() {
    // UIにバージョンを表示
    document.getElementById('version-display').innerText = "ロジック: " + APP_VERSION;

    // データ読み込み
    const res = await fetch('station.json');
    MASTER_DATA = await res.json();
    
    Object.entries(MASTER_DATA).forEach(([k, cat]) => {
        cat.coords.forEach((c, i) => ALL_STATIONS.push({ id:`${k}-${c.lv}-${i}`, typeName:cat.name, lv:c.lv, x:c.x, y:c.y }));
    });
    
    const saved = localStorage.getItem('wos_data_v291');
    if (saved) userState = JSON.parse(saved);
    render();
}

function render() {
    const list = document.getElementById('station-list');
    list.innerHTML = '';
    userState.selectedIds.forEach(id => {
        const s = ALL_STATIONS.find(x => x.id === id);
        if(!s) return;
        const div = document.createElement('div');
        div.className = 'station-card';
        div.innerHTML = `<div>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</div>`;
        list.appendChild(div);
    });
}

function showModal() { document.getElementById('modal').style.display = 'block'; }
function hideModal() { document.getElementById('modal').style.display = 'none'; }
function importData(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        userState = JSON.parse(ev.target.result);
        localStorage.setItem('wos_data_v291', ev.target.result);
        render();
    };
    reader.readAsText(e.target.files[0]);
}

window.onload = init;

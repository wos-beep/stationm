let MASTER_DATA = {}, userState = { selectedIds: [], timers: {}, modes: {} };

async function init() {
    const res = await fetch('station.json');
    MASTER_DATA = await res.json();
    const saved = localStorage.getItem('wos_data');
    if (saved) userState = JSON.parse(saved);
    render();
    setInterval(render, 1000);
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

        // メインカード描画
        const div = document.createElement('div');
        div.className = `station-card ${userState.modes[id] || ''}`;
        div.innerHTML = `<div>${MASTER_DATA[k].name} Lv.${s.lv} (${s.x},${s.y})</div>
                         <div style="font-weight:bold">${diff > 0 ? formatTime(diff) : formatDate(endTime)}</div>
                         <button onclick="setMode('${id}', 'own')">自</button>
                         <button onclick="setMode('${id}', 'enemy')">他</button>
                         <button onclick="syncTimer('${id}')">同期</button>`;
        list.appendChild(div);

        // 24時間以内リスト用描画
        if (diff > 0 && diff < 86400000) {
            const p = document.createElement('div');
            p.className = 'prot-item';
            p.innerHTML = `<span>${MASTER_DATA[k].name} (${s.x},${s.y}) ${formatDate(endTime)}</span>`;
            protItems.appendChild(p);
        }
    });
}

function copyProtectionList() {
    const items = Array.from(document.querySelectorAll('.prot-item')).map(el => el.innerText).join('\n');
    navigator.clipboard.writeText(items).then(() => alert("コピーしました"));
}

// (補助関数：formatTime, formatDate, parseDuration, syncTimer 等を以前の定義に合わせて記述)

let MASTER_DATA = {};
let ALL_STATIONS = [];
let userState = { selectedIds: [], timers: {}, modes: {} };
const STORAGE_KEY = 'wos_v300_master';
const DUR = 72 * 60 * 60 * 1000;
const EPOCH = 1735689600;

async function init() {
    const res = await fetch('station.json');
    MASTER_DATA = await res.json();
    Object.entries(MASTER_DATA).forEach(([k, cat]) => {
        cat.coords.forEach((c, i) => {
            ALL_STATIONS.push({ id:`${k}-${c.lv}-${i}`, typeKey:k, typeName:cat.name, lv:c.lv, x:c.x, y:c.y });
        });
    });
    load();
    setInterval(tick, 1000);
}

function migrate(state) {
    // 旧ステータス名を新ステータス名へ変換
    Object.keys(state.modes).forEach(id => {
        if (state.modes[id] === 'own') state.modes[id] = 'self';
        if (state.modes[id] === 'enemy') state.modes[id] = 'other';
    });
    return state;
}

function load() {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('v');
    if (v) {
        try {
            const newState = { selectedIds: [], timers: {}, modes: {} };
            v.split('_').forEach(p => {
                const [idx36, mode, time36] = p.split('.');
                const station = ALL_STATIONS[parseInt(idx36, 36)];
                if (!station) return;
                newState.selectedIds.push(station.id);
                // URLパラメータからの変換
                newState.modes[station.id] = mode == 1 ? 'self' : (mode == 2 ? 'other' : 'none');
                if (time36) newState.timers[station.id] = (parseInt(time36, 36) + EPOCH) * 1000;
            });
            userState = newState; save(); window.history.replaceState({}, '', location.pathname);
        } catch(e) {}
    } else {
        const saved = localStorage.getItem('wos_v255_master') || localStorage.getItem(STORAGE_KEY);
        if(saved) userState = migrate(JSON.parse(saved));
    }
    const tSel = document.getElementById('f-type');
    Object.entries(MASTER_DATA).forEach(([k, v]) => tSel.innerHTML += `<option value="${k}">${v.name}</option>`);
    render();
}

function render() {
    const grid = document.getElementById('station-list'); grid.innerHTML = '';
    const sortedIds = [...userState.selectedIds].sort((a, b) => {
        const timeA = userState.timers[a] ? userState.timers[a] + DUR : Infinity;
        const timeB = userState.timers[b] ? userState.timers[b] + DUR : Infinity;
        return timeA - timeB;
    });

    sortedIds.forEach(id => {
        const s = ALL_STATIONS.find(x => x.id === id); if(!s) return;
        const mode = userState.modes[id] || 'none', t = userState.timers[id];
        const card = document.createElement('div'); 
        card.className = `station-card ${mode==='self'?'self':''} ${mode==='other'?'other':''}`;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="display:flex; gap:5px;">
                    <button class="btn" style="padding:8px 15px; background:${mode==='self'?'var(--self)':'#333'}" onclick="setMode('${id}','self')">自</button>
                    <button class="btn" style="padding:8px 15px; background:${mode==='other'?'var(--other)':'#333'}" onclick="setMode('${id}','other')">他</button>
                </div>
                <span style="cursor:pointer; color:#777; font-size:2rem; padding:0 10px;" onclick="removeStation('${id}')">&times;</span>
            </div>
            <div class="card-title">${s.typeName} Lv.${s.lv} <small style="color:#aaa">(${s.x}, ${s.y})</small></div>
            ${t ? `<div class="countdown" id="t-${id}">--:--:--</div><div class="jst-time" id="jst-${id}">--/-- --:--:--</div>
                 <div style="display:flex; gap:10px;"><button class="btn" style="background:#0277bd; flex:1" onclick="sync('${id}')">同期</button><button class="btn" style="background:#c62828" onclick="resetTimer('${id}')">解除</button></div>` 
            : `<button class="btn" style="background:#2e7d32; width:100%; margin-top:10px; font-size:1.1rem;" onclick="startTimer('${id}')">72h 保護開始</button>`}
        `;
        grid.appendChild(card);
    });
}

function tick() {
    const now = Date.now(); 
    let sumData = userState.selectedIds.map(id => {
        const endTime = userState.timers[id] ? userState.timers[id] + DUR : null;
        const diff = endTime ? endTime - now : Infinity;
        const s = ALL_STATIONS.find(x => x.id === id);
        return { id, name: `${s.typeName} Lv.${s.lv}`, diff, mode: userState.modes[id], endTime };
    });

    // 争奪中優先、その後時間順でソート
    sumData.sort((a,b) => (a.diff <= 0 ? -1 : 1) - (b.diff <= 0 ? -1 : 1) || a.diff - b.diff);

    // UI更新
    sumData.forEach(item => {
        const el = document.getElementById(`t-${item.id}`), jstEl = document.getElementById(`jst-${item.id}`);
        if(el) {
            el.className = 'countdown ' + (item.diff <= 0 ? 'cd-danger' : (item.diff <= 3600000 ? 'cd-warning' : 'cd-safe'));
            el.innerText = item.diff <= 0 ? "争奪中" : `${Math.floor(item.diff/3600000)}h ${Math.floor((item.diff%3600000)/60000)}m ${Math.floor((item.diff%60000)/1000)}s`;
        }
        if(jstEl && item.endTime) {
            const date = new Date(item.endTime);
            jstEl.innerText = `${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
        }
    });

    document.getElementById('summary-list').innerHTML = sumData.map(i => {
        if(i.diff > 24 * 60 * 60 * 1000) return '';
        let cls = i.diff <= 0 ? 'color:var(--status-danger);' : (i.diff <= 3600000 ? 'color:var(--status-warning);' : 'color:#ccc;');
        return `<div style="background:#2a2a2a; padding:6px 10px; border-radius:4px; display:flex; justify-content:space-between; border-left:4px solid ${i.mode==='other'?'var(--other)':'var(--self)'}; ${cls}">
            <span>${i.mode==='other'?'他':'自'} ${i.name}</span>
            <span>${i.diff <= 0 ? '争奪中' : Math.floor(i.diff/3600000)+'h'}</span>
        </div>`;
    }).join('');
}

// 他の関数(save, setMode, etc...)は以前の仕様を踏襲し、定数を新名称に適合させる
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userState)); }
function setMode(id, m) { userState.modes[id] = m; save(); render(); }
function startTimer(id) { userState.timers[id] = Date.now(); save(); render(); }
function resetTimer(id) { if(confirm('解除しますか？')) { delete userState.timers[id]; save(); render(); } }
function removeStation(id) { userState.selectedIds = userState.selectedIds.filter(x => x !== id); delete userState.timers[id]; delete userState.modes[id]; save(); render(); }
function showModal() { document.getElementById('modal').style.display = 'block'; filterModal(); }
function hideModal() { document.getElementById('modal').style.display = 'none'; }
function onTypeChange() {
    const type = document.getElementById('f-type').value, lvSel = document.getElementById('f-lv'), prevLv = lvSel.value;
    lvSel.innerHTML = '<option value="">全Lv</option>';
    if (type) {
        const lvs = [...new Set(MASTER_DATA[type].coords.map(c => c.lv))].sort();
        lvs.forEach(l => lvSel.innerHTML += `<option value="${l}">Lv.${l}</option>`);
        lvSel.value = lvs.includes(parseInt(prevLv)) ? prevLv : "";
    }
    filterModal();
}
function filterModal() {
    const type = document.getElementById('f-type').value, lv = document.getElementById('f-lv').value, search = document.getElementById('f-search').value;
    const list = document.getElementById('modal-list'); list.innerHTML = '';
    ALL_STATIONS.filter(s => (!type || s.typeKey === type) && (!lv || s.lv == lv) && (!search || s.x == search || s.y == search) && !userState.selectedIds.includes(s.id)).forEach(s => {
        const div = document.createElement('div'); div.className = 'modal-item';
        div.innerHTML = `<span><b>${s.typeName} Lv.${s.lv}</b> (${s.x}, ${s.y})</span><button class="btn btn-add" onclick="addStation('${s.id}')">追加</button>`;
        list.appendChild(div);
    });
}
function addStation(id) { userState.selectedIds.push(id); userState.modes[id] = 'none'; save(); render(); filterModal(); }

function copySummaryText() {
    const isAll = document.getElementById('copy-all-flag').checked;
    let txt = isAll ? "【全状況】\n" : "【24h以内 保護終了】\n";
    let items = userState.selectedIds.filter(id => userState.timers[id]).map(id => {
        const t = userState.timers[id] + DUR; const s = ALL_STATIONS.find(x => x.id === id);
        return { name: `${s.typeName} Lv.${s.lv}`, diff: t - Date.now(), mode: userState.modes[id] };
    }).sort((a,b) => (a.diff <= 0 ? -1 : 1) - (b.diff <= 0 ? -1 : 1) || a.diff - b.diff);
    
    if (!isAll) items = items.filter(i => i.diff > 0 && i.diff <= 24 * 60 * 60 * 1000);
    items.forEach(i => {
        const h = Math.floor(Math.max(0,i.diff)/3600000);
        txt += `${i.mode==='other'?'●他':'○自'} ${i.name}: ${i.diff <= 0 ? '争奪中' : h + 'h'}\n`;
    });
    navigator.clipboard.writeText(txt).then(() => alert("コピーしました"));
}

function shareURL() {
    if (!userState.selectedIds.length) return;
    const parts = userState.selectedIds.map(id => {
        const idx = ALL_STATIONS.findIndex(s => s.id === id);
        const mode = userState.modes[id] === 'self' ? 1 : (userState.modes[id] === 'other' ? 2 : 0);
        const time = userState.timers[id] ? Math.floor(userState.timers[id]/1000 - EPOCH).toString(36) : "";
        return `${idx.toString(36)}.${mode}.${time}`;
    });
    const url = window.location.origin + window.location.pathname + "?v=" + parts.join('_');
    navigator.clipboard.writeText(url).then(() => alert("短縮URLコピー完了"));
}

function exportData() { const b = new Blob([JSON.stringify(userState)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `wos_backup.json`; a.click(); }
function importData(e) { const r = new FileReader(); r.onload = (ev) => { try { userState = migrate(JSON.parse(ev.target.result)); save(); render(); } catch(e){alert("失敗");} }; r.readAsText(e.target.files[0]); }

init();

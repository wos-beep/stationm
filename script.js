const APP_VERSION = "3.6.4", STORAGE_KEY = 'wos_st_manage_data', DUR = 72 * 3600000;
let MASTER_DATA = {}, ALL_STATIONS = [], userState = { selectedIds: [], timers: {}, modes: {} };

function isWindows() { return navigator.userAgent.includes("Windows"); }

// 文字幅の重み計算
function getCharWeight(char) {
    if (char === '.' || char === '．' || char === ':' || char === '：') return 0.5;
    return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(char) ? 2.0 : 1.0;
}
function calculateRowWeight(str) { return Array.from(str).reduce((acc, char) => acc + getCharWeight(char), 0); }

// パディング関数（ターゲット幅を引数で指定）
function padSummaryLine(line, targetWidth = 32.0) { 
    let diff = targetWidth - calculateRowWeight(line); 
    while (diff >= 2.0) { line += "　"; diff -= 2.0; }
    if (diff >= 1.0) { line += " "; }
    return line; 
}

async function init() {
    document.getElementById('js-version-tag').innerText = APP_VERSION;
    const res = await fetch('station.json'); MASTER_DATA = await res.json();
    Object.entries(MASTER_DATA).forEach(([k, cat]) => {
        cat.coords.forEach((c, i) => ALL_STATIONS.push({ id:`${k}-${c.lv}-${i}`, typeKey:k, typeName:cat.name, lv:c.lv, x:c.x, y:c.y }));
    });
    const d = new URLSearchParams(window.location.search).get('d');
    if(d) {
        userState = { selectedIds: [], timers: {}, modes: {} };
        d.split("-").forEach(item => {
            const [idx, timeSec] = item.split(".");
            const s = ALL_STATIONS[idx];
            if(s) { userState.selectedIds.push(s.id); userState.timers[s.id] = parseInt(timeSec) * 1000; userState.modes[s.id] = 'self'; }
        });
        save();
    } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if(saved) userState = JSON.parse(saved);
    }
    const typeSel = document.getElementById('f-type');
    Object.entries(MASTER_DATA).forEach(([k, v]) => typeSel.innerHTML += `<option value="${k}">${v.name}</option>`);
    render(); setInterval(tick, 1000);
}

function tick() { render(); }

function render(sortedIds) {
    const list = document.getElementById('station-list'), summaryList = document.getElementById('summary-list');
    list.innerHTML = ''; summaryList.innerHTML = '';
    const ids = sortedIds || userState.selectedIds;
    ids.sort((a, b) => ((userState.timers[a] || 0) + DUR - Date.now()) - ((userState.timers[b] || 0) + DUR - Date.now())).forEach(id => {
        const s = ALL_STATIONS.find(x => x.id === id), m = userState.modes[id] || 'none';
        const diff = (userState.timers[id] || 0) + DUR - Date.now(), isExpired = diff <= 0;
        const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m_ = Math.floor((diff % 3600000) / 60000), s_ = Math.floor((diff % 60000) / 1000);
        const expiryDate = new Date(Date.now() + diff);
        const dateStr = expiryDate.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric' });
        const dayStr = '日月火水木金土'[expiryDate.getDay()];
        const timeStr = expiryDate.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const timeDisplay = isExpired ? "争奪中" : (d>0?d+"d ":"")+h.toString().padStart(2,'0')+":"+m_.toString().padStart(2,'0')+":"+s_.toString().padStart(2,'0');

        list.innerHTML += `<div class="station-card ${m}">
            <div>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</div>
            <div style="font-size:0.9rem; color:#666;">${isExpired ? "" : `${dateStr}(${dayStr}) ${timeStr}`}</div>
            <div style="font-size:1.4rem; margin-bottom:5px;">${timeDisplay}</div>
            <div style="display:flex; gap:5px;">
                <button class="btn" onclick="sync('${id}')">同期</button>
                <button class="btn" onclick="removeStation('${id}')">削除</button>
                <button class="btn" onclick="setMode('${id}')">同盟:${m==='self'?'自':'他'}</button>
            </div>
        </div>`;
        if (isExpired || diff <= 24 * 3600000) {
            const targetDate = new Date(Date.now() + diff);
            const dateStr = targetDate.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric' });
            const dayStr = '日月火水木金土'[targetDate.getDay()];
            const timeStr = targetDate.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            const displayDate = isExpired ? "争奪中" : `${dateStr}(${dayStr}) ${timeStr}`;
            summaryList.innerHTML += `<div class="summary-entry">[${m==='self'?'自':'他'}] ${s.typeName}Lv.${s.lv}: ${displayDate}</div>`;
        }
    });
    renderChart();
}

function renderChart() {
    const chart = document.getElementById('gantt-chart');
    const DAYS = 4; // チャート全体の表示期間（4日間）
    const now = Date.now();
    const durationMs = DAYS * 86400000;
    
    let html = '<div style="display:flex; justify-content:space-between; margin-bottom:10px;">';
    for(let i = 0; i <= DAYS; i++) {
        const d = new Date(now + (i * 86400000));
        html += `<span style="font-size:10px; color:#aaa; width:${100/DAYS}%">${d.getMonth()+1}/${d.getDate()}(${'日月火水木金土'[d.getDay()]})</span>`;
    }
    html += '</div>';
    
    for(let i = 0; i <= DAYS; i++) {
        html += `<div class="gantt-grid" style="left:${(i / DAYS) * 100}%"></div>`;
    }
    
    userState.selectedIds.forEach((id, index) => {
        const s = ALL_STATIONS.find(x => x.id === id);
        if(!s) return;
        
        const endTime = userState.timers[id] || now;
        const timeLeft = endTime - now; // 現在から解除までの残り時間
        
        // 1. バーの開始位置：常に現在時刻（left: 0%）からスタート
        const left = 0;
        
        // 2. バーの長さ：残り時間をDAYS期間に対するパーセンテージで算出
        // timeLeft が負（期限切れ）なら長さ0、最大でも100%まで
        const width = Math.max(0, Math.min(100, (timeLeft / durationMs) * 100));
        
        const expiry = new Date(endTime);
        const label = `${s.typeName} Lv.${s.lv}`;
        
        // 残り時間がある（timeLeft > 0）場合のみバーを描画
        if(timeLeft > 0) {
            html += `<div class="gantt-bar ${userState.modes[id]}" 
                title="${label}: ${expiry.getMonth()+1}/${expiry.getDate()} ${expiry.getHours()}:${expiry.getMinutes().toString().padStart(2,'0')}まで" 
                style="left:${left}%; width:${width}%; top:${45 + (index % 8) * 16}px;">
                ${label}</div>`;
        }
    });
    chart.innerHTML = html;
}

function copySummaryText() { 
    // 全データ数を取得
    const elements = document.querySelectorAll('.summary-entry');
    const total = elements.length;
    
    const entries = Array.from(elements).map((el, index) => {
        let text = el.innerText;
        
        // 1. スペース全消去
        text = text.replace(/\s+/g, '');
        
        // 2. 記号整形
        text = text.replace(/\[自\]/g, '【自】').replace(/\[他\]/g, '【他】');
        text = text.replace(/Lv\./g, 'Lv').replace(/:/g, ':');
        
        // 3. 日付＋曜日＋時刻整形
        const dateMatch = text.match(/(\d+\/\d+)(\d{2}:\d{2})/);
        if (dateMatch) {
            const [full, datePart, timePart] = dateMatch;
            const [m, d] = datePart.split('/').map(Number);
            const dateObj = new Date(new Date().getFullYear(), m - 1, d);
            const dow = '日月火水木金土'[dateObj.getDay()];
            text = text.replace(full, `${datePart}(${dow})_${timePart}`);
        }
        
        // 4. パディング制御：最後（index === total - 1）以外にのみパディング適用
        const isLast = (index === total - 1);
        return (isWindows() && !isLast) ? padSummaryLine(text, 32.0) : text;
    });
    
    const textToCopy = isWindows() ? entries.join('') : entries.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => alert("コピーしました"));
}

function shareURL() { const data = userState.selectedIds.map(id => ALL_STATIONS.findIndex(s => s.id === id) + "." + Math.floor(userState.timers[id] / 1000)).join("-"); const url = window.location.origin + window.location.pathname + "?d=" + data; navigator.clipboard.writeText(url).then(() => alert("URLをコピーしました")); }
function sync(id) { const val = prompt("残り時間を入力 (例: 1d 09 37 50)"); if(!val) return; let sec = 0, d = val.match(/(\d+)d/i); if(d) sec += parseInt(d[1])*86400; const n = val.replace(/\d+d/i,'').trim().split(/[:：\s]+/u).map(Number); if(n.length === 3) sec += n[0]*3600 + n[1]*60 + n[2]; else if(n.length === 4) sec += n[0]*86400 + n[1]*3600 + n[2]*60 + n[3]; userState.timers[id] = Date.now() + (sec*1000) - DUR; save(); tick(); }
function exportData() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(userState)], {type: 'application/json'})); a.download = 'station_data.json'; a.click(); }
function importData(e) { const reader = new FileReader(); reader.onload = (e) => { userState = JSON.parse(e.target.result); save(); tick(); }; reader.readAsText(e.target.files[0]); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userState)); }
function setMode(id) { userState.modes[id] = userState.modes[id] === 'self' ? 'other' : 'self'; save(); tick(); }
function removeStation(id) { userState.selectedIds = userState.selectedIds.filter(x=>x!==id); delete userState.timers[id]; delete userState.modes[id]; save(); tick(); }
function addStation(id) { 
    userState.selectedIds.push(id); 
    // 【修正前】 userState.modes[id] = 'self';
    // 【修正後】 初期値を 'other' に変更
    userState.modes[id] = 'other'; 
    save(); 
    tick(); 
    renderModalList(); 
}
function showModal() { document.getElementById('modal').style.display = 'block'; renderModalList(); }
function hideModal() { document.getElementById('modal').style.display = 'none'; }
function updateLvFilters() { const type = document.getElementById('f-type').value, lvSel = document.getElementById('f-lv'); lvSel.innerHTML = '<option value="">全Lv</option>'; if(type) [...new Set(MASTER_DATA[type].coords.map(c => c.lv))].sort((a,b)=>a-b).forEach(l => lvSel.innerHTML += `<option value="${l}">Lv.${l}</option>`); renderModalList(); }
function renderModalList() { const ml = document.getElementById('modal-list'), type = document.getElementById('f-type').value, lv = document.getElementById('f-lv').value; ml.innerHTML = ''; ALL_STATIONS.filter(s => (!type || s.typeKey === type) && (!lv || s.lv == lv) && !userState.selectedIds.includes(s.id)).forEach(s => { ml.innerHTML += `<div class="modal-item"><span>${s.typeName} Lv.${s.lv} (${s.x},${s.y})</span> <button class="btn" onclick="addStation('${s.id}')">追加</button></div>`; }); }
document.addEventListener('DOMContentLoaded', init);

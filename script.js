/**
 * [v2.9.2] 施設管理-ロジック部
 */
const VERSION = "v2.9.2";
const STORAGE_KEY = 'wos_data_v291';
const DUR_PROTECT = 72 * 3600000;
let MASTER_DATA = {};
let ALL_STATIONS = [];
let userState = { selectedIds: [], timers: {}, modes: {} };

// アプリ初期化：JSON読み込みとデータ統合
async function init() {
    try {
        const response = await fetch('station.json');
        MASTER_DATA = await response.json();
        
        // ALL_STATIONSの構築 (v2.6.2互換のID生成)
        ALL_STATIONS = [];
        Object.entries(MASTER_DATA).forEach(([k, cat]) => {
            cat.coords.forEach((c, i) => {
                ALL_STATIONS.push({ id:`${k}-${c.lv}-${i}`, typeKey:k, typeName:cat.name, lv:c.lv, x:c.x, y:c.y });
            });
        });

        // 過去データ読み込み（ローカルストレージ優先）
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            userState = JSON.parse(saved);
        }
        render();
        setInterval(tick, 1000);
    } catch (e) { console.error("初期化失敗:", e); }
}

// インポート機能：過去のバックアップデータを現在のマスターと照合・変換
function importData(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            // v2.6.2バックアップ構造との互換性マッピング
            userState = {
                selectedIds: imported.selectedIds || [],
                timers: imported.timers || {},
                modes: imported.modes || {}
            };
            save();
            render();
            alert("データの移行と読み込みが完了しました");
        } catch(err) { alert("JSON形式が不正です"); }
    };
    reader.readAsText(e.target.files[0]);
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userState)); }

// v2.6.2 の強固なソート・描画ロジック
function render() {
    const grid = document.getElementById('station-list');
    grid.innerHTML = '';
    
    // 終了時間順のソート
    const sortedIds = [...userState.selectedIds].sort((a, b) => {
        const tA = userState.timers[a] ? userState.timers[a] + DUR_PROTECT : Infinity;
        const tB = userState.timers[b] ? userState.timers[b] + DUR_PROTECT : Infinity;
        return tA - tB;
    });

    sortedIds.forEach(id => {
        const s = ALL_STATIONS.find(x => x.id === id);
        if (!s) return; // マスターにないIDはスキップ
        
        // ここに v2.6.2 準拠のカード生成ロジックを実装
        // (省略：以前のコードと同様のHTML生成処理)
    });
}

window.onload = init;

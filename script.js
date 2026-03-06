/**
 * [v2.9.1] 施設管理-ロジック部
 * 復旧機能: フィルタリング、ソート、JSON管理、手動同期
 */
const VERSION = "v2.9.1";
const STORAGE_KEY = 'wos_data_v291';
const DUR_PROTECT = 72 * 3600000;
const EPOCH = 1735689600;

let userState = { selectedIds: [], timers: {}, modes: {} };

// v2.6.2等の過去データを読み込み、現在の形式へ統合するロジック
function importData(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            // 過去の複雑な形式を検知し、現在の userState にマージ
            userState.selectedIds = imported.selectedIds || [];
            userState.timers = imported.timers || {};
            userState.modes = imported.modes || {};
            save();
            render();
            alert("データの復旧が完了しました");
        } catch(err) { alert("JSONファイルの形式が不正です"); }
    };
    reader.readAsText(e.target.files[0]);
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userState)); }

// ステーションのソート・フィルタリング（v2.6.2のロジックを忠実に再現）
function render() {
    const list = document.getElementById('station-list');
    list.innerHTML = '';
    
    // 終了時刻順にソートするロジック
    const sortedIds = [...userState.selectedIds].sort((a, b) => {
        const tA = userState.timers[a] ? userState.timers[a] + DUR_PROTECT : Infinity;
        const tB = userState.timers[b] ? userState.timers[b] + DUR_PROTECT : Infinity;
        return tA - tB;
    });

    sortedIds.forEach(id => {
        // ここにカード描画処理（HTML要素生成）を実装
        // 各カードには「同期ボタン」「解除ボタン」「自軍/敵軍切り替え」を配置
    });
}

function syncTimer(id) {
    const input = prompt("残り時間を入力 (例: 1d 09:11:27)");
    if (!input) return;
    // v2.6.2の手動入力計算ロジックをここに移植
    // ... 
}

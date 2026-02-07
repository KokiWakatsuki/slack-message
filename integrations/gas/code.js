/**
 * ==============================================================================
 * Phase 1: 基盤・定数定義
 * 役割：スクリプトプロパティの取得、グローバル変数の定義、メニューの生成
 * ==============================================================================
 */

// 1. スクリプトプロパティの取得
// SLACK_BOT_TOKEN: xoxb- で始まるトークン
// SPREADSHEET_ID: 書き込み先スプレッドシートのID
// EXPORT_FOLDER_ID: Google Drive上のエクスポートデータ保存フォルダのID
const scriptProps = PropertiesService.getScriptProperties();
const SLACK_BOT_TOKEN = scriptProps.getProperty('SLACK_BOT_TOKEN');
const SPREADSHEET_ID = scriptProps.getProperty('SPREADSHEET_ID');
const EXPORT_FOLDER_ID = scriptProps.getProperty('EXPORT_FOLDER_ID');

// 2. システム定数
const SYSTEM_SHEETS = ["_user", "_channels", "IMPORT_STATUS"]; // ログ以外の管理用シート名
const TIME_LIMIT_MS = 4.5 * 60 * 1000; // GASの実行制限を考慮した安全な停止時間 (4分30秒)

/**
 * スプレッドシートが開かれた時に実行される
 * カスタムメニュー「🚀 Slackコンソール」を作成
 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('🚀 Slackコンソール')
        .addItem('管理パネルを開く', 'showSidebar')
        .addSeparator()
        .addItem('設定の確認（ログ出力）', 'checkConfig')
        .addToUi();
}

/**
 * サイドバーを表示する
 */
function showSidebar() {
    const html = HtmlService.createHtmlOutputFromFile('Sidebar')
        .setTitle('Slack Data Manager')
        .setWidth(300);
    SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 設定が正しく読み込めているかデバッグ用のログを出す
 */
function checkConfig() {
    const ui = SpreadsheetApp.getUi();
    const report = [
        `TOKEN: ${SLACK_BOT_TOKEN ? '✅ OK' : '❌ 未設定'}`,
        `SPREADSHEET_ID: ${SPREADSHEET_ID ? '✅ OK' : '❌ 未設定'}`,
        `EXPORT_FOLDER_ID: ${EXPORT_FOLDER_ID ? '✅ OK' : '❌ 未設定'}`
    ].join('\n');

    ui.alert('設定ステータス', report, ui.ButtonSet.OK);
}

/**
 * ==============================================================================
 * Phase 2: 通信・共通ユーティリティ
 * 役割：API通信の共通化、シート操作の安全化、文字列のクレンジング
 * ==============================================================================
 */

/**
 * 1. Slack APIにGETリクエストを送り、JSONを返す
 * @param {string} url - APIのURL（クエリパラメータ含む）
 * @return {Object} - 解析済みJSONオブジェクト
 */
function getSlackJson(url) {
    const options = {
        method: 'get',
        headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` },
        muteHttpExceptions: true // エラー時も中身を解析するためにtrueにする
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        let json;
        try {
            json = JSON.parse(response.getContentText());
        } catch (e) {
            console.error(`JSON Parse Error: ${e.message}`);
            return { ok: false, error: 'JSON Parse Error' };
        }

        if (!json.ok) {
            console.error(`Slack API Error: ${json.error} (URL: ${url})`);
        }
        return json;
    } catch (e) {
        console.error(`Network Error: ${e.message}`);
        return { ok: false, error: 'Network failure' };
    }
}

/**
 * 2. 名前を指定してシートを取得。存在しない場合は新規作成してヘッダーを書き込む
 * @param {Spreadsheet} ss - スプレッドシートオブジェクト
 * @param {string} name - シート名
 * @param {Array} header - 新規作成時に書き込むヘッダー行
 * @return {Sheet} - 対象のシートオブジェクト
 */
function getTargetSheet(ss, name, header = ["index", "createdAt", "userIndex", "type", "content", "parentIndex", "parentTs", "slackTs", "fileUrl"]) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(header);
        // ヘッダーを固定して見やすくする
        sheet.setFrozenRows(1);
    }
    return sheet;
}

/**
 * 3. Windows特有の文字化けを解消する
 * UTF-8がShift-JISとして解釈されたフォルダ名を復元する
 */
function fixMojibake(str) {
    if (!str) return "";
    try {
        // Windowsの解凍ソフトによる文字化けを解消するハック
        return decodeURIComponent(escape(str));
    } catch (e) {
        // 文字化けしていない場合はエラーになるので、そのままの文字列を返す
        return str;
    }
}

/**
 * 4. スプレッドシートのタブ名として使えるように文字列を洗浄する
 * 禁止文字（: \ / ? * [ ]）の置換と、31文字制限に対応
 */
function sanitizeSheetName(name) {
    if (!name) return "unnamed_channel";

    // スプシのタブ名で禁止されている記号をアンダースコアに置換
    let sanitized = name.replace(/[:\\\/?\*\[\]]/g, "_");

    // Googleスプレッドシートの仕様：タブ名は最大31文字まで
    if (sanitized.length > 31) {
        sanitized = sanitized.substring(0, 31);
    }
    return sanitized;
}

/**
 * 5. 日付をSlackのログで使いやすいJST（日本標準時）形式にフォーマット
 * 例: 2026/02/07 00:00:00
 */
function formatJstDate(date) {
    if (!date) return "";
    return Utilities.formatDate(date, "JST", "yyyy/MM/dd HH:mm:ss");
}

/**
 * 6. 指定したタイムスタンプ（ts）がシート内に既に存在するか高速チェック
 */
function isDuplicateTs(sheet, ts) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;

    // 直近50件程度をチェック（リアルタイム受信の重複対策ならこれで十分）
    const checkRange = 50;
    const startRow = Math.max(2, lastRow - checkRange + 1);
    const values = sheet.getRange(startRow, 8, Math.min(checkRange, lastRow - 1), 1).getValues();

    return values.some(row => row[0].toString().replace("'", "") === ts.toString());
}

/**
 * 7. 指定した関数を1分後に実行するトリガーをセット（継続処理用）
 */
function setTrigger(funcName) {
    // 既存の同名トリガーを削除してからセット（重複防止）
    deleteTriggers(funcName);
    ScriptApp.newTrigger(funcName).timeBased().after(10 * 1000).create();
}

/**
 * 8. 指定した関数のトリガーを削除する
 */
function deleteTriggers(funcName) {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === funcName) {
            ScriptApp.deleteTrigger(trigger);
        }
    });
}

/**
 * ==============================================================================
 * Phase 3: ID・エンティティ同期
 * 役割：ユーザー・チャンネル情報のマッピング、メモリへのキャッシュ
 * ==============================================================================
 */

/**
 * 1. Slackから全ユーザーを取得し、_userシートを更新する
 */
function syncUserTable() {
    if (!SPREADSHEET_ID) return "【エラー】スプレッドシートIDが未設定です。";

    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const userSheet = getTargetSheet(ss, "_user", ["index", "userId", "name", "email"]);

        const json = getSlackJson('https://slack.com/api/users.list');
        if (!json.ok) return "エラー: Slack APIからのユーザー取得に失敗しました。";

        // 一旦既存のデータをクリアして最新の状態にする
        userSheet.clear().appendRow(["index", "userId", "name", "email"]);

        const users = json.members.map((m, i) => [
            i + 1, // index (1, 2, 3...)
            m.id,
            m.profile.real_name || m.name,
            m.profile.email || ""
        ]);

        if (users.length > 0) {
            userSheet.getRange(2, 1, users.length, 4).setValues(users);
        }
        return `成功: ${users.length} 名のユーザーを同期しました。`;
    } catch (e) {
        return "致命的エラー: " + e.message;
    }
}

/**
 * 2. チャンネル情報を同期し、未参加の公開チャンネルに自動参加する
 */
function syncChannelsAndJoin() {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const mapSheet = getTargetSheet(ss, "_channels", ["channelId", "lastKnownName"]);

        // 公開、参加済みの非公開、マルチ人DM(MPIM)を網羅
        const json = getSlackJson('https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim&limit=1000');
        if (!json.ok) return "エラー: チャンネルリストの取得に失敗。";

        let joinCount = 0;
        const existingData = mapSheet.getDataRange().getValues();
        const existingIds = new Set(existingData.slice(1).map(r => r[0]));
        const newMappings = [];

        json.channels.forEach(ch => {
            // 未参加の公開チャンネルにはボットが自動で「参加(Join)」する
            if (!ch.is_member && !ch.is_archived && ch.is_channel && !ch.is_private) {
                joinChannel(ch.id);
                joinCount++;
            }
            // まだ管理シートにないIDなら記録候補に追加
            if (!existingIds.has(ch.id)) {
                newMappings.push([ch.id, ch.name || ch.id]);
            }
        });

        if (newMappings.length > 0) {
            mapSheet.getRange(mapSheet.getLastRow() + 1, 1, newMappings.length, 2).setValues(newMappings);
        }

        // 仕上げに重複チェックと掃除を行う
        deduplicateChannelMap();

        return `同期完了。新しく ${newMappings.length} 件を登録し、${joinCount} 個のチャンネルに参加しました。`;
    } catch (e) {
        return "エラー: " + e.message;
    }
}

/**
 * 3. 初期設定（ユーザー同期 + チャンネル同期）を一括実行する
 */
function runInitialSetup() {
    const userResult = syncUserTable();
    // ユーザー同期でエラーが出たらそこで止める
    if (userResult.includes("エラー") || userResult.includes("致命的")) {
        return userResult;
    }

    const channelResult = syncChannelsAndJoin();
    return `【初期設定完了】\n${userResult}\n${channelResult}`;
}

/**
 * 4. スプレッドシートからユーザー情報を読み込み、Mapオブジェクト（メモリ内）にキャッシュする
 * インポートなどの高速処理時に、スプシへのアクセス回数を減らすため
 */
function buildUserCache(ss) {
    const userSheet = getTargetSheet(ss, "_user");
    const userData = userSheet.getDataRange().getValues();
    const cache = new Map();
    // row[1] = userId, row[0] = index (番号)
    userData.slice(1).forEach(row => cache.set(row[1], row[0]));
    return cache;
}

/**
 * 4. Slack APIを使用してボットをチャンネルに参加させる
 */
function joinChannel(id) {
    const options = {
        method: 'post',
        headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` },
        payload: { 'channel': id },
        muteHttpExceptions: true
    };
    UrlFetchApp.fetch('https://slack.com/api/conversations.join', options);
}

/**
 * 5. チャンネルIDから現在の最新のチャンネル名を取得する
 */
function getSlackChannelNameFromApi(id) {
    const json = getSlackJson(`https://slack.com/api/conversations.info?channel=${id}`);
    if (!json.ok) return id;
    return json.channel.name || id;
}

/**
 * ==============================================================================
 * Phase 4-1: 過去ログ (Drive Export) インポート機能
 * 役割：Google Drive上のエクスポートデータを読み込み、スプレッドシートへ流し込む
 * ==============================================================================
 */

/**
 * インポートの進捗状況を取得する（ポーリング用）
 */
function getProgress() {
    return scriptProps.getProperty('IMPORT_STATUS') || '{}';
}

/**
 * インポートの進捗をリセットする（最初からやり直したい時用）
 */
function resetImportState() {
    scriptProps.deleteProperty('IMPORT_STATUS');
    deleteTriggers('runImportFromExport'); // トリガーも解除
    return "進捗をリセットしました。";
}

/**
 * 状態ポーリング用関数 (Drive取り込み or API同期)
 */
function getAllStatus() {
    return JSON.stringify({
        import: JSON.parse(scriptProps.getProperty('IMPORT_STATUS') || 'null'),
        api: JSON.parse(scriptProps.getProperty('API_SYNC_STATUS') || 'null')
    });
}

/**
 * メイン：Google Driveのエクスポートフォルダからメッセージを流し込む
 */
function runImportFromExport() {
    if (!EXPORT_FOLDER_ID || !SPREADSHEET_ID) return "【致命的】設定（ID）が不足しています。";

    const startTime = new Date().getTime();
    let ss;
    try {
        ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
        return "【致命的】スプレッドシートが開けません。IDを確認してください。";
    }

    // 進捗ステータスの読み込み
    let status = JSON.parse(scriptProps.getProperty('IMPORT_STATUS') || '{"completedFolders": [], "userSyncDone": false, "totalFolders": 0}');
    const rootFolder = DriveApp.getFolderById(EXPORT_FOLDER_ID);

    // 0. 未計算なら全フォルダ数をカウント (初回のみ少し時間がかかる)
    if (!status.totalFolders || status.totalFolders === 0) {
        let count = 0;
        const iter = rootFolder.getFolders();
        while (iter.hasNext()) { iter.next(); count++; }
        status.totalFolders = count;
        scriptProps.setProperty('IMPORT_STATUS', JSON.stringify(status));
    }

    // 1. users.json からユーザー一覧を同期 (初回のみ)
    if (!status.userSyncDone) {
        try {
            const userFiles = rootFolder.getFilesByName('users.json');
            if (userFiles.hasNext()) {
                updateUserTableFromExport(ss, JSON.parse(userFiles.next().getBlob().getDataAsString()));
                status.userSyncDone = true;
                scriptProps.setProperty('IMPORT_STATUS', JSON.stringify(status));
            }
        } catch (e) {
            return "【継続可能】ユーザー情報の読み取りに失敗しました。再開してください。\n(詳細: " + e.message + ")";
        }
    }

    // 高速化のためユーザーキャッシュを構築
    const userCache = buildUserCache(ss);
    const folders = rootFolder.getFolders();

    // 2. 各チャンネル（フォルダ）を巡回
    while (folders.hasNext()) {
        const folder = folders.next();
        const rawName = folder.getName();
        // 文字化け修復 ＆ シート名サニタイズ
        const folderName = sanitizeSheetName(fixMojibake(rawName));

        // フォルダ名が修復されたら、Google Drive側の名前も直しておく（親切設計）
        if (rawName !== folderName) {
            try { folder.setName(folderName); } catch (e) { }
        }

        // 完了済みフォルダはスキップ
        if (status.completedFolders.includes(folderName)) continue;

        // タイムリミット（4分30秒）チェック
        if (new Date().getTime() - startTime > TIME_LIMIT_MS) {
            setTrigger('runImportFromExport'); // 次回実行を予約
            status.lastUpdated = new Date().getTime(); // 生存確認用
            scriptProps.setProperty('IMPORT_STATUS', JSON.stringify(status));

            const progress = `(${status.completedFolders.length} / ${status.totalFolders} 件)`;
            return `⏳ 処理を継続します... 10秒後に再開します。\n現在の進捗: ${progress}`;
        }



        try {
            const sheet = getTargetSheet(ss, folderName);
            let allMessages = [];
            const files = folder.getFiles();

            // フォルダ内の全JSONファイルを読み込む
            while (files.hasNext()) {
                const file = files.next();
                if (file.getName().endsWith('.json')) {
                    allMessages = allMessages.concat(JSON.parse(file.getBlob().getDataAsString()));
                }
            }

            if (allMessages.length > 0) {
                // 時系列順にソート（ts = タイムスタンプ）
                allMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
                // 書き込み（インポート中はスレッド修復をスキップして爆速化）
                processAndAppendMessagesFast(sheet, allMessages, userCache, true);
            }

            // 完了フォルダとして記録 & 進捗を即時保存（ポーリング用）
            status.completedFolders.push(folderName);
            status.lastUpdated = new Date().getTime(); // 最終更新時刻を記録
            scriptProps.setProperty('IMPORT_STATUS', JSON.stringify(status));

        } catch (e) {
            return `【継続可能】「${folderName}」の処理中にエラーが発生しました。そのまま再開してください。\n(詳細: ${e.message})`;
        }
    }

    // 全て完了したらトリガーを掃除
    deleteTriggers('runImportFromExport');

    // 修復モードであることを記録（UI反映用）
    status.isRepairing = true;
    scriptProps.setProperty('IMPORT_STATUS', JSON.stringify(status));

    // 【自動実行】仕上げにスレッド修復を行う
    const repairResult = repairAllChannelsThreads();

    // 全工程完了！ステータスを削除
    scriptProps.deleteProperty('IMPORT_STATUS');

    return `🎉 インポート完了！\n(内訳)\n- Driveデータ取込: 完了\n- ${repairResult}`;
}

/**
 * ==============================================================================
 * Phase 4-2: 高速書き込み・スレッド修復ロジック
 * 役割：大量データの一括処理、スレッド親子関係の解決
 * ==============================================================================
 */

/**
 * 1. メッセージ配列をシートへ高速に書き込む
 * @param {Sheet} sheet - 書き込み先のシート
 * @param {Array} messages - Slackのメッセージオブジェクト配列
 * @param {Map} userCache - userId -> index のマップ
 * @param {boolean} skipRepair - インポート中に親子修復をスキップするかどうか
 */
function processAndAppendMessagesFast(sheet, messages, userCache, skipRepair = false) {
    // 重複排除のための既存TS（タイムスタンプ）取得
    // 重複排除のための既存TS（タイムスタンプ）取得
    let existingTsSet = new Set();
    let lastIndex = 0;
    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
        // データがある場合のみ読み込む（日付とTS列だけ取得してメモリ節約）
        // 1列目:index, 8列目:slackTs
        const indexValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        // 8列目 (H列) を取得 (index=7)
        const tsValues = sheet.getRange(2, 8, lastRow - 1, 1).getValues();

        existingTsSet = new Set(tsValues.map(row => row[0].toString().replace("'", "")));
        lastIndex = Math.max(...indexValues.map(row => parseInt(row[0]) || 0));
    }

    const rows = [];
    messages.forEach(msg => {
        // 重複メッセージや、システムメッセージ（参加/脱退）はスキップ
        if (existingTsSet.has(msg.ts) || msg.subtype === 'channel_join' || msg.subtype === 'channel_leave') return;

        const isReply = (msg.thread_ts && msg.thread_ts !== msg.ts);

        rows.push([
            ++lastIndex,                         // index
            formatJstDate(new Date(msg.ts * 1000)), // createdAt
            userCache.get(msg.user) || msg.user, // userIndex (キャッシュから取得)
            isReply ? "REPLY" : (msg.subtype === 'file_share' ? "FILE" : "MESSAGE"), // type
            replaceMentionsWithCache(msg.text || "", userCache), // content (メンション変換)
            "",                                  // parentIndex (修復フェーズで埋める)
            "'" + (isReply ? msg.thread_ts : ""), // parentTs
            "'" + msg.ts,                        // slackTs
            msg.files ? msg.files.map(f => {
                const url = f.url_private || f.permalink || "";
                const name = f.name || f.title || "Unknown File";
                return `${url}|${name}`;
            }).join("\n") : "" // fileUrl (url|name)
        ]);
    });

    // 5000行ずつのチャンクに分けて一括書き込み（GASのメモリ制限対策）
    if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 5000) {
            const chunk = rows.slice(i, i + 5000);
            sheet.getRange(sheet.getLastRow() + 1, 1, chunk.length, 9).setValues(chunk);
        }
        // インポート中でなければ親子関係を修復
        if (!skipRepair) repairAllParentIndices(sheet);
    }
}

/**
 * 親Index修復：安全ガード付き（空行や欠損データがあっても落ちない）
 */
function repairAllParentIndices(sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const tsMap = {};
    // 1. まずは全メッセージのTSマッピングを作成
    data.slice(1).forEach(row => {
        const slackTs = row[7]; // slackTs列
        const index = row[0];   // index列

        // slackTsが存在する場合のみMapに追加
        if (slackTs && index) {
            tsMap[slackTs.toString().replace("'", "")] = index;
        }
    });

    // 2. parentIndex列を更新するためのデータを作成
    const updateColumn = data.slice(1).map(row => {
        const currentParentIdx = row[5]; // 現在のparentIndex
        const parentTs = row[6];        // parentTs列

        // parentTsが存在し、かつtsMapに親メッセージが見つかる場合のみ更新
        if (parentTs) {
            const pTsStr = parentTs.toString().replace("'", "");
            if (pTsStr && tsMap[pTsStr]) {
                return [tsMap[pTsStr]];
            }
        }

        // 見つからない、または空の場合は現在の値を維持（空なら空のまま）
        return [currentParentIdx || ""];
    });

    // 3. 一括でシートに書き戻す
    if (updateColumn.length > 0) {
        sheet.getRange(2, 6, updateColumn.length, 1).setValues(updateColumn);
    }
}

/**
 * 3. 【一括ボタン用】管理用シート以外の全てのシートのスレッド関係を修復する
 */
function repairAllChannelsThreads() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();
    let repairedCount = 0;

    // 定期的なステータス更新のために読み込み
    let status = JSON.parse(scriptProps.getProperty('IMPORT_STATUS') || '{}');

    for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const name = sheet.getName();

        // システムシート以外を対象にする
        if (!SYSTEM_SHEETS.includes(name)) {
            repairAllParentIndices(sheet);
            repairedCount++;
        }

        // 5シートごとに進捗（生存確認）を更新
        if (i % 5 === 0) {
            status.lastUpdated = new Date().getTime();
            scriptProps.setProperty('IMPORT_STATUS', JSON.stringify(status));
        }
    }
    return `🎉 ${repairedCount} 個のチャンネルのスレッド関係を修復しました。`;
}

/**
 * 4. メンション（<@U...>）をインデックス（@番号）に置換する
 */
function replaceMentionsWithCache(text, userCache) {
    if (!text) return "";
    return text.replace(/<@(U[A-Z0-9]+)>/g, (match, id) => {
        const index = userCache.get(id);
        return index ? `<@${index}>` : match;
    });
}

/**
 * 5. users.jsonのデータを使ってユーザーテーブルを更新する
 */
function updateUserTableFromExport(ss, usersData) {
    const userSheet = getTargetSheet(ss, "_user");
    const existingIds = new Set(userSheet.getDataRange().getValues().map(row => row[1]));
    let nextIdx = userSheet.getLastRow();

    const newRows = usersData
        .filter(u => !existingIds.has(u.id))
        .map(u => [
            nextIdx++,
            u.id,
            u.real_name || u.name,
            u.profile?.email || ""
        ]);

    if (newRows.length > 0) {
        userSheet.getRange(userSheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
    }
}

/**
 * ==============================================================================
 * Phase 5: リアルタイム・受信エンジン (doPost)
 * 役割：SlackからのWebhookを受信し、各種イベント（投稿・編集・リアクション等）を処理
 * ==============================================================================
 */

/**
 * Slack Event API からのPOSTリクエストを受け取る
 */
function doPost(e) {
    const prop = JSON.parse(e.postData.contents);

    // 1. URL検証（Slack API設定時のチャレンジ応答）
    if (prop.type === 'url_verification') {
        return ContentService.createTextOutput(prop.challenge);
    }

    // 2. 重複リクエストの排除（Slackの3秒リトライ対策）
    const eventId = prop.event_id;
    const cache = CacheService.getScriptCache();
    if (eventId && cache.get(eventId)) {
        return ContentService.createTextOutput('Duplicate Request (Cached)');
    }
    if (eventId) cache.put(eventId, 'processed', 600); // 10分間キャッシュ

    const event = prop.event;
    // ボット自身の投稿を無視して無限ループを防止
    if (!event || event.bot_id) {
        return ContentService.createTextOutput('Ignore Bot Message');
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 3. システムイベントのハンドリング
    // 3-1. チャンネル作成：自動参加 ＆ シート準備
    if (event.type === 'channel_created') {
        joinChannel(event.channel.id);
        getSheetByChannelId(event.channel.id);
        return ContentService.createTextOutput('Auto-Joined');
    }

    // 3-2. ユーザー参加：ユーザーマスターを更新
    if (event.type === 'team_join') {
        syncUserTable(); // 全体同期（頻度は低いので全体を回してもOK）
        return ContentService.createTextOutput('User Registered');
    }

    // 4. アーカイブ対象外の判定
    if (event.channel_type === 'im') return ContentService.createTextOutput('Ignore DM');

    const channelId = event.channel || (event.item && event.item.channel);
    const sheet = getSheetByChannelId(channelId);
    if (!sheet) return ContentService.createTextOutput('No SheetFound');

    const ts = event.ts || event.event_ts || (event.item && event.item.ts);

    // 5. メッセージ編集 (message_changed) への対応
    if (event.type === 'message' && event.subtype === 'message_changed') {
        const msg = event.message;
        const data = sheet.getDataRange().getValues();
        // 直近から遡って該当するtsの行を更新
        for (let i = data.length - 1; i >= 1; i--) {
            if (data[i][7].toString().replace("'", "") === msg.ts) {
                sheet.getRange(i + 1, 5).setValue(replaceMentionsWithIndex(msg.text || ""));
                sheet.getRange(i + 1, 9).setValue(msg.files ? msg.files.map(f => {
                    const url = f.url_private || f.permalink || "";
                    const name = f.name || f.title || "Unknown File";
                    return `${url}|${name}`;
                }).join("\n") : "");
                sheet.getRange(i + 1, 4).setValue("EDITED");
                return ContentService.createTextOutput('Updated');
            }
        }
    }

    // 6. 通常メッセージ・リアクションの記録（排他ロック制御）
    // 複数が同時に書き込もうとして行が重なるのを防ぐ
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000); // 最大10秒待機

        // ロック取得後に二重チェック
        if (isDuplicateTs(sheet, ts)) return ContentService.createTextOutput('Duplicate (Locked Check)');

        const lastRow = sheet.getLastRow();
        let nextIdx = lastRow > 1 ? (parseInt(sheet.getRange(lastRow, 1).getValue()) || 0) + 1 : 1;
        let userIndex = getUserIndex(event.user);
        let content = "", type = "MESSAGE", parentTs = "", fileUrl = "";

        // イベント別のデータ整形
        if (event.type === 'message' && !event.subtype) {
            content = replaceMentionsWithIndex(event.text || "");
            if (event.files) {
                type = "FILE";
                fileUrl = event.files.map(f => {
                    const url = f.url_private || f.permalink || "";
                    const name = f.name || f.title || "Unknown File";
                    return `${url}|${name}`;
                }).join("\n");
            }
            if (event.thread_ts && event.thread_ts !== event.ts) {
                type = "REPLY";
                parentTs = event.thread_ts;
            }
        } else if (event.type === 'reaction_added') {
            type = "REACTION";
            content = `:${event.reaction}:`;
            parentTs = event.item.ts;
        }

        // スプレッドシートへ追記
        sheet.appendRow([
            nextIdx,
            formatJstDate(new Date()),
            userIndex,
            type,
            content,
            "",              // parentIndex
            "'" + parentTs,
            "'" + ts,
            fileUrl
        ]);

        // その場でスレッド親子関係を修復（リアルタイム性を重視）
        // ※ 負荷軽減のため一時的に無効化。定期的なバッチ実行に任せる。
        // repairAllParentIndices(sheet);

    } catch (err) {
        console.error('doPost Error:', err);
    } finally {
        lock.releaseLock();
    }

    return ContentService.createTextOutput('OK');
}

/**
 * 補助関数：ユーザーIDからインデックス番号を取得
 */
function getUserIndex(userId) {
    if (!userId) return "";

    // 1. ScriptCacheを確認
    const scriptCache = CacheService.getScriptCache();
    const cachedIndex = scriptCache.get(`useridx_${userId}`);
    if (cachedIndex) return parseInt(cachedIndex, 10);

    // 2. スプレッドシートからロード
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const cache = buildUserCache(ss);

    if (cache.has(userId)) {
        const idx = cache.get(userId);
        scriptCache.put(`useridx_${userId}`, idx.toString(), 21600); // 6時間キャッシュ
        return idx;
    }

    // 3. キャッシュにない場合はAPIから取得して追加
    syncUserTable();
    return userId; // 初回はIDを返し、次回のキャッシュビルドで番号になる
}

/**
 * 補助関数：メンションをインデックス（@1など）に変換
 */
function replaceMentionsWithIndex(text) {
    if (!text) return "";
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const cache = buildUserCache(ss);
    return text.replace(/<@(U[A-Z0-9]+)>/g, (match, id) => {
        const index = cache.get(id);
        return index ? `<@${index}>` : match;
    });
}

/**
 * ==============================================================================
 * Phase 7: データ整合性チェック機能
 * 役割：全シートをスキャンし、Next.js側でエラーの原因になる不備を特定する
 * ==============================================================================
 */

/**
 * ==============================================================================
 * Phase 7: データ整合性チェック機能（ブラッシュアップ版）
 * 役割：ログ用シートのみをスキャンし、不備を特定する
 * ==============================================================================
 */

/**
 * 不適切なデータを検知して報告する
 */
function checkDataIntegrity() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();
    const errors = [];

    // チェックをスキップするシート名のリスト
    // ユーザー様の要望に合わせて「シート1」や管理シートを追加
    const SKIP_SHEETS = [...SYSTEM_SHEETS, "シート1", "Sheet1"];

    sheets.forEach(sheet => {
        const sheetName = sheet.getName();

        // スキップ対象のシートなら何もしない
        if (SKIP_SHEETS.includes(sheetName)) return;

        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return; // ヘッダーのみのシートは無視

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 1;
            const issues = [];

            // チェック項目1: Indexがない（空行の可能性）
            if (!row[0]) {
                issues.push("Index欠損（空行の疑い）");
            }

            // チェック項目2: 日付（createdAt）の検証
            if (!row[1]) {
                issues.push("日付が空");
            } else {
                // 日付として解釈可能かテスト（Invalid time value対策）
                const dateVal = row[1].toString().replace(/\//g, '-');
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) {
                    issues.push("日付形式エラー（解釈不能）");
                }
            }

            // チェック項目3: Slackタイムスタンプの検証
            if (!row[7]) {
                issues.push("Slack TS欠損");
            }

            // エラーがあった場合のみ記録
            if (issues.length > 0) {
                errors.push(`【${sheetName}】${rowNum}行目: ${issues.join(" / ")}`);
            }

            // エラー報告が多すぎると見づらいため、最大50件でストップ
            if (errors.length >= 50) break;
        }
    });

    if (errors.length === 0) {
        return "✅ 素晴らしい！ログデータに不備は見つかりませんでした。";
    } else {
        let report = "⚠️ 以下のデータに不備が見つかりました（Next.jsでエラーの原因になります）：\n\n" + errors.join("\n");
        if (errors.length >= 50) {
            report += "\n\n(※50件以上のエラーがあるため、以降は省略されました)";
        }
        return report;
    }
}

/**
 * ==============================================================================
 * Phase 4-3: API同期 (最新ログ取得)
 * 役割：Slack APIを叩き、Driveデータ以降の最新ログを全件取得する
 * ==============================================================================
 */

/**
 * 1. ボットが参加可能な全てのチャンネルを同期する（大規模組織・中断再開対応版）
 */
function importAllPastMessages() {
    const startTime = new Date().getTime();
    const TIME_LIMIT = 4.5 * 60 * 1000; // 4分30秒で安全に中断

    syncUserTable();

    // 進捗状況の読み込み
    let status = JSON.parse(scriptProps.getProperty('API_SYNC_STATUS') || '{"lastIndex": 0, "channels": []}');

    // 1ページ目、またはリセット後の場合はチャンネルリストをSlackから取得
    if (status.channels.length === 0) {
        let allChannels = [];
        let cursor = "";
        do {
            const url = `https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=1000&cursor=${cursor}`;
            const res = getSlackJson(url);
            if (res.ok) {
                // アーカイブされていないチャンネルのみ抽出
                const activeChannels = res.channels.filter(ch => !ch.is_archived).map(ch => ({ id: ch.id, name: ch.name, is_private: ch.is_private, is_member: ch.is_member }));
                allChannels = allChannels.concat(activeChannels);
                cursor = (res.response_metadata && res.response_metadata.next_cursor) ? res.response_metadata.next_cursor : "";
            } else { cursor = ""; }
        } while (cursor);

        status.channels = allChannels;
        status.lastIndex = 0;
        scriptProps.setProperty('API_SYNC_STATUS', JSON.stringify(status));
    }

    const results = [];
    const total = status.channels.length;

    for (let i = status.lastIndex; i < total; i++) {
        // タイムリミットチェック
        if (new Date().getTime() - startTime > TIME_LIMIT) {
            status.lastIndex = i;
            status.lastUpdated = new Date().getTime(); // ポーリング用更新
            scriptProps.setProperty('API_SYNC_STATUS', JSON.stringify(status));
            setTrigger('importAllPastMessages'); // 自動継続
            return `⏳ 時間制限のため中断しました。1分後に自動で再開します... (完了: ${i}/${total} チャンネル)`;
        }

        const ch = status.channels[i];

        // 自動参加ロジック
        if (!ch.is_member && !ch.is_private) {
            joinChannel(ch.id);
        }

        // 同期実行
        try {
            // IDと名前を渡してシートを取得（API節約と名前化け防止）
            const sheet = getSheetByChannelId(ch.id, ch.name);
            const count = runBackfillLogic(ch.id, sheet.getName());
            results.push(`✅ ${ch.name}: ${count}件`);
        } catch (e) {
            // エラーメッセージを具体的に出すように変更
            results.push(`❌ ${ch.name}: エラー(${e.message})`);
            console.error(`Channel: ${ch.name}, Error: ${e.message}`);
        }

        // 1チャンネルごとに生存確認更新（頻度高すぎるか？いや、これでいい）
        if (i % 5 === 0) {
            status.lastIndex = i + 1; // ここまで完了したとする
            status.lastUpdated = new Date().getTime();
            scriptProps.setProperty('API_SYNC_STATUS', JSON.stringify(status));
        }
    }

    // すべて完了したらステータスを削除 ＆ トリガー解除
    scriptProps.deleteProperty('API_SYNC_STATUS');
    deleteTriggers('importAllPastMessages');
    return `🎉 全 ${total} チャンネルの同期が完了しました！\n` + results.slice(-5).join("\n") + "\n(直近5件を表示)";
}

/**
 * API同期の進捗をリセットする
 */
function resetApiSyncStatus() {
    scriptProps.deleteProperty('API_SYNC_STATUS');
    deleteTriggers('importAllPastMessages');
    return "API同期の進捗をリセットしました。";
}

/**
 * 特定のチャンネルのメッセージ履歴を、APIの制限（ページネーション）を考慮して取得する
 * @param {string} channelId - SlackのチャンネルID
 * @param {string} sheetName - 書き込み先のシート名
 * @return {number} - 同期したメッセージ件数
 */
function runBackfillLogic(channelId, sheetName) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return 0;

    const userCache = buildUserCache(ss);

    // 重複を避けるため、既存のTS（タイムスタンプ）を取得
    // A列(index)からH列(slackTs)までのデータを想定。H列は8番目(index 7)
    const lastRow = sheet.getLastRow();
    const existingTsSet = new Set();
    if (lastRow > 1) {
        const values = sheet.getRange(2, 8, lastRow - 1, 1).getValues();
        values.forEach(row => existingTsSet.add(row[0].toString().replace("'", "")));
    }

    let allEvents = [];
    let cursor = "";

    // 1. チャンネルの履歴を全件取得（ページネーション対応）
    do {
        const url = `https://slack.com/api/conversations.history?channel=${channelId}&limit=100&cursor=${cursor}`;
        const res = getSlackJson(url);

        if (res.ok) {
            res.messages.forEach(msg => {
                // ボット自身の投稿以外、かつ未登録のもの
                if (!msg.bot_id && !existingTsSet.has(msg.ts)) {
                    allEvents.push(msg);
                }

                // 2. スレッド（返信）が存在する場合、その中身も取得
                if (msg.reply_count > 0) {
                    const threadUrl = `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${msg.ts}`;
                    const threadRes = getSlackJson(threadUrl);
                    if (threadRes.ok) {
                        threadRes.messages.forEach(reply => {
                            // 親メッセージはhistoryと重複するので、親（msg.ts）でないものだけ追加
                            if (!reply.bot_id && !existingTsSet.has(reply.ts) && reply.ts !== msg.ts) {
                                allEvents.push(reply);
                            }
                        });
                    }
                }
            });
            // 次のページへの目印（cursor）を更新
            cursor = (res.response_metadata && res.response_metadata.next_cursor) ? res.response_metadata.next_cursor : "";
        } else {
            console.error(`API Error in ${sheetName}: ${res.error}`);
            cursor = "";
        }
    } while (cursor);

    // 3. 古い順にソートして一括書き込み
    if (allEvents.length > 0) {
        allEvents.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
        // Phase 4-2で作成した高速書き込み関数を呼び出す
        processAndAppendMessagesFast(sheet, allEvents, userCache, false);
    }

    return allEvents.length;
}

/**
 * ==============================================================================
 * Phase 3 追記: チャンネル管理エンジン
 * 役割：Slack IDから対象シートを特定し、チャンネル名変更に追従する
 * ==============================================================================
 */

/**
 * チャンネルIDから対応するシートを取得する。
 * 名前が変更されている場合は、シート名も自動でリネームする。
 * @param {string} channelId - チャンネルID
 * @param {string} [knownName] - (任意) 既知のチャンネル名。API呼び出しを節約・回避するために使用。
 */
function getSheetByChannelId(channelId, knownName) {
    if (!channelId) return null;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. チャンネル名を取得（knownNameがあればそれを優先、なければAPI）
    let currentName;
    if (knownName) {
        currentName = sanitizeSheetName(knownName);
    } else {
        const rawName = getSlackChannelNameFromApi(channelId);
        currentName = sanitizeSheetName(rawName);
    }

    // 2. _channels管理シートでIDと名前の対応を確認
    const mapSheet = getTargetSheet(ss, "_channels", ["channelId", "lastKnownName"]);
    const data = mapSheet.getDataRange().getValues();

    let sheetNameInMap = "";
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === channelId) {
            sheetNameInMap = data[i][1];
            rowIndex = i + 1;
            break;
        }
    }

    if (rowIndex === -1) {
        // 3-A. 未登録のチャンネル：新規シート作成とID登録
        const newSheet = getTargetSheet(ss, currentName);
        mapSheet.appendRow([channelId, currentName]);
        return newSheet;
    } else if (sheetNameInMap !== currentName) {
        // 3-B. 名前が変更されている：シートをリネームして管理表も更新
        const oldSheet = ss.getSheetByName(sheetNameInMap);
        if (oldSheet) {
            // 名前が被る場合はタイムスタンプをつける等の回避処理が必要だが、一旦上書きトライ
            try { oldSheet.setName(currentName); } catch (e) { /* ignore collision */ }
        } else {
            // 古い名前のシートが見つからない場合は新規作成
            getTargetSheet(ss, currentName);
        }
        mapSheet.getRange(rowIndex, 2).setValue(currentName);
        return ss.getSheetByName(currentName);
    } else {
        // 3-C. 名前変更なし：既存のシートを返す
        return getTargetSheet(ss, currentName);
    }
}

/**
 * チャンネルリスト取得（サイドバー表示用・高速版）
 * 役割：スプレッドシートの _channels シートから既知のチャンネルを読み込む
 */
function getChannelList() {
    if (!SPREADSHEET_ID) return [];

    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const mapSheet = ss.getSheetByName("_channels");

        // シートがない、またはデータがない場合
        if (!mapSheet || mapSheet.getLastRow() <= 1) {
            return [];
        }

        const data = mapSheet.getDataRange().getValues();
        const seenIds = new Set();
        const seenNames = new Set();
        const list = [];

        // 2行目以降（データ行）をループして ID と 名前 のペアを作成
        // 重複排除ロジックを追加
        for (let i = 1; i < data.length; i++) {
            const id = data[i][0];
            const name = data[i][1];

            // IDがある場合はIDで重複チェック
            if (id && seenIds.has(id)) continue;

            // IDがない（過去の遺産）場合でも、同じ名前ですでにID付きが登録されていればスキップ
            if (!id && seenNames.has(name)) continue;

            // 名前しかなくて、まだ登録されていない（純粋なImportのみデータ）はリストに入れるが、
            // 後でID付きが来たらそちらを優先したい。
            // しかしここでは単純に上から順。

            if (id) seenIds.add(id);
            if (name) seenNames.add(name);

            list.push({ id: id, name: name });
        }

        // 名前順に並び替えておくと使いやすい
        return list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    } catch (e) {
        console.error("getChannelList Error: " + e.message);
        return [];
    }
}

/**
 * _channelsシートの重複を掃除する（メンテナンス用）
 */
function deduplicateChannelMap() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const mapSheet = ss.getSheetByName("_channels");
    if (!mapSheet || mapSheet.getLastRow() <= 1) return;

    const data = mapSheet.getDataRange().getValues();
    const header = data[0];
    const rows = data.slice(1);

    // IDをキーにしたマップ。
    // 名前だけの行は、同じ名前のID付き行があれば削除対象。
    // ID付き行同士なら、後勝ち（最新）あるいはそのまま。

    const uniqueMap = new Map(); // Name -> {id, row}

    rows.forEach(row => {
        const id = row[0];
        const name = row[1];
        if (!name) return;

        if (uniqueMap.has(name)) {
            const existing = uniqueMap.get(name);
            // 既存がIDなしで、今回がIDありなら更新
            if (!existing.id && id) {
                uniqueMap.set(name, { id, name });
            }
            // 既存がIDありで、今回がIDなしなら何もしない（今回は捨てる）
            // 両方IDありなら…？まあ上書きでいいか
        } else {
            uniqueMap.set(name, { id, name });
        }
    });

    // 書き戻し
    const newRows = Array.from(uniqueMap.values()).map(v => [v.id, v.name]);

    // ソート（名前順）
    newRows.sort((a, b) => a[1].localeCompare(b[1], 'ja'));

    mapSheet.clearContents();
    mapSheet.appendRow(header);
    if (newRows.length > 0) {
        mapSheet.getRange(2, 1, newRows.length, 2).setValues(newRows);
    }
    return `重複を整理しました。${rows.length} -> ${newRows.length}`;
}

# 家帳 Kin Ledger

以 Expo SDK 57、React Native、Expo Router 和 TypeScript 建立的家庭共同記帳專案。介面以繁體中文與新台幣為預設，包含收支登錄、成員分攤、代墊結算、明細篩選和 CSV 匯出。

## 目前版本

未設定 Supabase 時，App 使用本機示範資料。設定 Supabase 後，App 使用 Email magic link 登入；登入者需建立家庭帳本或輸入邀請碼加入，之後才會讀寫該家庭的雲端資料。新增交易與分攤透過資料庫 RPC 原子寫入，付款結清由資料庫授權；交易、結清、分類與成員會訂閱 Realtime 更新。`首頁` 只會在雲端家庭載入成功後顯示雲端模式。

目前尚未完成離線寫入佇列、衝突解決、帳號刪除流程、正式備份／還原演練與 RLS 多家庭自動化測試。網路中斷時雲端操作會回報失敗，不會假裝已同步。上正式資料前，請先用獨立測試帳號驗證跨家庭隔離與權限。

## 開發

需求：Node.js 22.13 或更新版本。安裝及啟動：

```sh
export PATH="$HOME/.local/lib/node-v22/bin:$PATH"
npm install
npm run start
```

此工作區的 Node 22 安裝在使用者目錄；若新終端顯示找不到 `node` 或 `npm`，先執行上方的 PATH 設定。

在 Expo CLI 選擇 Web，或直接執行 `npm run web`。手機可使用 Expo Go 掃描開發伺服器 QR code。常用檢查：

```sh
npm test
npm run typecheck
npm run lint
npx expo install --check
```

## 建立 App 安裝檔（EAS Build）

本專案可以使用 Expo Application Services（EAS）在雲端建立 Android／iOS 安裝檔。EAS Build 需要免費的 Expo 帳號；Expo 帳號和 Supabase 帳號不同。只使用 Web 或 Expo Go 開發時不需要登入 EAS。

第一次使用 EAS 時，在同一個終端機依序執行：

```sh
export PATH="$HOME/.local/lib/node-v22/bin:$PATH"
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

`login` 會登入 Expo 帳號；`build:configure` 會建立 `eas.json` 並初始化 EAS 專案設定。兩個指令請分開執行，確認登入成功後再執行下一個。建置前可用以下指令確認帳號：

```sh
npx eas-cli@latest whoami
```

### Android 測試版

`preview` profile 用於測試，通常產生可直接安裝到 Android 手機的 `.apk`：

```sh
npx eas-cli@latest build --platform android --profile preview
```

建置完成後，EAS 會提供下載連結。若手機阻擋安裝，需允許該來源安裝未知 App。

### Android 正式版

`production` profile 用於上架 Google Play，通常產生 `.aab`，不是直接安裝用的 APK：

```sh
npx eas-cli@latest build --platform android --profile production
```

Google Play 上架需要 Google Play Developer 帳號。Android 簽章金鑰可交由 EAS 建立並保管；請妥善保留正式專案與簽章設定。

### iOS

```sh
npx eas-cli@latest build --platform ios
```

iOS 測試與上架需要 Apple Developer 帳號。測試通常透過 TestFlight，不能像 Android APK 一樣任意下載安裝 IPA。

### EAS 建置注意事項

- 雲端建置不會自動使用本機 `.env` 的秘密設定；請在 Expo project 的 EAS environment variables 設定 `EXPO_PUBLIC_SUPABASE_URL` 和 `EXPO_PUBLIC_SUPABASE_ANON_KEY`。
- 只能設定 Supabase Project URL 與 Publishable／anon key；絕不可放入 service-role key 或其他 Secret key。
- 本專案的 App scheme 是 `kinledger`，Supabase **Authentication → URL Configuration → Redirect URLs** 必須加入 `kinledger://auth/callback`，原生 magic link 才能回到 App。
- 若 npm 出現 `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`，先設定系統 CA 憑證，不要關閉 SSL 驗證：

	```sh
	export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
	npm config set cafile /etc/ssl/certs/ca-certificates.crt
	```

- `preview` 適合手機直接測試；`production` 適合商店發布。每次建置前先確認目前分支、環境變數與 Supabase Redirect URLs。

## GitHub Pages（Deploy from a branch）

此專案發布於 `https://mattyu99.github.io/kin-ledger/`，Expo 的 `experiments.baseUrl` 已設定為 `/kin-ledger`。手動發布到 Pages 的 `/docs`：

```sh
npm run build:web
mkdir -p docs
cp -R dist/. docs/
touch docs/.nojekyll
```

將 `docs/` 內容推送到 `kin-ledger` repository 後，在 repository 的 **Settings → Pages → Build and deployment** 選 **Deploy from a branch**，Branch 選包含這些變更的分支，資料夾選 `/docs`。每次更新網站都要重新 build、複製 `dist/` 內容到 `docs/` 並推送。

Supabase **Authentication → URL Configuration** 的 Site URL 設為 `https://mattyu99.github.io`，Redirect URLs 加入 `https://mattyu99.github.io/kin-ledger/auth/callback`。GitHub Pages 網站是公開網站；Publishable key 可放在前端 bundle，但絕不可放 Secret／service-role key。家庭資料仍由 Supabase Auth 與 RLS 保護。

## 資料與匯出

- TWD 金額以整數元儲存；不接受小數金額。
- 平均分攤會精確分配餘數，並保證分攤總和等於交易金額。
- CSV 使用 UTF-8 BOM，支援試算表開啟；手機使用系統分享面板，Web 直接下載。
- 本機範例資料可在程式碼 `src/domain/ledger.ts` 的 `INITIAL_LEDGER` 調整。

## Supabase 後端準備

Migration 檔案位於 `supabase/migrations/`。第一份建立資料表與 RLS；第二份加入登入後的家庭建立／邀請流程、原子新增交易／結清 RPC、幂等欄位與 Realtime publication。第一次設定請在測試專案依序執行兩份 SQL；已有第一份的專案只執行第二份。

1. 在 Supabase **SQL Editor** 依序執行 migration。
2. 在 **Authentication → URL Configuration** 設定 Site URL，並加入 Redirect URLs：`http://localhost:8081/auth/callback` 和 `kinledger://auth/callback`。原生測試建議使用含 `kinledger` scheme 的 development build；Expo Go 的 redirect 會依目前的開發主機網址變動。
3. 在 **Authentication → Providers → Email** 確認 Email 登入已啟用。
4. 複製 `.env.example` 為 `.env`，填入 Connect 面板中的 Project URL 與 Publishable key（`sb_publishable_...`），再重新啟動 Expo。
5. 先從 Web 在同一瀏覽器寄送並開啟 magic link；第一次登入後建立家庭帳本。家人各自登入後，輸入家庭頁產生的邀請碼加入。

用戶端只能使用 Publishable key（或舊版 anon key）；絕不可放入 Secret／service-role key。`.env` 已加入 git ignore。用戶端 key 本身不是使用者身分驗證，資料存取由 Supabase Auth session 和 RLS policy 控制。

## 下一階段上線工作

- 實作可靠的離線 outbox、重試佇列及同步衝突處理。
- 以至少兩個測試家庭驗證所有 RLS policy，特別測試跨家庭讀寫、viewer 權限、邀請過期／用量及交易分攤。
- 補上資料匯入／匯出還原、帳號刪除、錯誤監控與正式備份流程。
- 評估本機敏感資料保護、資料保留／刪除政策、正式備份與還原流程、錯誤監控和商店簽署。
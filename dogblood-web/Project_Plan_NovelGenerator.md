Project Blueprint: DogBlood AI (AI 爽文生成器)

1. 專案概述 (Project Overview)

本專案旨在開發一款「無限流」小說生成與閱讀 App。核心特色在於模擬「晉江文學城 (BL/虐戀)」與「起點中文網 (BG/爽文)」的寫作風格，利用 Google Gemini API 進行實時創作，並具備「記憶系統」以防劇情崩壞。應用優先開發 Web 版本 (React)，最終透過 Capacitor 封裝為 iOS App。

2. 技術棧 (Tech Stack)

前端框架: React 18 + Vite

UI 系統: Tailwind CSS (Mobile-First 設計，暗色模式)

圖標庫: Lucide React

AI 核心: Google Gemini API (Model: gemini-1.5-flash for speed or gemini-1.5-pro for context)

後端服務 (BaaS): Supabase

Database: PostgreSQL (存儲小說文本、用戶資料)

Auth: Email/Password 或 Social Login (Google)

Realtime: 實時同步閱讀進度 (可選)

狀態管理: React Context API + Hooks (配合 TanStack Query 進行數據獲取)

移動端封裝: Capacitor.js (後期階段)

3. 核心功能模組 (Core Modules)

A. 用戶認證與權限 (Auth & Security)

登錄/註冊: 支援 Email 或 Google 登入。

數據隔離: 用戶只能看見自己的私人庫，以及公開廣場的小說。

寫入權限: 僅有小說的「擁有者 (Owner)」可以觸發 Gemini 生成新章節。

公開開關: 創建或編輯時，用戶可切換 Private/Public 狀態。

B. 首頁：個人圖書館 (Personal Library)

佈局: 網格狀 (Grid) 展示用戶「已創建」或「已收藏」的書籍。

封面: 使用色塊或簡單圖標區分 BL (紫色系) / BG (紅色系)。

元數據: 顯示書名、當前章節、私密/公開狀態標籤。

交互:

點擊封面 -> 進入閱讀器。

懸浮按鈕 (FAB) -> 進入創建嚮導。

C. 公開小說廣場 (Public Square)

展示: 一個公開的 Feed 頁面，列出所有標記為 is_public: true 的小說。

內容卡片: 顯示 標題、作者名、背景 Summary、標籤 (BG/BL)。

交互:

訪客可以點擊閱讀已生成的章節。

訪客無法觸發 AI 生成（按鈕禁用或隱藏）。

D. 創建嚮導 (Creation Wizard)

用戶點擊 + 後進入的三步驟流程：

類型選擇 (Genre Selection):

BG (言情/爽文): 重生、復仇、大女主、異能、打臉。

BL (耽美/純愛): 救贖、虐戀、BDSM暗示、主僕、強強。

設定生成器 (Randomizer + Editor):

隨機骰子: 前端隨機組合「標題」、「主角名」、「CP/反派名」、「核心梗」。

手動微調: 用戶修改隨機內容。

隱私設定: 勾選是否公開至廣場。

初始化 (Initialization):

提交後，寫入 Supabase novels 表，並呼叫 Gemini API 生成 Wiki 與 Chapter 1。

E. 沉浸式閱讀器 (Immersive Reader)

UI 佈局: 全螢幕文字顯示，無卷軸 (No Scroll)。

分頁邏輯 (Chunking):

核心規則: 將 AI 生成的長文本切割為 ~50 字/頁 的小塊 (Chunks)。

目的: 增加點擊頻率，營造「爽文」的快速節奏感。

導航: 點擊螢幕左右側或使用音量鍵翻頁。

Wiki 側邊欄: 點擊 i 圖標顯示人物狀態與記憶。

F. AI 後台邏輯 (The Brain)

權限檢查: 在呼叫 API 前，先檢查 session.user.id === novel.owner_id。若非擁有者，拒絕生成請求。

預加載緩衝: 若擁有者在閱讀，且後台緩存 < N+5 章，自動觸發生成。

記憶更新: 生成完畢後，觸發 Agent 更新 Supabase 中的 wiki 欄位。

4. 數據結構 (Supabase Schema)

Table: profiles (Users)

id: uuid (Primary Key, references auth.users)

username: text

avatar_url: text

Table: novels

id: uuid (PK)

owner_id: uuid (FK -> profiles.id)

is_public: boolean (Default: false)

genre: text ('BG' | 'BL')

title: text

settings: jsonb

{ protagonist, love_interest, trope, background_context }

wiki: jsonb

{ characters: [...], world_state: "..." }

created_at: timestamp

Table: chapters

id: uuid (PK)

novel_id: uuid (FK -> novels.id)

index: integer (章節序號)

title: text

content: text (完整 Markdown 文本)

chunks: jsonb (切割後的 50字 分頁陣列)

created_at: timestamp

5. Prompt Engineering 策略 (Gemini)

(此部分保持不變，核心在於 System Prompt 的風格控制)

角色與風格設定 (System Prompt)

"你是一個深諳【晉江/起點】文化的頂級網文作家... (略)"

6. 開發階段規劃 (Implementation Roadmap)

Phase 1: 基礎架構與 Supabase 整合

初始化 React + Vite + Tailwind。

設置 Supabase 專案，建立 SQL Tables 與 RLS (Row Level Security) 策略：

novels: Public 讀取 is_public = true，Owner 讀寫所有。

實作 Auth 頁面 (Login/Register)。

Phase 2: 核心業務邏輯

開發「創建嚮導」，連接 Supabase 寫入新書。

開發「圖書館」與「廣場」頁面，分別 Fetch 私人與公開數據。

接入 Gemini API：實作 Edge Function 或前端直接呼叫 (需注意 Key 安全，建議使用 Proxy)。

Phase 3: 閱讀器與分頁

開發沉浸式閱讀器 UI。

實作前端分頁算法 (Text Chunking)。

實作 Chapter 的 Lazy Loading 與緩存機制。

Phase 4: 移動端優化

Capacitor 封裝。

實作音量鍵翻頁插件。

End of Plan
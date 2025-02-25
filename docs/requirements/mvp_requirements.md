# MVP要件定義

## アプリの目的とゴール
### 目的
妊娠中かつ子育て・仕事で忙しい女性が、短時間で自身の栄養バランスを管理し、夕食の献立に活かせるようにする。
### ゴール
1日や1週間単位で必要な栄養を無理なく摂取するために、手間を最小限にした食事記録・献立提案・食材管理が行えるアプリを提供する。


## 概要
妊婦向け栄養管理アプリ「manmaru」のMVP（Minimum Viable Product）として、食事記録と栄養管理の基本機能を実装する。

## 主要機能

### 1. ユーザー認証
- Supabase Authを使用したメール認証
- プロフィール設定（年齢、妊娠週数、身長、体重、家族構成）

### 2. 食事記録
- 食事写真のアップロード
- AI画像解析による食品検出
- Gemini 2.0 Flashを使用した高精度食品検出
- ユーザーによる食品リストの編集・追加
- 栄養素の自動計算

### 3. 栄養管理ダッシュボード
- 日次の栄養摂取状況表示
- 主要栄養素（カロリー、タンパク質、鉄分、葉酸、カルシウム）の達成率
- 栄養バランスに関するAIアドバイス

### 4. 献立提案
- 不足栄養素を補うレシピ提案
- LangChain.jsとGemini APIを使用したレシピ生成

## 非機能要件

### 1. パフォーマンス
- 画像解析レスポンス：5秒以内
- ページロード：2秒以内

### 2. セキュリティ
- ユーザーデータの暗号化
- Supabase RLSによるデータアクセス制御

### 3. ユーザビリティ
- モバイルファーストデザイン
- 直感的な操作性
- オフライン時の基本機能維持（将来拡張）

## MVPスコープ外（将来拡張）
- 週間・月間の栄養傾向分析
- 体重管理機能
- 食事写真のギャラリー表示
- ソーシャル機能
- プッシュ通知

### 画面一覧（MVP）

1. **初期画面**
- 免責事項・利用規約同意画面
  - アプリの目的と免責事項
  - 同意ボタン

2. **認証画面**
- シンプルなメール認証
  - ログイン
  - 新規登録

3. **プロフィール設定画面**
- 基本情報入力
  - 年齢
  - 妊娠週数
  - 身長
  - 現在の体重
- 家族構成入力（シンプルに）
  - 大人の人数
  - 子どもの人数

4. **メインダッシュボード**
- 1日の栄養状況
  - カロリー摂取（円グラフ）
  - 主要栄養素（バーグラフ）
  - シンプルなアドバイス

5. **食事記録画面**
- 食事記録入力
  - 写真撮影/選択
  - 食事タイプ（朝/昼/夜/間食）
  - 認識された食事内容の確認
  - 飲み物や補助食品の追加入力

6. **献立提案画面**
- レシピ提案
  - 3-5件の候補
  - 栄養価
  - 何人分の分量か指定可能

### 機能一覧（MVP）

1. **認証機能**
- Supabase Auth
  - メール認証
  - セッション管理

2. **プロフィール管理**
- 基本情報管理
- 家族人数管理
- 推奨栄養量計算

3. **食事記録**
- 写真AI解析
  - メニュー認識
  - 栄養価推定
- 補足情報の追加
  - 飲み物
  - サプリメント
  - 間食
- 食事の人数記録

4. **栄養管理**
- 日次の栄養管理
  - カロリー計算
  - 栄養バランス
  - シンプルなアラート

5. **献立提案**
- 家族分の献立提案
  - 人数に応じた分量調整
  - 栄養バランスを考慮
  - 作り方と元のリンクを出力

6. **PWA基本機能**
- ホーム画面に追加機能
- 特定のファイルやpathをキャッシュする

## API設計（MVP版）


## 1. 認証関連 API

### メールアドレスでの新規登録
**POST** `/api/auth/register`

- **Request:**
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```

- **Response:**
  ```json
  {
    "user": {
      "id": "string",
      "email": "string"
    },
    "session": "string"
  }
  ```

### ログイン
**POST** `/api/auth/login`

- **Request:**
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```

- **Response:**
  ```json
  {
    "user": {
      "id": "string",
      "email": "string"
    },
    "session": "string"
  }
  ```

### ログアウト
**POST** `/api/auth/logout`

- **Response:**
  ```json
  {
    "success": "boolean"
  }
  ```

## 2. プロフィール関連 API

### プロフィール取得
**GET** `/api/profile`

- **Response:**
  ```json
  {
    "age": "number",
    "pregnancy_week": "number",
    "height": "number",
    "weight": "number",
    "adult_family_members": "number",
    "child_family_members": "number",
    "daily_nutrition_targets": {
      "calories": "number",
      "protein": "number",
      "iron": "number",
      "folic_acid": "number",
      "calcium": "number"
    }
  }
  ```

### プロフィール作成/更新
**POST** `/api/profile`

- **Request:**
  ```json
  {
    "age": "number",
    "pregnancy_week": "number",
    "height": "number",
    "weight": "number",
    "adult_family_members": "number",
    "child_family_members": "number"
  }
  ```

- **Response:**
  ```json
  {
    "success": "boolean",
    "daily_nutrition_targets": {
      "calories": "number",
      "protein": "number",
      "iron": "number",
      "folic_acid": "number",
      "calcium": "number"
    }
  }
  ```

## 3. 食事記録関連 API

### 食事写真のAI解析
**POST** `/api/meals/analyze`

- **Request:**
  ```json
  {
    "photo": "File",
    "meal_type": "breakfast | lunch | dinner | snack"
  }
  ```

- **Response:**
  ```json
  {
    "detected_items": [
      {
        "name": "string",
        "confidence": "number",
        "estimated_nutrition": {
          "calories": "number",
          "protein": "number",
          "iron": "number",
          "folic_acid": "number",
          "calcium": "number"
        }
      }
    ]
  }
  ```

### 食事記録の保存
**POST** `/api/meals`

- **Request:**
  ```json
  {
    "meal_type": "breakfast | lunch | dinner | snack",
    "photo_url": "string (optional)",
    "menu_items": [
      {
        "name": "string",
        "quantity": "string",
        "nutrition": {
          "calories": "number",
          "protein": "number",
          "iron": "number",
          "folic_acid": "number",
          "calcium": "number"
        }
      }
    ],
    "supplementary_items": [
      {
        "name": "string",
        "quantity": "string",
        "nutrition": {
          "calories": "number",
          "protein": "number",
          "iron": "number",
          "folic_acid": "number",
          "calcium": "number"
        }
      }
    ] (optional)
  }
  ```

- **Response:**
  ```json
  {
    "id": "string",
    "created_at": "string"
  }
  ```

### 日付別の食事記録取得
**GET** `/api/meals`

- **Request:**
  ```json
  {
    "date": "string (YYYY-MM-DD)"
  }
  ```

- **Response:**
  ```json
  {
    "meals": [
      {
        "id": "string",
        "meal_type": "breakfast | lunch | dinner | snack",
        "photo_url": "string (optional)",
        "menu_items": [
          {
            "name": "string",
            "quantity": "string",
            "nutrition": {
              "calories": "number",
              "protein": "number",
              "iron": "number",
              "folic_acid": "number",
              "calcium": "number"
            }
          }
        ],
        "supplementary_items": [
          {
            "name": "string",
            "quantity": "string",
            "nutrition": {
              "calories": "number",
              "protein": "number",
              "iron": "number",
              "folic_acid": "number",
              "calcium": "number"
            }
          }
        ],
        "created_at": "string"
      }
    ]
  }
  ```

## 4. 栄養管理関連 API

### 日次の栄養サマリー取得
**GET** `/api/nutrition/daily`

- **Request:**
  ```json
  {
    "date": "string (YYYY-MM-DD)"
  }
  ```

- **Response:**
  ```json
  {
    "total_nutrition": {
      "calories": "number",
      "protein": "number",
      "iron": "number",
      "folic_acid": "number",
      "calcium": "number"
    },
    "target_nutrition": {
      "calories": "number",
      "protein": "number",
      "iron": "number",
      "folic_acid": "number",
      "calcium": "number"
    },
    "achievement_rates": {
      "calories": "number",
      "protein": "number",
      "iron": "number",
      "folic_acid": "number",
      "calcium": "number"
    },
    "advice": "string"
  }
  ```

## 5. 献立提案関連 API

### 献立提案の取得
**GET** `/api/recipes/recommend`

- **Request:**
  ```json
  {
    "servings": "number",
    "exclude_ingredients": ["string"] (optional)
  }
  ```

- **Response:**
  ```json
  {
    "recipes": [
      {
        "title": "string",
        "servings": "number",
        "nutrition_per_serving": {
          "calories": "number",
          "protein": "number",
          "iron": "number",
          "folic_acid": "number",
          "calcium": "number"
        },
        "ingredients": [
          {
            "name": "string",
            "amount": "string"
          }
        ],
        "instructions": ["string"],
        "source_url": "string"
      }
    ]
  }
  ```

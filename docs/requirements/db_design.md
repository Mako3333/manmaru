# データベース設計

## 概要
MVPでは、シンプルで拡張性のあるデータベース設計を採用する。Supabaseを使用し、JSONBカラムを活用して柔軟なデータ構造を実現する。

## テーブル構造

### 1. profiles（既存）
ユーザープロファイル情報を管理するテーブル。
```sql
[
  {
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "column_name": "age",
    "data_type": "smallint"
  },
  {
    "column_name": "pregnancy_week",
    "data_type": "smallint"
  },
  {
    "column_name": "height",
    "data_type": "numeric"
  },
  {
    "column_name": "weight",
    "data_type": "numeric"
  },
  {
    "column_name": "adult_family_members",
    "data_type": "smallint"
  },
  {
    "column_name": "child_family_members",
    "data_type": "smallint"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "user_id",
    "data_type": "uuid"
  }
]
```

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  age SMALLINT,
  pregnancy_week SMALLINT,
  height NUMERIC,
  weight NUMERIC,
  adult_family_members SMALLINT DEFAULT 1,
  child_family_members SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. meals（新規）
食事記録を管理するテーブル。

```
[
  {
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "column_name": "user_id",
    "data_type": "uuid"
  },
  {
    "column_name": "meal_type",
    "data_type": "character varying"
  },
  {
    "column_name": "meal_date",
    "data_type": "date"
  },
  {
    "column_name": "photo_url",
    "data_type": "text"
  },
  {
    "column_name": "food_description",
    "data_type": "jsonb"
  },
  {
    "column_name": "nutrition_data",
    "data_type": "jsonb"
  },
  {
    "column_name": "servings",
    "data_type": "smallint"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone"
  }
]
```
```sql
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_url TEXT,
  food_description JSONB, -- 食品リストをJSON形式で保存
  nutrition_data JSONB,   -- 栄養価データをJSON形式で保存
  servings SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. daily_nutrition_logs（新規）
日次の栄養摂取状況を集計するテーブル。
```
[
  {
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "column_name": "user_id",
    "data_type": "uuid"
  },
  {
    "column_name": "log_date",
    "data_type": "date"
  },
  {
    "column_name": "nutrition_data",
    "data_type": "jsonb"
  },
  {
    "column_name": "ai_comment",
    "data_type": "text"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone"
  }
]
```

```sql
CREATE TABLE daily_nutrition_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  nutrition_data JSONB,   -- 日次栄養データをJSON形式で保存
  ai_comment TEXT,        -- AIからのアドバイスコメント
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);
```
### ER図
```
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│    profiles   │          │     meals     │          │daily_nutrition│
├───────────────┤          ├───────────────┤          │     logs     │
│ id            │          │ id            │          ├───────────────┤
│ user_id       │◄────────►│ user_id       │          │ id            │
│ age           │          │ meal_type     │          │ user_id       │◄──┐
│ pregnancy_week│          │ meal_date     │          │ log_date      │   │
│ height        │          │ photo_url     │          │ nutrition_data│   │
│ weight        │          │ food_description         │ ai_comment    │   │
│ adult_members │          │ nutrition_data│          │ created_at    │   │
│ child_members │          │ servings      │          │ updated_at    │   │
│ created_at    │          │ created_at    │          └───────────────┘   │
│ updated_at    │          └───────┬───────┘                              │
└───────────────┘                  │                                      │
                                   └──────────────────────────────────────┘
```

## JSONBデータ構造

### food_description（meals テーブル）
```json
{
  "items": [
    {"name": "ご飯", "quantity": "茶碗1杯"},
    {"name": "焼き魚（鮭）", "quantity": "1切れ"},
    {"name": "ほうれん草のお浸し", "quantity": "小鉢1杯"}
  ]
}
```

### nutrition_data（meals テーブル）
```json
{
  "calories": 370,
  "protein": 26.4,
  "iron": 0.9,
  "folic_acid": 21,
  "calcium": 17,
  "confidence_score": 0.85
}
```

### nutrition_data（daily_nutrition_logs テーブル）
```json
{
  "total": {
    "calories": 1850,
    "protein": 75.2,
    "iron": 8.4,
    "folic_acid": 320,
    "calcium": 650
  },
  "target": {
    "calories": 2200,
    "protein": 80,
    "iron": 10,
    "folic_acid": 400,
    "calcium": 800
  },
  "achievement_rates": {
    "calories": 84,
    "protein": 94,
    "iron": 84,
    "folic_acid": 80,
    "calcium": 81
  },
  "deficient_nutrients": ["iron", "folic_acid"]
}
```

## インデックス設定

```sql
-- ユーザーごとの食事検索を高速化
CREATE INDEX idx_meals_user_id ON meals(user_id);

-- 日付ごとの食事検索を高速化
CREATE INDEX idx_meals_date ON meals(meal_date);

-- ユーザー+日付での栄養ログ検索を高速化
CREATE INDEX idx_daily_nutrition_user_date ON daily_nutrition_logs(user_id, log_date);
```

## 将来の拡張ポイント

1. **お気に入りレシピ保存**
   ```sql
   CREATE TABLE saved_recipes (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES auth.users(id),
     recipe_data JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **体重記録履歴**
   ```sql
   CREATE TABLE weight_logs (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES auth.users(id),
     log_date DATE NOT NULL,
     weight NUMERIC NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE (user_id, log_date)
   );
   ``` 
-- 食品データ関連テーブルの追加

-- 食品テーブル作成
CREATE TABLE IF NOT EXISTS food_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_id TEXT,
  name TEXT NOT NULL,
  calories NUMERIC NOT NULL,
  protein NUMERIC NOT NULL,
  iron NUMERIC NOT NULL,
  folic_acid NUMERIC NOT NULL,
  calcium NUMERIC NOT NULL,
  vitamin_d NUMERIC NOT NULL,
  standard_quantity TEXT DEFAULT '100g',
  cooking_method TEXT,
  category TEXT,
  pregnancy_caution BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 食品エイリアステーブル作成
CREATE TABLE IF NOT EXISTS food_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  food_id UUID REFERENCES food_items(id) ON DELETE CASCADE,
  alias TEXT NOT NULL
);

-- 食品カテゴリーテーブル作成
CREATE TABLE IF NOT EXISTS food_categories (
  id VARCHAR(2) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- food_itemsにcategory_idカラムを追加
ALTER TABLE food_items 
ADD COLUMN category_id VARCHAR(2) REFERENCES food_categories(id);

-- GINインデックス追加（あいまい検索用）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_food_aliases_alias ON food_aliases USING gin (alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_food_items_category_id ON food_items(category_id);

-- 食品テーブルへの読み取りポリシー（全ユーザーアクセス可能）
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read food_items" ON food_items
  FOR SELECT USING (true);

-- エイリアステーブルへの読み取りポリシー
ALTER TABLE food_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read food_aliases" ON food_aliases
  FOR SELECT USING (true);

-- カテゴリーテーブルへの読み取りポリシー
ALTER TABLE food_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read food_categories" ON food_categories
  FOR SELECT USING (true);

-- 食品カテゴリーの初期データ追加
INSERT INTO food_categories (id, name, description) VALUES
('01', '穀類', '米、パン、麺類など'),
('02', 'いも及びでん粉類', 'じゃがいも、さつまいも、でん粉など'),
('03', '砂糖及び甘味類', '砂糖、はちみつなど'),
('04', '豆類', '大豆、小豆、えんどう豆など'),
('05', '種実類', 'ごま、くるみ、ピーナッツなど'),
('06', '野菜類', '葉菜類、根菜類、果菜類など'),
('07', '果実類', 'りんご、みかん、バナナなど'),
('08', 'きのこ類', 'しいたけ、まいたけ、えのきなど'),
('09', '藻類', 'わかめ、ひじき、のりなど'),
('10', '魚介類', '魚類、貝類、えびなど'),
('11', '肉類', '牛肉、豚肉、鶏肉など'),
('12', '卵類', '鶏卵、うずらの卵など'),
('13', '乳類', '牛乳、チーズ、ヨーグルトなど'),
('14', '油脂類', 'バター、マーガリン、植物油など'),
('15', '菓子類', 'ケーキ、クッキー、チョコレートなど'),
('16', 'し好飲料類', 'コーヒー、お茶、ジュースなど'),
('17', '調味料及び香辛料類', '塩、しょうゆ、みそなど'),
('18', '調理済み流通食品類', '弁当、惣菜、レトルト食品など'); 
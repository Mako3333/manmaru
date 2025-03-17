-- レシピクリップ機能のためのテーブル作成

-- レシピ情報を保存するテーブル
CREATE TABLE IF NOT EXISTS clipped_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT,
  source_url TEXT NOT NULL,
  source_platform TEXT,
  recipe_type TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  nutrition_per_serving JSONB NOT NULL DEFAULT '{}'::jsonb,
  caution_foods TEXT[] DEFAULT '{}',
  caution_level TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  servings INTEGER DEFAULT 1,
  clipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 食事記録とレシピの関連付けテーブル
CREATE TABLE IF NOT EXISTS meal_recipe_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  clipped_recipe_id UUID NOT NULL REFERENCES clipped_recipes(id) ON DELETE CASCADE,
  portion_size FLOAT NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 妊婦向けの注意食材テーブル
CREATE TABLE IF NOT EXISTS caution_foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  food_name TEXT NOT NULL,
  category TEXT NOT NULL,
  caution_level TEXT NOT NULL,
  reason TEXT NOT NULL,
  alternative_suggestion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 初期データ: いくつかの注意食材を登録
INSERT INTO caution_foods (food_name, category, caution_level, reason, alternative_suggestion)
VALUES
  ('生魚（刺身）', '生食', 'high', '食中毒のリスクがあります', '加熱した魚料理を選びましょう'),
  ('生肉', '生食', 'high', 'トキソプラズマ症のリスクがあります', '十分に加熱した肉料理を選びましょう'),
  ('生卵', '生食', 'high', 'サルモネラ菌のリスクがあります', '加熱した卵料理を選びましょう'),
  ('マグロ（大型）', '魚介', 'medium', '水銀含有量が多い場合があります', '小型魚や白身魚を選びましょう'),
  ('カフェイン飲料', '飲料', 'medium', '過剰摂取は控えましょう', 'ノンカフェイン飲料やハーブティーがおすすめです'),
  ('アルコール', '飲料', 'high', '胎児の発育に悪影響を与えます', 'ノンアルコール飲料を選びましょう');

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_clipped_recipes_user_id ON clipped_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_recipe_entries_meal_id ON meal_recipe_entries(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_recipe_entries_recipe_id ON meal_recipe_entries(clipped_recipe_id);
CREATE INDEX IF NOT EXISTS idx_caution_foods_name ON caution_foods(food_name);

-- RLSポリシー設定
ALTER TABLE clipped_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_recipe_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recipes" 
  ON clipped_recipes FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recipes" 
  ON clipped_recipes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes" 
  ON clipped_recipes FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes" 
  ON clipped_recipes FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own meal recipe entries" 
  ON meal_recipe_entries FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM meals m 
    WHERE m.id = meal_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own meal recipe entries" 
  ON meal_recipe_entries FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m 
    WHERE m.id = meal_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own meal recipe entries" 
  ON meal_recipe_entries FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM meals m 
    WHERE m.id = meal_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own meal recipe entries" 
  ON meal_recipe_entries FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM meals m 
    WHERE m.id = meal_id AND m.user_id = auth.uid()
  ));

-- カスタムトリガー: updated_atを自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clipped_recipes_updated_at
BEFORE UPDATE ON clipped_recipes
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_meal_recipe_entries_updated_at
BEFORE UPDATE ON meal_recipe_entries
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

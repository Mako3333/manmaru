-- 関数のsearch_path設定
-- 警告: function_search_path_mutable の対応
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
-- 他の該当関数も同様に設定
-- ここで他の関数についても同様の設定をしてください
-- 例: ALTER FUNCTION public.fuzzy_search_food(keyword text) SET search_path = public;

-- 対応例：全認証ユーザーに読み取り権限を付与するRLSポリシー
ALTER TABLE public.food_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "食品カテゴリの読み取りを全認証ユーザーに許可" 
  ON public.food_categories FOR SELECT 
  USING (auth.role() = 'authenticated');
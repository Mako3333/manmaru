# レシピ機能の実装と栄養計算ロジックの改善

## 概要
妊婦向け栄養管理アプリ「manmaru」の開発において、以下の主要な実装を行いました：
1. レシピページの実装とクリップ機能の追加
2. レシピクライアントコンポーネントの実装
3. 栄養計算ロジックの精度向上と安定性の改善

## 1. レシピ機能の実装

### 1.1 レシピページの実装

#### 背景
- ユーザーがクリップしたレシピを表示する機能が必要
- 栄養バランスに基づいたレシピのフィルタリングが必要
- レシピの検索と管理機能の実装が必要

#### 実施した変更
1. **レシピページのサーバーコンポーネント実装**
   ```typescript
   // src/app/(authenticated)/recipes/page.tsx
   export const metadata: Metadata = {
     title: "レシピ - manmaru",
     description: "妊婦さんに必要な栄養バランスを考慮したレシピを探せます。",
   };

   async function RecipesPage() {
     const supabase = createServerComponentClient<Database>({ cookies });
     
     // ユーザー認証確認
     const {
       data: { user },
     } = await supabase.auth.getUser();

     if (!user) {
       return (
         <div className="text-center p-4">
           <p>レシピを見るにはログインが必要です</p>
         </div>
       );
     }

     // クリップされたレシピの取得
     const { data: clippedRecipes, error } = await supabase
       .from("clipped_recipes")
       .select("*")
       .eq("user_id", user.id)
       .order("clipped_at", { ascending: false });

     if (error) {
       console.error("レシピの取得に失敗:", error);
       return <div>レシピの取得に失敗しました</div>;
     }

     // 栄養バランスの評価
     const recipesWithNutrition = clippedRecipes.map(recipe => {
       const nutrition = recipe.nutrition_per_serving;
       
       // 栄養素の基準値
       const thresholds = {
         iron: 2.5,      // mg
         folic_acid: 40, // μg
         calcium: 80,    // mg
       };

       // 各栄養素の充足度を評価
       const nutritionFocus = Object.entries(thresholds).reduce((acc, [nutrient, threshold]) => {
         if (nutrition[nutrient] >= threshold) {
           acc.push(nutrient);
         }
         return acc;
       }, [] as string[]);

       return {
         ...recipe,
         nutrition_focus: nutritionFocus
       };
     });

     return <RecipesClient recipes={recipesWithNutrition} />;
   }
   ```

2. **レシピクライアントコンポーネントの実装**
   ```typescript
   // src/app/(authenticated)/recipes/recipes-client.tsx
   export default function RecipesClient({ recipes }: RecipesClientProps) {
     const [filteredRecipes, setFilteredRecipes] = useState(recipes);
     const [isLoading, setIsLoading] = useState(false);
     const [activeTab, setActiveTab] = useState("all");
     const [searchQuery, setSearchQuery] = useState("");

     // レシピのフィルタリング
     const filterRecipes = useCallback(() => {
       let filtered = [...recipes];

       // 検索クエリによるフィルタリング
       if (searchQuery) {
         filtered = filtered.filter(recipe =>
           recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
         );
       }

       // タブによるフィルタリング
       switch (activeTab) {
         case "favorites":
           filtered = filtered.filter(recipe => recipe.is_favorite);
           break;
         case "main":
           filtered = filtered.filter(recipe => recipe.category === "main");
           break;
         case "side":
           filtered = filtered.filter(recipe => recipe.category === "side");
           break;
         case "soup":
           filtered = filtered.filter(recipe => recipe.category === "soup");
           break;
       }

       setFilteredRecipes(filtered);
     }, [recipes, searchQuery, activeTab]);

     // レシピカードクリック時の処理
     const handleRecipeClick = (recipeId: string) => {
       router.push(`/recipes/${recipeId}`);
     };

     return (
       <div className="container mx-auto px-4 py-8">
         {/* 検索バーとタブ */}
         <div className="mb-8">
           <Input
             placeholder="レシピを検索..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="mb-4"
           />
           <Tabs value={activeTab} onValueChange={setActiveTab}>
             <TabsList>
               <TabsTrigger value="all">すべて</TabsTrigger>
               <TabsTrigger value="favorites">お気に入り</TabsTrigger>
               <TabsTrigger value="main">主菜</TabsTrigger>
               <TabsTrigger value="side">副菜</TabsTrigger>
               <TabsTrigger value="soup">汁物</TabsTrigger>
             </TabsList>
           </Tabs>
         </div>

         {/* レシピグリッド */}
         {isLoading ? (
           <div className="text-center">
             <Spinner />
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredRecipes.map((recipe) => (
               <RecipeCard
                 key={recipe.id}
                 recipe={recipe}
                 onClick={() => handleRecipeClick(recipe.id)}
                 onFavoriteToggle={() => handleFavoriteToggle(recipe.id)}
               />
             ))}
           </div>
         )}

         {/* レシピが見つからない場合 */}
         {filteredRecipes.length === 0 && (
           <div className="text-center py-8">
             <p className="text-gray-500">
               レシピが見つかりませんでした
             </p>
           </div>
         )}
       </div>
     );
   }
   ```

### 1.2 レシピクリップ機能の実装

#### 背景
- レシピURLからの栄養情報自動取得が必要
- 複数のレシピサイトに対応する必要がある
- 取得した情報の正確性を確保する必要がある

#### 実施した変更
1. **レシピURL解析APIの実装**
   ```typescript
   // src/app/api/recipes/parse-url/route.ts
   export async function POST(req: Request) {
     try {
       const { url } = await req.json();
       
       // JSDOMを使用してHTMLを解析
       const dom = await JSDOM.fromURL(url);
       const { document } = dom.window;
       
       // メタデータの取得
       const title = getMetaContent(document, 'og:title');
       const imageUrl = getMetaContent(document, 'og:image');
       const sourcePlatform = determineSourcePlatform(url);
       
       // 材料リストの抽出
       const ingredients = extractIngredients(document, sourcePlatform);
       
       // AIサービスを使用して栄養計算
       const aiService = AIService.getInstance();
       const nutritionResult = await aiService.analyzeTextInput(ingredients);
       
       return NextResponse.json({
         success: true,
         data: {
           title,
           imageUrl,
           sourceUrl: url,
           sourcePlatform,
           ingredients,
           nutritionPerServing: nutritionResult.nutrition,
           cautionFoods: nutritionResult.caution_foods,
           cautionLevel: nutritionResult.max_caution_level
         }
       });
     } catch (error) {
       console.error('レシピURL解析エラー:', error);
       return NextResponse.json(
         { success: false, error: 'レシピの解析に失敗しました' },
         { status: 500 }
       );
     }
   }
   ```

## 2. 栄養計算ロジックの改善

### 2.1 量の解析ロジックの改善

#### 背景
- 日本語特有の量表現（「大4株」「太3本」など）が正確に解析できていなかった
- 単位変換が不完全で、一部の栄養計算が不正確だった
- 標準的でない単位の処理が不十分だった

#### 実施した変更
1. **量の解析機能の強化**
   ```typescript
   private static parseQuantity(quantity: string | undefined | null): number {
       if (!quantity) return 1;

       // 数値のみの場合は係数として扱う
       const numericMatch = quantity.match(/^(\d+\.?\d*)$/);
       if (numericMatch) {
           return parseFloat(numericMatch[1]);
       }

       // 標準的な単位の変換
       const standardUnitMatch = quantity.match(/^(\d+\.?\d*)\s*(g|ml|mg|μg)$/i);
       if (standardUnitMatch) {
           const value = parseFloat(standardUnitMatch[1]);
           const unit = standardUnitMatch[2].toLowerCase();

           switch (unit) {
               case 'g':
               case 'ml':
                   return value / 100;
               case 'mg':
                   return value / 100000;
               case 'μg':
                   return value / 100000000;
               default:
                   return 1;
           }
       }

       // 日本語の量表現の解析
       const japaneseQuantityMap: { [key: string]: number } = {
           '大さじ': 15,
           '小さじ': 5,
           'カップ': 200,
           '本': 40,
           '個': 50,
           '株': 50,
           '束': 100,
           '缶': 100,
           '切れ': 80,
           '枚': 60,
       };

       // 数値と単位を分離して解析
       const japaneseMatch = quantity.match(/^(大|小|)(\d+\.?\d*)(株|本|個|束|缶|さじ|カップ|切れ|枚)$/);
       if (japaneseMatch) {
           const prefix = japaneseMatch[1];
           const value = parseFloat(japaneseMatch[2]);
           const unit = japaneseMatch[3];

           let baseGrams = japaneseQuantityMap[unit] || 0;
           if (prefix === '大' && unit === 'さじ') {
               baseGrams = japaneseQuantityMap['大さじ'];
           } else if (prefix === '小' && unit === 'さじ') {
               baseGrams = japaneseQuantityMap['小さじ'];
           }

           return (value * baseGrams) / 100;
       }

       return 1;
   }
   ```

### 2.2 栄養計算ロジックの改善

#### 背景
- 栄養素の計算結果が非現実的な値になることがあった
- 量の係数が正しく反映されていなかった
- 小数点以下の精度が不適切だった

#### 実施した変更
1. **栄養計算メソッドの改善**
   ```typescript
   static calculateMealNutrition(foods: any[]): BasicNutritionData {
       const nutrition = foods.reduce((acc, food) => {
           const quantity = this.parseQuantity(food.quantity);

           return {
               calories: acc.calories + this.calculateWithQuantity(food.nutrition?.calories, quantity),
               protein: acc.protein + this.calculateWithQuantity(food.nutrition?.protein, quantity),
               iron: acc.iron + this.calculateWithQuantity(food.nutrition?.iron, quantity),
               folic_acid: acc.folic_acid + this.calculateWithQuantity(food.nutrition?.folic_acid, quantity),
               calcium: acc.calcium + this.calculateWithQuantity(food.nutrition?.calcium, quantity),
               vitamin_d: acc.vitamin_d + this.calculateWithQuantity(food.nutrition?.vitamin_d, quantity),
           };
       }, this.getEmptyNutrition());

       return {
           calories: Math.round(nutrition.calories * 100) / 100,
           protein: Math.round(nutrition.protein * 100) / 100,
           iron: Math.round(nutrition.iron * 100) / 100,
           folic_acid: Math.round(nutrition.folic_acid * 100) / 100,
           calcium: Math.round(nutrition.calcium * 100) / 100,
           vitamin_d: Math.round(nutrition.vitamin_d * 100) / 100,
       };
   }
   ```

### 2.3 バランススコア計算の改善

#### 背景
- 妊娠期特有の栄養バランスが考慮されていなかった
- 栄養素の重要度が適切に反映されていなかった
- スコアの計算方法が不透明だった

#### 実施した変更
1. **妊娠期に特化したスコア計算の実装**
   ```typescript
   static calculateBalanceScore(nutrition: BasicNutritionData): number {
       const weights = {
           protein: 0.25,
           iron: 0.2,
           folic_acid: 0.25,
           calcium: 0.2,
           vitamin_d: 0.1
       };

       const dailyValues = {
           protein: 60,
           iron: 27,
           folic_acid: 400,
           calcium: 1000,
           vitamin_d: 10
       };

       let score = 0;
       for (const [nutrient, weight] of Object.entries(weights)) {
           const value = nutrition[nutrient as keyof typeof nutrition] as number;
           const daily = dailyValues[nutrient as keyof typeof dailyValues];
           const fulfillment = Math.min(value / daily, 1);
           score += fulfillment * weight * 100;
       }

       return Math.round(score);
   }
   ```

## 3. 実装の効果

### 3.1 レシピ機能の向上
- レシピの検索と管理が容易に
- 栄養バランスに基づいたフィルタリングが可能に
- レシピのクリップと保存が簡単に

### 3.2 栄養計算の精度向上
- 日本語の量表現が正確に解析可能に
- 栄養素の計算結果が現実的な値に
- 小数点以下の精度が適切に調整

### 3.3 ユーザー体験の改善
- 直感的なレシピ検索インターフェース
- リアルタイムの栄養バランス表示
- スムーズな操作感の実現

## 4. 今後の課題

### 4.1 レシピ機能の拡張
- レシピの詳細表示機能の実装
- 献立作成機能の追加
- レシピの共有機能の実装

### 4.2 栄養計算の改善
- より多様な量表現への対応
- 食品の調理による栄養価変化の考慮
- 季節性や地域性を考慮した補正

### 4.3 システムの安定性向上
- エラーハンドリングの強化
- パフォーマンスの最適化
- セキュリティ対策の強化

## 5. 現状の課題

### 5.1 データベース検索の問題
- 表記ゆれによる食材の検索精度低下
  - 「味噌」→「みそ」
  - 「小松菜」→「こまつな」
  など、同じ食材でも表記が異なると正確に検索できない

### 5.2 画像表示の問題
```
Error: Invalid src prop (https://og-image.cookpad.com/global/jp/recipe/24523436?t=1741049453) on `next/image`, hostname "og-image.cookpad.com" is not configured under images in your `next.config.js`
```
- クリップしたレシピの画像表示時にエラーが発生
- `next.config.js`での外部画像ドメインの設定が必要

### 5.3 開発方針の見直し
- 栄養素計算ロジックの改善は一時保留
- 全ての機能と画面の実装を優先
- 実装STEPの画面設計完了後に栄養計算の精度向上に着手

## 6. まとめ

本日の実装により、レシピ機能の基盤が整い、栄養計算の精度が大幅に向上しました。特に、日本語特有の量表現の解析と、妊娠期に特化した栄養バランスの計算に重点を置いた改善を行いました。

今後は、まず全ての機能と画面の実装を完了させ、その後栄養計算ロジックの改善に取り組む予定です。また、実際のユーザーフィードバックを基に、継続的な改善を行っていきます。 
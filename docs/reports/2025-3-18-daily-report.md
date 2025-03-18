# レシピ解析機能の強化とクリップ解除機能の実装

## 概要
妊婦向け栄養管理アプリ「manmaru」の開発において、以下の主要な実装を行いました：
1. レシピURLパーサーの強化（特にデリッシュキッチン対応）
2. 外部画像ドメイン設定の追加（www.sirogohan.comなど）
3. レシピクリップの解除機能の実装
4. 栄養素の比例計算機能の実装
5. お気に入り機能の即時反映

## 1. レシピURL解析機能の強化

### 1.1 デリッシュキッチン対応の改善

#### 背景
- デリッシュキッチンのレシピページから材料情報を正確に抽出できない問題が発生
- 「レシピの材料が見つかりませんでした」というエラーが頻繁に発生
- サイト構造が変更された可能性があり、セレクタの見直しが必要

#### 実施した変更
1. **複数のセレクタパターン対応**
   ```typescript
   // src/app/api/recipes/parse-url/route.ts
   // デリッシュキッチン用パーサー - 強化版
   const selectors = [
       // 材料リストコンテナのセレクター
       '.recipe-ingredients__list',
       '.ingredients-list',
       '.ingredient-list',
       '.recipe__ingredients',
       '.recipe-content__ingredients',
       '.recipe-detail__ingredients',
       
       // ページ全体
       '.recipe-detail',
       '.recipe-content',
       '.recipe'
   ];
   
   // セレクタを一つずつ試す
   for (const selector of selectors) {
       const container = document.querySelector(selector);
       if (container) {
           console.log(`セレクター ${selector} が見つかりました`);
           
           // コンテナ内の要素を取得
           ingredientElements = container.querySelectorAll('li, .ingredient, .ingredient-item, .ingredient-row');
           
           // 要素が見つかったら終了
           if (ingredientElements.length > 0) {
               console.log(`${ingredientElements.length}個の材料要素が見つかりました`);
               break;
           }
       }
   }
   ```

2. **名前と分量を取得するセレクタの拡充**
   ```typescript
   // 名前と分量を取得するセレクター
   const nameSelectors = ['.ingredient-list__item-name', '.ingredients-list-item-name', '.ingredient-name', '.recipe-ingredient-name', '.name'];
   const quantitySelectors = ['.ingredient-list__item-serving', '.ingredients-list-item-amount', '.ingredient-amount', '.recipe-ingredient-amount', '.amount'];
   
   let nameElement = null;
   for (const selector of nameSelectors) {
       const el = element.querySelector(selector);
       if (el) {
           nameElement = el;
           break;
       }
   }
   ```

3. **テキスト全体からの材料抽出機能追加**
   ```typescript
   // 材料が見つからない場合、ページのテキスト全体から材料セクションを探す
   if (ingredients.length === 0) {
       console.log('材料要素が見つからないため、テキスト解析を試みます');
       const bodyText = document.body.textContent || '';
       
       // 「材料」というテキストの後の部分を抽出
       const materialsPattern = /材料(?:\s*[\(（][^）\)]*[\)）])?[\s\n]*?([\s\S]*?)(?:作り方|手順|レシピ|調理|下準備|STEP)/i;
       const materialsMatch = bodyText.match(materialsPattern);
       
       if (materialsMatch && materialsMatch[1]) {
           const materialsText = materialsMatch[1].trim();
           const lines = materialsText.split(/\n|<br>/).map(line => line.trim()).filter(line => line.length > 0);
           
           for (const line of lines) {
               if (line.length > 2 && line.length < 50 && !line.includes('材料') && !line.includes('つくり方')) {
                   // 材料名と分量を分ける試み
                   const parts = line.split(/[：:]|\s{2,}/);
                   if (parts.length > 1) {
                       ingredients.push({
                           name: parts[0].trim(),
                           quantity: parts.slice(1).join(' ').trim()
                       });
                   } else {
                       ingredients.push({ name: line });
                   }
               }
           }
       }
   }
   ```

### 1.2 エラーメッセージとデバッグ情報の改善

#### 背景
- エラーメッセージが一般的で、具体的な問題点や解決策が示されていなかった
- トラブルシューティングが難しく、開発プロセスが遅延

#### 実施した変更
1. **サイト別のエラーメッセージ**
   ```typescript
   // サイト別のエラーメッセージ
   const fetchErrorHostname = new URL(url).hostname;
   let errorMessage = `URLからのデータ取得中にエラーが発生しました: ${fetchError.message}`;
   
   if (fetchErrorHostname.includes('delishkitchen.tv')) {
       errorMessage = `デリッシュキッチンのレシピ取得に失敗しました。サイトの仕様が変更された可能性があります。他のレシピURLを試すか、別のサイト（クックパッドなど）をお試しください。詳細: ${fetchError.message}`;
   } else if (fetchErrorHostname.includes('shirogoghan.com') || fetchErrorHostname.includes('shirogohan.com')) {
       errorMessage = `白ごはん.comのレシピ取得に失敗しました。サイトの仕様が変更された可能性があります。他のレシピURLを試すか、別のサイト（クックパッドなど）をお試しください。詳細: ${fetchError.message}`;
   }
   ```

2. **詳細なデバッグ情報のログ出力**
   ```typescript
   // デバッグ情報
   console.log(`デリッシュキッチンのレシピ解析: ${ingredients.length}個の材料を検出しました`);
   if (ingredients.length > 0) {
       console.log('検出された材料の例:', ingredients.slice(0, 3));
   }
   ```

## 2. 外部画像ドメイン設定の追加

### 2.1 Next.jsの画像ドメイン設定

#### 背景
- レシピのクリップと表示時に外部画像が表示されないエラーが発生
- `Invalid src prop on next/image`エラーでwww.sirogohan.comなどのドメインが許可リストにない

#### 実施した変更
1. **next.config.tsの更新**
   ```typescript
   // next.config.ts
   images: {
     domains: [
       // クックパッド
       "cookpad.com",
       "og-image.cookpad.com",
       "img.cpcdn.com",
       // デリッシュキッチン
       "delishkitchen.tv",
       "image.delishkitchen.tv",
       "www.delishkitchen.tv",
       // クラシル
       "kurashiru.com",
       "video.kurashiru.com",
       "image.kurashiru.com",
       // 白ごはん.com
       "sirogohan.com",
       "image.sirogohan.com",
       "www.sirogohan.com",
       // その他
       "placehold.jp"
     ],
   },
   ```

## 3. レシピクリップの解除機能実装

### 3.1 クリップ解除UIの実装

#### 背景
- レシピをクリップした後、不要になったレシピを削除する機能が必要
- ユーザーが使いやすい直感的なUIと確認プロセスが必要

#### 実施した変更
1. **解除ボタンの配置**
   ```tsx
   // src/app/(authenticated)/recipes/[id]/recipes-client.tsx
   {/* 元サイトへのリンクとクリップ解除ボタン */}
   <div className="mt-8 flex flex-col sm:flex-row gap-3">
       <Button
           variant="outline"
           className="flex-1"
           onClick={() => window.open(recipe.source_url, '_blank')}
       >
           <ExternalLink size={16} className="mr-2" />
           元のレシピを見る
       </Button>
       
       <Button
           variant="outline"
           className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
           onClick={openDeleteDialog}
       >
           <Trash size={16} className="mr-2" />
           クリップの解除
       </Button>
   </div>
   ```

2. **確認ダイアログの実装**
   ```tsx
   {/* 削除確認ダイアログ */}
   {showDeleteDialog && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
               <h2 className="text-xl font-bold mb-4">クリップを解除しますか？</h2>
               <p className="text-gray-600 mb-6">
                   このレシピを削除すると、元に戻すことができません。本当にクリップを解除しますか？
               </p>
               <div className="flex justify-end gap-3">
                   <Button
                       variant="outline"
                       onClick={closeDeleteDialog}
                       disabled={loading}
                   >
                       キャンセル
                   </Button>
                   <Button
                       variant="destructive"
                       onClick={handleDeleteRecipe}
                       disabled={loading}
                   >
                       {loading ? '削除中...' : '削除する'}
                   </Button>
               </div>
           </div>
       </div>
   )}
   ```

### 3.2 レシピ削除処理の実装

#### 背景
- レシピを安全に削除するためのバックエンド処理が必要
- 削除後の適切なフィードバックとナビゲーションが必要

#### 実施した変更
1. **削除処理関数の実装**
   ```typescript
   // レシピ削除処理
   const handleDeleteRecipe = async () => {
       if (!recipe.id) return;
       
       setLoading(true);
       try {
           const response = await fetch(`/api/recipes/${recipe.id}`, {
               method: 'DELETE',
           });
           
           if (!response.ok) {
               const errorData = await response.json();
               throw new Error(errorData.error || 'レシピの削除に失敗しました');
           }
           
           // 削除成功後、レシピ一覧ページに戻る
           router.push('/recipes');
           router.refresh();
       } catch (error) {
           console.error('削除エラー:', error);
           alert('レシピの削除に失敗しました。もう一度お試しください。');
       } finally {
           setLoading(false);
           setShowDeleteDialog(false);
       }
   };
   ```

## 4. 栄養素の比例計算機能の実装

### 4.1 分量に応じた栄養素計算

#### 背景
- 食事記録に追加する際、分量を変更しても栄養素計算が更新されないという問題があった
- 実際の摂取量と表示される栄養価に不一致が生じていた
- ユーザー体験の改善と栄養管理の正確性向上が必要だった

#### 実施した変更
1. **API側での比例計算ロジックの実装**
   ```typescript
   // src/app/api/meals/from-recipe/route.ts
   // 分量に応じた栄養素の計算
   const nutrition_data = Object.entries(recipe.nutrition_per_serving)
     .reduce((acc, [key, value]) => {
       acc[key] = typeof value === 'number' ? value * portion_size : value;
       return acc;
     }, {} as Record<string, any>);
   
   // 食事記録の作成
   const { data: mealData } = await supabase
     .from('meals')
     .insert({
       user_id: session.user.id,
       meal_type,
       meal_date,
       food_description: recipe.ingredients,
       nutrition_data, // 比例計算済みの栄養データを使用
       servings: Math.max(1, Math.round(portion_size))
     })
     .select('id')
     .single();
   ```

2. **プレビュー表示機能の追加**
   ```typescript
   // src/components/recipes/add-to-meal-dialog.tsx
   // 分量に応じた栄養素のリアルタイム計算
   const calculateAdjustedNutrition = () => {
     const adjusted = {} as Record<string, number>;
     
     Object.entries(recipe.nutrition_per_serving).forEach(([key, value]) => {
       if (typeof value === 'number') {
         adjusted[key] = value * portionSize;
       }
     });
     
     return adjusted;
   };
   
   // 計算された栄養素を表示
   const adjustedNutrition = calculateAdjustedNutrition();
   
   // UI表示部分
   <div className="my-4 p-3 bg-gray-50 rounded-lg">
     <h3 className="text-sm font-medium mb-2">栄養素プレビュー</h3>
     <div className="grid grid-cols-2 gap-2">
       {Object.entries(adjustedNutrition)
         .filter(([key]) => ['calories', 'protein', 'iron', 'folic_acid', 'calcium'].includes(key))
         .map(([key, value]) => (
           <div key={key} className="flex justify-between">
             <span className="text-gray-600">{getNutrientDisplayName(key)}</span>
             <span className="font-medium">
               {typeof value === 'number' ? value.toFixed(1) : value} {getNutrientUnit(key)}
             </span>
           </div>
         ))
       }
     </div>
   </div>
   ```

## 5. お気に入り機能の即時反映実装

### 5.1 Optimistic UI更新の実装

#### 背景
- お気に入りボタンをクリックした際の状態更新が遅く、ユーザー体験が低下していた
- API応答を待つ間、UIの状態が更新されないため操作感が悪かった
- 複数のレシピカードでの一貫性が保たれていなかった

#### 実施した変更
1. **お気に入りトグル関数の改善**
   ```typescript
   // src/app/(authenticated)/recipes/recipes-client.tsx
   const handleFavoriteToggle = async (recipeId: string, isFavorite: boolean) => {
     try {
       // 即時UI更新（Optimistic UI）
       setFilteredRecipes(prev => 
         prev.map(recipe => 
           recipe.id === recipeId 
             ? { ...recipe, is_favorite: isFavorite } 
             : recipe
         )
       );
       
       // APIリクエスト
       const response = await fetch(`/api/recipes/${recipeId}/favorite`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ is_favorite: isFavorite })
       });
       
       if (!response.ok) {
         // エラー時はUI状態を元に戻す
         setFilteredRecipes(prev => 
           prev.map(recipe => 
             recipe.id === recipeId 
               ? { ...recipe, is_favorite: !isFavorite } 
               : recipe
           )
         );
         throw new Error('お気に入り状態の更新に失敗しました');
       }
       
       // 成功フィードバック
       toast.success(
         isFavorite 
           ? 'お気に入りに追加しました' 
           : 'お気に入りから削除しました'
       );
     } catch (error) {
       console.error('お気に入り更新エラー:', error);
       toast.error('操作に失敗しました。もう一度お試しください。');
     }
   };
   ```

2. **UIフィードバックの改善**
   ```typescript
   // src/components/recipes/recipe-card.tsx
   // お気に入りボタンのアニメーション効果
   const FavoriteButton = ({ isFavorite, onClick, isDisabled }) => {
     return (
       <button
         className={`
           favorite-button p-1 rounded-full transition-all duration-300
           ${isFavorite ? 'text-red-500 scale-110' : 'text-gray-400 hover:text-gray-600'}
         `}
         onClick={onClick}
         disabled={isDisabled}
         aria-label={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
       >
         <Heart 
           size={18} 
           fill={isFavorite ? 'currentColor' : 'none'} 
           className={isFavorite ? 'animate-pulse' : ''} 
         />
       </button>
     );
   };
   ```

## 6. 栄養ユーティリティの改善

### 6.1 共通ユーティリティの作成

#### 背景
- 栄養素の表示名や単位の変換処理がコンポーネント内に埋め込まれていた
- コードの重複が発生し、メンテナンス性が低下

#### 実施した変更
1. **栄養素ユーティリティの分離**
   ```typescript
   // src/lib/nutrition-utils.ts
   // 栄養素の表示名を取得
   export const getNutrientDisplayName = (key: string): string => {
       const nameMap: Record<string, string> = {
           'calories': 'カロリー',
           'protein': 'タンパク質',
           'iron': '鉄分',
           'folic_acid': '葉酸',
           'calcium': 'カルシウム',
           'vitamin_d': 'ビタミンD'
       };
       return nameMap[key] || key;
   };

   // 栄養素の単位を取得
   export const getNutrientUnit = (key: string): string => {
       const unitMap: Record<string, string> = {
           'calories': 'kcal',
           'protein': 'g',
           'iron': 'mg',
           'folic_acid': 'μg',
           'calcium': 'mg',
           'vitamin_d': 'μg'
       };
       return unitMap[key] || '';
   };
   ```

## 7. 実装の効果

### 7.1 レシピURL解析の堅牢性向上
- より多くのレシピサイトとページ構造に対応可能に
- エラー発生時の明確なフィードバックと提案が可能に
- デバッグ情報の充実によりトラブルシューティングが容易に

### 7.2 ユーザー体験の改善
- 外部画像の正常表示によるビジュアル体験の向上
- 直感的なクリップ解除機能によるレシピ管理の円滑化
- エラーメッセージの改善によるユーザーフラストレーション軽減

### 7.3 コードの品質向上
- 共通ユーティリティを活用した重複コードの削減
- タイプセーフな実装によるバグの予防
- コンポーネントの役割分担の明確化

## 8. 今後の課題

### 8.1 レシピパーサーの更なる強化
- 追加のレシピサイト対応（他の人気サイト）
- AIを活用したより柔軟な材料抽出
- 構造化データ（JSON-LD）の活用

### 8.2 栄養素の比例計算
- 分量調整時の栄養素値の自動計算機能
- 材料の追加・削除時の栄養値リアルタイム更新

### 8.3 パフォーマンス最適化
- 画像読み込みの最適化
- データ取得のキャッシュ戦略
- API呼び出しの効率化

## 9. まとめ

本日の実装により、レシピURL解析機能の堅牢性が大幅に向上し、特にデリッシュキッチンなどの一般的なレシピサイトへの対応が改善されました。レシピクリップの解除機能や栄養素の比例計算機能の追加により、アプリの基本的な使いやすさと正確性が大幅に向上しました。

また、お気に入り機能の即時反映実装により、ユーザーインターフェースの応答性が改善され、より自然な操作感を実現しました。これらはいずれもMVPに不可欠な機能であり、その実装によりアプリの完成度が高まりました。

これらの改善により、MVPリリースに向けた実装が着実に進行しています。次のステップでは、ホーム画面とレシピ推奨の連携、および食品禁忌警告の基本実装に取り組む予定です。 
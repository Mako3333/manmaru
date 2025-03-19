
# ホーム画面におすすめレシピ機能の実装

## 概要
妊婦向け栄養管理アプリ「manmaru」の開発において、本日3月19日に以下の主要機能を実装しました：

1. ホーム画面におけるおすすめレシピセクションの実装
2. ユーザーのクリップ状況に応じた適応型表示
3. レシピ推奨アルゴリズムの実装

## 1. おすすめレシピAPIエンドポイントの実装

### 1.1 ユーザー状況に応じたレコメンデーション

#### 背景
- ホーム画面でユーザーの現在の状況に適したレシピを表示する必要があった
- クリップ数に応じて適切な量と種類のレシピを推奨する仕組みが必要だった
- 新規ユーザーからアクティブユーザーまで様々な利用状況に対応する必要があった

#### 実施した変更
1. **段階的なレコメンデーション状態の定義**
   ```typescript
   // src/app/api/recommendations/home-recipes/route.ts
   // クリップ数に応じた4つの状態
   if (clippedCount === 0) {
     // クリップなしの場合
     return NextResponse.json({
       status: 'no_clips',
       recipes: []
     });
   } else if (clippedCount < 5) {
     // クリップが少ない場合（1件のみ返す）
     recommendedRecipes = [recipes[0]];
     return NextResponse.json({
       status: 'few_clips',
       recipes: recommendedRecipes
     });
   } else if (clippedCount < 10) {
     // クリップが5～9件の場合（2件返す）
     // ... レコメンドロジック
     return NextResponse.json({
       status: 'few_more_clips',
       recipes: recommendedRecipes,
       total_clips: clippedCount
     });
   } else {
     // クリップが十分ある場合（10件以上で4件表示）
     // ... 高度なレコメンドロジック
     return NextResponse.json({
       status: 'enough_clips',
       recipes: recommendedRecipes,
       total_clips: clippedCount
     });
   }
   ```

2. **レシピ選定アルゴリズムの実装**
   ```typescript
   // 最近使用したレシピを除外
   let availableRecipes = recipes.filter(r => !recentlyUsedIds.has(r.id));
   
   // お気に入りを優先
   const favoriteRecipes = availableRecipes.filter(r => r.is_favorite);
   
   // クリップが新しいものから古いものまで均等に選ぶ（バラエティ向上）
   const step = Math.max(1, Math.floor(availableRecipes.length / 4));
   recommendedRecipes = [0, 1, 2, 3].map(i => 
     availableRecipes[Math.min(i * step, availableRecipes.length - 1)]
   );
   ```

### 1.2 最近利用したレシピの除外機能

#### 背景
- 同じレシピが繰り返し表示されるとユーザー体験が低下する問題があった
- 過去7日間に利用したレシピを除外して多様性を確保する必要があった

#### 実施した変更
1. **最近使用したレシピの取得**
   ```typescript
   // 最近使用したレシピの取得（除外用）
   const { data: recentlyUsed } = await supabase
     .from('meal_recipe_entries')
     .select('clipped_recipe_id')
     .eq('user_id', session.user.id)
     .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
   
   const recentlyUsedIds = new Set(recentlyUsed?.map(item => item.clipped_recipe_id) || []);
   ```

## 2. フロントエンドコンポーネントの実装

### 2.1 クリップ状況に応じた段階的UI

#### 背景
- ユーザーのクリップ数に応じて異なるUIを表示する必要があった
- 新規ユーザーには適切なガイダンスを提供しつつ、アクティブユーザーには豊富な選択肢を提示する必要があった

#### 実施した変更
1. **4段階の表示状態の実装**
   - クリップなし：ガイダンス表示
   - クリップ1～4件：1件のレシピと追加促進メッセージ
   - クリップ5～9件：2件のレシピとポジティブメッセージ
   - クリップ10件以上：4件のレシピをグリッド表示

2. **状態別の条件付きレンダリング**
   ```tsx
   // src/components/home/recommended-recipes.tsx
   // クリップなしの場合
   if (status === 'no_clips') {
     return (
       <div className="space-y-2">
         <h2 className="text-xl font-medium">おすすめレシピ</h2>
         <Card className="bg-gray-50 border border-dashed">
           {/* ガイダンス表示 */}
         </Card>
       </div>
     );
   }
   
   // クリップが少ない場合、中間の場合、十分な場合...それぞれに対応するUIを実装
   ```

### 2.2 利用促進メッセージの実装

#### 背景
- ユーザーのエンゲージメントを高め、より多くのレシピをクリップするよう促す必要があった
- ユーザーの現在の進捗を認識して前向きなフィードバックを提供したい

#### 実施した変更
1. **中間段階（5～9件）での励ましメッセージ**
   ```tsx
   <Card className="bg-green-50 border-green-100 mt-3">
     <CardContent className="p-4">
       <p className="text-green-700 text-sm mb-2">
         <span className="font-medium">順調にレシピが集まっていますね！</span>
         現在{totalClips}件のレシピをクリップ済み。あと数件クリップすると、
         もっと多彩なおすすめが表示されます。
       </p>
       <Button 
         variant="outline" 
         className="w-full"
         onClick={() => router.push('/recipes/clip')}
       >
         レシピを追加する <ArrowRight className="ml-2 w-4 h-4" />
       </Button>
     </CardContent>
   </Card>
   ```

## 3. ホーム画面への統合

### 3.1 メインレイアウトへのコンポーネント配置

#### 背景
- ホーム画面の重要な位置にレシピレコメンデーションを表示する必要があった
- モバイルファーストのレスポンシブデザインへの対応が必要だった

#### 実施した変更
1. **コンポーネント配置**
   ```tsx
   // src/components/home/home-client.tsx
   import { RecommendedRecipes } from './recommended-recipes';
   
   // ...
   
   <main className="flex-grow container mx-auto max-w-4xl px-4 pt-6 space-y-8">
     {/* 1. 妊娠週数情報カード */}
     <PregnancyWeekInfo className="rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.05)]" />
     
     {/* 2. おすすめレシピ */}
     <div className="mx-0 sm:mx-4">
       <RecommendedRecipes />
     </div>
     
     {/* 他のコンポーネント... */}
   </main>
   ```

## 4. 実装の効果

### 4.1 ユーザー体験の向上
- ホーム画面からすぐにユーザーに適したレシピを提案することでアプリの有用性が向上
- ユーザーの利用段階に応じたUIによって直感的な操作が可能に
- ポジティブなフィードバックによるユーザーエンゲージメントの向上

### 4.2 コンテンツ発見性の改善
- 最近使用していないレシピの再発見が容易に
- お気に入り登録されたレシピの優先表示による満足度向上
- クリップ数の増加に伴いより多彩なレコメンデーションを提供

## 5. 今後の課題

### 5.1 レコメンドアルゴリズムの強化
- ユーザーの栄養状態に基づいたレシピ推奨の実装
- 季節性や旬の食材を考慮したレコメンデーション
- 利用パターンの分析による個人化されたレコメンデーション

### 5.2 UI/UXの最適化
- パフォーマンス改善（画像の最適化、キャッシュ戦略）
- 多様なレイアウトオプションの検討
- ページネーションや無限スクロールの検討

## 6. まとめ

ホーム画面におすすめレシピ機能の実装により、ユーザーがアプリ起動直後からすぐに役立つコンテンツを発見できるようになりました。特に注目すべき点は、ユーザーのクリップ状況に応じて4段階の表示を切り替える適応型UIです。これにより新規ユーザーから経験豊富なユーザーまで、それぞれの状況に合わせた最適な体験を提供することが可能になりました。

このコンポーネントは、MVPリリースに向けた重要な一歩であり、ユーザーがレシピをクリップするモチベーションを高めつつ、アプリの中核機能である栄養管理をサポートする役割も果たしています。

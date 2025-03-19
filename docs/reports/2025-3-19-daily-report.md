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

# ホーム画面の栄養バランス表示の改善

## 概要
3月19日の追加作業として、ホーム画面の栄養バランス表示について以下の改善を実施しました：

1. 栄養バランス表示のUIを元のデザインに復元
2. ダッシュボードとの栄養スコア計算の整合性確保
3. 視覚的一貫性の向上
4. 初回ユーザーと毎日一回目のユーザー向け表示の最適化

## 1. ユーザー状態に応じた表示の最適化

### 1.1 ユーザー状態の判別と最適な表示

#### 背景
- 新規ユーザー、毎日初回アクセスユーザー、栄養記録済みユーザーで異なる表示が必要だった
- 各状態に最適化されたUI/UXを提供し、ユーザーの継続利用を促進する必要があった

#### 実施した変更
1. **ユーザー状態の判別ロジック**
   ```tsx
   // src/components/home/home-client.tsx
   // ユーザー状態の判別
   const isNewUser = profile?.onboarding_completed === false;
   const isFirstVisitOfDay = nutritionData?.entries?.length === 0;
   
   // 状態に応じた表示の切り替え
   if (isNewUser) {
     return <OnboardingView />;
   } else if (isFirstVisitOfDay && isStartOfDay) {
     return <MorningNutritionView profile={profile} />;
   } else {
     return <NutritionBalanceView nutritionData={nutritionData} />;
   }
   ```

### 1.2 初回ユーザー向けオンボーディング表示

#### 背景
- 新規ユーザーには栄養バランスの重要性とアプリの使い方を理解してもらう必要があった
- 優しく導入することでユーザーの継続利用を促進する必要があった

#### 実施した変更
1. **オンボーディングコンポーネントの改善**
   ```tsx
   const OnboardingView = () => {
     return (
       <Card className="w-full overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px] border-none">
         <CardContent className="p-6">
           <div className="space-y-4">
             <h3 className="text-xl font-semibold text-[#363249]">まずは栄養を記録してみましょう</h3>
             <p className="text-gray-600">
               毎日の食事を記録することで、あなたと赤ちゃんに必要な栄養素がバランスよく摂取できているか確認できます。
             </p>
             <div className="grid grid-cols-3 gap-4 my-4">
               {/* 栄養素アイコン表示 */}
             </div>
             <Button 
               className="w-full bg-gradient-to-r from-[#2E9E6C] to-[#39B97E] hover:from-[#268a5c] hover:to-[#30a46c]"
               onClick={() => router.push('/nutrition/record')}
             >
               今日の栄養を記録する <ArrowRight className="ml-2 w-4 h-4" />
             </Button>
           </div>
         </CardContent>
       </Card>
     );
   };
   ```

### 1.3 毎日初回アクセス時の朝の表示

#### 背景
- 毎日最初のアクセス時には、その日の栄養目標を意識づける表示が必要だった
- 妊娠週数に応じた適切な情報と励ましを提供する必要があった

#### 実施した変更
1. **朝の表示コンポーネントの最適化**
   ```tsx
   // src/components/home/morning-nutrition-view.tsx
   // 妊娠週数計算の統一
   const { currentWeek, trimester } = calculatePregnancyWeekAndTrimester(profile.due_date);
   
   return (
     <Card className="w-full overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px] border-none">
       <div className="bg-gradient-to-r from-[#2E9E6C] to-[#39B97E] p-4">
         <div className="flex items-center">
           <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
             <SunIcon className="text-white w-6 h-6" />
           </div>
           <div>
             <h3 className="text-white font-medium">おはようございます！</h3>
             <p className="text-white/90 text-sm">
               現在 {currentWeek} 週目（{trimester}期）
             </p>
           </div>
         </div>
       </div>
       <CardContent className="p-6">
         {/* 1日の推奨メッセージ */}
         <div className="mb-4">
           <h4 className="font-medium text-[#363249] mb-2">今日の栄養ポイント</h4>
           <p className="text-gray-600 text-sm">{getTrimesterNutritionTip(trimester)}</p>
         </div>
         
         {/* 記録ボタン */}
         <Button 
           className="w-full bg-gradient-to-r from-[#2E9E6C] to-[#39B97E] hover:from-[#268a5c] hover:to-[#30a46c]"
           onClick={() => router.push('/nutrition/record')}
         >
           今日の栄養を記録する <ArrowRight className="ml-2 w-4 h-4" />
         </Button>
       </CardContent>
     </Card>
   );
   ```

## 2. 栄養バランス表示の元デザインへの復元

### 背景
- ダッシュボードと栄養バランス表示の一貫性を保つ必要があった
- 元のデザインの方がユーザーにとって直感的で情報が把握しやすかった

### 実施した変更
1. **栄養バランス表示コンポーネントの改善**
   ```tsx
   // src/components/home/home-client.tsx
   const NutritionBalanceView = ({ nutritionData }) => {
     const allNutrientsZero = nutritionData?.nutrients?.every(n => n.progress === 0);
     
     return (
       <Card className="w-full overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.05)] rounded-[16px] border-none p-6">
         <div className="flex flex-col">
           <div className="flex items-center mb-4">
             <div className="relative w-20 h-20 flex-shrink-0 mr-6">
               <div
                 className="w-full h-full rounded-full flex items-center justify-center"
                 style={{
                   background: `conic-gradient(#2E9E6C ${Math.round(nutritionData?.overall_score || 0)}%, #EEEEEE ${Math.round(nutritionData?.overall_score || 0)}%)`
                 }}
               >
                 <div className="absolute top-[5px] left-[5px] right-[5px] bottom-[5px] bg-white rounded-full flex items-center justify-center">
                   <span className="text-[24px] font-extrabold text-[#363249]">{Math.round(nutritionData?.overall_score || 0)}</span>
                 </div>
               </div>
             </div>
             <div>
               <p className="text-[15px] font-medium text-gray-700">
                 {allNutrientsZero
                   ? '今日も元気に過ごしましょう！'
                   : nutritionData?.overall_score >= 70
                     ? '良好な栄養状態です！'
                     : nutritionData?.overall_score >= 50
                       ? '栄養バランスの改善が必要です'
                       : '栄養不足が心配されます'}
               </p>
             </div>
           </div>
           
           {/* 栄養素グリッド表示 */}
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
             {nutritionData?.nutrients?.filter(n => n.progress < 100).slice(0, 6).map((nutrient) => (
               <div key={nutrient.id} className="flex items-center">
                 <div className={`w-2 h-8 rounded-full mr-2 bg-[${getNutrientColor(nutrient.progress)}]`} />
                 <div>
                   <p className="text-[13px] font-medium text-[#363249]">{nutrient.name}</p>
                   <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
                     <div
                       className={`h-full rounded-full bg-[${getNutrientColor(nutrient.progress)}]`}
                       style={{ width: `${Math.min(nutrient.progress, 100)}%` }}
                     />
                   </div>
                 </div>
               </div>
             ))}
           </div>
           
           {/* 記録ボタン */}
           <Button
             className="w-full mt-6 bg-gradient-to-r from-[#2E9E6C] to-[#39B97E]"
             onClick={() => router.push('/nutrition/record')}
           >
             栄養を追加記録する <ArrowRight className="ml-2 w-4 h-4" />
           </Button>
         </div>
       </Card>
     );
   };
   ```

## 3. 実装の効果

### 3.1 ユーザー体験の向上
- ユーザーの状態に応じた最適な表示によりアプリの有用性が向上
- 新規ユーザーからアクティブユーザーまで、段階的なUI体験の提供
- 視覚的一貫性の確保によるユーザーの混乱防止

### 3.2 栄養状態の可視化改善
- ダッシュボードとホーム画面の栄養スコア表示の統一
- 円形の進捗表示による直感的な理解の促進
- 色分けされた栄養素表示による優先度の明確化

## 4. まとめ

ホーム画面の栄養バランス表示の改善により、ユーザーの状態（新規、毎日初回、記録済み）に応じた最適な情報提供が可能になりました。特に、初回ユーザー向けのオンボーディング表示と毎朝のファーストビュー表示を最適化することで、ユーザーエンゲージメントの向上が期待できます。

また、栄養バランス表示を元の直感的なデザインに戻すことで、ダッシュボードとの一貫性が確保され、ユーザーがより正確に自分の栄養状態を把握できるようになりました。円形進捗表示と色分けされた栄養素リストにより、一目で改善すべき栄養素がわかるようになっています。

これらの改善は、アプリの中核機能である栄養管理をより使いやすく、直感的にするための重要なステップであり、MVPリリースに向けた品質向上に貢献しています。


# InstagramとTikTokレシピクリップ機能の実装

## 概要
妊婦向け栄養管理アプリ「manmaru」の開発において、以下のソーシャルメディア連携機能を実装しました：

1. InstagramとTikTokからのレシピクリップ機能
2. ソーシャルメディア向けプレースホルダー画像表示機能
3. ディープリンク機能によるオリジナルコンテンツへの遷移
4. 手動栄養計算機能の統合

## 1. ソーシャルメディアURL解析機能の実装

### 1.1 ソーシャルメディア専用APIエンドポイント

#### 背景
- 従来のレシピサイトとは異なり、InstagramやTikTokはOGP情報の取得が困難
- ユーザーがソーシャルメディアのレシピも簡単にクリップできる仕組みが必要だった
- 栄養情報の手動追加が必要なUIが必要だった

#### 実施した変更
1. **ソーシャルメディア専用のAPI実装**
   ```typescript
   // src/app/api/recipes/parse-social-url/route.ts
   // ソーシャルメディアURLの解析
   export async function POST(req: Request) {
     try {
       const data = await req.json();
       const url = data.url;
       
       // URLからプラットフォームとコンテンツIDを抽出
       const { platform, contentId } = extractSocialMediaInfo(url);
       
       if (!platform || !contentId) {
         return NextResponse.json(
           { error: 'サポートされていないURLまたは不正なURLです' },
           { status: 400 }
         );
       }
       
       // レスポンスの構築
       return NextResponse.json({
         title: `${platform}のレシピ`,
         source_url: url,
         source_platform: platform,
         content_id: contentId,
         image_url: undefined, // プレースホルダー表示用
         ingredients: [],
         is_social_media: true
       });
     } catch (error) {
       return NextResponse.json(
         { error: 'URLの解析に失敗しました' },
         { status: 500 }
       );
     }
   }
   ```

2. **ソーシャルメディア情報抽出ユーティリティ**
   ```typescript
   // src/lib/utils/social-media.ts
   // InstagramとTikTokのURL解析
   export function extractSocialMediaInfo(url: string) {
     let platform: string | null = null;
     let contentId: string | null = null;
     
     // Instagram URL解析
     if (url.includes('instagram.com')) {
       platform = 'Instagram';
       // Instagram URLからIDを抽出
       const matches = url.match(/\/p\/([^\/]+)/) || url.match(/\/reel\/([^\/]+)/);
       contentId = matches ? matches[1] : null;
     }
     // TikTok URL解析
     else if (url.includes('tiktok.com')) {
       platform = 'TikTok';
       // TikTok URLからIDを抽出
       const matches = url.match(/\/video\/(\d+)/);
       contentId = matches ? matches[1] : null;
     }
     
     return { platform, contentId };
   }
   ```

## 2. ソーシャルメディア向けUI実装

### 2.1 スクリーンショットアップローダーコンポーネント

#### 背景
- サムネイル自動取得が難しいため、ユーザーがスクリーンショットをアップロードできる機能が必要だった
- アップロードしない場合のプレースホルダー表示も必要だった

#### 実施した変更
1. **スクリーンショットアップローダー実装**
   ```tsx
   // src/components/recipes/screenshot-uploader.tsx
   export const ScreenshotUploader: React.FC<ScreenshotUploaderProps> = ({ onImageCapture }) => {
     const [image, setImage] = useState<string | null>(null);
     
     const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files?.[0];
       if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
           const imageUrl = reader.result as string;
           setImage(imageUrl);
           onImageCapture(imageUrl);
         };
         reader.readAsDataURL(file);
       }
     };
     
     return (
       <div className="screenshot-uploader mb-6">
         <h3 className="text-sm font-medium mb-2">レシピのスクリーンショット</h3>
         {!image ? (
           <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
             <CameraIcon className="h-10 w-10 text-gray-400 mb-2" />
             <p className="text-sm text-gray-500">画像をアップロード</p>
             <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
           </label>
         ) : (
           <div className="relative">
             <img src={image} alt="Preview" className="w-full h-auto rounded-lg" />
             <Button 
               type="button" 
               variant="outline" 
               size="sm" 
               className="absolute top-2 right-2 bg-white"
               onClick={() => {
                 setImage(null);
                 onImageCapture(null);
               }}
             >
               変更
             </Button>
           </div>
         )}
       </div>
     );
   };
   ```

### 2.2 ソーシャルメディアプレースホルダー実装

#### 背景
- 画像がない場合でも、どのプラットフォームかを視覚的に伝える必要があった
- ブランドカラーを活用した直感的なデザインが必要だった

#### 実施した変更
1. **プラットフォーム専用プレースホルダー実装**
   ```tsx
   // src/components/recipes/social-media-placeholder.tsx
   export const SocialMediaPlaceholder: React.FC<SocialMediaPlaceholderProps> = ({
     platform,
     title
   }) => {
     // プラットフォームに応じた背景スタイル
     const getBgStyle = () => {
       if (platform === 'Instagram') {
         return 'bg-gradient-to-tr from-purple-500 via-pink-600 to-orange-400';
       }
       if (platform === 'TikTok') {
         return 'bg-black';
       }
       return 'bg-gray-200';
     };
     
     return (
       <div className={`social-media-placeholder mb-6 rounded-lg overflow-hidden ${getBgStyle()}`}>
         <div className="flex flex-col items-center p-6 text-white text-center">
           <div className="relative w-16 h-16 mb-4">
             <Image
               src={`/icons/${platform.toLowerCase()}.svg`}
               alt={platform}
               width={64}
               height={64}
               className="object-contain"
             />
           </div>
           <h3 className="text-xl font-semibold">{title}</h3>
           <p className="text-sm opacity-80 mt-1">{platform}のレシピ</p>
         </div>
       </div>
     );
   };
   ```

## 3. ディープリンク機能の実装

### 3.1 ソーシャルメディア専用ディープリンク

#### 背景
- モバイル端末ではアプリ内でコンテンツを開くことでUXを向上させる必要があった
- PCでは通常のブラウザで開く必要があった
- プラットフォームごとに異なるURLスキーマに対応する必要があった

#### 実施した変更
1. **ディープリンクユーティリティの実装**
   ```typescript
   // src/lib/utils/deep-link.ts
   export function openOriginalSocialMedia(url: string, platform: string | undefined, contentId: string | undefined) {
     if (!platform || !contentId) {
       window.open(url, '_blank');
       return;
     }
     
     // モバイル判定
     const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
     
     if (isMobile) {
       // プラットフォームごとのディープリンク
       if (platform === 'Instagram') {
         window.location.href = `instagram://media?id=${contentId}`;
         // フォールバック
         setTimeout(() => {
           window.location.href = url;
         }, 1000);
       } else if (platform === 'TikTok') {
         window.location.href = `tiktok://video/${contentId}`;
         // フォールバック
         setTimeout(() => {
           window.location.href = url;
         }, 1000);
       } else {
         window.open(url, '_blank');
       }
     } else {
       // PCの場合は通常のブラウザで開く
       window.open(url, '_blank');
     }
   }
   ```

2. **レシピ詳細画面への統合**
   ```tsx
   // src/app/(authenticated)/recipes/[id]/recipes-client.tsx
   // 元のレシピを開く
   const handleOpenOriginalRecipe = () => {
     if (isSocialMedia && recipe.content_id) {
       // ソーシャルメディアの場合はディープリンクを使用
       openOriginalSocialMedia(
         recipe.source_url,
         recipe.source_platform,
         recipe.content_id
       );
     } else {
       // 通常のレシピサイトの場合は新しいタブで開く
       window.open(recipe.source_url, '_blank');
     }
   };
   ```

## 4. 手動栄養計算機能の統合

### 4.1 ユーザー入力による栄養計算

#### 背景
- ソーシャルメディアからは栄養情報を自動取得できないため、手動入力が必要だった
- AIによる栄養素計算を保存時のみ行う効率的な処理が必要だった
- サービング数（何人前）に基づいた栄養計算が必要だった

#### 実施した変更
1. **手動材料入力フォームの実装**
   ```tsx
   // src/components/recipes/manual-ingredients-form.tsx
   export const ManualIngredientsForm: React.FC<ManualIngredientsFormProps> = ({
     ingredients,
     onChange,
     servings,
     onServingsChange
   }) => {
     // 空の材料を追加する関数
     const addIngredient = () => {
       const newIngredients = [
         ...ingredients,
         { name: '', quantity: '' }
       ];
       onChange(newIngredients);
     };
     
     // 材料を削除する関数
     const removeIngredient = (index: number) => {
       const newIngredients = ingredients.filter((_, i) => i !== index);
       onChange(newIngredients);
     };
     
     // 人数の変更
     const handleServingsChange = (value: string) => {
       onServingsChange(Number(value));
     };
     
     return (
       <div className="manual-ingredients-form space-y-4">
         <div className="servings-selector mb-4">
           <label className="text-sm font-medium block mb-2">このレシピは何人前ですか？</label>
           <Select
             value={String(servings)}
             onValueChange={handleServingsChange}
           >
             <SelectTrigger className="w-full sm:w-40">
               <SelectValue placeholder="人数を選択" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="1">1人前</SelectItem>
               <SelectItem value="2">2人前</SelectItem>
               <SelectItem value="3">3人前</SelectItem>
               <SelectItem value="4">4人前</SelectItem>
               <SelectItem value="5">5人前</SelectItem>
               <SelectItem value="6">6人前</SelectItem>
             </SelectContent>
           </Select>
         </div>
         
         {/* 材料入力リスト */}
         <div className="ingredients-list">
           {/* ... 材料入力フォーム ... */}
         </div>
       </div>
     );
   };
   ```

2. **保存時のみの栄養計算処理**
   ```typescript
   // src/app/(authenticated)/recipes/clip/recipe-clip-client.tsx
   const handleSaveRecipe = async () => {
     if (!editedRecipe) return;
     
     setIsLoading(true);
     setError(null);
     
     try {
       // ソーシャルメディアの場合は保存前に最終的な栄養素計算を実行
       if (editedRecipe.is_social_media ||
           editedRecipe.source_platform === 'Instagram' ||
           editedRecipe.source_platform === 'TikTok') {
         
         try {
           // 有効な材料のみでAPIを呼び出し
           const validIngredients = editedRecipe.ingredients.filter(
             ing => ing.name && ing.name.trim() !== ''
           );
           
           if (validIngredients.length > 0) {
             const response = await fetch('/api/recipes/calculate-nutrients', {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
               },
               body: JSON.stringify({
                 ingredients: validIngredients,
                 servings: servings
               }),
             });
             
             if (response.ok) {
               const nutritionData = await response.json();
               if (nutritionData.success) {
                 // 栄養素データを更新
                 editedRecipe.nutrition_per_serving = nutritionData.nutrition_per_serving;
               }
             }
           }
         } catch (error) {
           console.error('栄養素計算エラー:', error);
           // エラーがあっても保存処理は続行
         }
       }
       
       // プレースホルダーフラグの設定
       if (editedRecipe.is_social_media) {
         editedRecipe.use_placeholder = usePlaceholder;
       }
       
       // レシピの保存処理
       const response = await fetch('/api/recipes/save', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           ...editedRecipe,
           servings: servings
         }),
       });
       
       // 保存後の処理
       // ...
     } catch (error) {
       console.error('保存エラー:', error);
       setError(error instanceof Error ? error.message : '予期せぬエラーが発生しました');
     } finally {
       setIsLoading(false);
     }
   };
   ```

## 5. データベース拡張

### 5.1 ソーシャルメディア対応のスキーマ拡張

#### 背景
- ソーシャルメディアの情報を保存するための追加フィールドが必要だった
- プレースホルダー表示を制御するフラグが必要だった

#### 実施した変更
1. **データベーススキーマの拡張**
   ```sql
   -- clipped_recipesテーブルにソーシャルメディア関連のカラムを追加
   ALTER TABLE clipped_recipes ADD COLUMN use_placeholder boolean DEFAULT false;
   ALTER TABLE clipped_recipes ADD COLUMN is_social_media boolean DEFAULT false;
   ALTER TABLE clipped_recipes ADD COLUMN content_id text;
   ```

## 6. 実装の効果

### 6.1 コンテンツ多様性の向上
- レシピソースの選択肢が大幅に拡大（従来のレシピサイトに加えてInstagramとTikTok）
- ビジュアル中心のコンテンツへのアクセスが可能に
- 最新のトレンドレシピへのアクセスが容易に

### 6.2 ユーザー体験の向上
- モバイル端末でのアプリ連携によるスムーズなコンテンツ閲覧
- プラットフォーム特有のビジュアルデザインによる直感的な理解
- ユーザーが自由に栄養情報を入力できる柔軟性

## 7. 今後の課題

### 7.1 サムネイル自動取得の検討
- OGP情報やAPI連携による公式サムネイル画像の取得可能性の調査
- 権利関係を考慮したコンテンツ表示の最適化
- キャッシュ戦略によるパフォーマンス向上

### 7.2 栄養計算の精度向上
- AIによる画像解析を用いた材料の自動推定機能の検討
- より詳細な栄養情報の提供
- ユーザーフィードバックに基づく継続的な改善

## 8. まとめ

InstagramとTikTokのレシピクリップ機能の実装により、ユーザーはより多様なソースからレシピを収集できるようになりました。特にソーシャルメディア上で人気の妊娠中の方に適した健康的なレシピへのアクセスが容易になり、アプリの価値が大きく向上しました。

プレースホルダー表示機能とディープリンク機能の組み合わせにより、ユーザーは簡単にオリジナルコンテンツにアクセスしつつ、栄養情報を手動で追加することが可能になりました。これにより、妊婦の方々がより多様なレシピの栄養価を理解し、バランスの取れた食事計画を立てる手助けとなることが期待されます。

この機能は、MVPリリースに向けた重要な拡張であり、ユーザーが食事の多様性を高めながら栄養管理をサポートする役割を果たします。

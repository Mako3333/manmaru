# manmaruプロジェクト フェーズ4前改善計画

いただいた問題点と改善案を精査し、フェーズ4（レシピ提案機能）に進む前に対応すべき項目を整理しました。以下に優先順位別の具体的な改善計画を提案します。

## 優先度マトリクス

| 優先度 | 実装難易度 | タスク内容 |
|-----|-----|-----|
| 🔴 高 | 🔧 中 | 栄養状態サマリー・バランススコアの機能修正 |
| 🔴 高 | 🔧 低 | 「食事を記録」ボタンのUI改善 |
| 🔴 高 | 🔧 中 | 写真記録のレスポンスを日本語化 |
| 🟠 中 | 🔧 中 | プロフィール登録と妊娠周数計算の矛盾解消 |
| 🟠 中 | 🔧 低 | Pregnancy_Week_info_cardのモダン化 |
| 🟠 中 | 🔧 低 | AIアドバイスのマークダウン対応 |
| 🟢 低 | 🔧 低 | 週間・月間タブの「実装中」表示 |
| 🟢 低 | 🔧 高 | AIアドバイス更新システムの設計 |
| 🟢 低 | 🔧 高 | 食材抽出ロジックの統一検討 |

## 実装計画（5STEP）

### STEP 1: 栄養計算バグ修正（最優先）

#### 1. 栄養状態サマリー・バランススコア修正
- **原因調査**: 
  ```typescript
  // src/hooks/useNutrition.ts
  // 食事データ取得後の栄養値計算ロジックを確認
  export function useNutritionSummary(date: string) {
    const [summary, setSummary] = useState<NutritionSummary | null>(null);
    
    useEffect(() => {
      async function fetchData() {
        try {
          const response = await fetch(`/api/meals/summary?date=${date}`);
          if (!response.ok) throw new Error('Failed to fetch nutrition summary');
          const data = await response.json();
          setSummary(data);
        } catch (error) {
          console.error('Error fetching nutrition summary:', error);
        }
      }
      
      fetchData();
    }, [date]);
    
    return summary;
  }
  ```

- **修正案**:
  ```typescript
  // サマリーAPIの修正
  // src/app/api/meals/summary/route.ts
  // 食事登録後にこのAPIが正しいデータを返すよう修正
  
  // 依存関係の更新
  // meal_nutrientsテーブルからの読み取り確認
  // ダッシュボードコンポーネントでのデータ更新トリガー追加
  ```

#### 2. 食事記録ボタンのUI改善
- **現状確認**:
  ```tsx
  // src/components/home/home-client.tsx
  // 現在の実装を確認
  <div className="grid gap-4">
    <ActionCard
      title="食事を記録"
      description="食事の写真や内容を記録して栄養バランスを分析します"
      icon={<Utensils />}
      onClick={() => router.push('/meals/log')}
    />
    // 他のカード
  </div>
  ```

- **改善案**:
  ```tsx
  // モダンでより目立つボタンデザインに変更
  <div className="mb-6">
    <Button 
      onClick={() => router.push('/meals/log')}
      className="w-full py-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg"
    >
      <div className="flex items-center justify-center">
        <Utensils className="mr-2 h-6 w-6" />
        <span className="text-lg font-medium">食事を記録する</span>
      </div>
    </Button>
  </div>
  ```

### STEP 2: UI改善 - ホーム画面

#### 1. Pregnancy_Week_info_cardのモダン化
- **現状確認**:
  ```tsx
  // src/components/home/pregnancy-week-info.tsx
  // 現在の実装を確認
  ```

- **改善案**:
  ```tsx
  // モダンなカードデザインに変更
  export function PregnancyWeekInfo({ week }: { week: number }) {
    // 妊娠期の計算
    const trimester = week <= 13 ? 1 : week <= 27 ? 2 : 3;
    
    return (
      <Card className="overflow-hidden border-none shadow-md bg-gradient-to-r from-indigo-50 to-blue-50">
        <CardContent className="p-0">
          <div className="flex">
            <div className="p-4 flex-1">
              <h3 className="text-lg font-medium text-gray-800">妊娠 {week} 週目</h3>
              <p className="text-sm text-gray-600">第{trimester}期</p>
              
              <div className="mt-3">
                <Progress value={(week / 40) * 100} className="h-2" />
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>0週</span>
                  <span>40週</span>
                </div>
              </div>
            </div>
            <div className="w-24 flex items-center justify-center bg-gradient-to-r from-blue-100 to-indigo-100">
              <div className="text-center">
                <span className="block text-3xl font-bold text-indigo-600">{week}</span>
                <span className="text-xs text-indigo-700">週目</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  ```

#### 2. 写真記録時のレスポンスの日本語化
- **原因調査**:
  - AI応答のプロンプトが英語を誘導している可能性
  - プロンプト内の指示や条件を確認

- **修正案**:
  ```typescript
  // src/lib/ai/prompts/templates/food-analysis/v1.ts
  // プロンプトに日本語応答を明示的に指定
  export const template = `
  あなたは日本の栄養士AIアシスタントです。この食事の写真から含まれている食品を識別してください。
  食事タイプは「{{mealType}}」です。
  {{#if trimester}}妊娠第{{trimester}}期の栄養素に特に注目してください。{{/if}}
  
  以下の形式で必ず日本語でJSON形式の応答を返してください:
  {
    "foods": [
      {"name": "食品名（日本語）", "quantity": "量の目安（日本語）", "confidence": 信頼度(0.0-1.0)}
    ],
    "nutrition": {
      "calories": カロリー推定値,
      "protein": タンパク質(g),
      "iron": 鉄分(mg),
      "folic_acid": 葉酸(μg),
      "calcium": カルシウム(mg),
      "vitamin_d": ビタミンD(μg),
      "confidence_score": 信頼度(0.0-1.0)
    }
  }
  
  食品名は必ず日本語で返してください。量の目安も日本語で表現してください。
  例: "Rice" → "ご飯"、"100g" → "お茶碗1杯分"
  回答は必ずこのJSONフォーマットのみで返してください。
  `;
  ```

### STEP 3: プロフィール & AIアドバイス改善

#### 1. プロフィール登録と妊娠周数計算の矛盾解消
- **問題分析**:
  - 妊娠周数の手動入力と自動計算の不一致
  - 出産予定日と妊娠周数の関連付け

- **解決案**:
  ```tsx
  // src/components/profile/profile-form.tsx
  // 妊娠周数入力を出産予定日入力に置き換え、自動計算に一本化
  
  // 出産予定日からの自動計算
  function calculatePregnancyWeek(dueDate: string): number {
    const today = new Date();
    const due = new Date(dueDate);
    const timeDiff = due.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return Math.max(1, Math.min(40, 40 - Math.floor(daysDiff / 7)));
  }
  
  // プロフィールフォームの修正
  <div className="grid gap-4">
    <div className="space-y-2">
      <Label htmlFor="dueDate">出産予定日</Label>
      <Input
        id="dueDate"
        type="date"
        value={dueDate}
        onChange={(e) => {
          setDueDate(e.target.value);
          // 妊娠周数を自動計算（表示のみ）
          const week = calculatePregnancyWeek(e.target.value);
          setCalculatedWeek(week);
        }}
      />
      {calculatedWeek > 0 && (
        <p className="text-sm text-gray-500">
          現在の妊娠週数: {calculatedWeek}週目（自動計算）
        </p>
      )}
    </div>
    // その他のフィールド
  </div>
  ```

#### 2. AIアドバイスのマークダウン対応
- **現状確認**:
  ```tsx
  // src/components/dashboard/nutrition-advice.tsx
  // 現在の実装を確認
  <div className="prose prose-sm max-w-none">
    <p>{advice}</p>
  </div>
  ```

- **改善案**:
  ```tsx
  // マークダウンレンダリングライブラリの導入（例：react-markdown）
  // package.jsonに追加
  // "react-markdown": "^9.0.0",
  
  // コンポーネントの修正
  import ReactMarkdown from 'react-markdown';
  
  // レンダリング部分
  <div className="prose prose-sm max-w-none">
    <ReactMarkdown>{advice}</ReactMarkdown>
  </div>
  ```

### STEP 4: ダッシュボード改善

#### 1. 週間・月間タブの「実装中」表示
- **現状確認**:
  ```tsx
  // src/components/dashboard/tabs-container.tsx
  // 現在の実装を確認
  <Tabs defaultValue="daily">
    <TabsList>
      <TabsTrigger value="daily">日別</TabsTrigger>
      <TabsTrigger value="weekly">週間</TabsTrigger>
      <TabsTrigger value="monthly">月間</TabsTrigger>
    </TabsList>
    <TabsContent value="daily">
      // 日別コンテンツ
    </TabsContent>
    <TabsContent value="weekly">
      // 空または未実装
    </TabsContent>
    <TabsContent value="monthly">
      // 空または未実装
    </TabsContent>
  </Tabs>
  ```

- **改善案**:
  ```tsx
  // 未実装タブのコンテンツを追加
  <TabsContent value="weekly">
    <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed rounded-lg bg-gray-50">
      <ClockIcon className="h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-700">実装中</h3>
      <p className="text-sm text-gray-500 text-center mt-2">
        週間レポート機能は現在開発中です。<br />
        次回のアップデートをお待ちください。
      </p>
    </div>
  </TabsContent>
  
  <TabsContent value="monthly">
    <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed rounded-lg bg-gray-50">
      <CalendarIcon className="h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-700">実装中</h3>
      <p className="text-sm text-gray-500 text-center mt-2">
        月間レポート機能は現在開発中です。<br />
        次回のアップデートをお待ちください。
      </p>
    </div>
  </TabsContent>
  ```

#### 2. AIアドバイス更新システムの設計
- **概念設計**:
  1. 更新トリガーの定義
     - 日付変更時
     - 栄養状態の大きな変化時
     - 妊娠周数の変化時
  
  2. 過去アドバイスの管理
     - 過去7日分を保持
     - 古いアドバイスを自動アーカイブ
  
  3. テーブル設計
     ```sql
     CREATE TABLE nutrition_advice_history (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
       advice_date DATE NOT NULL,
       advice_type TEXT NOT NULL,
       advice_content TEXT NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       archived BOOLEAN DEFAULT FALSE,
       UNIQUE(user_id, advice_date, advice_type)
     );
     ```

### STEP 5: 食材抽出ロジック検討 & 総合テスト

#### 1. 食材抽出ロジックの統一検討
- **現状分析**:
  - 写真入力: 食材単位での登録と栄養素計算
  - テキスト入力: 料理名での登録と栄養素検索

- **アプローチ案**:
  1. ハイブリッドアプローチ
     - ユーザーの入力方法に応じて最適な処理を選択
     - 写真入力: 食材分解型（現状維持）
     - テキスト入力: 食材/料理名の両方に対応/databese.tsの拡充

  2. AIプロンプト改善
     ```typescript
     // 写真分析プロンプト
     export const photoAnalysisTemplate = `
     この食事の写真から料理と含まれる食材を識別し、可能な限り正確に栄養素を推定してください。
     まず料理名を特定し、次に含まれる主要な食材を分析してください。
     
     例:
     写真がカツ丼の場合:
     - 料理名: カツ丼
     - 食材: とんかつ(120g), ご飯(200g), 卵(50g), 玉ねぎ(30g)
     
     食事タイプは「{{mealType}}」です。
     
     以下の形式でJSON形式の応答を返してください:
     {
       "dish_name": "料理名（日本語）",
       "foods": [
         {"name": "食品名（日本語）", "quantity": "量の目安（日本語）", "confidence": 信頼度(0.0-1.0)}
       ],
       "nutrition": {
         // 栄養素情報
       }
     }
     `;
     
     // テキスト分析プロンプト
     export const textAnalysisTemplate = `
     以下のテキスト入力から料理や食品を識別し、栄養素を推定してください。
     入力テキスト: {{foodsText}}
     
     入力が料理名（例: カツ丼）の場合は、その料理に含まれる一般的な食材を推測してください。
     入力が食材リスト（例: ごはん、みそ汁、納豆）の場合は、各食材の一般的な量を推測してください。
     
     以下の形式でJSON形式の応答を返してください:
     {
       "is_dish": true/false, // 料理名の場合はtrue、食材リストの場合はfalse
       "dish_name": "料理名（日本語）", // is_dishがtrueの場合のみ
       "foods": [
         {"name": "食品名（日本語）", "quantity": "量の目安（日本語）", "confidence": 信頼度(0.0-1.0)}
       ],
       "nutrition": {
         // 栄養素情報
       }
     }
     `;
     ```

#### 2. 総合テストと調整
- **テスト項目**:
  1. 栄養状態サマリーの更新確認
  2. UI改善の視覚的確認
  3. プロフィール登録と妊娠周数計算の整合性チェック
  4. AIアドバイスのマークダウン表示確認
  5. 日本語レスポンス確認

- **フィードバック収集と調整**:
  - 開発チーム内でのユーザビリティテスト
  - 改善点の洗い出しと微調整

## 技術的特記事項

1. **Next.js 15.2.0とReact 19の互換性**
   - React 19の新機能（useFormStatus, useActionなど）の活用検討
   - Server Componentsの適切な活用

2. **モバイルファーストデザイン**
   - すべてのUI改善はモバイル表示を最優先
   - Touch Targetの適切なサイズ確保（最低44x44px）

3. **AI機能の最適化**
   - プロンプトの日本語指定による応答品質向上
   - コンテキスト（妊娠周数、季節など）の最適活用

4. **パフォーマンス考慮**
   - 不必要なレンダリング防止（useMemo, useCallback）
   - API呼び出しの最適化（キャッシュ戦略）

## フェーズ4への接続計画

改善完了後、フェーズ4（レシピ提案機能）へスムーズに移行するための準備：

1. **データ構造の拡張**
   - レシピテーブルの設計
   - 食材と栄養素のマッピングテーブル準備

2. **AIプロンプト準備**
   - レシピ提案用プロンプトテンプレートの作成
   - 不足栄養素に基づく食材選定ロジック

3. **UI設計**
   - レシピカードコンポーネントの設計
   - レシピ詳細ページのワイヤーフレーム作成

```mermaid
flowchart TD
    Start([ユーザー]) --> A[食事記録ページ表示 /meals/log/page.tsx]

    A --> B1{入力モード選択}
    B1 -->|写真モード| C1[MealPhotoInput: 写真撮影/選択]
    B1 -->|テキストモード| D1[食品入力フォーム: addFoodItem]

    C1 --> C2[handlePhotoCapture: 画像キャプチャ]
    C2 --> C3[analyzePhoto: 画像解析API呼び出し]

    D1 --> D2[食品リスト管理: setFoodItems]

    C3 --> E1[analyzeMealPhoto: API呼び出し]
    E1 --> E2[/api/analyze-meal/route.ts: POST処理]

    E2 --> F1[Geminiモデル呼び出し: createGeminiModel]
    F1 --> F2[画像解析: createMultiModalMessage]
    F2 --> F3[食品検出: DetectedFoodsSchema]
    F3 --> F4[栄養素計算: calculateNutrition]

    F4 --> G1[栄養データ返却]

    G1 --> H1[RecognitionEditor: 検出結果表示・編集]
    D2 --> H2[テキスト入力結果]

    H1 --> I1[handleSaveRecognition: 写真モード保存]
    H2 --> I2[handleSaveTextInput: テキストモード保存]

    I1 --> J1[/api/meals/route.ts: POST処理]
    I2 --> J1

    J1 --> K1[Supabaseへ保存: mealsテーブル]
    K1 --> L1[/api/update-nutrition-log/route.ts: 栄養ログ更新]

    L1 --> M1[栄養摂取計算: calculateDailyNutrition]
    M1 --> M2[不足栄養素特定: identifyDeficientNutrients]
    M2 --> M3[daily_nutrition_logsテーブルに保存]

    M3 --> End([ホーム画面へリダイレクト])
```

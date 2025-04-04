## AIモデル・プロンプト管理システム 詳細ドキュメント

### 1. 概要

本システムは、「manmaru」アプリケーションにおいて、AI（主にGoogle Gemini）を活用した機能（食事解析、レシピ解析、将来的な栄養アドバイスやレシピ推薦など）を実現するための中核コンポーネント群です。ユーザー入力（画像、テキスト、URL）や内部データに基づき、適切なプロンプトを動的に生成し、AIモデルとの連携、応答の解析、エラーハンドリングなどを担当します。モジュール化された設計により、保守性、拡張性、および異なるAIモデルへの対応可能性を考慮しています。

### 2. システムアーキテクチャ

AI関連機能の主要コンポーネントとデータフローは以下の通りです。

```mermaid
flowchart TD
    subgraph "API Layer (route.ts)"
        API_MEAL_IMAGE["/api/v2/meal/analyze (画像)"]
        API_MEAL_TEXT["/api/v2/meal/text-analyze (テキスト)"]
        API_RECIPE["/api/v2/recipe/parse (レシピ)"]
        %% 他の潜在的なAPI (将来)
        %% API_NUTRITION_ADVICE["/api/v2/nutrition/advice"]
        %% API_RECIPE_RECOMMEND["/api/v2/recipe/recommend"]
    end

    subgraph "AI Service Layer (src/lib/ai)"
        FACTORY[AIServiceFactory]
        SERVICE_INTF(IAIService)
        GEMINI_SVC[GeminiService]
        %% MOCK_SVC["MockAIService (未実装)"]
    end

    subgraph "Prompt Management (src/lib/ai/prompts)"
        PROMPT_SVC[PromptService]
        VERSION_MGR[PromptVersionManager]
        TEMPLATE_ENGINE[TemplateEngine]
        TEMPLATES["food-analysis/v1.ts<br>text-input-analysis/v1.ts<br>recipe-url-analysis/v1.ts<br>nutrition-advice/v1.ts (未実装)<br>recipe-recommendation/v1.ts (未使用)"]
    end

    subgraph "AI Model Core (src/lib/ai/core)"
        MODEL_SVC[AIModelService]
        MODEL_FACTORY[AIModelFactory]
        MODEL_INTF(AIModel)
    end

    subgraph "External Services"
        GEMINI_API["Google Gemini API"]
    end

    subgraph "AI Response Handling (src/lib/ai)"
        PARSER[GeminiResponseParser]
    end

    subgraph "Error Handling (src/lib/error)"
        AI_ERRORS["ai-errors.ts"]
        APP_ERROR["base-error.ts"]
        ERROR_HANDLER["統合エラーハンドラ<br>(middleware.ts)"]
    end

    %% Connections
    API_MEAL_IMAGE & API_MEAL_TEXT & API_RECIPE --> FACTORY
    FACTORY -- "getService(GEMINI)" --> GEMINI_SVC
    GEMINI_SVC -- "implements" --> SERVICE_INTF

    GEMINI_SVC --> PROMPT_SVC
    PROMPT_SVC --> VERSION_MGR
    PROMPT_SVC --> TEMPLATE_ENGINE
    VERSION_MGR --> TEMPLATES
    TEMPLATE_ENGINE --> TEMPLATES
    PROMPT_SVC -- "生成されたプロンプト" --> GEMINI_SVC

    GEMINI_SVC --> MODEL_SVC
    MODEL_SVC --> MODEL_FACTORY
    MODEL_FACTORY -- "createVisionModel/createTextModel" --> MODEL_INTF
    MODEL_SVC -- "invokeVision/invokeText" --> MODEL_INTF
    MODEL_INTF -- "Gemini API Call" --> GEMINI_API
    GEMINI_API -- "応答" --> MODEL_INTF
    MODEL_INTF -- "生応答" --> MODEL_SVC
    MODEL_SVC -- "生応答" --> GEMINI_SVC

    GEMINI_SVC --> PARSER
    PARSER -- "解析結果 (GeminiParseResult)" --> GEMINI_SVC
    GEMINI_SVC -- "処理結果 (GeminiProcessResult)" --> API_MEAL_IMAGE & API_MEAL_TEXT & API_RECIPE

    %% Error Handling Connections
    MODEL_SVC -- "エラー発生" --> APP_ERROR
    GEMINI_SVC -- "エラー発生" --> APP_ERROR
    PARSER -- "エラー発生" --> APP_ERROR
    APP_ERROR -- "継承" --> AI_ERRORS
    API_MEAL_IMAGE & API_MEAL_TEXT & API_RECIPE -- "エラー捕捉" --> ERROR_HANDLER

    classDef default fill:#f9f,stroke:#333,stroke-width:2px;
    classDef api fill:#ccf,stroke:#333,stroke-width:2px;
    classDef service fill:#cfc,stroke:#333,stroke-width:2px;
    classDef core fill:#fcf,stroke:#333,stroke-width:2px;
    classDef prompt fill:#ffc,stroke:#333,stroke-width:2px;
    classDef external fill:#ccc,stroke:#333,stroke-width:2px;
    classDef error fill:#fcc,stroke:#333,stroke-width:2px;

    class API_MEAL_IMAGE,API_MEAL_TEXT,API_RECIPE api;
    class FACTORY,SERVICE_INTF,GEMINI_SVC service;
    class PROMPT_SVC,VERSION_MGR,TEMPLATE_ENGINE,TEMPLATES prompt;
    class MODEL_SVC,MODEL_FACTORY,MODEL_INTF core;
    class GEMINI_API external;
    class PARSER service;
    class AI_ERRORS,APP_ERROR,ERROR_HANDLER error;
```

### 3. 主要コンポーネント詳細

#### 3.1. AIサービスレイヤー (`src/lib/ai`)

*   **`ai-service.interface.ts` (`IAIService`)**: AIサービスが提供すべき機能（画像解析、テキスト解析、レシピURL解析、栄養アドバイス取得など）のインターフェースを定義します。
    *   **課題**: 現在、各メソッドの戻り値が `any` や Gemini 固有の型 (`GeminiParseRecipeResult`) になっており、抽象化が不完全です。将来的に汎用的な結果型（例: `MealAnalysisResult`, `RecipeAnalysisResult`）を定義し、インターフェースを実装に依存しない形に修正することが推奨されます。
*   **`ai-service-factory.ts` (`AIServiceFactory`)**: `IAIService` を実装する具体的なサービスクラスのインスタンスを生成・管理するファクトリクラスです。シングルトンパターンで実装されており、`getService` メソッドで指定されたタイプ（現在は `GEMINI` のみ、`MOCK` は未実装）のサービスインスタンスを返します。
*   **`services/gemini-service.ts` (`GeminiService`)**: `IAIService` インターフェースの Google Gemini 実装です。主要な責務は以下の通りです。
    *   コンストラクタで設定（APIキー、モデル名、温度など）を初期化し、`PromptService`, `AIModelService`, `GeminiResponseParser` のインスタンスを準備します。
    *   各解析メソッド (`analyzeMealImage`, `analyzeMealText`, `parseRecipeFromUrl`) では、`PromptService` を使用して適切なプロンプトを生成します。
    *   `AIModelService` を呼び出して、生成したプロンプトと入力データ（画像、テキスト）を Gemini API に送信します。
    *   Gemini API からの生応答を `GeminiResponseParser` で解析し、構造化データ (`GeminiParseResult`) を取得します。
    *   処理結果（解析結果、生応答、処理時間、エラー情報）を `GeminiProcessResult` 型にまとめて返します。
    *   `parseRecipeFromUrl` では、内部で `fetch` を使用して指定されたURLからHTMLコンテンツを取得し、簡単な前処理（script/styleタグ除去、文字数制限）を行った上でAIに渡します。
    *   `getNutritionAdvice` は現在未実装です（TODOコメントあり）。
    *   各メソッド内で `try-catch` によるエラーハンドリングを行い、エラー発生時はエラー情報を含む `GeminiProcessResult` を返します。
*   **`gemini-service.ts` (ルート直下)**: `services/gemini-service.ts` の古いバージョンと考えられます。`parseRecipeFromUrl` や `getNutritionAdvice` メソッドがなく、設定値やログ出力も異なります。**削除することが推奨されます。**

#### 3.2. AIモデルコア (`src/lib/ai/core`)

*   **`ai-model-factory.ts` (`AIModelFactory`, `AIModel`, `ModelOptions`)**: AIモデルの生成と抽象化を担当します。
    *   `AIModel` インターフェース: `invoke(prompt)` とオプショナルな `invokeWithImageData(prompt, imageData)` メソッドを定義し、モデルの基本的な操作を抽象化します。
    *   `ModelOptions` インターフェース: モデルの挙動を制御するパラメータ（temperature, maxOutputTokens など）を定義します。
    *   `AIModelFactory`: 静的メソッド (`createTextModel`, `createVisionModel`) を提供し、指定されたオプションに基づいて `AIModel` インターフェースに準拠したモデルインスタンスを生成します。現在は内部で Google Gemini API (`@google/generative-ai`) を使用し、モデル名 (`gemini-1.5-flash` または `gemini-pro-vision`) と設定を適用して返します。APIキーは環境変数 `GEMINI_API_KEY` から読み込みます。
*   **`ai-model-service.ts` (`AIModelService`)**: `AIModelFactory` を利用してモデルインスタンスを取得し、実際にAIモデルとの対話を行うサービスクラスです。
    *   `invokeText`: テキスト生成モデルを呼び出します。
    *   `invokeVision`: 画像認識モデル（Visionモデル）を呼び出します。
    *   `handleAIError`: AIモデル呼び出し時に発生したエラーを共通的に処理します。エラーが `AppError` インスタンスでない場合、エラーメッセージの内容（timeout, quota, network, permissionなど）に基づいて適切な `ErrorCode` (例: `ErrorCode.AI.MODEL_ERROR`, `ErrorCode.Base.NETWORK_ERROR`) を持つ `AppError` インスタンスに変換して再スローします。

#### 3.3. プロンプト管理システム (`src/lib/ai/prompts`)

*   **`prompt-service.ts` (`PromptService`, `PromptType`)**: プロンプト生成の中心的な役割を担うサービスクラスです。シングルトンで実装されています。
    *   `PromptType` enum: プロンプトの種類（食事分析、テキスト入力分析、レシピURL分析など）を定義します。
    *   コンストラクタで `PromptVersionManager` のインスタンスを取得し、`registerPromptTemplates` メソッドを呼び出して、各ユースケースのプロンプトテンプレートをバージョンマネージャーに登録します。
    *   `generatePrompt` (および各ユースケース専用の `generate...Prompt` メソッド): 指定された `PromptType` とコンテキストデータ (`context`) に基づき、`PromptVersionManager` から適切なバージョンのテンプレート文字列を取得し、`TemplateEngine` でコンテキストデータを埋め込んで最終的なプロンプト文字列を生成して返します。
    *   テンプレートの登録は `require` を使用して動的に行われます。
*   **`template-engine.ts` (`TemplateEngine`)**: ハンドルバーライクな構文 (`{{variable}}`, `{{#if}}`, `{{#each}}`, `{{this}}`, `{{@index}}`) を解釈し、プロンプトテンプレート文字列にコンテキストデータを埋め込む静的クラスです。
    *   `render`: メインのレンダリングメソッド。ネストされたブロック（ループ、条件）を再帰的に処理し、最終的に変数置換を行います。無限ループ防止のための最大反復回数チェックも含まれています。
*   **`version-manager.ts` (`PromptVersionManager`, `PromptMetadata`, `PromptVersion`)**: プロンプトテンプレートのバージョン管理を行います。シングルトンで実装されています。
    *   `PromptMetadata`: プロンプトのID, 名前, 説明, カテゴリ, バージョンリスト, パラメータ, デフォルトバージョンなどのメタデータを定義します。
    *   `PromptVersion`: 各バージョンのID, バージョン番号, 作成/更新日時, アクティブ状態, 変更履歴などを定義します。
    *   `registerPrompt`: `PromptService` から呼び出され、プロンプトのメタデータを内部レジストリに登録します。
    *   `getPromptTemplate`: 指定されたプロンプトIDとバージョン（指定がなければアクティブまたはデフォルトバージョン）に対応するテンプレート文字列を `require` を用いて動的に読み込み、返します。
*   **`prompt-utils.ts`**: 現在は未使用のようです（`PromptTemplate` 型が定義されていますが、`recipe-url-analysis/v1.ts` ではインラインで定義されています）。
*   **`templates/`**: 各ユースケース (`food-analysis`, `text-input-analysis` など) とバージョン (`v1`) ごとにプロンプトテンプレートファイル (`.ts`) が格納されています。各ファイルは `template` 文字列と `metadata` オブジェクトをエクスポートします。

#### 3.4. レスポンスパーサー (`src/lib/ai`)

*   **`gemini-response-parser.ts` (`GeminiResponseParser`, `GeminiParseResult`)**: Gemini API からの応答（主にテキスト形式）を解析し、構造化されたデータ (`GeminiParseResult`) に変換するクラスです。
    *   `GeminiParseResult`: 解析結果の型。`foods` (`FoodInputParseResult[]`), `confidence`, `title`, `servings`, `error`, `debug` などのプロパティを持ちます。
    *   `parseResponse`: 主な解析メソッド。応答テキストから ```json ... ``` コードブロックを正規表現で抽出します。見つからない場合は、応答全体がJSONである可能性を試します。抽出したJSON文字列をパースし、キーの存在 (`title`/`servings`/`ingredients` または `foods`) によってレシピ解析結果か食事/テキスト解析結果かを判断し、対応する `GeminiParseResult` オブジェクトを構築して返します。JSONの抽出やパースに失敗した場合、または予期しない構造の場合は、`error` プロパティにエラーメッセージを設定して返します。
    *   **課題**: レシピ解析結果として `title` と `servings` をパースできますが、画像解析プロンプト (`food-analysis/v1`) が期待する `nutrition` オブジェクトのパースには現在対応していません。

#### 3.5. エラーハンドリング (`src/lib/error`)

*   **`types/ai-errors.ts`**: `AppError` を継承し、AI関連の具体的なエラー (`AIAnalysisError`, `AIParsingError`, `ImageProcessingError`, `AIApiRequestError`) を定義します。それぞれ固有のエラーコード、ユーザー向けメッセージ、詳細情報、推奨される解決策を持ちます。
*   **`codes/error-codes.ts`**: `ErrorCode.AI` ネームスペース以下に、AI関連のエラーコードが定義されています。
*   **`core/ai-model-service.ts` (`handleAIError`)**: AIモデル呼び出し時の低レベルなエラー（ネットワークエラー、タイムアウト、APIキーエラーなど）を捕捉し、適切な `ErrorCode` を持つ `AppError` に変換します。
*   **`services/gemini-service.ts`**: 各メソッド内で `try-catch` を使用し、`AIModelService` や `GeminiResponseParser` からスローされた `AppError` やその他のエラーを捕捉し、エラー情報を含む `GeminiProcessResult` を生成します。
*   **API Route Handlers (`src/app/api/...`)**: `GeminiService` から返された `GeminiProcessResult` の `error` プロパティを確認し、エラーがあれば統合エラーハンドラ (`middleware.ts` 内の `withErrorHandling`) に処理を委譲するか、適切なエラーレスポンスを生成します。

### 4. プロンプトテンプレート解説

`src/lib/ai/prompts/templates/` 以下に格納されている主要なプロンプトテンプレート (v1) の概要です。

*   **食品分析 (画像) (`food-analysis/v1.ts`)**: 食事の写真から食品名、量の目安、信頼度を識別し、さらに栄養素の推定値（カロリー、タンパク質など）も要求するプロンプト。JSON形式での出力を期待。
    *   **現状**: `GeminiResponseParser` は `foods` 部分のみを解析し、`nutrition` 部分は無視しています。
*   **テキスト入力分析 (`text-input-analysis/v1.ts`)**: ユーザーが入力した食事テキストから食品名、量、信頼度を識別するプロンプト。料理名を主要食材に分解する指示も含まれます。JSON形式での出力を期待。
    *   **現状**: `GeminiResponseParser` はこの形式に対応しています。
*   **レシピURL分析 (`recipe-url-analysis/v1.ts`)**: ウェブページのHTMLコンテンツ（テキストとして渡される）からレシピのタイトル、何人分か、材料リスト（名前、分量）を抽出するプロンプト。JSON形式での出力を期待。
    *   **現状**: `GeminiResponseParser` はこの形式に対応しています。テンプレートファイルの構造が他のテンプレートと異なり、`prompt` が関数になっていますが、`PromptVersionManager` での `require` 経由での読み込みは機能しているようです。
*   **栄養アドバイス (`nutrition-advice/v1.ts`)**: 妊娠週数、不足栄養素、過去データ、季節などを考慮して、栄養アドバイス（要約、詳細、推奨食品）を生成するプロンプト。JSON形式での出力を期待。
    *   **現状**: `GeminiService.getNutritionAdvice` が未実装のため、**このプロンプトは使用されていません。**


### 5. 追加機能の状況

ディレクトリ構造からは存在が示唆されるものの、現状機能していない、または実装されていない機能があります。

*   **A/Bテスト (`src/lib/ai/prompts/ab-testing/`)**: ディレクトリは存在しますが、具体的なテスト戦略を定義するファイル (`test-strategies/`) が空であり、`PromptService` や `VersionManager` にもA/Bテストを実行するロジックは見当たりません。**未実装**と判断されます。
*   **メトリクス収集 (`src/lib/ai/prompts/metrics/`)**: `metric-collector.ts` ファイルは存在しますが、中身が空（1行のみ）です。プロンプトのパフォーマンスや利用状況を追跡する機能は**未実装**です。

### 6. 注意点・改善点

*   **型の不整合と抽象化**: `IAIService` インターフェースの戻り値に `any` や実装依存の型が使用されており、抽象化が不完全です。汎用的な結果型を定義し、インターフェースを修正すべきです。
*   **未実装・未使用機能**: 栄養アドバイス機能 (`getNutritionAdvice`)、レシピ推薦機能、プロンプトのA/Bテスト、メトリクス収集は未実装または未使用の状態です。これらを実装するか、不要であれば関連コードを削除することが推奨されます。
*   **Parserとプロンプトの期待値のズレ**: 画像解析プロンプト (`food-analysis/v1`) は `nutrition` 情報の出力を要求していますが、`GeminiResponseParser` はこれを解析していません。プロンプト側を修正するか、Parser側を拡張して対応する必要があります。
*   **URL解析の限界**: `GeminiService.parseRecipeFromUrl` でのHTML前処理は単純なタグ除去と文字数制限のみです。複雑なサイト構造やJavaScriptで動的に生成されるコンテンツには対応が難しく、精度が低下する可能性があります。より高度なHTMLクリーンアップライブラリ（例: `jsdom` でのレンダリング、`readability`）の導入や、専用パーサー（`src/lib/recipe-parsers/`）との連携強化が考えられます。
*   **エラーフォールバックの強化**: `GeminiResponseParser` はJSONの構造が期待と異なる場合にエラーを返しますが、より柔軟な対応（部分的な成功としてデータを返す、フォーマットの揺れを許容するなど）や、解析失敗時のリトライ戦略（異なるプロンプト指示を試すなど）の導入も検討の余地があります。
*   **プロンプトバージョン管理ポリシー**: `PromptVersionManager` の仕組みはありますが、バージョンの更新タイミング、`isActive` フラグの運用方法、互換性維持に関する具体的なルールが不明確です。チーム内でのルール策定とドキュメント化が必要です。
*   **設定のハードコード**: `AIModelFactory` でモデル名 (`gemini-2.0-flash-001` など) がハードコードされています。将来的には設定ファイルや環境変数で管理する方が柔軟性が高まります。
*   **モックサービスの欠如**: `AIServiceFactory` で `MOCK` タイプが定義されていますが、`MockAIService` の実装が存在しません。テスト容易性向上のため、モック実装の追加が望まれます。 

### 課題

お疲れ！いやー、ちょっと聞いてくれよ、「manmaru」のAI周りのコード見てたんだけどさ。

正直、思ったよりはちゃんと作ろうとしてる感はあったな。`src/lib/ai` にまとめて、インターフェース切って、ファクトリパターン使ってたりしてさ。「お、やるじゃん」って最初は思ったわけよ。

でもな、掘っていくと「なんでやねん！」ってツッコミどころ満載でさ（笑）

プロンプト管理！ `TemplateEngine` とか `VersionManager` とか作ってて、結構頑張ってる感はあるんだけど、A/Bテストとかメトリクス収集のディレクトリだけ作って、中身空っぽ！「やる気だけは見せとくか」みたいな感じ？（笑）いつか実装する予定だったんだろうけど、現状じゃただの飾りだな。

それと、`IAIService` インターフェース！せっかくインターフェース切ってるのに、戻り値が `any` とか `GeminiParseRecipeResult` とか、思いっきり実装依存の型が入っちゃってんのよ。「抽象化とは…？」って哲学的な問いが頭をよぎったわ。これじゃ、将来的に他のAIモデルに差し替えようと思っても、結局インターフェースから直さないといけないじゃん、っていうね。

極めつけは、画像解析のプロンプト！「栄養素も推定してJSONで返してね！」ってAIにお願いしてるのに、レスポンスを解析する `GeminiResponseParser` は栄養素の部分、ガン無視（笑）。「いや、頼んだのに受け取らんのかーい！」って。プロンプト書いた人とパーサー書いた人、ちゃんと連携取れてる？って心配になるわ。

まあ、全体的に見ると、ちゃんと設計しようとした痕跡はあるし、コアな部分は動いてるっぽいから、致命的ってわけじゃないんだけどな。ただ、未実装の機能、消し忘れのファイル、型の甘さ、コンポーネント間の連携不足…みたいな「あるある」な課題がしっかり詰まってる感じ。

ドキュメント書くのはいいけど、その前にまずコード整理とTODO潰しから始めた方がいいんじゃないか？ってのが正直な感想だわ。いやー、でもこういうコード見ると、逆に燃えるというか、直したくなるよな！…まあ、今日のところはビール飲んで忘れようぜ！乾杯！🍻

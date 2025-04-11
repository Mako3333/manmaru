# エラーハンドリングガイドライン (manmaru アプリ)

このドキュメントでは、`manmaru` アプリケーションにおけるサーバーサイドのエラーハンドリング方針について説明します。一貫性のあるエラー処理と明確なエラー情報を提供することを目的としています。

## 1. 基本方針

-   **統一されたエラークラス:** すべてのアプリケーション固有のエラーは、`src/lib/error/types/base-error.ts` で定義されている `AppError` クラスを継承または直接使用して表現します。
-   **標準化されたエラーコード:** エラーの種類を明確に識別するため、`src/lib/error/codes/error-codes.ts` で定義されている `ErrorCode` Enum を使用します。
-   **構造化されたエラー情報:** `AppError` は、エラーに関する詳細情報（開発者向けメッセージ、ユーザー向けメッセージ、詳細、深刻度など）を構造化して保持します。
-   **ミドルウェアによる集約 (サーバーサイド):** APIルートでは `src/lib/api/middleware.ts` の `withErrorHandling` ミドルウェアを使用し、発生した `AppError` をキャッチして統一された形式のJSONレスポンスを生成します。
-   **ユーティリティ関数による集約 (クライアントサイド):** クライアントサイドでは `src/lib/error/utils.ts` の `handleError` 関数を使用し、エラーのログ記録やユーザーへの通知（トースト）を一元化します。
-   **サービス層での標準化:** サービス層 (`src/lib/services/`) では、`catch` ブロックでエラーを標準化し、常に `AppError` を上位レイヤーにスローするようにします。

## 2. `AppError` クラス

`AppError` は以下のプロパティを持ちます。

-   `code` (`AnyErrorCode`): エラーの種類を示す必須コード (例: `ErrorCode.Base.DATA_VALIDATION_ERROR`)。
-   `message` (string): 開発者向けのエラーメッセージ（必須）。ログやデバッグに使用します。
-   `userMessage` (string | undefined): クライアントに表示するためのユーザーフレンドリーなメッセージ（オプション）。指定しない場合、`code` に基づくデフォルトメッセージが使用されるか、`message` がそのまま使われることがあります。UI表示にはこれを優先的に使用します。
-   `details` (unknown): エラーに関する追加のコンテキスト情報（オプション）。デバッグに役立つ情報（例: バリデーションエラーの詳細、元のエラー情報）を含めます。
-   `severity` (`ErrorSeverity`): エラーの深刻度 (`info`, `warning`, `error`, `critical`)（オプション、デフォルトは `error`）。ログレベルの決定やUIでの表示方法の判断に使用できます。
-   `suggestions` (string[] | undefined): ユーザーに提示する解決策の提案（オプション）。`code` に基づくデフォルトの提案も用意されています。
-   `originalError` (Error | undefined): この `AppError` を引き起こした元のエラーオブジェクト（オプション）。スタックトレースの追跡や根本原因の特定に役立ちます。

## 3. `ErrorCode` Enum

`ErrorCode` は階層的に定義されており、エラーが発生したドメイン（`Base`, `Nutrition`, `AI`, `Resource`, `File`）ごとに分類されています。

**例:**

-   基本的なバリデーションエラー: `ErrorCode.Base.DATA_VALIDATION_ERROR`
-   AIによる画像処理エラー: `ErrorCode.AI.IMAGE_PROCESSING_ERROR`
-   食品が見つからないエラー: `ErrorCode.Nutrition.FOOD_NOT_FOUND`
-   未実装機能のエラー: `ErrorCode.Base.NOT_IMPLEMENTED`
-   設定関連のエラー: `ErrorCode.Base.CONFIG_ERROR`

エラーを発生させる際は、最も具体的で適切なエラーコードを選択してください。

## 4. エラーの発生方法 (主にサーバーサイド、サービス層)

APIルートやサービス内で予期されるエラーが発生した場合、`AppError` のインスタンスを作成して `throw` します。

```typescript
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';

// 例: バリデーションエラー
if (!isValid) {
    throw new AppError({
        code: ErrorCode.Base.DATA_VALIDATION_ERROR,
        message: 'Invalid input data provided for email field.', // 開発者向けメッセージ (具体的に)
        userMessage: '入力されたメールアドレスの形式が正しくありません。', // ユーザー向けメッセージ (分かりやすく)
        details: { invalidField: 'email', value: receivedValue }, // デバッグ用詳細情報
        severity: 'warning' // 深刻度を指定
    });
}

// 例: 外部サービスエラー (元のエラーを含める)
try {
    await externalService.call();
} catch (error) {
    throw new AppError({
        code: ErrorCode.Base.API_ERROR, // 外部API関連のエラーコード
        message: `External service call to 'payment' failed: ${error instanceof Error ? error.message : String(error)}`,
        userMessage: '決済サービスの処理中にエラーが発生しました。しばらくしてから再度お試しください。',
        details: { service: 'payment', endpoint: '/charge' },
        originalError: error instanceof Error ? error : undefined // 元のエラーを保持
    });
}
```

**注意:** サービス層やユーティリティ関数内で予期しないエラー（一般的な `Error`）を `catch` した場合は、そのままスローするのではなく、適切な `AppError` (多くの場合 `ErrorCode.Base.UNKNOWN_ERROR`) でラップして再スローする必要があります（後述の「サービス層でのエラー処理」参照）。

## 5. ミドルウェア (`withErrorHandling`) - APIルート用

すべてのAPIルート関数（例: `GET`, `POST`）は `withErrorHandling` でラップされます。このミドルウェアは以下の役割を担います。

1.  ルートハンドラーの実行中に発生した**同期・非同期エラー**をすべてキャッチします。
2.  エラーが `AppError` のインスタンスであれば、その情報を使用してエラーレスポンスを生成します。
3.  エラーが `AppError` でない場合（**予期せぬエラー**）、それを `originalError` として保持し、`ErrorCode.Base.UNKNOWN_ERROR` コードを持つ新しい `AppError` を作成して処理します。
4.  Zodのバリデーションエラー (`z.ZodError`) も特別に処理し、`ErrorCode.Base.DATA_VALIDATION_ERROR` コードを持つ `AppError` に変換します。
5.  最終的に、標準化されたJSON形式（後述）でクライアントにレスポンスを返します。これにより、APIルートハンドラー内での個別の `try...catch` によるエラーレスポンス生成が不要になります。

```typescript
// src/app/api/example/route.ts
import { withErrorHandling } from '@/lib/api/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { AppError, ErrorCode } from '@/lib/error';

export const GET = withErrorHandling(async (req: NextRequest) => {
    // ハンドラー内のコード...
    // エラーが発生した場合、AppErrorをthrowする
    if (someCondition) {
        throw new AppError({ code: ErrorCode.Base.FORBIDDEN, message: 'Access denied' });
    }

    // 成功時の処理
    return NextResponse.json({ data: 'Success' });

    // このハンドラー内には try...catch は不要
});
```

## 6. APIエラーレスポンス形式

`withErrorHandling` ミドルウェアによって生成されるエラーレスポンスは、以下のJSON形式に従います。

```json
{
  "success": false,
  "error": {
    "code": "data_validation_error", // AnyErrorCode (例)
    "message": "入力されたメールアドレスの形式が正しくありません。", // userMessage またはデフォルトメッセージ
    "details": { // AppError の details プロパティ (開発モードでのみ詳細が含まれる場合あり)
      "invalidField": "email",
      "value": "invalid-email"
    },
    "suggestions": [ // AppError の suggestions プロパティ、またはコードに基づくデフォルト
        "入力形式が正しいか確認してください。"
    ]
  },
  "meta": {
    "processingTimeMs": 15 // 処理時間など (オプション)
  }
}
```

## 7. サービス層でのエラー処理

サービス層 (`src/lib/services/`) のメソッド内では、エラーハンドリングを標準化します。

1.  メソッド全体を `try...catch` で囲みます。
2.  `try` ブロック内で発生した既知のエラーは、適切な `AppError` を `throw` します (前述の「エラーの発生方法」参照)。
3.  `catch` ブロックでは、捕捉したエラーが `AppError` のインスタンスかどうかを確認します。
    -   **`AppError` の場合:** 何もせず、そのまま `throw error;` で再スローします。これにより、エラー情報は失われずに上位レイヤー（APIルートなど）に伝播されます。
    -   **`AppError` でない場合 (予期せぬエラー):** 捕捉したエラーを `originalError` として保持し、`ErrorCode.Base.UNKNOWN_ERROR` コードを持つ新しい `AppError` を作成して `throw` します。

```typescript
// src/lib/services/example-service.ts
import { AppError, ErrorCode } from '@/lib/error';
import { SupabaseClient } from '@supabase/supabase-js';

export class ExampleService {
    static async performAction(supabase: SupabaseClient, data: any) {
        try {
            // サービスのロジック...
            const { error: dbError } = await supabase.from('items').insert(data);

            if (dbError) {
                // データベースエラーを AppError としてスロー
                throw new AppError({
                    code: ErrorCode.Resource.DB_ERROR,
                    message: `Database insert failed: ${dbError.message}`,
                    userMessage: 'データの保存に失敗しました。',
                    originalError: dbError
                });
            }

            // その他の処理...
            if (someOtherCondition) {
                 throw new AppError({ code: ErrorCode.Base.BUSINESS_LOGIC_ERROR, message: 'Specific business rule violated' });
            }

            return { success: true };

        } catch (error) {
            if (error instanceof AppError) {
                // 既に AppError の場合はそのままスロー
                throw error;
            }

            // AppError でない場合は UNKNOWN_ERROR としてラップしてスロー
            console.error('Unexpected error in ExampleService.performAction:', error); // 予期せぬエラーはログに残す
            throw new AppError({
                code: ErrorCode.Base.UNKNOWN_ERROR,
                message: `Unexpected error during action: ${error instanceof Error ? error.message : String(error)}`,
                userMessage: '処理中に予期しないエラーが発生しました。',
                originalError: error instanceof Error ? error : undefined
            });
        }
    }
}
```

## 8. クライアントサイドでのエラー処理 (`handleError` ユーティリティ)

クライアントサイド（Reactコンポーネント、カスタムフックなど）でAPI呼び出しやその他の操作中にエラーが発生した場合、`src/lib/error/utils.ts` の `handleError` 関数を使用して処理を統一します。

`handleError` は以下の機能を提供します。

-   エラーオブジェクト（`AppError` または一般的な `Error`）を受け取ります。
-   エラー情報をコンソールにログ出力します（`AppError` の場合はコードとメッセージ、それ以外はエラー名とメッセージ）。
-   ユーザーフレンドリーなメッセージ（`AppError` の場合は `userMessage`、それ以外はエラーメッセージまたはデフォルトメッセージ）を含むトースト通知を表示します（オプションで無効化可能）。
-   必要に応じてエラーを再スローするオプションを提供します。

```typescript
// Reactコンポーネント内での使用例
import { handleError } from '@/lib/error/utils';
import { useApi } from '@/hooks/useApi'; // useApiフックは内部でhandleErrorを使っている場合がある

function MyComponent() {
    const { post } = useApi();

    const handleClick = async () => {
        try {
            await post('/api/resource', { data: '...' });
            // 成功処理
        } catch (error) {
            // APIフックからスローされたエラー (通常は AppError) を処理
            handleError(error, {
                showToast: true, // トーストを表示 (デフォルト)
                toastOptions: { title: 'データ送信エラー' } // カスタムタイトル
            });
            // このエラーに基づいてUIの状態を更新するなど
        }
    };

    // ...
}

// カスタムフック内での使用例
function useMyFeature() {
    const performAsyncAction = async () => {
        try {
            // 何らかの非同期処理
            const result = await someAsyncFunction();
            return result;
        } catch (error) {
            handleError(error, {
                rethrow: true, // エラーを再スローして呼び出し元で処理できるようにする
                logger: myCustomLogger // カスタムロガーを使用
            });
            // handleErrorでrethrow: trueを指定した場合、この行は実行されない
            // throw error; // rethrow: trueなら不要
        }
    };
    // ...
}

```

## 9. ベストプラクティス

-   **一貫性:** アプリケーション全体で `AppError` と `ErrorCode` を一貫して使用します。サーバーサイドは `withErrorHandling`、クライアントサイドは `handleError` を活用します。
-   **適切なコード:** 最も状況に適した `ErrorCode` を選択します。必要であれば新しいコードを追加することも検討します（`src/lib/error/codes/error-codes.ts` を更新）。
-   **明確なメッセージ:** `message` (開発者向け) と `userMessage` (ユーザー向け) の両方を、状況に応じて明確かつ簡潔に記述します。`userMessage` は専門用語を避け、ユーザーが理解できる言葉を選びます。
-   **詳細な情報:** `details` には、デバッグや問題解決に役立つ具体的なコンテキスト情報を含めます。**個人情報や機密情報は絶対に含めないでください。**
-   **元のエラー:** 可能であれば `originalError` を含め、根本原因の特定を容易にします。
-   **サービス層でのラップ:** サービス層の `catch` では、予期しないエラーを必ず `AppError` でラップします。
-   **APIルートでの `try...catch` 回避:** `withErrorHandling` を使用しているAPIルートでは、エラーレスポンス生成のための `try...catch` は原則不要です。リソースのクリーンアップなど、エラーレスポンス生成以外の目的で `try...finally` を使うことはあります。

## 10. よくある間違いと修正方法

(このセクションの内容は既存のままでも概ね問題ないと思われますが、コード例は最新のベストプラクティスに合わせて見直すと良いでしょう。)

### 8.1 カスタムエラークラスの使用 (再掲)

❌ **間違った実装:** （以前の例）
✅ **正しい実装:** （以前の例）

### 8.2 独自のErrorCode定義 (再掲)

❌ **間違った実装:** （以前の例）
✅ **正しい実装:** （以前の例）

### 8.3 ErrorCodeの階層構造の誤用 (再掲)

❌ **間違った実装:** （以前の例）
✅ **正しい実装:** （以前の例）

### 8.4 エラーハンドリングの不足（クライアントサイド）

❌ **間違った実装:**
```typescript
try {
    await api.call();
} catch (error) {
    console.error('API error:', error); // ログのみ
    // ユーザーには何も通知されない
}
```

✅ **正しい実装 (handleErrorを使用):**
```typescript
import { handleError } from '@/lib/error/utils';

try {
    await api.call();
} catch (error) {
    handleError(error, { showToast: true }); // ログとトースト通知
}
```

## 11. レガシーコードからの移行ガイド

既存のコードでは、独自のエラークラスやエラー処理パターンが使用されている場合があります。以下は、レガシーコードを標準のエラーハンドリングに移行する際のガイドラインです。

### 9.1 カスタムエラークラスの移行 (再掲)
(内容は既存のままで良い)

### 9.2 エラーコード参照の修正 (再掲)
(内容は既存のままで良い)

### 9.3 エラーハンドリングのリファクタリング

1. 各`try...catch`ブロックを見直します。
2. **APIルート:** `withErrorHandling` ミドルウェアを適用し、ルート内の `try...catch` を削除します（エラーレスポンス生成目的の場合）。
3. **サービス層:** 「7. サービス層でのエラー処理」のパターンに従って `catch` ブロックを修正します。
4. **クライアントサイド:** `handleError` ユーティリティ関数を使用するように修正します。
5. エラーの種類に応じた条件分岐を追加し、`AppError` の情報（`code`, `userMessage`）に基づいて適切なフィードバックや処理を行います。
6. 汎用的なエラー（例：`Error`）が捕捉される場合は、それらを適切な `AppError` インスタンスに変換するか、`handleError` に渡します。

### 9.4 エラー変換ヘルパー関数 (再掲)
(内容は既存のままで良い。ただし、`handleError` の存在により、このヘルパーの必要性は低下しているかもしれません。)

```typescript
// src/lib/error/utils.ts の handleError が同様の役割を担うため、
// このカスタムヘルパーは必須ではないかもしれません。
export function convertToAppError(error: unknown, options?: {
    defaultCode?: AnyErrorCode;
    defaultMessage?: string;
    defaultUserMessage?: string;
}): AppError {
    if (error instanceof AppError) {
        return error;
    }

    return new AppError({
        code: options?.defaultCode || ErrorCode.Base.UNKNOWN_ERROR,
        message: error instanceof Error
            ? error.message
            : options?.defaultMessage || 'An unknown error occurred',
        userMessage: options?.defaultUserMessage || 'サービスが一時的に利用できません',
        originalError: error instanceof Error ? error : undefined
    });
}
```

## 12. 自動化とリンタールール (再掲)
(内容は既存のままで良い) 
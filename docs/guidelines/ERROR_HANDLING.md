# エラーハンドリングガイドライン (manmaru アプリ)

このドキュメントでは、`manmaru` アプリケーションにおけるサーバーサイドのエラーハンドリング方針について説明します。一貫性のあるエラー処理と明確なエラー情報を提供することを目的としています。

## 1. 基本方針

-   **統一されたエラークラス:** すべてのアプリケーション固有のエラーは、`src/lib/error/types/base-error.ts` で定義されている `AppError` クラスを継承または直接使用して表現します。
-   **標準化されたエラーコード:** エラーの種類を明確に識別するため、`src/lib/error/codes/error-codes.ts` で定義されている `ErrorCode` Enum を使用します。
-   **構造化されたエラー情報:** `AppError` は、エラーに関する詳細情報（開発者向けメッセージ、ユーザー向けメッセージ、詳細、深刻度など）を構造化して保持します。
-   **ミドルウェアによる集約:** APIルートでは `src/lib/api/middleware.ts` の `withErrorHandling` ミドルウェアを使用し、発生した `AppError` をキャッチして統一された形式のJSONレスポンスを生成します。

## 2. `AppError` クラス

`AppError` は以下のプロパティを持ちます。

-   `code` (`AnyErrorCode`): エラーの種類を示す必須コード (例: `ErrorCode.Base.DATA_VALIDATION_ERROR`)。
-   `message` (string): 開発者向けのエラーメッセージ（必須）。ログやデバッグに使用します。
-   `userMessage` (string): クライアントに表示するためのユーザーフレンドリーなメッセージ（オプション）。指定しない場合は `code` に基づくデフォルトメッセージが使用されます。
-   `details` (unknown): エラーに関する追加のコンテキスト情報（オプション）。デバッグに役立つ情報（例: バリデーションエラーの詳細、元のエラー情報）を含めます。
-   `severity` (`ErrorSeverity`): エラーの深刻度 (`info`, `warning`, `error`, `critical`)（オプション、デフォルトは `error`）。
-   `suggestions` (string[]): ユーザーに提示する解決策の提案（オプション）。`code` に基づくデフォルトの提案も用意されています。
-   `originalError` (Error | undefined): この `AppError` を引き起こした元のエラーオブジェクト（オプション）。スタックトレースの追跡などに役立ちます。

## 3. `ErrorCode` Enum

`ErrorCode` は階層的に定義されており、エラーが発生したドメイン（`Base`, `Nutrition`, `AI`, `Resource`, `File`）ごとに分類されています。

**例:**

-   基本的なバリデーションエラー: `ErrorCode.Base.DATA_VALIDATION_ERROR`
-   AIによる画像処理エラー: `ErrorCode.AI.IMAGE_PROCESSING_ERROR`
-   食品が見つからないエラー: `ErrorCode.Nutrition.FOOD_NOT_FOUND`

エラーを発生させる際は、最も具体的で適切なエラーコードを選択してください。

## 4. エラーの発生方法

APIルートやサービス内で予期されるエラーが発生した場合、`AppError` のインスタンスを作成して `throw` します。

```typescript
import { AppError } from '@/lib/error/types/base-error';
import { ErrorCode } from '@/lib/error/codes/error-codes';

// 例: バリデーションエラー
if (!isValid) {
    throw new AppError({
        code: ErrorCode.Base.DATA_VALIDATION_ERROR,
        message: 'Invalid input data provided.', // 開発者向けメッセージ
        userMessage: '入力内容を確認してください。', // ユーザー向けメッセージ (オプション)
        details: { invalidField: 'email', reason: 'format is incorrect' } // 詳細情報
    });
}

// 例: 外部サービスエラー (元のエラーを含める)
try {
    await externalService.call();
} catch (error) {
    throw new AppError({
        code: ErrorCode.Base.API_ERROR,
        message: `External service call failed: ${error.message}`,
        details: { service: 'externalService' },
        originalError: error // 元のエラーを保持
    });
}
```

**注意:** 予期しないエラー（`try...catch` で捕捉される一般的な `Error`）は、`withErrorHandling` ミドルウェア内で `ErrorCode.Base.UNKNOWN_ERROR` として処理されるか、ルート固有の `catch` ブロックで適切な `AppError` に変換して再スローする必要があります。

## 5. ミドルウェア (`withErrorHandling`)

すべてのAPIルート関数は `withErrorHandling` でラップされます。このミドルウェアは以下の役割を担います。

1.  ルートハンドラーの実行中に発生したエラーをキャッチします。
2.  エラーが `AppError` のインスタンスであれば、その情報を使用してエラーレスポンスを生成します。
3.  エラーが `AppError` でない場合（予期せぬエラー）、`UNKNOWN_ERROR` コードを持つ `AppError` を作成して処理します。
4.  Zodのバリデーションエラー (`z.ZodError`) も特別に処理し、`DATA_VALIDATION_ERROR` コードを持つ `AppError` に変換します。
5.  最終的に、標準化されたJSON形式でクライアントにレスポンスを返します。

## 6. APIエラーレスポンス形式

`withErrorHandling` ミドルウェアによって生成されるエラーレスポンスは、以下のJSON形式に従います。

```json
{
  "success": false,
  "error": {
    "code": "data_validation_error", // AnyErrorCode
    "message": "入力内容を確認してください。", // userMessage
    "details": { // AppError の details プロパティ (開発モードでのみ詳細が含まれる場合あり)
      "invalidField": "email",
      "reason": "format is incorrect"
    },
    "suggestions": [ // AppError の suggestions プロパティ
        "入力形式が正しいか確認してください。"
    ]
  },
  "meta": {
    "processingTimeMs": 15 // 処理時間など
  }
}
```

## 7. ベストプラクティス

-   **一貫性:** アプリケーション全体で `AppError` と `ErrorCode` を一貫して使用します。
-   **適切なコード:** 最も状況に適した `ErrorCode` を選択します。必要であれば新しいコードを追加することも検討します（`src/lib/error/codes/error-codes.ts` を更新）。
-   **明確なメッセージ:** `message` (開発者向け) と `userMessage` (ユーザー向け) の両方を、状況に応じて明確かつ簡潔に記述します。
-   **詳細な情報:** `details` には、デバッグや問題解決に役立つ具体的なコンテキスト情報を含めます。個人情報や機密情報は含めないように注意してください。
-   **元のエラー:** 可能であれば `originalError` を含め、根本原因の特定を容易にします。 

## 8. よくある間違いと修正方法

以下は、コードベースでよく見られるエラー処理の間違いとその修正方法です。

### 8.1 カスタムエラークラスの使用

❌ **間違った実装:**
```typescript
class DataProcessingError extends Error {
    userMessage: string;
    details?: any;
    
    constructor(message: string, dataType: string, code?: string, details?: any) {
        super(message);
        this.name = 'DataProcessingError';
        this.userMessage = `${dataType}の処理中にエラーが発生しました`;
        this.details = details;
    }
}

throw new DataProcessingError(
    '画像データが不足しています',
    '食事画像',
    'data_validation_error',
    { imageLength: 0 }
);
```

✅ **正しい実装:**
```typescript
import { AppError, ErrorCode } from '@/lib/error';

throw new AppError({
    code: ErrorCode.Base.DATA_VALIDATION_ERROR,
    message: '画像データが不足しています',
    userMessage: '食事画像を再度撮影してください',
    details: { imageLength: 0 }
});
```

### 8.2 独自のErrorCode定義

❌ **間違った実装:**
```typescript
// エラーコード定数
const ErrorCode = {
    AUTH_EXPIRED: 'auth_expired',
    DATA_VALIDATION_ERROR: 'data_validation_error',
    API_RESPONSE_INVALID: 'api_response_invalid'
};

throw new Error('認証エラー: ' + ErrorCode.AUTH_EXPIRED);
```

✅ **正しい実装:**
```typescript
import { AppError, ErrorCode } from '@/lib/error';

throw new AppError({
    code: ErrorCode.Base.AUTH_ERROR,
    message: 'ログインセッションが無効です',
    userMessage: 'ログインセッションの有効期限が切れました'
});
```

### 8.3 ErrorCodeの階層構造の誤用

❌ **間違った実装:**
```typescript
import { ErrorCode } from '@/lib/error';

// エラー：ErrorCodeは階層構造（ErrorCode.Base.AUTH_ERROR）
if (error.code === ErrorCode.AUTH_REQUIRED) {
    // ...
}
```

✅ **正しい実装:**
```typescript
import { ErrorCode } from '@/lib/error';

if (error.code === ErrorCode.Base.AUTH_ERROR) {
    // ...
}
```

### 8.4 エラーハンドリングの不足

❌ **間違った実装:**
```typescript
try {
    const result = await api.call();
    // 結果を処理
} catch (error) {
    console.error('API error:', error);
    toast.error('エラーが発生しました');
}
```

✅ **正しい実装:**
```typescript
try {
    const result = await api.call();
    // 結果を処理
} catch (error) {
    console.error('API error:', error);
    
    if (error instanceof AppError) {
        // AppErrorの場合は、そのuserMessageを使用
        toast.error(error.userMessage || 'エラーが発生しました');
        
        // 必要に応じて特定のエラーコードに基づいて処理
        if (error.code === ErrorCode.Base.AUTH_ERROR) {
            router.push('/login');
        }
    } else {
        // 一般的なエラーを適切なAppErrorに変換
        const appError = new AppError({
            code: ErrorCode.Base.UNKNOWN_ERROR,
            message: error instanceof Error ? error.message : String(error),
            userMessage: 'サービスが一時的に利用できません'
        });
        
        toast.error(appError.userMessage);
    }
}
```

## 9. レガシーコードからの移行ガイド

既存のコードでは、独自のエラークラスやエラー処理パターンが使用されている場合があります。以下は、レガシーコードを標準のエラーハンドリングに移行する際のガイドラインです。

### 9.1 カスタムエラークラスの移行

1. カスタムエラークラス（例：`DataProcessingError`、`ApiError`、`AuthError`など）を見つけます。
2. 該当するエラーをスローしているコードを特定します。
3. エラーインスタンスの作成を、相当する `AppError` に置き換えます。
4. 元のエラークラスに存在していたカスタムプロパティを、`AppError` の適切なプロパティにマッピングします：
   - カスタムの `message` → `message`
   - カスタムの `userMessage` → `userMessage`
   - カスタムの `code` → 適切な `ErrorCode` 階層値
   - カスタムの `details` → `details`
   - カスタムの `suggestions` → `suggestions`

### 9.2 エラーコード参照の修正

1. 独自の `ErrorCode` 定数や列挙型を見つけます。
2. それらの代わりに標準の `ErrorCode` を使用するようにコードを修正します。
3. コード内の `ErrorCode` への直接参照（例：`ErrorCode.AUTH_REQUIRED`）を見つけ、階層構造を使用するように修正します（例：`ErrorCode.Base.AUTH_ERROR`）。

### 9.3 エラーハンドリングのリファクタリング

1. 各`try...catch`ブロックを見直し、標準的なエラーハンドリングパターンを使用しているか確認します。
2. エラーの種類に応じた条件分岐を追加し、`AppError` の情報に基づいて適切なフィードバックを提供します。
3. 汎用的なエラー（例：`Error`、`SyntaxError`）が捕捉される場合は、それらを適切な `AppError` インスタンスに変換します。

### 9.4 エラー変換ヘルパー関数

複数の場所で同様のエラー変換が必要な場合、ヘルパー関数を作成することを検討します：

```typescript
export function handleError(error: unknown, options?: {
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

この関数を使用して、任意のエラーを `AppError` に変換できます。

## 10. 自動化とリンタールール

エラー処理のベストプラクティスを強制するために、ESLintなどのリンターを設定することを検討してください。以下は、使用できるカスタムルールの例です：

1. カスタムエラークラスの使用を禁止する
2. 直接的な `throw new Error()` を禁止し、代わりに `AppError` の使用を促す
3. 独自の `ErrorCode` 定数の定義を禁止する
4. `try...catch` ブロックで `error` 変数の型を適切に絞り込むことを強制する

チームがこれらのガイドラインを一貫して適用できるよう、コードレビュープロセスにおいてもエラー処理パターンに注目することをお勧めします。 
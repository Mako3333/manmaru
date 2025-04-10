# TypeScript 型統一・リンターエラー対応ガイドライン (完全版)

## 1. 目的

本ガイドラインは、`manmaru` アプリケーション開発において、以下の点を達成することを目的とします。

*   **型安全性の徹底:** `any` 型や型エラー抑制ディレクティブの使用を原則禁止し、TypeScript の静的型チェックを最大限に活用することで、実行時エラーを未然に防ぎ、コードの信頼性を向上させます。
*   **コード一貫性の確保:** 型定義の命名や配置、オプショナルプロパティの扱い、エラーハンドリングなどの規約を統一し、コードベース全体の可読性と保守性を高めます。
*   **開発効率の向上:** 明確で一貫性のあるコードは、新規開発者のオンボーディングを容易にし、リファクタリングやコードレビューの効率を高め、チーム全体の生産性向上に貢献します。

---

## 2. 基本方針

*   **根本解決の優先:** リンターエラーや型エラーに対して、`@ts-ignore` や `any` 型で一時的に抑制するのではなく、問題の根本原因を特定し、型安全性を損なわない方法で解決します。
*   **型定義の明確化:** 変数、関数、コンポーネント Props など、あらゆる箇所で可能な限り具体的な型を定義し、TypeScript の型推論と静的解析能力を最大限に活用します。
*   **堅牢性と予測可能性:** 安全で予測可能なコードを目指し、意図しない `null` や `undefined` によるエラーを防ぎ、保守しやすいコードベースを構築します。

---

## 3. 型安全性の原則

### 3.1. `any` 型の原則禁止

*   **`any` は最終手段:** `any` 型の使用は、型システムの恩恵を放棄することに繋がるため、原則として禁止します。
*   **`unknown` の活用:** 型が不明な場合は `unknown` 型を使用し、利用する前に必ず型ガードや型アサーション（安全性が確認できる場合のみ）によって型を特定します。
*   **型ガードの具体例:**
    *   `typeof`: プリミティブ型のチェック
        ```typescript
        if (typeof value === 'string') {
          // value は string 型として扱える
          console.log(value.toUpperCase());
        }
        ```
    *   `instanceof`: クラスインスタンスのチェック
        ```typescript
        if (error instanceof AppError) {
          // error は AppError 型として扱える
          console.error(error.code, error.userMessage);
        }
        ```
    *   `in` 演算子: オブジェクトが特定のプロパティを持つかチェック
        ```typescript
        if (typeof data === 'object' && data !== null && 'calories' in data) {
          // data は { calories: unknown } 型として扱える
          console.log((data as { calories: number }).calories); // 必要に応じてアサーション
        }
        ```
    *   ユーザー定義型ガード関数 (`isXxx`): より複雑な型のチェック
        ```typescript
        interface Dog { type: 'dog'; bark: () => void; }
        interface Cat { type: 'cat'; meow: () => void; }
        type Animal = Dog | Cat;

        function isDog(animal: Animal): animal is Dog {
          return animal.type === 'dog';
        }

        function makeSound(animal: Animal) {
          if (isDog(animal)) {
            animal.bark(); // animal は Dog 型として扱える
          } else {
            animal.meow(); // animal は Cat 型として扱える
          }
        }
        ```

### 3.2. `@ts-ignore` / `@ts-expect-error` の原則禁止

*   **原則禁止:** これらのディレクティブは、型エラーを強制的に無視するため、原則として使用を禁止します。
*   **例外的な使用:**
    *   外部ライブラリの型定義が不完全または誤っている場合など、やむを得ない場合に限り、限定的に使用を許可します。
    *   使用する場合は、**必ず**以下のルールに従ってください。
        1.  `@ts-expect-error` を優先的に使用します。（将来的にエラーが解消された場合に検知できるため）
        2.  直前の行に、**なぜ抑制が必要なのか具体的な理由**と、**将来的な解消計画（Issue 番号など）**をコメントで明記します。
            ```typescript
            // @ts-expect-error: ライブラリXXXのv1.2.3の型定義にバグがあるため。v1.2.4で修正予定 (Issue #123)
            const result = externalLibraryFunction(invalidTypedValue);
            ```
    *   コードレビューで `@ts-ignore` / `@ts-expect-error` の使用理由と解消計画を必ず確認します。

---

## 4. コーディングスタイルと規約

### 4.1. オプショナルプロパティの扱い

*   **`prop?: T` 形式を基本:** インターフェースや型エイリアスで省略可能なプロパティは `prop?: T` 形式で定義します。
*   **値がない場合はキー自体を省略:** オブジェクトリテラルでオプショナルなプロパティに値がない場合、`undefined` を代入するのではなく、キー自体を省略します。条件付きスプレッド構文を活用します。
    *   **推奨例:**
        ```typescript
        interface Options {
          timeout?: number;
          retry?: boolean;
        }

        const createOptions = (timeoutValue?: number): Options => {
          return {
            ...(timeoutValue !== undefined ? { timeout: timeoutValue } : {}),
            // retry は常に省略される例
          };
        };
        ```
    *   **非推奨例:**
        ```typescript
        const options: Options = {
          timeout: undefined, // undefined を明示的に設定しない
          retry: undefined
        };
        ```

### 4.2. 型定義の配置と命名規則

*   **配置ルール:**
    *   **共通型:** プロジェクト全体で広く使用される型（APIレスポンス、基本データモデルなど）は `src/types/` ディレクトリに配置します。
    *   **モジュール固有型:** 特定の機能モジュール（例: `src/lib/nutrition/`）内でのみ使用される型は、そのモジュールディレクトリ内に `types.ts` ファイルを作成して配置します。（例: `src/lib/nutrition/types.ts`）
    *   **コンポーネント固有型:** 特定の React コンポーネントでのみ使用される Props や State の型は、コンポーネントファイル (`.tsx`) 内で定義することを推奨します。ただし、型定義が複雑化・長大化する場合は、同ディレクトリに `types.ts` を作成して分離することも検討します。
*   **命名規則:**
    *   **インターフェース/型エイリアス:** `PascalCase` を使用します。
    *   **接頭辞/接尾辞:** `I` (Interface) や `T` (Type) のような接頭辞、`Type` や `Interface` のような接尾辞は**使用しません**。型が何を表すかを具体的に示す名前を付けます。（例: `UserProfile`, `MealData`, `ApiResponse`）
    *   **Enum:** `PascalCase` を使用します。（例: `ErrorCode`, `MealType`）

### 4.3. Union 型と Enum の使い分け

*   **Union 型の推奨:** 少数の固定された文字列リテラルや数値リテラルを表す場合は、Union 型 (`type Status = 'pending' | 'success' | 'error';`) を推奨します。シンプルで可読性が高いです。
*   **Enum の使用:** 状態や種別が多く、グループ化して管理したい場合や、数値とのマッピングが必要な場合に Enum を使用します。（例: `ErrorCode`）

---

## 5. エラーハンドリングの型安全

*   **`catch` ブロック:** `try...catch` 構文では、`catch (error: unknown)` のように `unknown` 型でエラーオブジェクトを受け取ります。
*   **型ガード:** `catch` ブロック内でエラーオブジェクトを使用する際は、`instanceof Error` や `instanceof AppError` (プロジェクト固有のエラークラス) などで型ガードを行い、安全にプロパティにアクセスします。
    ```typescript
    try {
      // 何らかの処理
    } catch (error: unknown) {
      // プロジェクト共通のエラーハンドラ関数を呼び出すことを推奨
      handleError(error); // handleError 内で型ガードを行う

      // もし個別処理が必要な場合:
      if (error instanceof AppError && error.code === ErrorCode.Base.AUTH_ERROR) {
        // 認証エラー時の特別な処理
        router.push('/login');
      } else if (error instanceof Error) {
        // 一般的なエラー
        console.error('An unexpected error occurred:', error.message);
      } else {
        // その他の予期せぬエラー
        console.error('An unknown error occurred:', error);
      }
    }
    ```
*   **`AppError` の活用:** プロジェクト固有のエラーは、`src/lib/error/` で定義されている `AppError` クラスと `ErrorCode` を使用して表現し、エラーに関する構造化された情報（コード、メッセージ、詳細など）を伝達します。

---

## 6. 実装上の推奨パターン

### 6.1. スプレッド構文による条件付きプロパティ追加

*   オブジェクトリテラル内で、条件に応じてプロパティを追加する場合に便利です。
    ```typescript
    const mealData = {
      user_id: userId,
      meal_date: date,
      ...(photoUrl ? { photo_url: photoUrl } : {}), // photoUrl が存在する場合のみ追加
      ...(notes ? { notes: notes } : {}),         // notes が存在する場合のみ追加
    };
    ```

### 6.2. 未定義値の安全処理

*   **Optional Chaining (`?.`):** ネストされたプロパティに安全にアクセスします。途中のプロパティが `null` または `undefined` の場合、エラーを発生させずに `undefined` を返します。
    ```typescript
    const street = user?.address?.street; // user や address が null/undefined でもエラーにならない
    ```
*   **Nullish Coalescing (`??`):** 左辺が `null` または `undefined` の場合に右辺のデフォルト値を返します。
    ```typescript
    const timeout = options?.timeout ?? 5000; // options.timeout が null/undefined なら 5000 を使用
    ```

---

## 7. リンティングとフォーマット

### 7.1. ESLint 設定の整備

*   **推奨ルールセット:** 以下のルールセットを基本として導入・設定します。
    *   `eslint:recommended`
    *   `plugin:@typescript-eslint/recommended` (または `recommended-type-checking`)
    *   `plugin:react/recommended`
    *   `plugin:react-hooks/recommended`
    *   `plugin:jsx-a11y/recommended` (アクセシビリティ)
    *   `next/core-web-vitals` (Next.js 推奨)
*   **特に重要なルール:** 以下のルールは `error` レベルで設定し、違反を許容しないことを推奨します。
    *   `@typescript-eslint/no-explicit-any`: `any` 型の使用を禁止。
    *   `@typescript-eslint/no-unused-vars`: 未使用の変数やインポートを禁止（`eslint-plugin-unused-imports` との併用も検討）。
    *   `react-hooks/rules-of-hooks`: フックのルール違反を禁止。
    *   `react-hooks/exhaustive-deps`: `useEffect`, `useCallback` 等の依存配列の不足・過剰を警告/エラー。
    *   `no-console`: 本番コードでの `console.log` 等の使用を制限（開発中は `warn` レベルでも可）。
*   **設定ファイル:** `eslint.config.mjs` (Flat Config) または `.eslintrc.js` で設定を管理します。

### 7.2. Prettier との連携

*   コードフォーマットは Prettier に一任し、ESLint のフォーマット関連ルールは無効化します (`eslint-config-prettier`)。
*   `.prettierrc.js` または `package.json` で Prettier の設定を統一します。

### 7.3. 自動化

*   **コミットフック:** `husky` と `lint-staged` を使用して、コミット前に自動的に ESLint と Prettier を実行し、問題を修正またはコミットをブロックします。
*   **CI/CD:** GitHub Actions などの CI/CD パイプラインに ESLint と TypeScript の型チェック (`tsc --noEmit`) を組み込み、マージ前にコード品質を保証します。

---

## 8. 運用と継続的改善

### 8.1. 型定義の更新・配置計画

1.  **共通定義の整備:** `src/types/` 内に共通の API レスポンス型、エラー型、主要なデータモデル（User, Meal, Recipe など）を整備します。
2.  **モジュール別型定義:** `src/lib/[module]/types.ts` 形式で、各機能モジュール固有の型を整理します。
3.  **段階的な移行:** 既存コードの `any` 型や古い型定義は、機能改修やリファクタリングのタイミングで段階的に新しい型定義に置き換えます。

### 8.2. 定期レビューとドキュメント更新

*   定期的なコードレビューを通じて、本ガイドラインの遵守状況を確認します。
*   新たな問題やより良いプラクティスが見つかった場合は、本ガイドラインを適宜更新します。

### 8.3. 新規実装・改修時の徹底

*   新しい機能の実装や既存機能の改修を行う際は、本ガイドラインに準拠したコーディングを必須とします。
*   コードレビューでは、型安全性とガイドライン遵守を重要なチェック項目とします。

---

## 9. エラー解決の体系的手順

リンターエラーや TypeScript の型エラーに遭遇した場合、以下の手順で対処します。

1.  **エラーメッセージの分析:** エラーメッセージを正確に読み、どのファイルのどの行で、どのような問題が発生しているかを理解します。
2.  **コードと型定義の照合:** エラー箇所周辺のコードと、関連する変数や関数の型定義を確認し、不整合がないかを確認します。
3.  **根本原因の特定:** なぜ型エラーが発生しているのか、リンタールールに違反しているのか、根本的な原因を特定します。（例: `null` / `undefined` の可能性、型のミスマッチ、依存配列の不足など）
4.  **型安全な解決策の策定:** 特定した原因に基づき、`any` や `@ts-ignore` に頼らず、型ガード、適切な型定義、ロジック修正などで問題を解決します。
5.  **リンター/コンパイラの再実行:** 修正後、再度 ESLint や `tsc` を実行し、エラーが解消されたことを確認します。
6.  **ベストプラクティス適合確認:** 修正内容が本ガイドラインの原則や推奨パターンに適合しているかを確認します。
7.  **ドキュメント化・知識共有:** 解決が困難だったエラーや、チーム内で共有すべき知見が得られた場合は、ドキュメント化や口頭での共有を行います。

---

## 10. 長期的利点

本ガイドラインを遵守することで、以下の長期的な利点が期待できます。

*   **実行時エラーの削減:** 静的型チェックにより、多くの潜在的なバグを開発段階で検出・修正できます。
*   **コードの保守性・拡張性向上:** 一貫性があり、型が明確なコードは、理解しやすく、変更や機能追加が容易になります。
*   **開発者体験の向上:** 型補完や早期のエラー検出により、開発プロセスがスムーズになり、デバッグ時間が短縮されます。
*   **コード品質の一貫性担保:** チーム全体で共通の基準を持つことで、コード品質のばらつきを防ぎます。

---

## 11. any型の修正手順

### 1. any型の検出

- **コードベース全体の検索:**
  - プロジェクト全体で「`: any`」や「any」をキーワードに検索し、明示的にanyを宣言している箇所を抽出します。
  - また、暗黙的なany（型が推論できずにanyと解釈されるケース）については、TypeScriptのstrictモードを有効にすることで警告やエラーとして検出します。
  - 開発環境のLintツール（ESLintなど）を設定し、anyの使用を禁止するルール（例: `@typescript-eslint/no-explicit-any`）を有効にして、全箇所の検出を行います。

### 2. any型の置換方針の決定

- **具体的な型の導入:**
  - 変数、関数の引数や戻り値、オブジェクトのプロパティ等において、anyと記述されている場合、実際に取り扱っている値の構造や役割から具体的な型を定義します。
  - 例えば、栄養データの場合は、既存の`NutritionData`や新たに統一した`StandardizedMealNutrition`型に置き換えます。
  - コンポーネントのプロップスやAPIレスポンス、サービスのメソッドシグネチャでは、ドキュメントや既存実装の仕様を参考に、適切なインターフェースを定義します。

- **unknown型 + 型ガードの採用:**
  - 値の型が動的に決定され、型推論が難しい箇所については、まずunknown型に置き換えます。
  - その後、値を利用する際に型ガード（`typeof`、`instanceof`、あるいはカスタムガード関数）を適用して、正しい型かどうかを判定します。
  - これにより、型安全性を担保しながら柔軟なコード記述が可能となります。

### 3. 修正作業の手順

1. **コードの分析と一覧作成:**
   - 各モジュール・ファイルごとにanyが使用されている箇所の一覧を作成し、どの部分がどのようなデータを扱っているかを確認します。
   - コンポーネント、API、フック、サービス、ユーティリティなど、カテゴリーごとにanyの使用箇所を整理し、優先度順（重要度・使用頻度）にリストアップします。

2. **型の設計と定義:**
   - 検出した各箇所について、具体的な型定義（新しい型、既存の型の利用、または新たなインターフェースの定義）を行い、コードの仕様に沿った型を決定します。
   - 既に定義されている型（例: `StandardizedMealNutrition`やその他の共通型）を積極的に活用し、一貫性を保つようにします。

3. **リファクタリング実施:**
   - 作成した一覧に基づいて、一箇所ずつanyを削除します。最初にunknownに置き換え、そこから具体的な型に変更するアプローチを取ると、短期間で全体を修正しつつ、その都度型ガードなどを実装できるため安全です。
   - 例えば、関数の引数がanyの場合、引数に期待されるデータの構造（オブジェクトのプロパティや値の型）を明示的に型注釈します。また、その関数内で受け取ったunknown型の値に対して、必要なチェック（`if (typeof value === 'string') { ... }`など）を実装します。

4. **@ts-expect-error, @ts-ignoreの削除:**
   - anyの置換作業に関連して、これらの指示コメントが残っている場合は、正しい型の適用や型ガードの導入により、コメントが不要となるよう修正します。
   - すべての@ts-ignoreコメントを調査し、どのコードが原因で発生しているかを特定、適切な型修正後に削除するようにします。

5. **テストと確認:**
   - 各修正箇所ごとに、ローカルでコンパイルエラーやLintエラーが解消されることを確認します。
   - 単体テストや統合テストを実行し、機能面に不具合が生じていないか、特に変換処理やAPI応答部分の挙動が正しいことを検証します。
   - 必要に応じて、型ガード部分のテストケースを追加し、動的に型が判断されるシナリオをカバーします。

### 4. 効率的な進め方のポイント

- **段階的なリファクタリング:**
  全体を一気に変更するのではなく、ファイル単位、モジュール単位で少しずつ変更し、そのたびにテストを回すことで安全性を担保します。
- **チーム内レビュー:**
  型安全性の改善は他の開発者にも影響するため、プルリクエストなどで変更内容をレビューし、抜け漏れがないか確認します。
- **自動ツールの利用:**
  TypeScriptのコンパイラ設定（`strict`オプションの有効化）やLintツールにより、anyの使用箇所が継続的にチェックできる環境を整えます。

---

以上の手順で、プロジェクト全体のany型を排除する作業を計画的に実施してください。これにより、より安全で堅牢なコードベースへ移行でき、将来の開発が容易になります。

## 12. 実践例（manmaruの実例）

### 12.1 型安全なエラーハンドリング（栄養計算サービス）

栄養計算サービス（`nutrition-service-impl.ts`）では、以下のような型安全なエラーハンドリングを実装しています：

```typescript
// 適切なエラーコードと型を持つAppErrorの使用
throw new AppError({
    code: ErrorCode.Nutrition.NUTRITION_CALCULATION_ERROR,
    message: `Unusually high calories detected: ${calories}kcal`,
    userMessage: '栄養計算で異常な値が検出されました。結果が正確でない可能性があります。',
    details: { calories, inputs: originalInputs },
    severity: 'warning' // 警告レベル
});
```

### 12.2 カスタム型ガード関数の活用（データ変換）

型の安全性を高めるためのカスタム型ガード関数の実装例：

```typescript
/**
 * 値がStandardizedMealNutrition型かどうかをチェックする型ガード関数
 */
export function isStandardizedMealNutrition(data: unknown): data is StandardizedMealNutrition {
    return (
        typeof data === 'object' &&
        data !== null &&
        'totalCalories' in data &&
        'totalNutrients' in data &&
        Array.isArray((data as StandardizedMealNutrition).totalNutrients)
    );
}

// 使用例
if (nutritionResult.nutrition && isStandardizedMealNutrition(nutritionResult.nutrition)) {
    // ここでは nutritionResult.nutrition は StandardizedMealNutrition 型として扱える
    standardizedNutrition = nutritionResult.nutrition;
} else {
    // 型変換が必要な場合
    const originalNutritionData = nutritionResult.nutrition as unknown as NutritionData;
    standardizedNutrition = createStandardizedMealNutrition(originalNutritionData);
}
```

### 12.3 Union型とオプショナルプロパティの活用（レシピパース）

レシピURL解析では、以下のようにUnion型とオプショナルプロパティを活用して型安全性を高めています：

```typescript
type AnalysisSource = 'parser' | 'ai';  // Union型による有限値の型定義

interface RecipeData {
    title: string;
    servings: string;
    ingredients: Array<{ name: string; quantity?: string }>;  // オプショナルプロパティ
    sourceUrl: string;
    imageUrl?: string;  // オプショナルプロパティ
}
```

### 12.4 配列アクセスの安全な処理（量パーサー）

配列アクセスの結果が `undefined` になる可能性を考慮した安全な処理：

```typescript
private static parseValueString(valueStr: string): number {
    if (valueStr.includes('/')) {
        const parts = valueStr.split('/');
        if (parts.length === 2) {
            const part0 = parts[0];
            const part1 = parts[1];
            if (part0 !== undefined && part1 !== undefined) {
                const numerator = parseFloat(part0);
                const denominator = parseFloat(part1);
                if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                    return numerator / denominator;
                }
            }
        }
    }
    // ... 以下省略
}
```


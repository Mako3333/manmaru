# manmaruアプリ TypeScript型統一・リンターエラー対応ガイドライン

## 1. 目的

- **型安全性の徹底**：any 型の使用を排除し、明示的な型定義でバグの早期発見とコンパイル時の安全性を実現。
- **コード一貫性の確保**：型定義やオプショナルプロパティの扱いを統一し、コードの保守性と可読性を高める。
- **開発効率の向上**：統一された基準で実装・リファクタリングを容易にし、コードレビューを効率化。

---

## 2. 基本方針

- 基本方針対症療法ではなく根本解決を目指す：エラーを抑制するのではなく、問題の根本を特定・解消します。
- 型安全性の徹底：型定義を明確化し、型推論を最大限活用します。
- コードの堅牢性・予測可能性の向上：安全かつ保守しやすいコードを目指します。

### 2.1. 型安全性の原則
- **any型を避ける**：unknownを使い、必ず型ガードや検証関数で型安全を確保。

### 2.2. オプショナルプロパティの扱い
- **採用方針**：`prop?: T` パターンを基本とし、省略可能なプロパティは値がない場合キー自体を省略。
- **推奨例**：
```ts
const result = {
  requiredProp: value,
  ...(optionalValue !== undefined ? { optionalProp: optionalValue } : {})
};
```
- **非推奨例**：
```ts
const result = {
  requiredProp: value,
  optionalProp: undefined
};
```

### 2.3. 型定義の配置と命名規則
- **配置ルール**：
  - 共通型：`src/types/`
  - モジュール固有：`src/lib/[module]/types.ts`
- **命名規則**：
  - インターフェース名は具体的な名前（接頭辞Iを避ける）。例：`GeminiParseResult`
  - 型エイリアスも明確な目的を示す。例：`type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';`

### 2.4. エラーハンドリングの型安全
- **基本方針**：エラーは`unknown`型で受け取り、具体的な型に変換。
- **推奨例**：
```ts
try {
  // 処理
} catch (error: unknown) {
  if (error instanceof AppError) {
    handleAppError(error);
  } else {
    throw new AppError({
      code: ErrorCode.Base.UNKNOWN_ERROR,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
```

---

## 3. 実装上の推奨パターン

### 3.1. スプレッド構文による条件付きプロパティ追加
- **例**：
```ts
const mealData = {
  requiredField: value,
  ...(mealType ? { meal_type: mealType } : {}),
  ...(base64Image ? { image_url: base64Image } : {})
};
```

### 3.2. 未定義値の安全処理
- **例**：
```ts
const formattedDate = selectedDate
  ? selectedDate.toISOString().split('T')[0]
  : new Date().toISOString().split('T')[0];
```

### 3.3. Union型とEnumの使い分け
- 基本的な種別はUnion型を推奨：
```ts
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
```

---

## 4. 型定義の更新・配置計画

1. **共通定義の整備**：`src/types/` 内に共通APIレスポンス・エラー型を整備。
2. **モジュール別型定義ファイル作成**：`src/lib/[module]/types.ts` 形式で整備。
3. **インターフェース統一**：すべてのオプショナルプロパティを統一的に扱う。

---

## 5. 運用と継続的改善

### 5.1. 定期レビューとドキュメント更新
- 定期的なコードレビューを通じて遵守状況を確認し、ガイドラインを更新。

### 5.2. ESLint設定の整備
- ESLintルールを整備し、自動修正機能を有効化。

### 5.3. 新規実装・改修時の徹底
- 新規機能や改修時のコードレビューでガイドライン遵守を必須条件とする。

---

## 6. エラー解決の体系的手順

1. エラーメッセージ分析
2. コードと型定義照合
3. 根本原因特定と型安全な解決策策定
4. リンター再実行
5. ベストプラクティス適合確認
6. ドキュメント化・知識共有

---

## 7. 長期的利点

- 実行時エラー削減
- コードの保守性・拡張性向上
- 開発者体験の向上
- コード品質の一貫性担保


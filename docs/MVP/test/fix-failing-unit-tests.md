# 失敗ユニットテスト修正

## 問題点

1. NextRequestのURL設定問題：
   - whatwg-fetchとNext.jsのNextRequestの互換性の問題
   - モックの実装方法の問題

2. AbortSignal.timeoutのサポート問題：
   - Node.js/Jest環境での非対応APIの問題
   - fetch呼び出しをモックするか、タイムアウト実装を差し替える必要がある

3. テスト期待値の不一致：
   - モックデータと実際の結果の不一致
   - テストケースの期待値を正しく更新する必要がある

## 修正内容

### 1. NextRequestのURL設定問題

問題:
- NextRequestのURLプロパティがテスト環境で正しく機能しない
- whatwg-fetchのモックがNextRequestのプロパティにアクセスできない

対策:
- NextRequestをモックするためのヘルパー関数を作成
- ネイティブRequestオブジェクトを基にしてNextRequestをラップする設計に変更
- 各APIテストで直接NextRequestインスタンスをnewする代わりにヘルパー関数を使用

コード:
```typescript
function createMockNextRequest(url: string, options: RequestInit) {
    // ネイティブのRequestオブジェクトを作成し、NextRequestにラップする
    const request = new Request(url, options);
    // NextRequestのprototypeを使用して新しいオブジェクトを作成
    const mockNextRequest = Object.create(NextRequest.prototype);
    // 元のRequestの必要なプロパティを移行
    Object.defineProperties(mockNextRequest, {
        url: {
            get() { return request.url; }
        },
        method: {
            get() { return request.method; }
        },
        headers: {
            get() { return request.headers; }
        },
        body: {
            get() { return request.body; }
        },
        bodyUsed: {
            get() { return request.bodyUsed; }
        },
        json: {
            value: () => request.json()
        },
        text: {
            value: () => request.text()
        }
    });
    return mockNextRequest;
}
```

適用ファイル:
- `__tests__/app/api/v2/image/analyze/route.test.ts`
- `__tests__/app/api/v2/meal/analyze/route.test.ts`
- `__tests__/app/api/v2/recipe/parse/route.test.ts`

### 2. AbortSignal.timeoutのサポート問題

問題:
- AbortSignal.timeoutはNode.js環境で十分にサポートされていない
- AbortSignal.timeoutのIEとの互換性の問題がJest環境で発生する

対策:
- AbortControllerとsetTimeoutを使用してタイムアウト機能を実装
- タイムアウト制御のために、独自のAbortController実装に切り替え

コード:
```typescript
// AbortSignal.timeoutを使わずにタイムアウトを実装
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);
try {
    const response = await fetch(url, {
        headers: {...},
        signal: controller.signal
    });
    clearTimeout(timeoutId);
    // 続きの処理
} catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
        // タイムアウトエラー処理
    }
    throw error;
}
```

適用ファイル:
- `src/lib/ai/services/gemini-service.ts`

### 3. テスト期待値の不一致

問題:
- Nutrientの型定義とテストのモックデータに不一致があった
- StandardizedMealNutritionの構造が変更されたがテストケースが更新されていなかった

対策:
- Nutrient型に合わせてモックデータを修正
- percentOfRdiなどの古いプロパティを削除
- StandardizedMealNutritionの型に合わせて各プロパティを調整

コード:
```typescript
const mockStandardNutrition: StandardizedMealNutrition = {
    totalCalories: 320,
    totalNutrients: [
        { name: 'タンパク質', value: 15, unit: 'g' },
        { name: '鉄分', value: 2, unit: 'mg' }
    ],
    foodItems: [
        { 
            id: 'chicken', 
            name: '鶏肉', 
            amount: 100, 
            unit: 'g', 
            nutrition: { 
                calories: 100, 
                nutrients: [], 
                servingSize: { value: 100, unit: 'g' } 
            } 
        }
    ],
    reliability: { 
        confidence: 0.85, 
        balanceScore: 70, 
        completeness: 0.9 
    }
};
```

適用ファイル:
- `__tests__/app/api/v2/image/analyze/route.test.ts`
- `__tests__/app/api/v2/meal/analyze/route.test.ts`

## 追加作業

1. 共有モック設定の整理
   - 各テストファイルで重複しているモック定義をヘルパーや共通モジュールに抽出

2. テスト用の環境変数設定
   - 一部のAPIキーや環境変数に依存するテストの環境設定を`.env.test`などに分離

3. テストデータの充実化
   - フィクスチャディレクトリに基本テストデータを追加
   - テスト用画像などの共有リソースを整備

4. テストカバレッジの向上
   - エラーケースのテストを追加
   - バリデーションのテストケースを追加



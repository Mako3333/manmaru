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

4. NextResponse.jsonモックの問題：
   - テスト環境でNextResponse.jsonが正しく動作しない
   - レスポンスオブジェクトのjsonメソッドがundefinedになる問題

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
- `src/app/api/v2/recipe/parse/route.ts`
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
- `__tests__/app/api/v2/recipe/parse/route.test.ts`

### 4. NextResponse.jsonモックの問題

問題:
- テスト環境でNextResponse.jsonメソッドが正しく動作しない
- Route APIハンドラのレスポンスオブジェクトがテスト環境で期待通りに機能しない
- `response.json()`で`Cannot read properties of undefined (reading 'json')`エラーが発生する

対策:
- NextResponse全体をより完全にモックする実装に変更
- jest.setupファイルにNextResponseの基本実装を追加
- テストファイル内で返されるレスポンスオブジェクトに適切なjsonメソッドを実装

コード:
```typescript
// jest.setup.js
// NextResponseのjsonメソッドをモック
if (typeof Response.prototype.json !== 'function') {
    Response.prototype.json = function () {
        return Promise.resolve(JSON.parse(this._bodyText || '{}'));
    };
}

// テストファイル内
jest.mock('next/server', () => {
  const actualNextResponse = jest.requireActual('next/server').NextResponse;
  
  return {
    ...jest.requireActual('next/server'),
    NextResponse: {
      ...actualNextResponse,
      json: jest.fn((data) => {
        return {
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          body: JSON.stringify(data),
          json: () => Promise.resolve(data)
        };
      })
    }
  };
});
```

適用ファイル:
- `jest.setup.js`
- `__tests__/app/api/v2/recipe/parse/route.test.ts`

## 進捗状況

### レシピ解析APIテスト修正状況（2023-05-20）

- NextRequestモックとAbortController実装を修正済み
- テストファイルの構造を最新化し、より簡素なテストケースに修正
- 6テスト中1テストが正常に通過、5テストが失敗
- 主なエラー：`Cannot read properties of undefined (reading 'json')`

次のステップ：
- NextResponse.jsonモックの問題を解決
- テストケースごとのモックデータ設定を改善
- レスポンスチェーンの互換性確保

### 現在の問題点

1. テスト環境の互換性：
   - Jest環境でのDOMExceptionやAbortController実装の差異
   - NextResponseモックによるjsonメソッドの不整合

2. テストの堅牢性：
   - テストが外部依存関係（実装の詳細）に強く結合している
   - 実装変更に弱いテスト設計

3. モック戦略：
   - 一部のモックが必要以上に複雑で、メンテナンスが困難
   - spyOnとmockImplementationの併用によるコード可読性の低下

## 追加作業

1. 共有モック設定の整理
   - 各テストファイルで重複しているモック定義をヘルパーや共通モジュールに抽出
   - テスト間で再利用可能なモック関数やモックデータの整理

2. テスト用の環境変数設定
   - 一部のAPIキーや環境変数に依存するテストの環境設定を`.env.test`などに分離
   - テスト環境固有の設定を明確化

3. テストデータの充実化
   - フィクスチャディレクトリに基本テストデータを追加
   - テスト用画像などの共有リソースを整備

4. テストカバレッジの向上
   - エラーケースのテストを追加
   - バリデーションのテストケースを追加

5. テスト実行の高速化
   - モック戦略の最適化によるテスト実行時間の短縮
   - 並列テスト実行の設定調整



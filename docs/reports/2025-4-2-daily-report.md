◤◢◤◢◤◢◤◢◤◢◤◢◤◢
# 栄養素計算表示ロジックの共通化
## 実装レポート - 2025年4月2日

## 概要

本日は、栄養素計算表示ロジックの共通化を実装しました。ダッシュボードページとホームの栄養サマリーで異なっていた栄養スコア計算ロジックと色クラス取得ロジックを統一し、共通ユーティリティとして切り出しました。これにより、表示の一貫性とコードの保守性が向上しました。

### 実装手順

1. 栄養表示ロジックの分析と統一方針の決定
2. 共通ユーティリティファイルの作成
3. ダッシュボードページの修正
4. 栄養サマリーコンポーネントの修正
5. 型安全性の確保と修正

## 実施内容

### 1. 共通ユーティリティの作成

`src/lib/nutrition/nutrition-display-utils.ts` ファイルを新規作成し、共通の型定義と計算ロジックを実装しました。

```typescript
// 栄養データの型定義（共通で使用する場合は別ファイルに移動すべき）
export interface NutritionData {
    calories_percent: number;
    protein_percent: number;
    iron_percent: number;
    folic_acid_percent: number;
    calcium_percent: number;
    vitamin_d_percent: number;
    // ...その他のプロパティ
}

/**
 * 栄養バランススコアを計算する
 */
export function calculateNutritionScore(nutritionData: NutritionData | null): number {
    if (!nutritionData) return 0;
    
    // 各栄養素の達成率
    const nutrients = [
        nutritionData.calories_percent,
        nutritionData.protein_percent,
        nutritionData.iron_percent,
        nutritionData.folic_acid_percent,
        nutritionData.calcium_percent,
        nutritionData.vitamin_d_percent
    ];
    
    // 各栄養素の達成率をスコア化（理想的な範囲内なら高得点）
    const scores = nutrients.map(percent => {
        if (percent < 50) return percent / 2; // 50%未満は達成率の半分をスコアとする
        if (percent <= 110) return 50; // 50-110%は満点50点
        if (percent <= 130) return 50 - ((percent - 110) / 20) * 25; // 110-130%は徐々に減点
        return 25; // 130%以上は25点
    });
    
    // スコアの合計（300点満点）を100点満点に換算
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    return Math.round(totalScore / 6 * 2); // 各栄養素50点満点×6項目＝300点→100点満点に調整
}

/**
 * 栄養素の状態に応じた色クラスを取得
 */
export function getNutrientColor(percent: number): string {
    if (percent < 50) return 'text-red-500 bg-red-50';
    if (percent < 70) return 'text-orange-500 bg-orange-50';
    if (percent <= 110) return 'text-green-500 bg-green-50';
    if (percent <= 130) return 'text-orange-500 bg-orange-50';
    return 'text-red-500 bg-red-50';
}

/**
 * 栄養素の状態に応じたバーの色を取得
 */
export function getNutrientBarColor(percent: number): string {
    if (percent < 50) return 'bg-red-500';
    if (percent < 70) return 'bg-orange-500';
    if (percent <= 110) return 'bg-green-500';
    if (percent <= 130) return 'bg-orange-500';
    return 'bg-red-500';
}
```

### 2. ダッシュボードの修正

ダッシュボードページ（`src/app/(authenticated)/dashboard/page.tsx`）の内部計算ロジックを削除し、共通ユーティリティを使用するように修正しました。

```typescript
import { NutritionData, calculateNutritionScore, getNutrientColor, getNutrientBarColor } from '@/lib/nutrition/nutrition-display-utils';

// ...

// 栄養バランススコアを計算（共通ユーティリティを使用）
const overall_score = calculateNutritionScore(nutritionProgress);

// ...

// 共通ユーティリティを使用して色クラスを取得
<span className={`px-2 py-1 rounded-full ${getNutrientColor(nutrient.percent)}`}>
    {Math.round(nutrient.percent)}%
</span>
```

### 3. 栄養サマリーの修正

栄養サマリーコンポーネント（`src/components/home/nutrition-summary.tsx`）も共通ユーティリティを使用するように修正し、内部の計算ロジックを削除しました。

```typescript
import { NutritionData, calculateNutritionScore } from '@/lib/nutrition/nutrition-display-utils';

// 栄養バランススコアの計算（共通ユーティリティを使用）
const nutritionScore = calculateNutritionScore(dailyNutrition);

// キーが存在し、値が数値であることを確認
const value = dailyNutrition && 
             typeof dailyNutrition[item.key as keyof NutritionData] === 'number' 
             ? dailyNutrition[item.key as keyof NutritionData] as number 
             : 0;

const percentValue = Math.round(value);
```

### 4. 型安全性の確保

栄養サマリーコンポーネントで発生した型エラーを修正し、undefined の可能性に対処しました。

```typescript
// キーが存在し、値が数値であることを確認
const value = dailyNutrition && 
             typeof dailyNutrition[item.key as keyof NutritionData] === 'number' 
             ? dailyNutrition[item.key as keyof NutritionData] as number 
             : 0;
        
const percentValue = Math.round(value);
```

## 効果と成果

栄養素計算表示ロジックの共通化により、コードの一貫性、保守性、型安全性が向上しました。特に異なるコンポーネント間で統一された計算方法を採用したことで、ユーザー体験の一貫性が確保されました。

今後の改善点としては、型定義の適切な配置、テストの追加、より細かなモジュール分割が考えられます。また、栄養スコア計算アルゴリズムの妥当性についても、専門家の意見を取り入れながら継続的に評価していく必要があります。

これらの変更は、アプリケーション全体の品質向上と、ユーザーにとってより価値のある栄養情報の提供に貢献すると考えられます。

## テスト実装と実行結果

実装した栄養表示ユーティリティの品質を確保するため、単体テストを作成し実行しました。`__tests__/lib/nutrition/nutrition-display-utils.test.ts` に以下の観点でテストケースを作成しました：

### テスト内容

1. **栄養スコア計算のテスト（`calculateNutritionScore`）**
   - null入力の処理確認
   - 理想範囲内（50-110%）の栄養素の得点計算
   - 不足している栄養素（50%未満）の得点計算
   - 過剰摂取（130%超）時の減点処理
   - 様々な値が混在するケースでの総合スコア計算

2. **栄養素カラー表示のテスト（`getNutrientColor`）**
   - 各パーセント範囲（50%未満、50-70%、70-110%、110-130%、130%超）での色クラス生成

3. **栄養素プログレスバーカラーのテスト（`getNutrientBarColor`）**
   - 各パーセント範囲での適切なバー色クラス生成

### テスト結果

テスト実行の結果、作成したすべてのテストケース（合計15件）が正常に通過し、実装の信頼性が確認できました：

```
 PASS  __tests__/lib/nutrition/nutrition-display-utils.test.ts
  栄養表示ユーティリティ
    calculateNutritionScore                                                                            
      √ nullが渡された場合は0を返す
      √ すべての栄養素が理想的な範囲内（50-110%）の場合、満点に近いスコアを返す
      √ 栄養素が不足している（50%未満）場合、低いスコアを返す
      √ 栄養素が過剰（130%超）の場合、減点される
      √ 栄養素が混在している場合、適切なスコアを返す
    getNutrientColor                                                                                   
      √ 50%未満の場合、赤色を返す
      √ 50%～70%未満の場合、オレンジ色を返す
      √ 70%～110%の場合、緑色を返す
      √ 110%超～130%以下の場合、オレンジ色を返す
      √ 130%超の場合、赤色を返す
    getNutrientBarColor                                                                                
      √ 50%未満の場合、赤色を返す
      √ 50%～70%未満の場合、オレンジ色を返す
      √ 70%～110%の場合、緑色を返す
      √ 110%超～130%以下の場合、オレンジ色を返す
      √ 130%超の場合、赤色を返す
```

特に注目すべき点として、栄養スコア計算ロジックの複雑なケース（混合した栄養素値）でも期待通りの結果が得られたことが挙げられます。これにより、ユーザーに提示される栄養バランススコアの信頼性が担保されました。

### テストによる効果

単体テストの実施により、以下の効果が得られました：

1. **計算ロジックの検証**: 特に複雑な栄養スコア計算のアルゴリズムが正確に動作することを確認
2. **エッジケースの確認**: 境界値（ちょうど50%や110%など）での適切な動作を検証
3. **リファクタリングの安全性**: 今後のコード修正時にも、テストによって機能の正常性を確認可能
4. **仕様の明確化**: テストコードが仕様書としての役割も果たし、期待される動作が明確に

テスト駆動開発（TDD）の観点からは後付けでのテスト作成となりましたが、共通ロジックの信頼性を確保する上で有効な取り組みとなりました。

## 実装者の所感と気づき

### 良かった点

1. **責任の明確化**: 表示用ロジックを共通ユーティリティに移動したことで、コンポーネントの責任がより明確になりました。コンポーネントはデータの取得と表示に集中し、計算ロジックはユーティリティに委譲されています。

2. **一貫した計算方法**: 以前は単純平均と重み付け計算という異なるアルゴリズムが混在していましたが、より洗練された計算方法に統一したことで、ユーザーに一貫した評価を提供できるようになりました。

3. **型の活用**: TypeScriptの型を活用することで、共通ユーティリティへの移行が安全に行えました。特に、未定義値の処理や型チェックが強化された点は重要です。

### 懸念点と改善の余地

1. **モジュール分割の粒度**: 現在のユーティリティはやや多機能であり、将来的にはさらに細かい粒度に分割することが考えられます。特に表示用と計算用の関数を別々のモジュールに分けることで、コードの再利用性が向上する可能性があります。

2. **テストの不足**: 計算ロジックを移動したものの、それに対応するテストが追加されていません。栄養スコア計算の正確性を担保するためには、ユニットテストの追加が重要です。

3. **さらなる標準化**: 色クラスやスタイルの生成ロジックは、より広範なデザインシステムの一部として整理できる可能性があります。他のコンポーネントでも同様のパターンがあれば、より包括的な標準化を検討すべきです。

4. **型定義の場所**: `NutritionData` インターフェイスは現在ユーティリティファイル内で定義されていますが、アプリケーション全体の型定義を一元管理するアプローチを検討すべきです。「栄養データ型標準化ガイドライン」との整合性を確保する必要があります。

## まとめ

栄養素計算表示ロジックの共通化により、コードの一貫性、保守性、型安全性が向上しました。特に異なるコンポーネント間で統一された計算方法を採用したことで、ユーザー体験の一貫性が確保されました。

今後の改善点としては、型定義の適切な配置、テストの追加、より細かなモジュール分割が考えられます。また、栄養スコア計算アルゴリズムの妥当性についても、専門家の意見を取り入れながら継続的に評価していく必要があります。

これらの変更は、アプリケーション全体の品質向上と、ユーザーにとってより価値のある栄養情報の提供に貢献すると考えられます。

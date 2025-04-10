# 新デザイン導入のための指示

## 優先的な変更点

1. **ヘッダー部分の改善**
   - 下部に丸みを持たせ、border-radius: 0 0 24px 24px を適用
   - グラデーション背景を適用（linear-gradient(135deg, #2E9E6C, #237D54)）
   - ヘッダー内の余白を増やし（padding-bottom: 32px）、視覚的な余裕を持たせる
   - 影効果を追加（box-shadow: 0 4px 20px rgba(46, 158, 108, 0.25)）

2. **カードデザインの統一**
   - すべての情報ブロックに一貫したカードスタイルを適用
   - 角丸を強調（border-radius: 16px）
   - 影効果を追加（box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05)）
   - カード内の余白を増やす（padding: 24px）

3. **妊娠進捗カードの改良**
   - 背景に微妙なグラデーションを適用（linear-gradient(to right, #F0F7F4, #F0F7FA)）
   - 「妊娠19週目」をバッジスタイルで強調表示
   - 進捗バーの視覚的な改善（高さを8pxに、より鮮明な色で）
   - カード右下に装飾的な丸要素を配置（::after擬似要素で実装）

4. **アクションボタンの改良**
   - 「食事を記録」ボタンをより洗練されたデザインに
   - アイコンと説明テキストのレイアウト改善
   - ホバー/アクティブ状態の視覚的フィードバックを追加

5. **栄養情報の視覚化改善**
   - 円グラフでの栄養スコア表示
   - 栄養素アイテムにアイコンと色分けを追加
   - 2×2のグリッドレイアウトで栄養素を表示

6. **アドバイスカードのデザイン改良**
   - 引用符デザインを追加
   - 「今日のアドバイス」バッジを上部中央に配置
   - 背景色を薄い緑色に変更（#F0F7F4）

## 実装手順

1. まず共通の変数とスタイルを定義
   ```css
   :root {
     /* カラーパレット */
     --primary: #2E9E6C;
     --primary-dark: #237D54;
     --primary-light: #A7D7C1;
     /* その他の色変数 */
     
     /* サイズ */
     --radius-sm: 8px;
     --radius-md: 16px;
     --radius-lg: 24px;
     --spacing-xs: 4px;
     /* その他のスペーシング変数 */
   }
   ```

2. ヘッダーコンポーネントの更新
   - より大きなアバターアイコン
   - 余白と丸みの調整

3. 各カードコンポーネントのスタイル更新
   - 共通のカードスタイルを適用
   - コンポーネント固有のスタイル調整

4. 進捗表示コンポーネントの改良
   - バッジスタイルとアニメーション効果の追加
   - より直感的な進捗表示

5. データ表示方法の更新
   - 栄養素データの視覚的表現の改善
   - アイコンと色分けの導入

## コードの更新ポイント

- `components/home/pregnancy-week-info.tsx`
- `components/home/nutrition-summary.tsx`
- `components/home/action-card.tsx`
- `components/home/advice-card.tsx`
- `components\home\home-client.tsx`
- `styles/globals.css`（または該当するCSSモジュール）

## 注意点

- デザイン変更はモバイルファーストで実装し、さまざまな画面サイズでのテストが必要
- アニメーションやトランジションは控えめに使用し、パフォーマンスへの影響を最小限に
- アクセシビリティを考慮し、色のコントラストやフォントサイズを適切に設定
- 変更は段階的に適用し、各ステップでユーザーテストを行うことを推奨

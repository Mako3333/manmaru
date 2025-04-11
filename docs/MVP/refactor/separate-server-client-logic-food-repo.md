### 課題2: Basic Food Repository リファクタリング
#### チケット名: refactor/separate-server-client-logic-food-repo
#### タイトル: リファクタリング: basic-food-repository.ts のサーバー/クライアントロジック分離
##### 説明
npm run build 実行時に Module not found: Can't resolve 'fs/promises' が発生します。src/lib/food/basic-food-repository.ts 内でサーバーサイド専用の fs/promises が使用されていますが、クライアントサイドからも参照されている可能性があります。サーバーサイド処理とクライアントサイド処理を明確に分離するか、クライアントサイドからの不適切な呼び出しを修正する必要があります。
##### 優先度: 高
##### 完了条件
ビルドが正常に完了し、サーバーサイド専用モジュールがクライアントサイドバンドルに含まれないようにリファクタリングすること。
### 課題1: Tailwind Scrollbar Hide ビルドエラー修正
#### チケット名: MVP/bug/fix-tailwind-scrollbar-hide
#### タイトル: ビルドエラー修正: tailwind-scrollbar-hide モジュールが見つからない
#### 説明:
npm run build 実行時に `Error: Cannot find module 'tailwind-scrollbar-hide'` が発生します。tailwind.config.ts で参照されていますが、依存関係が正しくインストールされていないか、設定に問題がある可能性があります。
#### 優先度: 高
#### 完了条件:
package.json, node_modules, tailwind.config.ts を調査し、ビルドが正常に完了するように問題を解決すること。
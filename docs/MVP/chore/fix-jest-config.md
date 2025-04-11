## 課題: Jest 設定を修正し、テストを実行可能にする (`chore/fix-jest-config`)

**優先度:** 高

**ラベル:** `bug`, `test`, `config`

**説明:**

現在、`npm run test` を実行すると Jest がエラーで失敗し、テストスイート全体を実行できない状態です。これは `jest.setup.js` におけるモジュール形式 (`require`/`import`) の扱いと、Jest および関連設定 (TypeScript, Babel) の間で不整合が発生していることが原因と考えられます。

コードの品質保証とリグレッション防止のため、この問題を解決し、テストを正常に実行できるようにする必要があります。

**発生しているエラー:**

1.  **`jest.setup.js` で `import` を使用した場合:**
    ```
    SyntaxError: Cannot use import statement outside a module
    ```
    (エラー発生箇所: `jest.setup.js` の `import '@testing-library/jest-dom';` など)

2.  **`jest.setup.js` で `require` を使用した場合:**
    ```
    Cannot find module '@testing-library/jest-dom' from 'jest.setup.js'
    ```
    (エラー発生箇所: `jest.setup.js` の `require('@testing-library/jest-dom');` など)

**考えられる原因:**

*   **Jest の設定 (`jest.config.js` / `package.json`)**:
    *   ES Modules / CommonJS のトランスフォーム設定 (`transform`, `preset`) が正しくない。
    *   `transformIgnorePatterns` が適切でなく、`node_modules` 内の必要なライブラリがトランスフォームされていない可能性がある。
    *   `moduleNameMapper` の設定が不足または誤っている。
*   **TypeScript の設定 (`tsconfig.json`)**:
    *   `compilerOptions.module` の設定 (`"ESNext"` など) が Jest の実行環境と互換性がない可能性がある。
*   **Babel の設定 (もし使用している場合)**:
    *   Babel プラグインの設定が不足または誤っている。

**試したこと:**

1.  `jest.setup.js` 内の `require` を `import` に変更 → 上記エラー 1 が発生。
2.  `jest.setup.js` 内の `import` を `require` に戻す → 上記エラー 2 が発生。

**対応方針案:**

1.  `jest.config.js`, `tsconfig.json`, `babel.config.js` (存在する場合) の設定を詳細にレビューし、ES Modules と CommonJS の両方を適切に扱えるように修正する。
2.  特に `transform`, `transformIgnorePatterns`, `moduleNameMapper` の設定を見直す。Next.js の SWC や `ts-jest` の設定との兼ね合いも考慮する。
3.  Next.js の Jest 連携に関する公式ドキュメントやベストプラクティスを参照する。
4.  段階的に設定を変更し、エラーメッセージの変化を確認しながら原因を特定・修正する。

**完了条件:**

*   `npm run test` がエラーなく実行され、すべてのテストスイートが正常に完了（パスまたはフェイル）する。


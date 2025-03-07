/**
 * シンプルなテンプレートエンジン
 * ハンドルバーライクな構文でテンプレート処理を行う
 */
export class TemplateEngine {
    /**
     * テンプレートをレンダリング
     * @param template テンプレート文字列
     * @param context コンテキストデータ
     * @returns レンダリングされた文字列
     */
    static render(template: string, context: Record<string, any>): string {
        try {
            // レンダリング開始をログ
            // console.log('テンプレートレンダリング開始');

            let result = template;
            let iterations = 0;
            const maxIterations = 5; // 無限ループ防止

            // 完全に処理されるまで繰り返し
            while (iterations < maxIterations) {
                iterations++;
                const prevResult = result;

                // 一連の処理を実行
                result = this.processTemplate(result, context);

                // 変更がなければ処理完了
                if (prevResult === result) {
                    // console.log(`テンプレートレンダリング完了 (${iterations}回の処理)`);
                    break;
                }
            }

            if (iterations === maxIterations) {
                console.warn('警告: テンプレート処理の最大繰り返し回数に達しました。無限ループの可能性があります。');
            }

            return result;
        } catch (error) {
            console.error('テンプレート処理中にエラーが発生しました:', error);
            return `テンプレート処理エラー: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    /**
     * テンプレート全体を処理
     */
    private static processTemplate(template: string, context: Record<string, any>): string {
        // コンテキスト内の配列を検出して前処理
        Object.entries(context).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                // console.log(`コンテキスト内の配列を検出: ${key}, 要素数: ${value.length}`);
            }
        });

        // 1. まず最深部のブロックから処理するために、ループ・条件ブロックを処理
        let processed = this.processNestedBlocks(template, context);

        // 2. 最後に単純な変数置換
        processed = this.replaceVariables(processed, context);

        return processed;
    }

    /**
     * ネストされたブロックを処理
     */
    private static processNestedBlocks(template: string, context: Record<string, any>): string {
        // 一定回数の処理で確実に終了させる
        const maxPasses = 10;
        let result = template;

        for (let pass = 0; pass < maxPasses; pass++) {
            const prevResult = result;

            // 深い方から処理するため、まずループ処理
            result = this.processLoopBlocks(result, context);

            // 次に条件処理
            result = this.processConditionalBlocks(result, context);

            // 変更がなければ処理終了
            if (prevResult === result) break;
        }

        return result;
    }

    /**
     * 変数の置換処理
     */
    private static replaceVariables(template: string, context: Record<string, any>): string {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            const trimmedPath = path.trim();

            // 制御構文はスキップ
            if (trimmedPath.startsWith('#') || trimmedPath.startsWith('/')) {
                return match;
            }

            // @index の特殊処理
            if (trimmedPath === '@index') {
                return context['@index'] !== undefined ? String(context['@index']) : '';
            }

            // this の特殊処理
            if (trimmedPath === 'this') {
                const item = context['this'];
                return item !== undefined ?
                    (typeof item === 'object' ? JSON.stringify(item) : String(item)) : '';
            }

            // 通常の変数取得
            const value = this.getNestedValue(trimmedPath, context);
            return value !== undefined ? String(value) : '';
        });
    }

    /**
     * 条件ブロックの処理
     */
    private static processConditionalBlocks(template: string, context: Record<string, any>): string {
        // if/else ブロックのパターン
        const ifRegex = /\{\{\s*#if\s+([^}]+)\s*\}\}([\s\S]*?)(?:\{\{\s*else\s*\}\}([\s\S]*?))?\{\{\s*\/if\s*\}\}/g;

        // すべての条件ブロックを処理
        let result = template;
        let matches = [];
        let match;

        // マッチを全て収集
        while ((match = ifRegex.exec(template)) !== null) {
            matches.push({
                fullMatch: match[0],
                condition: match[1].trim(),
                ifContent: match[2],
                elseContent: match[3] || ''
            });
        }

        // マッチがなければ終了
        if (matches.length === 0) return template;

        // 最後のマッチから処理（ネスト対応）
        for (let i = matches.length - 1; i >= 0; i--) {
            const { fullMatch, condition, ifContent, elseContent } = matches[i];

            try {
                const conditionValue = this.evaluateCondition(condition, context);
                // console.log(`条件評価: ${condition} => ${conditionValue}`);

                // 条件に応じてコンテンツを選択
                const selectedContent = conditionValue ? ifContent : elseContent;

                // 選択されたコンテンツ内も再帰的に処理
                // const processedContent = this.processNestedBlocks(selectedContent, context);

                // 結果を置換
                result = result.replace(fullMatch, selectedContent);
            } catch (error) {
                console.error(`条件ブロック処理エラー [${condition}]:`, error);
                result = result.replace(fullMatch, `<!-- 条件処理エラー: ${error instanceof Error ? error.message : String(error)} -->`);
            }
        }

        return result;
    }

    /**
     * 繰り返しブロックの処理
     */
    private static processLoopBlocks(template: string, context: Record<string, any>): string {
        const eachRegex = /\{\{\s*#each\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/each\s*\}\}/g;

        // すべてのループブロックを処理
        let result = template;
        let matches = [];
        let match;

        // マッチを全て収集
        while ((match = eachRegex.exec(template)) !== null) {
            matches.push({
                fullMatch: match[0],
                arrayPath: match[1].trim(),
                itemTemplate: match[2]
            });
        }

        // マッチがなければ終了
        if (matches.length === 0) return template;

        // 最後のマッチから処理（ネスト対応）
        for (let i = matches.length - 1; i >= 0; i--) {
            const { fullMatch, arrayPath, itemTemplate } = matches[i];

            try {
                const array = this.getNestedValue(arrayPath, context);

                if (!Array.isArray(array) || array.length === 0) {
                    // 配列が空または存在しない場合は空文字に置換
                    result = result.replace(fullMatch, '');
                    continue;
                }

                console.log(`処理中の配列: ${arrayPath}, 要素数: ${array.length}`);

                // 各アイテムを処理して結合
                const processedItems = array.map((item, index) => {
                    try {
                        // 各項目用のローカルコンテキストを作成
                        const itemContext = { ...context, '@index': index, 'this': item };

                        // まず変数置換
                        let processed = itemTemplate;

                        // 条件とループの処理（条件→変数の順に適用する必要がある）
                        processed = this.replaceItemVariables(processed, item, itemContext);

                        return processed;
                    } catch (error) {
                        console.error(`アイテム処理エラー [${index}]:`, error);
                        return `<!-- アイテム処理エラー: ${error instanceof Error ? error.message : String(error)} -->`;
                    }
                }).join('');

                // 結果を置換
                result = result.replace(fullMatch, processedItems);
            } catch (error) {
                console.error(`ループブロック処理エラー [${arrayPath}]:`, error);
                result = result.replace(fullMatch, `<!-- ループ処理エラー: ${error instanceof Error ? error.message : String(error)} -->`);
            }
        }

        return result;
    }

    /**
     * ループ内アイテムの変数置換（特別処理）
     */
    private static replaceItemVariables(template: string, item: any, itemContext: Record<string, any>): string {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            const trimmedPath = path.trim();

            // 制御構文はスキップ
            if (trimmedPath.startsWith('#') || trimmedPath.startsWith('/')) {
                return match;
            }

            // @index の特殊処理
            if (trimmedPath === '@index') {
                return String(itemContext['@index']);
            }

            // this の特殊処理
            if (trimmedPath === 'this') {
                return typeof item === 'object' ? JSON.stringify(item) : String(item);
            }

            // アイテム自体のプロパティへの直接アクセス
            if (typeof item === 'object' && item !== null) {
                // まずドット区切りでのアクセスを試みる
                const itemValue = this.getNestedValue(trimmedPath, item);
                if (itemValue !== undefined) {
                    return typeof itemValue === 'object' ?
                        JSON.stringify(itemValue) : String(itemValue);
                }
            }

            // アイテムから取得できなければ親コンテキストから取得
            const contextValue = this.getNestedValue(trimmedPath, itemContext);
            return contextValue !== undefined ?
                (typeof contextValue === 'object' ?
                    JSON.stringify(contextValue) : String(contextValue)) : '';
        });
    }

    /**
     * ネストされた値の取得
     */
    private static getNestedValue(path: string, obj: Record<string, any>): any {
        if (!path || !obj) return undefined;

        try {
            // ドット記法で階層を分割
            return path.split('.').reduce((prev, curr) => {
                return prev && typeof prev === 'object' ? prev[curr] : undefined;
            }, obj);
        } catch (error) {
            console.error(`パス解決エラー [${path}]:`, error);
            return undefined;
        }
    }

    /**
     * 条件式の評価
     */
    private static evaluateCondition(condition: string, context: Record<string, any>): boolean {
        // '@index'の特殊処理（インデックスが0より大きい場合に真）
        if (condition === '@index') {
            return context['@index'] !== undefined && context['@index'] > 0;
        }

        // 'array.length' のような長さチェック
        if (condition.endsWith('.length')) {
            const arrayPath = condition.slice(0, -7);
            const array = this.getNestedValue(arrayPath, context);
            return Array.isArray(array) && array.length > 0;
        }

        // 通常の変数評価
        const value = this.getNestedValue(condition, context);
        return !!value;
    }
}
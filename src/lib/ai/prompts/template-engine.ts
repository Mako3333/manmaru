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
    static render(template: string, context: Record<string, any> = {}): string {
        // 変数置換
        let result = this.replaceVariables(template, context);

        // 条件ブロック処理
        result = this.processConditionalBlocks(result, context);

        // 繰り返しブロック処理
        result = this.processLoopBlocks(result, context);

        return result;
    }

    /**
     * 変数の置換処理
     */
    private static replaceVariables(template: string, context: Record<string, any>): string {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => {
            // trim と条件演算子の除去
            const trimmedPath = path.trim();

            if (trimmedPath.startsWith('if') ||
                trimmedPath.startsWith('each') ||
                trimmedPath.startsWith('/if') ||
                trimmedPath.startsWith('/each')) {
                return `{{${trimmedPath}}}`; // 条件/ループブロックはそのまま
            }

            return this.getNestedValue(trimmedPath, context) ?? '';
        });
    }

    /**
     * 条件ブロックの処理
     */
    private static processConditionalBlocks(template: string, context: Record<string, any>): string {
        const ifRegex = /\{\{\s*if\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/if\s*\}\}/g;

        return template.replace(ifRegex, (_, condition, content) => {
            const conditionValue = this.evaluateCondition(condition.trim(), context);
            return conditionValue ? content : '';
        });
    }

    /**
     * 繰り返しブロックの処理
     */
    private static processLoopBlocks(template: string, context: Record<string, any>): string {
        const eachRegex = /\{\{\s*each\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/each\s*\}\}/g;

        return template.replace(eachRegex, (_, arrayPath, content) => {
            const array = this.getNestedValue(arrayPath.trim(), context);

            if (!Array.isArray(array)) {
                return '';
            }

            return array.map((item, index) => {
                // 配列の各アイテムをコンテキストとしてコンテンツをレンダリング
                return this.render(content, {
                    ...context,
                    'this': item,
                    'item': item,
                    '@index': index
                });
            }).join('');
        });
    }

    /**
     * ネストされた値の取得
     */
    private static getNestedValue(path: string, obj: Record<string, any>): any {
        return path.split('.').reduce((prev, curr) => {
            return prev && typeof prev === 'object' ? prev[curr] : undefined;
        }, obj);
    }

    /**
     * 条件式の評価
     */
    private static evaluateCondition(condition: string, context: Record<string, any>): boolean {
        // 否定条件
        if (condition.startsWith('!')) {
            return !this.evaluateCondition(condition.substring(1).trim(), context);
        }

        // 単純な条件評価
        const value = this.getNestedValue(condition, context);

        // 配列の場合は長さをチェック
        if (Array.isArray(value)) {
            return value.length > 0;
        }

        // 真偽値評価
        return !!value;
    }
} 
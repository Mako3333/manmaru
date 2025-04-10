/**
 * シンプルなテンプレートエンジン
 * ハンドルバーライクな構文でテンプレート処理を行う
 */
import { AppError, ErrorCode } from '@/lib/error';

export class TemplateEngine {
    /**
     * テンプレートをレンダリング
     * @param template テンプレート文字列
     * @param context コンテキストデータ
     * @returns レンダリングされた文字列
     */
    static render(template: string, context: Record<string, unknown>): string {
        try {
            // レンダリング開始をログ
            // console.log('テンプレートレンダリング開始');

            let processedTemplate = template;
            processedTemplate = TemplateEngine.processConditionalBlocks(processedTemplate, context);
            processedTemplate = TemplateEngine.processLoopBlocks(processedTemplate, context);
            processedTemplate = TemplateEngine.replaceVariables(processedTemplate, context);
            // ネストしたブロックの処理（もし必要なら）
            processedTemplate = TemplateEngine.processNestedBlocks(processedTemplate, context);

            if (processedTemplate === template) {
                // console.log(`テンプレートレンダリング完了`);
            } else {
                // console.log(`テンプレートレンダリング完了 (${processedTemplate.length - template.length}文字の変更)`);
            }

            return processedTemplate;
        } catch (error: unknown) {
            if (error instanceof AppError) {
                throw error; // AppError はそのままスロー
            }
            // 想定外のエラーは AppError でラップ (ガイドラインに沿った形式)
            console.error('Template rendering failed:', error);
            throw new AppError({
                code: ErrorCode.AI.PARSING_ERROR,
                message: `Template rendering failed: ${error instanceof Error ? error.message : String(error)}`,
                // userMessage はデフォルトに任せるか、別途定義
                originalError: error instanceof Error ? error : undefined
            });
        }
    }

    /**
     * テンプレート全体を処理
     */
    private static processTemplate(template: string, context: Record<string, unknown>): string {
        // コンテキスト内の配列を検出して前処理
        Object.entries(context).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                // console.log(`コンテキスト内の配列を検出: ${key}, 要素数: ${value.length}`);
            }
        });

        // 1. まず最深部のブロックから処理するために、ループ・条件ブロックを処理
        let processed = TemplateEngine.processNestedBlocks(template, context);

        // 2. 最後に単純な変数置換
        processed = TemplateEngine.replaceVariables(processed, context);

        return processed;
    }

    /**
     * ネストされたブロックを処理
     */
    private static processNestedBlocks(template: string, context: Record<string, unknown>): string {
        // ネストされたブロック（例: ループ内の条件分岐）を再帰的に処理する可能性がある場合
        // この実装はテンプレートの複雑さに依存する
        // 簡単な例として、一度全ての処理を適用した後にもう一度適用する
        // より堅牢な実装には、テンプレートの構造を解析する必要があるかもしれない
        let previouslyProcessed: string;
        let currentlyProcessed = template;
        let counter = 0;
        const maxIterations = 5; // 無限ループ防止

        do {
            previouslyProcessed = currentlyProcessed;
            currentlyProcessed = TemplateEngine.processConditionalBlocks(currentlyProcessed, context);
            currentlyProcessed = TemplateEngine.processLoopBlocks(currentlyProcessed, context);
            currentlyProcessed = TemplateEngine.replaceVariables(currentlyProcessed, context);
            counter++;
        } while (previouslyProcessed !== currentlyProcessed && counter < maxIterations);

        if (counter === maxIterations) {
            console.warn('TemplateEngine: Max processing iterations reached. Potential infinite loop or complex nesting.');
        }

        return currentlyProcessed;
    }

    /**
     * 変数の置換処理
     */
    private static replaceVariables(template: string, context: Record<string, unknown>): string {
        // {{ variable }} または {{ object.property }} 形式の変数を検索
        const regex = /{{\s*([\w.-]+)\s*}}/g;
        return template.replace(regex, (match, variablePath) => {
            const value = TemplateEngine.getNestedValue(variablePath.trim(), context);
            // null または undefined の場合は空文字に置換
            if (value === null || typeof value === 'undefined') {
                return '';
            }
            // オブジェクトや配列の場合は JSON 文字列に変換（またはエラー）
            if (typeof value === 'object') {
                try {
                    return JSON.stringify(value); // 開発中は有用だが、本番では要検討
                } catch {
                    return '[Object]'; // シリアライズできない場合
                }
            }
            return String(value);
        });
    }

    /**
     * 条件ブロックの処理
     */
    private static processConditionalBlocks(template: string, context: Record<string, unknown>): string {
        const regex = /{{\s*#if\s+([\w.-]+)\s*}}([\s\S]*?){{\s*\/if\s*}}/g;
        return template.replace(regex, (match, conditionVariable, content) => {
            const value = TemplateEngine.getNestedValue(conditionVariable.trim(), context);
            // value が truthy (null, undefined, false, 0, "" でない) 場合に content を返す
            // 厳密な boolean チェックが必要な場合は `value === true` とする
            if (value) {
                // 条件ブロック内のテンプレートを再帰的に処理
                return TemplateEngine.processTemplate(content, context);
            }
            return '';
        });
    }

    /**
     * 繰り返しブロックの処理
     */
    private static processLoopBlocks(template: string, context: Record<string, unknown>): string {
        const regex = /{{\s*#each\s+([\w.-]+)\s*}}([\s\S]*?){{\s*\/each\s*}}/g;
        return template.replace(regex, (match, loopVariablePath, loopContent) => {
            const loopVariable = TemplateEngine.getNestedValue(loopVariablePath.trim(), context);

            if (!Array.isArray(loopVariable)) {
                console.warn(`TemplateEngine: Variable "${loopVariablePath}" is not an array. Skipping loop.`);
                // エラーにするか、空文字を返すか、ログを出すかは要件による
                // ここでは空文字を返す
                return '';
            }

            let result = '';
            loopVariable.forEach((item, index) => {
                // 各ループアイテム用のコンテキストを作成
                // item がオブジェクトでない場合は `this` としてアクセスできるようにする
                const itemContext: Record<string, unknown> = {
                    // 元のコンテキストを継承
                    ...context,
                    // item がオブジェクトの場合、そのプロパティを展開
                    ...(typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}),
                    // item 自体を 'this' または特定の変数名（例: 'item'）でアクセス可能にする
                    this: item,
                    item: item, // 'item' という名前でもアクセス可能にする (オプション)
                    '@index': index, // インデックス番号
                    '@first': index === 0, // 最初の要素か
                    '@last': index === loopVariable.length - 1, // 最後の要素か
                };
                // ループの内容を各アイテムのコンテキストで処理
                // ループ内容内の変数置換やネストしたブロック処理は processTemplate で行う
                result += TemplateEngine.processTemplate(loopContent, itemContext);
            });
            return result;
        });
    }

    /**
     * ループ内アイテムの変数置換（特別処理）
     */
    private static replaceItemVariables(template: string, item: unknown, itemContext: Record<string, unknown>): string {
        const regex = /{{\s*([\w.-]+)\s*}}/g;
        return template.replace(regex, (match, variablePath) => {
            let value: unknown;
            // まず itemContext (ループ変数やインデックスなどを含む) から検索
            if (variablePath.startsWith('@') || variablePath === 'this' || variablePath === 'item') {
                value = TemplateEngine.getNestedValue(variablePath, itemContext);
            } else if (typeof item === 'object' && item !== null) {
                // item がオブジェクトの場合、item のプロパティとして検索
                value = TemplateEngine.getNestedValue(variablePath, item as Record<string, unknown>);
            } else if (variablePath === 'this' || variablePath === 'item') {
                // item がプリミティブの場合、'this' または 'item' でアクセス
                value = item;
            }

            // itemContext や item で見つからなかった場合、元の全体コンテキストから検索
            if (typeof value === 'undefined') {
                value = TemplateEngine.getNestedValue(variablePath, itemContext); // itemContext には元の context が含まれている想定
            }

            if (value === null || typeof value === 'undefined') {
                return '';
            }
            if (typeof value === 'object') {
                try {
                    return JSON.stringify(value);
                } catch {
                    return '[Object]';
                }
            }
            return String(value);
        });
    }

    /**
     * ネストされた値の取得
     */
    private static getNestedValue(path: string, obj: Record<string, unknown>): unknown {
        if (!path || !obj) return undefined;

        try {
            // ドット記法で階層を分割
            // reduce のコールバックが unknown を返す可能性があるため、
            // prev の型を unknown にするか、アサーションを使う
            return path.split('.').reduce((prev: unknown, curr: string) => {
                // prev が オブジェクトであることを確認してからアクセス
                if (prev && typeof prev === 'object' && curr in (prev as Record<string, unknown>)) {
                    return (prev as Record<string, unknown>)[curr];
                }
                return undefined;
            }, obj);
        } catch (error) {
            console.error(`パス解決エラー [${path}]:`, error);
            return undefined;
        }
    }
}
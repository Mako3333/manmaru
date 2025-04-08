import { useState, useCallback } from 'react';
import { ApiAdapter } from '@/lib/api/api-adapter';
import { ApiResponse } from '@/types/api-interfaces';
import { AppError, ErrorCode } from '@/lib/error';

/**
 * API通信の状態を表す型
 */
export interface ApiState<T> {
    data?: T;
    loading: boolean;
    error?: AppError;
    errorDetails?: unknown;
}

/**
 * API通信用のカスタムフック
 */
export function useApi<T>() {
    const [state, setState] = useState<ApiState<T>>({
        loading: false
    });

    /**
     * APIリクエストを実行
     * 
     * @param url APIのエンドポイントURL
     * @param options fetchオプション
     * @param legacyFormat レガシー形式の使用フラグ
     * @returns 成功時はデータを、エラー時はエラーオブジェクトを返す
     */
    const request = useCallback(async <R = T>(
        url: string,
        options?: RequestInit,
        legacyFormat = false
    ): Promise<ApiResponse<R> | null> => {
        setState({ loading: true });

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers
                }
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    throw new Error(`${response.status}: ${response.statusText}`);
                }

                // エラーレスポンスの解析
                if (errorData.error) {
                    throw new Error(
                        typeof errorData.error === 'string'
                            ? errorData.error
                            : errorData.error.message || '不明なエラーが発生しました'
                    );
                }

                throw new Error('サーバーエラーが発生しました');
            }

            const result = await response.json();

            // 標準APIレスポンス形式かどうかを判定
            const isStandardFormat = 'success' in result && (result.data !== undefined || result.error !== undefined);

            if (isStandardFormat && !legacyFormat) {
                // 標準APIレスポンス形式の処理
                const typedResult = result as ApiResponse<R>;

                if (!typedResult.success) {
                    throw new Error(
                        typedResult.error?.message || '不明なエラーが発生しました',
                        { cause: typedResult.error }
                    );
                }

                // 型Tとして状態を更新（同じ型の場合のみ）
                if (typedResult.data as unknown === result.data) {
                    setState({
                        data: typedResult.data as unknown as T,
                        loading: false
                    });
                }

                // undefined の場合は null を返す
                return typedResult;
            } else if (isStandardFormat && legacyFormat) {
                // 標準形式から旧形式への変換
                console.warn('ApiAdapter.convertStandardToLegacy is temporarily disabled due to type mismatch.');
                const legacyData = null; // 一時的に null を設定

                // 型Tとして状態を更新（同じ型の場合のみ）
                // if (legacyData !== null && legacyData !== undefined) { // legacyData が null なので実行されない
                //     setState({
                //         data: legacyData as unknown as T,
                //         loading: false
                //     });
                // }

                // undefined の場合は null を返す -> ApiResponse形式で返す必要あり
                // return { success: true, data: legacyData }; // legacyData は null なので data: null で返す
                // legacyFormat が true の場合、旧形式 (データのみ) を期待している可能性もあるが、
                // ここでは ApiResponse 形式で統一し、データがないことを示す
                return { success: false, error: { code: ErrorCode.Base.DATA_PROCESSING_ERROR, message: 'Legacy format conversion is disabled.' }, data: undefined };
            } else {
                // 旧形式のAPIレスポンス（そのまま返す）
                // 型Tとして状態を更新（同じ型の場合のみ）
                if (result as unknown === result) {
                    setState({
                        data: result as unknown as T,
                        loading: false
                    });
                }

                // undefined の場合は null を返す
                return { success: true, data: result as R };
            }

        } catch (error) {
            console.error('API request failed:', error);

            const errorMessage = error instanceof Error ? error.message : '通信エラーが発生しました';
            const errorDetails = error instanceof Error ? error.cause : undefined;

            const appError = error instanceof AppError
                ? error
                : new AppError({
                    code: ErrorCode.Base.NETWORK_ERROR,
                    message: errorMessage,
                    originalError: error instanceof Error ? error : undefined,
                });

            setState({
                loading: false,
                error: appError,
                errorDetails
            });

            return null;
        }
    }, []);

    /**
     * 新API v2向けの便利メソッド（型安全）
     */
    const requestV2 = useCallback(<R>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: unknown
    ): Promise<ApiResponse<R> | null> => {
        const options: RequestInit = {
            method,
            ...(body ? { body: JSON.stringify(body) } : {})
        };

        // エンドポイントが /api/v2 で始まるか確認
        const url = endpoint.startsWith('/api/v2') || endpoint.startsWith('api/v2')
            ? endpoint
            : `/api/v2/${endpoint.replace(/^\//, '')}`;

        return request<R>(url, options, false);
    }, [request]);

    /**
     * 旧API向けの便利メソッド
     */
    const requestLegacy = useCallback(<R>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: unknown
    ): Promise<ApiResponse<R> | null> => {
        const options: RequestInit = {
            method,
            ...(body ? { body: JSON.stringify(body) } : {})
        };

        // エンドポイントが /api/ で始まるか確認
        const url = endpoint.startsWith('/api/') || endpoint.startsWith('api/')
            ? endpoint
            : `/api/${endpoint.replace(/^\//, '')}`;

        return request<R>(url, options, true);
    }, [request]);

    /**
     * 食事解析API（v2）
     */
    const analyzeMeal = useCallback(<R>(data: {
        text?: string;
        image?: string;
        meal_type?: string;
    }): Promise<ApiResponse<R> | null> => {
        return requestV2<R>('meal/analyze', 'POST', data);
    }, [requestV2]);

    /**
     * 食品テキスト解析API（v2）
     */
    const analyzeFoodText = useCallback(<R>(text: string): Promise<ApiResponse<R> | null> => {
        return requestV2<R>('food/parse', 'POST', { text });
    }, [requestV2]);

    /**
     * レシピ解析API（v2）
     */
    const analyzeRecipe = useCallback(<R>(url: string): Promise<ApiResponse<R> | null> => {
        return requestV2<R>('recipe/parse', 'POST', { url });
    }, [requestV2]);

    return {
        ...state,
        request,
        requestV2,
        requestLegacy,
        analyzeMeal,
        analyzeFoodText,
        analyzeRecipe
    };
}

export default useApi; 
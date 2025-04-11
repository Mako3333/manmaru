import { useState, useCallback } from 'react';
import { ApiAdapter } from '@/lib/api/api-adapter';
import { StandardApiResponse } from '@/types/api-interfaces';
import { AppError, ErrorCode, AnyErrorCode, BaseErrorCode, AIErrorCode } from '@/lib/error';

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
    ): Promise<StandardApiResponse<R> | null> => {
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
                    throw new AppError({
                        code: ErrorCode.Base.NETWORK_ERROR,
                        message: `API response parsing failed: ${response.status} ${response.statusText}`,
                        userMessage: 'サーバーからの応答の解析に失敗しました。'
                    });
                }

                // エラーレスポンスの解析
                if (errorData?.error) {
                    // 型アサーション: APIエラーレスポンスの error オブジェクトが期待する構造を持つことを前提とする。
                    // 本来は hasProperty などで各プロパティの存在と型をチェックすべき。
                    const errDetails = errorData.error as {
                        code?: AnyErrorCode;
                        message?: string;
                        userMessage?: string;
                        details?: unknown;
                    };
                    throw new AppError({
                        // 型アサーション: errDetails.code が AnyErrorCode に含まれる文字列であることを前提とする。
                        // ErrorCode の値として有効かチェックする関数が望ましい。
                        code: (errDetails.code && Object.values(ErrorCode.Base).includes(errDetails.code as BaseErrorCode))
                            || (errDetails.code && Object.values(ErrorCode.AI).includes(errDetails.code as AIErrorCode))
                            ? errDetails.code as AnyErrorCode
                            : ErrorCode.Base.API_ERROR,
                        message: errDetails.message || '不明なAPIエラーが発生しました',
                        userMessage: errDetails.userMessage || 'サーバー処理中にエラーが発生しました。',
                        details: errDetails.details
                    });
                }

                throw new AppError({
                    code: ErrorCode.Base.API_ERROR,
                    message: `Server error: ${response.status}`,
                    userMessage: 'サーバーエラーが発生しました。'
                });
            }

            const result = await response.json();

            // 標準APIレスポンス形式かどうかを判定
            // 型アサーション: APIレスポンスが StandardApiResponse<R> 形式に近いことを期待するが、完全な検証は行われていない。
            const typedResult = result as StandardApiResponse<R>;

            if (!legacyFormat) {
                // 標準APIレスポンス形式の処理
                if (!typedResult.success) {
                    throw new AppError({
                        code: typedResult.error?.code || ErrorCode.Base.API_ERROR,
                        message: typedResult.error?.message || 'API returned success=false with no error details',
                        userMessage: typedResult.error?.userMessage || 'サーバーでエラーが発生しました。',
                        details: typedResult.error?.details,
                        originalError: typedResult.error ? new Error(typedResult.error.message) : undefined
                    });
                }

                // 型Tとして状態を更新（同じ型の場合のみ）
                if (typedResult.data !== undefined) {
                    setState({
                        // 型アサーション: APIレスポンスの型Rをフックの状態型Tにキャスト。型安全ではないため注意。
                        data: typedResult.data as unknown as T,
                        loading: false
                    });
                }

                // undefined の場合は null を返す -> 標準形式なのでそのまま返す
                return typedResult;
            } else {
                // 旧形式（データのみ）を返すことを期待されていると仮定
                // ただし、エラーの場合はエラー情報を返す必要があるかもしれない
                if (!typedResult.success) {
                    // レガシー形式でもエラーはエラーとして返す
                    // throw new AppError(...) としてもよいが、呼び出し元でのハンドリングに任せるため null を返すか、
                    // もしくはエラー情報を含む ApiResponse を返す
                    console.error('Legacy API request failed:', typedResult.error);
                    setState({
                        loading: false,
                        error: new AppError({
                            code: typedResult.error?.code || ErrorCode.Base.API_ERROR,
                            message: typedResult.error?.message || 'Legacy API failed',
                            userMessage: typedResult.error?.userMessage || 'データ取得に失敗しました。',
                            details: typedResult.error?.details
                        }),
                        errorDetails: typedResult.error?.details
                    });
                    return null; // エラー時は null を返す（呼び出し元で処理）
                }

                const legacyData = typedResult.data;

                // 型Tとして状態を更新（同じ型の場合のみ）
                if (legacyData !== undefined) {
                    setState({
                        // 型アサーション: APIレスポンスの型Rをフックの状態型Tにキャスト。型安全ではないため注意。
                        data: legacyData as unknown as T,
                        loading: false
                    });
                }

                // レガシー形式の場合、成功時はデータのみを返すように見せかける必要があるかもしれないが、
                // このフックの戻り値型は StandardApiResponse<R> | null のため、適合させる
                // return legacyData as R; // これは型エラーになる
                // 成功時は data のみを含む StandardApiResponse を返す
                // 型アサーション: APIレスポンスの型Rをフックの戻り値型Rにキャスト。型安全ではないため注意。
                return { success: true, data: legacyData as R };
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
    ): Promise<StandardApiResponse<R> | null> => {
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
    ): Promise<StandardApiResponse<R> | null> => {
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
    }): Promise<StandardApiResponse<R> | null> => {
        return requestV2<R>('meal/analyze', 'POST', data);
    }, [requestV2]);

    /**
     * 食品テキスト解析API（v2）
     */
    const analyzeFoodText = useCallback(<R>(text: string): Promise<StandardApiResponse<R> | null> => {
        return requestV2<R>('food/parse', 'POST', { text });
    }, [requestV2]);

    /**
     * レシピ解析API（v2）
     */
    const analyzeRecipe = useCallback(<R>(url: string): Promise<StandardApiResponse<R> | null> => {
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
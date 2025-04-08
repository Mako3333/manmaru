import { NextResponse } from 'next/server';
import { RecipeService } from '@/lib/services/recipe-service';
import { withAuthAndErrorHandling, createSuccessResponse, validateRequestData } from '@/lib/api/api-handlers';
import { AppError, ErrorCode } from '@/lib/error';

// お気に入り状態の切り替え
export const POST = withAuthAndErrorHandling(
    async (req, { params, user }) => {
        const { id } = params;

        // IDの検証
        if (!id) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'レシピIDが指定されていません',
                userMessage: 'レシピIDが必要です'
            });
        }

        // リクエストを検証
        const { is_favorite } = await validateRequestData<{ is_favorite: boolean }>(req, ['is_favorite']);

        // お気に入り状態の切り替え処理
        const result = await RecipeService.toggleFavorite(id, user.id);

        return NextResponse.json(createSuccessResponse(
            result,
            result.isFavorite ? 'お気に入りに追加しました' : 'お気に入りから削除しました'
        ));
    }
);

// PUTメソッドでも同じ処理を行えるようにする
export const PUT = withAuthAndErrorHandling(
    async (req, { params, user }) => {
        const { id } = params;

        // IDの検証
        if (!id) {
            throw new AppError({
                code: ErrorCode.Base.DATA_VALIDATION_ERROR,
                message: 'レシピIDが指定されていません',
                userMessage: 'レシピIDが必要です'
            });
        }

        // お気に入り状態の切り替え処理
        const result = await RecipeService.toggleFavorite(id, user.id);

        return NextResponse.json(createSuccessResponse(
            result,
            result.isFavorite ? 'お気に入りに追加しました' : 'お気に入りから削除しました'
        ));
    }
); 
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from 'next/server';
import { RecipeService } from '@/lib/services/recipe-service';
import { withAuthAndErrorHandling, createSuccessResponse } from '@/lib/api/api-handlers';
import { AppError, ErrorCode } from '@/lib/error';
import type { User } from '@supabase/supabase-js';

// お気に入り状態の切り替え処理を共通化
const handleToggleFavorite = async (id: string | undefined, userId: string) => {
    if (!id) {
        throw new AppError({
            code: ErrorCode.Base.DATA_VALIDATION_ERROR,
            message: 'レシピIDが指定されていません',
            userMessage: 'レシピIDが必要です'
        });
    }

    const result = await RecipeService.toggleFavorite(id, userId);

    return NextResponse.json(createSuccessResponse(
        result,
        result.isFavorite ? 'お気に入りに追加しました' : 'お気に入りから削除しました'
    ));
};

// お気に入り状態の切り替え (POST)
export const POST = withAuthAndErrorHandling(
    async (req: NextRequest, { params, user }: { params: Record<string, string>, user: User }) => {
        return handleToggleFavorite(params.id, user.id);
    }
);

// PUTメソッドでも同じ処理を行えるようにする
export const PUT = withAuthAndErrorHandling(
    async (req: NextRequest, { params, user }: { params: Record<string, string>, user: User }) => {
        return handleToggleFavorite(params.id, user.id);
    }
); 
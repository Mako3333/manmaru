import { NextRequest, NextResponse } from 'next/server';
import { runNutritionSystemTest } from '@/lib/tests/nutrition-system-test';

/**
 * 栄養計算システムテスト実行API
 * 注意: このAPIは開発環境でのみ利用可能です
 */
export async function GET(request: NextRequest) {
    try {
        // 開発環境でのみ実行可能
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json(
                { error: 'このAPIは開発環境でのみ利用可能です' },
                { status: 403 }
            );
        }

        // テスト実行
        const result = await runNutritionSystemTest();

        return NextResponse.json({
            message: '栄養計算システムのテストが完了しました',
            result
        });
    } catch (error: unknown) {
        console.error('テスト実行エラー:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'テスト実行中にエラーが発生しました: ' + errorMessage },
            { status: 500 }
        );
    }
} 
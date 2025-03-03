import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createImageContent } from '@/lib/utils/image-utils';

// Google AI APIキーの設定
const apiKey = process.env.GEMINI_API_KEY || '';

// モデルの設定
const genAI = new GoogleGenerativeAI(apiKey);
const modelName = 'gemini-2.0-flash-001'; // 画像認識に適したモデル

// テストモードの設定（開発時のみtrueに設定）
const TEST_MODE = process.env.NODE_ENV === 'development';

/**
 * 食事写真の解析APIエンドポイント
 * Base64エンコードされた画像を受け取り、AI分析結果を返す
 */
export async function POST(request: Request) {
    try {
        console.log('API: リクエスト受信');

        // リクエストボディからデータを取得
        const body = await request.json();
        const { image, mealType } = body;

        console.log(`API: 食事タイプ=${mealType}, 画像データ長=${image?.length || 0}`);

        // 画像データの確認
        if (!image) {
            console.error('API: 画像データが含まれていません');
            return NextResponse.json(
                { error: '画像データが含まれていません' },
                { status: 400 }
            );
        }

        // テストモードの場合はモックデータを返す
        if (TEST_MODE) {
            console.log('API: テストモード - モックデータを返します');

            // 食事タイプに応じたモックデータ
            const mockData = getMockData(mealType);

            // 実際のAPIレスポンスを模倣するために少し遅延
            await new Promise(resolve => setTimeout(resolve, 1500));

            return NextResponse.json(mockData);
        }

        // Gemini APIのためのコンテンツ準備
        console.log('API: 画像コンテンツの準備');
        const imageContent = createImageContent(image);

        // Gemini モデルの設定
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0,
                topK: 32,
                topP: 0.95,
            },
        });

        // プロンプトの作成
        const prompt = `
            この食事の写真から含まれている食品を識別してください。
            食事タイプは「${mealType}」です。
            
            以下の形式でJSON形式で回答してください:
            {
                "foods": [
                    {"name": "食品名", "quantity": "量の目安", "confidence": 信頼度(0.0-1.0)}
                ],
                "nutrition": {
                    "calories": カロリー推定値,
                    "protein": タンパク質(g),
                    "iron": 鉄分(mg),
                    "folic_acid": 葉酸(μg),
                    "calcium": カルシウム(mg),
                    "confidence_score": 信頼度(0.0-1.0)
                }
            }
            
            回答は必ずこのJSONフォーマットのみで返してください。
        `;

        console.log('API: Gemini API呼び出し');
        // Gemini APIを呼び出し
        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: imageContent }
                    ]
                }
            ]
        });

        const response = result.response;
        const responseText = response.text();
        console.log('API: Gemini応答受信', responseText.substring(0, 100) + '...');

        // JSONレスポンスの抽出（レスポンスからJSONを見つける）
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.error('API: JSONレスポンスの抽出に失敗');
            throw new Error('APIからの応答を解析できませんでした');
        }

        try {
            const jsonResponse = JSON.parse(jsonMatch[0]);
            console.log('API: 解析成功', JSON.stringify(jsonResponse).substring(0, 100) + '...');
            return NextResponse.json(jsonResponse);
        } catch (parseError) {
            console.error('API: JSON解析エラー', parseError);
            throw new Error('APIレスポンスのJSON解析に失敗しました');
        }
    } catch (error) {
        console.error('API: 画像解析エラー:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '画像の解析に失敗しました' },
            { status: 500 }
        );
    }
}

/**
 * 食事タイプに応じたモックデータを返す
 * @param mealType 食事タイプ
 * @returns モックデータ
 */
function getMockData(mealType: string) {
    // 食事タイプに応じて異なるモックデータを返す
    switch (mealType) {
        case 'breakfast':
            return {
                foods: [
                    { name: '白米', quantity: '150g', confidence: 0.95 },
                    { name: '味噌汁', quantity: '1杯', confidence: 0.90 },
                    { name: '納豆', quantity: '1パック', confidence: 0.92 },
                    { name: 'ほうれん草のおひたし', quantity: '小鉢1つ', confidence: 0.88 }
                ],
                nutrition: {
                    calories: 450,
                    protein: 20,
                    iron: 2.5,
                    folic_acid: 120,
                    calcium: 180,
                    confidence_score: 0.85
                }
            };
        case 'lunch':
            return {
                foods: [
                    { name: 'サンドイッチ', quantity: '1個', confidence: 0.93 },
                    { name: 'サラダ', quantity: '1皿', confidence: 0.96 },
                    { name: 'スープ', quantity: '1杯', confidence: 0.89 },
                    { name: 'リンゴ', quantity: '1/2個', confidence: 0.97 }
                ],
                nutrition: {
                    calories: 550,
                    protein: 15,
                    iron: 1.8,
                    folic_acid: 150,
                    calcium: 120,
                    confidence_score: 0.88
                }
            };
        case 'dinner':
            return {
                foods: [
                    { name: '鮭の塩焼き', quantity: '1切れ', confidence: 0.94 },
                    { name: '白米', quantity: '150g', confidence: 0.95 },
                    { name: 'ひじきの煮物', quantity: '小鉢1つ', confidence: 0.87 },
                    { name: '豆腐と野菜の味噌汁', quantity: '1杯', confidence: 0.91 }
                ],
                nutrition: {
                    calories: 650,
                    protein: 35,
                    iron: 3.2,
                    folic_acid: 180,
                    calcium: 220,
                    confidence_score: 0.86
                }
            };
        case 'snack':
            return {
                foods: [
                    { name: 'ヨーグルト', quantity: '1カップ', confidence: 0.96 },
                    { name: 'ブルーベリー', quantity: '30g', confidence: 0.93 },
                    { name: 'グラノーラ', quantity: '大さじ2', confidence: 0.90 }
                ],
                nutrition: {
                    calories: 250,
                    protein: 8,
                    iron: 0.8,
                    folic_acid: 45,
                    calcium: 200,
                    confidence_score: 0.92
                }
            };
        default:
            return {
                foods: [
                    { name: '食品サンプル1', quantity: '1人前', confidence: 0.90 },
                    { name: '食品サンプル2', quantity: '適量', confidence: 0.85 }
                ],
                nutrition: {
                    calories: 400,
                    protein: 15,
                    iron: 2.0,
                    folic_acid: 100,
                    calcium: 150,
                    confidence_score: 0.80
                }
            };
    }
} 
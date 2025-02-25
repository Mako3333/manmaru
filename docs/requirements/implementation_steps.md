# 実装ステップ

## 概要
1週間でMVPを実現するための実装ステップを定義する。LangChain.js + Gemini APIを活用した栄養分析システムと、Next.js + Supabaseによるフロントエンド・バックエンドを構築する。

## 実装スケジュール

### Day 1: データベース構築とLLM連携基盤
- Supabaseで簡易DB（`meals`と`daily_nutrition_logs`テーブル）の作成
- LangChain.js + Gemini APIの設定
- 基本的な食品栄養データの準備（JSON形式）
- APIとNext.jsの連携テスト

### Day 2-3: 食事記録機能
- 写真アップロード機能（Supabase Storage）
- 食事タイプ選択UI
- Gemini APIによる画像解析
- 食品リスト編集画面
- 食事データ保存機能

### Day 4-5: 栄養ダッシュボード
- 日次栄養サマリーの表示
- 栄養素達成率グラフ実装
- 食事記録一覧表示
- AIアドバイス生成・表示

### Day 6: 献立提案機能
- 不足栄養素の特定ロジック
- LangChain.jsを使用したレシピ提案
- レシピ表示UI

### Day 7: 全体調整とテスト
- ナビゲーション最適化
- エラーハンドリング強化
- パフォーマンス最適化
- 妻へのデモ用に初期データ投入

## 技術的実装詳細

### 1. LLM連携実装（Next.js API Routes）

#### 食事分析API（LangChain.js + Gemini）
```typescript
// app/api/analyze-meal/route.ts
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";

export async function POST(req: Request) {
  const { imageBase64, mealType } = await req.json();
  
  // Gemini 2.0 Flashモデルの初期化
  const model = new ChatGoogleGenerativeAI({
    modelName: "gemini-pro-vision",
    apiKey: process.env.GOOGLE_API_KEY!,
    maxOutputTokens: 2048,
  });
  
  // 出力パーサーの定義
  const foodParser = StructuredOutputParser.fromZodSchema(
    z.object({
      foods: z.array(
        z.object({
          name: z.string(),
          quantity: z.string()
        })
      )
    })
  );
  
  try {
    // 画像から食品を検出
    const response = await model.invoke([
      {
        role: "user",
        content: [
          { type: "text", text: `この写真に写っている食品を全て抽出し、${foodParser.getFormatInstructions()}` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }
    ]);
    
    const detectedFoods = await foodParser.parse(response.content);
    
    // 栄養素計算（シンプルなRAG実装）
    const nutritionData = await calculateNutrition(detectedFoods.foods);
    
    return Response.json({
      foods: detectedFoods.foods,
      nutrition: nutritionData
    });
  } catch (error) {
    console.error('Error analyzing meal:', error);
    return Response.json(
      { error: '食事分析中にエラーが発生しました' }, 
      { status: 500 }
    );
  }
}

// 栄養素計算関数
async function calculateNutrition(foods) {
  // 栄養データベースからの検索実装
  const nutritionDb = await import('@/data/nutrition_data.json');
  
  let totalNutrition = {
    calories: 0,
    protein: 0,
    iron: 0,
    folic_acid: 0,
    calcium: 0,
    confidence_score: 0.8
  };
  
  // 各食品の栄養素を合計
  for (const food of foods) {
    const match = nutritionDb.find(item => 
      item.name.includes(food.name) || food.name.includes(item.name)
    );
    
    if (match) {
      // 量に基づいて栄養素を調整（シンプルな実装）
      const multiplier = estimateQuantityMultiplier(food.quantity, match.standard_quantity);
      
      totalNutrition.calories += match.calories * multiplier;
      totalNutrition.protein += match.protein * multiplier;
      totalNutrition.iron += match.iron * multiplier;
      totalNutrition.folic_acid += match.folic_acid * multiplier;
      totalNutrition.calcium += match.calcium * multiplier;
    }
  }
  
  return totalNutrition;
}

function estimateQuantityMultiplier(userQuantity, standardQuantity) {
  // 量の文字列から数値を推定するロジック
  // 例: "茶碗1杯" → 1.0, "大さじ2" → 0.2 など
  // MVPでは単純な実装から始める
  return 1.0; // デフォルト値
}
```

#### レシピ提案API（LangChain.js）
```typescript
// app/api/recommend-recipes/route.ts
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const { userId, servings = 2 } = await req.json();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  
  try {
    // 1. ユーザーの栄養ログを取得
    const { data: nutritionLog } = await supabase
      .from('daily_nutrition_logs')
      .select('nutrition_data')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(1)
      .single();
    
    if (!nutritionLog) {
      return Response.json({ error: '栄養データが見つかりません' }, { status: 404 });
    }
    
    const deficientNutrients = nutritionLog.nutrition_data.deficient_nutrients || [];
    
    // 2. レシピ検索プロンプト
    const recipePrompt = PromptTemplate.fromTemplate(`
      あなたは妊婦向けの栄養士です。以下の栄養素が不足している妊婦に適したレシピを3つ提案してください。
      
      不足している栄養素: {deficient_nutrients}
      
      提案するレシピは以下の条件を満たすこと:
      - {servings}人分の分量
      - 調理時間30分以内
      - 一般的な食材を使用
      - 妊婦に安全な食材のみ使用
      
      以下のJSON形式で返してください:
      {{
        "recipes": [
          {{
            "title": "レシピ名",
            "ingredients": ["材料1", "材料2", ...],
            "steps": ["手順1", "手順2", ...],
            "nutrients": ["含まれる栄養素1", "含まれる栄養素2", ...],
            "preparation_time": "調理時間（分）"
          }}
        ]
      }}
    `);
    
    // 3. LLMでレシピ生成
    const model = new ChatGoogleGenerativeAI({
      modelName: "gemini-pro",
      apiKey: process.env.GOOGLE_API_KEY!,
    });
    
    const chain = recipePrompt.pipe(model).pipe(new StringOutputParser());
    
    const result = await chain.invoke({
      deficient_nutrients: deficientNutrients.join(', '),
      servings: servings
    });
    
    // 4. 結果をJSONに変換して返す
    const recipes = JSON.parse(result);
    return Response.json(recipes);
  } catch (error) {
    console.error('Error recommending recipes:', error);
    return Response.json(
      { error: 'レシピ提案中にエラーが発生しました' }, 
      { status: 500 }
    );
  }
}
```

### 2. フロントエンド実装（Next.js）

#### 食事記録コンポーネント
```tsx
// app/meals/record/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Card } from '@/components/ui';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

export default function MealRecordPage() {
  const [mealType, setMealType] = useState('dinner');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<any[]>([]);
  const [servings, setServings] = useState(1);
  const [step, setStep] = useState('upload'); // 'upload', 'edit', 'result'
  
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  // 写真アップロード処理
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoUrl(URL.createObjectURL(file));
    }
  };

  // 食事解析処理
  const analyzeMeal = async () => {
    if (!photoFile) return;
    
    setIsAnalyzing(true);
    
    try {
      // 画像をBase64に変換
      const base64 = await fileToBase64(photoFile);
      
      // API呼び出し
      const response = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: base64,
          mealType 
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setDetectedItems(data.foods);
      setStep('edit');
    } catch (error) {
      console.error('Error analyzing meal:', error);
      alert('食事の解析中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Base64変換ヘルパー
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        // data:image/jpeg;base64, の部分を削除
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  // 食事データ保存
  const saveMealRecord = async () => {
    if (!user || detectedItems.length === 0) return;
    
    try {
      // 1. 写真をStorageにアップロード
      let photoPath = null;
      if (photoFile) {
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('meal-photos')
          .upload(`${user.id}/${Date.now()}.jpg`, photoFile);
          
        if (uploadError) throw uploadError;
        photoPath = uploadData.path;
      }
      
      // 2. 食事データをDBに保存
      const { error } = await supabase
        .from('meals')
        .insert({
          user_id: user.id,
          meal_type: mealType,
          meal_date: new Date().toISOString().split('T')[0],
          photo_url: photoPath,
          food_description: { items: detectedItems },
          servings: servings
        });
        
      if (error) throw error;
      
      // 3. 栄養ログの更新処理（別APIで実装）
      await fetch('/api/update-nutrition-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      setStep('result');
    } catch (error) {
      console.error('Error saving meal:', error);
      alert('食事の保存中にエラーが発生しました。もう一度お試しください。');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">食事記録</h1>
      
      {/* ステップ1: 写真アップロード */}
      {step === 'upload' && (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">食事タイプ</label>
            <Select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
            >
              <option value="breakfast">朝食</option>
              <option value="lunch">昼食</option>
              <option value="dinner">夕食</option>
              <option value="snack">間食</option>
            </Select>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">食事の写真</label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
          </div>
          
          {photoUrl && (
            <div className="mb-6">
              <img
                src={photoUrl}
                alt="食事の写真"
                className="w-full max-w-md mx-auto rounded-lg shadow-md"
              />
            </div>
          )}
          
          <Button
            onClick={analyzeMeal}
            disabled={!photoFile || isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? '解析中...' : '食事を解析する'}
          </Button>
        </div>
      )}
      
      {/* ステップ2: 食品リスト編集 */}
      {step === 'edit' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">検出された食品</h2>
          
          {detectedItems.length === 0 ? (
            <p className="text-gray-500 mb-4">食品が検出されませんでした。手動で追加してください。</p>
          ) : (
            <div className="mb-6">
              {detectedItems.map((item, index) => (
                <Card key={index} className="mb-2 p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <Input
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...detectedItems];
                          newItems[index].name = e.target.value;
                          setDetectedItems(newItems);
                        }}
                        className="mb-1"
                      />
                      <Input
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...detectedItems];
                          newItems[index].quantity = e.target.value;
                          setDetectedItems(newItems);
                        }}
                        placeholder="量（例: 1人前、100g）"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const newItems = detectedItems.filter((_, i) => i !== index);
                        setDetectedItems(newItems);
                      }}
                    >
                      削除
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => {
                setDetectedItems([...detectedItems, { name: '', quantity: '' }]);
              }}
              className="w-full mb-2"
            >
              食品を追加
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                setDetectedItems([...detectedItems, { name: '水', quantity: 'コップ1杯' }]);
              }}
              className="w-full"
            >
              飲み物を追加
            </Button>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">何人分の食事ですか？</label>
            <Select
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
            >
              <option value="1">1人分</option>
              <option value="2">2人分</option>
              <option value="3">3人分</option>
              <option value="4">4人分</option>
              <option value="5">5人分以上</option>
            </Select>
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setStep('upload')}
              className="flex-1"
            >
              戻る
            </Button>
            <Button 
              onClick={saveMealRecord} 
              disabled={detectedItems.length === 0}
              className="flex-1"
            >
              保存する
            </Button>
          </div>
        </div>
      )}
      
      {/* ステップ3: 結果表示 */}
      {step === 'result' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">記録完了</h2>
          <p className="mb-4">食事が正常に記録されました。</p>
          <Button onClick={() => router.push('/home')}>
            ホームに戻る
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 3. Supabase設定

#### RLS（Row Level Security）ポリシー
```sql
-- mealsテーブルのRLSポリシー
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分の食事記録のみ参照可能" 
ON meals FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の食事記録のみ作成可能" 
ON meals FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の食事記録のみ更新可能" 
ON meals FOR UPDATE 
USING (auth.uid() = user_id);

-- daily_nutrition_logsテーブルのRLSポリシー
ALTER TABLE daily_nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分の栄養ログのみ参照可能" 
ON daily_nutrition_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の栄養ログのみ作成可能" 
ON daily_nutrition_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の栄養ログのみ更新可能" 
ON daily_nutrition_logs FOR UPDATE 
USING (auth.uid() = user_id);

-- Storage RLSポリシー
CREATE POLICY "ユーザーは自分の食事写真のみアップロード可能" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'meal-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ユーザーは自分の食事写真のみ参照可能" 
ON storage.objects FOR SELECT 
TO authenticated
USING (bucket_id = 'meal-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
```

## デプロイ戦略

### 1. Next.jsアプリ（LangChain.js含む）
- 開発: ローカル環境で実行
- MVP: Vercelでデプロイ
- 将来: より高度なホスティングへ移行

### 2. Supabase
- 開発: Supabase無料プラン
- MVP: Supabase無料プラン（初期段階では十分）
- 将来: Supabaseの有料プランへアップグレード

## 実装の優先順位

1. **コア機能**
   - 認証
   - 食事記録（写真→AI解析→編集→保存）
   - 栄養ダッシュボード（基本表示）

2. **拡張機能**
   - レシピ提案
   - 詳細な栄養分析
   - AIアドバイス

3. **UI/UX改善**
   - アニメーション
   - レスポンシブ対応の最適化
   - エラーハンドリングの改善

## テスト戦略

1. **ユニットテスト**
   - 栄養計算ロジック
   - データ変換処理

2. **統合テスト**
   - API連携
   - データフロー

3. **エンドツーエンドテスト**
   - 主要ユーザーフロー
   - エッジケース

## 将来の拡張計画

1. **機能拡張**
   - 体重管理
   - 食事写真ギャラリー
   - 栄養傾向分析

2. **技術的拡張**
   - オフラインサポート強化
   - パフォーマンス最適化
   - セキュリティ強化

3. **ユーザー体験向上**
   - カスタマイズ機能
   - ソーシャル機能
   - 通知機能 
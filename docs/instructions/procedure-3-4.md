# AIアドバイス機能実装 - 詳細指示書 
## 0. 実装の背景と目的

manmaruアプリのAIアドバイス機能は、妊婦の栄養状態や妊娠週数に基づいてパーソナライズされた栄養アドバイスを提供します。この機能により、ユーザーは自分の状況に合った具体的なアドバイスを受け取り、必要な栄養素を意識して食事を取ることができるようになります。

**現状**: 現在のホーム画面には静的なアドバイス表示があり、不足栄養素の有無に基づいた一般的なメッセージを表示するのみです。AIによる個別化されたアドバイスはまだ実装されていません。

**目標**: ホーム画面では簡潔なAIアドバイスを表示し、ダッシュボードではより詳細なアドバイスと推奨食品リストを表示する二段階のアドバイスシステムを実装します。

## 1. データベーススキーマ実装**実装済み**


**詳細仕様**:
```sql
-- スキーマ定義
CREATE TABLE IF NOT EXISTS daily_nutri_advice (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  advice_type TEXT NOT NULL,
  advice_summary TEXT NOT NULL,
  advice_detail TEXT,
  recommended_foods TEXT[] DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, advice_date, advice_type)
);

-- RLSポリシー
ALTER TABLE daily_nutri_advice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own advice"
ON daily_nutri_advice FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own advice"
ON daily_nutri_advice FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own advice"
ON daily_nutri_advice FOR UPDATE
USING (auth.uid() = user_id);

-- インデックス作成
CREATE INDEX IF NOT EXISTS daily_nutri_advice_user_date_idx
ON daily_nutri_advice (user_id, advice_date, advice_type);
```


## 2. 型定義ファイルの作成

**ファイル**: `src/types/nutrition.ts` (既存ファイルに追加)

**コード**:
```typescript
// AIアドバイス関連の型定義
export interface NutritionAdvice {
  id: string;
  user_id: string;
  advice_date: string;
  advice_type: AdviceType;
  advice_summary: string;
  advice_detail?: string;
  recommended_foods?: string[];
  is_read: boolean;
  created_at: string;
}

export enum AdviceType {
  DAILY = 'daily',
  DEFICIENCY = 'deficiency',
  MEAL_SPECIFIC = 'meal_specific',
  WEEKLY = 'weekly'
}

// APIレスポンス用の型定義
export interface NutritionAdviceResponse {
  success: boolean;
  advice?: {
    id: string;
    content: string; // UIで表示するコンテンツ (summary or detail)
    recommended_foods?: string[];
    created_at: string;
    is_read: boolean;
  };
  error?: string;
}

// フロントエンド状態管理用の型定義
export interface AdviceState {
  loading: boolean;
  error: string | null;
  advice: {
    content: string;
    recommended_foods?: string[];
  } | null;
}
```

**注意点**:
- 既存の型定義と競合しないか確認
- プロジェクト固有の命名規則に従っているか確認
- 他のコンポーネントやAPIで再利用可能な設計にする

## 3. APIエンドポイント実装

**ファイル**: `src/app/api/nutrition-advice/route.ts`

**詳細仕様**:

```typescript
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AdviceType } from "@/types/nutrition";

export async function GET(request: Request) {
  try {
    // 1. リクエストパラメータの取得
    const { searchParams } = new URL(request.url);
    const detailLevel = searchParams.get('detail') === 'true' ? 'detail' : 'summary';
    
    // 2. Supabaseクライアント初期化
    const supabase = createRouteHandlerClient({ cookies });
    
    // 3. セッション確認 (認証チェック)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "認証が必要です" },
        { status: 401 }
      );
    }
    
    // 4. 今日の日付を取得
    const today = new Date().toISOString().split('T')[0];
    
    // 5. 既存のアドバイスを確認
    const { data: existingAdvice, error: adviceError } = await supabase
      .from('daily_nutri_advice')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('advice_date', today)
      .eq('advice_type', AdviceType.DAILY)
      .single();
    
    // 既存アドバイスがある場合は返す
    if (existingAdvice && !adviceError) {
      return NextResponse.json({
        success: true,
        advice: {
          id: existingAdvice.id,
          content: detailLevel === 'detail' ? existingAdvice.advice_detail : existingAdvice.advice_summary,
          recommended_foods: detailLevel === 'detail' ? existingAdvice.recommended_foods : undefined,
          created_at: existingAdvice.created_at,
          is_read: existingAdvice.is_read
        }
      });
    }
    
    // 6. ユーザープロファイル取得
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
      
    if (profileError) {
      console.error('プロファイル取得エラー:', profileError);
      return NextResponse.json(
        { success: false, error: "プロフィール情報の取得に失敗しました" },
        { status: 500 }
      );
    }
    
    // 7. 栄養目標・実績データ取得
    const { data: nutritionData, error: nutritionError } = await supabase
      .from('nutrition_goal_prog')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('meal_date', today)
      .single();
    
    // 栄養データがなくてもエラーとはしない（新規ユーザーや食事未記録の場合）
    
    // 8. Gemini APIセットアップ
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.error('API KEY未設定');
      return NextResponse.json(
        { success: false, error: "サーバー設定エラー" },
        { status: 500 }
      );
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: { temperature: 0.4 }
    });
    
    // 9. 不足栄養素の特定
    const deficientNutrients = [];
    
    if (nutritionData) {
      if (nutritionData.protein_percent < 80) 
        deficientNutrients.push("タンパク質");
      if (nutritionData.iron_percent < 80) 
        deficientNutrients.push("鉄分");
      if (nutritionData.folic_acid_percent < 80) 
        deficientNutrients.push("葉酸");
      if (nutritionData.calcium_percent < 80) 
        deficientNutrients.push("カルシウム");
      if (nutritionData.vitamin_d_percent < 80) 
        deficientNutrients.push("ビタミンD");
    }
    
    // 10. トライメスターの計算
    const pregnancyWeek = profile.pregnancy_week || 0;
    let trimester = 1;
    if (pregnancyWeek > 13) trimester = 2;
    if (pregnancyWeek > 27) trimester = 3;
    
    // 11. プロンプト生成
    const summaryPrompt = generatePrompt(pregnancyWeek, trimester, deficientNutrients, 'summary');
    const detailPrompt = generatePrompt(pregnancyWeek, trimester, deficientNutrients, 'detail');
    
    // 12. AI生成（並行処理）
    const [summaryResult, detailResult] = await Promise.all([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: summaryPrompt }] }]
      }),
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: detailPrompt }] }]
      })
    ]);
    
    const adviceSummary = summaryResult.response.text();
    const detailResponse = detailResult.response.text();
    
    // 13. 詳細レスポンスから推奨食品リストを抽出
    let adviceDetail = detailResponse;
    let recommendedFoods: string[] = [];
    
    const foodListMatch = detailResponse.match(/### 推奨食品リスト\s*([\s\S]*?)(\n\n|$)/);
    if (foodListMatch) {
      adviceDetail = detailResponse.replace(/### 推奨食品リスト[\s\S]*/, '').trim();
      recommendedFoods = foodListMatch[1]
        .split('\n')
        .map(item => item.replace(/^[•\-\*]\s*/, '').trim())
        .filter(item => item.length > 0);
    }
    
    // 14. データベースに保存
    const { data: savedAdvice, error: saveError } = await supabase
      .from('daily_nutri_advice')
      .insert({
        user_id: session.user.id,
        advice_date: today,
        advice_type: AdviceType.DAILY,
        advice_summary: adviceSummary,
        advice_detail: adviceDetail,
        recommended_foods: recommendedFoods,
        is_read: false
      })
      .select()
      .single();
      
    if (saveError) {
      console.error('アドバイス保存エラー:', saveError);
      return NextResponse.json(
        { success: false, error: "アドバイスの保存に失敗しました" },
        { status: 500 }
      );
    }
    
    // 15. レスポンス返却
    return NextResponse.json({
      success: true,
      advice: {
        id: savedAdvice.id,
        content: detailLevel === 'detail' ? savedAdvice.advice_detail : savedAdvice.advice_summary,
        recommended_foods: detailLevel === 'detail' ? savedAdvice.recommended_foods : undefined,
        created_at: savedAdvice.created_at,
        is_read: savedAdvice.is_read
      }
    });
    
  } catch (error) {
    console.error("アドバイス生成エラー:", error);
    return NextResponse.json(
      { success: false, error: "アドバイスの生成に失敗しました" },
      { status: 500 }
    );
  }
}

// プロンプト生成関数
function generatePrompt(
  pregnancyWeek: number, 
  trimester: number, 
  deficientNutrients: string[], 
  mode: 'summary' | 'detail'
): string {
  const basePrompt = `
あなたは妊婦向け栄養管理アプリ「manmaru」の栄養アドバイザーです。
現在妊娠${pregnancyWeek}週目（第${trimester}期）の妊婦に対して、栄養アドバイスを作成します。

${deficientNutrients.length > 0 
  ? `特に不足している栄養素: ${deficientNutrients.join('、')}` 
  : '現在の栄養状態は良好です。'}
`;

  if (mode === 'summary') {
    return `
${basePrompt}

以下の点を考慮した簡潔なアドバイスを作成してください:
1. 妊娠${pregnancyWeek}週目に特に重要な栄養素の説明
2. ${deficientNutrients.length > 0 
     ? `不足している栄養素を補うための簡単なアドバイス` 
     : '全体的な栄養バランスを維持するための簡単なアドバイス'}

アドバイスは150-200字程度、親しみやすく、要点を絞った内容で作成してください。
専門用語の使用は最小限に抑え、温かい口調で作成してください。
`;
  } else {
    return `
${basePrompt}

以下の点を含む詳細なアドバイスを作成してください:
1. 妊娠${pregnancyWeek}週目の胎児の発達状況
2. この時期に特に重要な栄養素とその理由
3. ${deficientNutrients.length > 0 
     ? `不足している栄養素（${deficientNutrients.join('、')}）を補うための具体的な食品例とレシピのアイデア` 
     : '全体的な栄養バランスを維持するための詳細なアドバイスと食品例'}
4. 季節の食材を取り入れた提案

さらに、レスポンスの最後に「### 推奨食品リスト」というセクションを作成し、箇条書きで5-7つの具体的な食品と、その栄養価や調理法のヒントを簡潔に列挙してください。

アドバイスは300-500字程度、詳細ながらも理解しやすい内容で作成してください。
専門用語を使う場合は、簡単な説明を添えてください。
`;
  }
}

// read状態を更新するPATCHエンドポイント
export async function PATCH(request: Request) {
  try {
    const { id } = await request.json();
    
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: "認証が必要です" },
        { status: 401 }
      );
    }
    
    const { error } = await supabase
      .from('daily_nutri_advice')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', session.user.id);
      
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("アドバイス更新エラー:", error);
    return NextResponse.json(
      { success: false, error: "アドバイスの更新に失敗しました" },
      { status: 500 }
    );
  }
}
```

**実装ポイント**:
1. 15のステップに分割された明確なロジックフロー
2. 詳細なエラーハンドリングとログ出力
3. 並行処理によるパフォーマンス最適化
4. 推奨食品リスト抽出のための正規表現処理
5. プロンプト生成のパターン化

**テスト方法**:
```bash
# cURLコマンドでのテスト例
curl -X GET "http://localhost:3000/api/nutrition-advice" \
  -H "Cookie: <your-auth-cookie>" \
  -v

# 詳細モードのテスト
curl -X GET "http://localhost:3000/api/nutrition-advice?detail=true" \
  -H "Cookie: <your-auth-cookie>" \
  -v
```

## 4. ホーム画面用アドバイスカードの実装

**ファイル**: `src/components/home/advice-card.tsx`

**詳細仕様**:
```tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdviceState } from "@/types/nutrition";

export function AdviceCard() {
  // 1. 状態管理
  const [state, setState] = useState<AdviceState>({
    loading: true,
    error: null,
    advice: null
  });
  
  const router = useRouter();

  // 2. データ取得
  useEffect(() => {
    async function fetchAdvice() {
      try {
        setState(prev => ({ ...prev, loading: true }));
        
        const response = await fetch("/api/nutrition-advice");
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "アドバイスの取得に失敗しました");
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || "データの取得に失敗しました");
        }
        
        // 3. アドバイスデータの設定
        setState({
          loading: false,
          error: null,
          advice: data.advice ? {
            content: data.advice.content,
            recommended_foods: data.advice.recommended_foods
          } : null
        });
        
        // 4. 既読状態の更新
        if (data.advice && data.advice.id && !data.advice.is_read) {
          try {
            await fetch("/api/nutrition-advice", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: data.advice.id })
            });
          } catch (readError) {
            console.error("既読更新エラー:", readError);
            // 非クリティカルなので失敗してもユーザーには表示しない
          }
        }
      } catch (err) {
        console.error("アドバイス取得エラー:", err);
        setState({
          loading: false,
          error: err instanceof Error ? err.message : "アドバイスを読み込めませんでした",
          advice: null
        });
        
        // エラー通知（オプション）
        toast.error("アドバイスの読み込みに失敗しました", {
          description: "しばらくしてからもう一度お試しください"
        });
      }
    }
    
    fetchAdvice();
  }, []);

  // 5. ダッシュボードへの遷移
  const handleViewDetail = () => {
    router.push("/dashboard?tab=advice");
  };

  // 6. UI描画
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg sm:text-xl font-bold">本日の栄養アドバイス</CardTitle>
      </CardHeader>
      <CardContent>
        {/* コンテンツエリア */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
          {state.loading ? (
            // ローディング表示
            <div className="flex justify-center items-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-green-600" />
            </div>
          ) : state.error ? (
            // エラー表示
            <div className="text-gray-500">
              <p>{state.error}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setState(prev => ({ ...prev, loading: true }))}
                className="mt-2 text-green-600"
              >
                再読み込み
              </Button>
            </div>
          ) : state.advice?.content ? (
            // アドバイス表示
            <div className="text-green-700">
              {state.advice.content}
            </div>
          ) : (
            // データなし表示
            <p className="text-green-700">
              今日の栄養バランスは良好です。このまま栄養バランスの良い食事を続けましょう。
            </p>
          )}
        </div>
      </CardContent>
      
      {/* 詳細表示ボタン - エラー時や読み込み中は非表示 */}
      {!state.loading && !state.error && (
        <CardFooter className="flex justify-end pt-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleViewDetail}
            className="text-green-600 hover:text-green-700 hover:bg-green-50 flex items-center gap-1"
          >
            詳しく見る
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
```

**実装ポイント**:
1. 状態管理パターンを使用した明確なデータフロー
2. ローディング/エラー/データなし状態の適切な処理
3. 再読み込み機能の実装
4. 既読状態の自動更新
5. ダッシュボードへの遷移パラメータ（`tab=advice`）

**スタイリングガイドライン**:
- 既存のデザインシステム（shadcn/ui）を使用
- モバイルに最適化された簡潔なレイアウト
- アクセシビリティ配慮（適切なコントラスト、フォーカス状態）
- プロジェクトの配色（緑系）との一貫性

## 5. ダッシュボード用詳細アドバイスコンポーネントの実装

**ファイル**: `src/components/dashboard/nutrition-advice.tsx`

**詳細仕様**:
```tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdviceState } from "@/types/nutrition";

export function DetailedNutritionAdvice() {
  // 1. 状態管理
  const [state, setState] = useState<AdviceState>({
    loading: true,
    error: null,
    advice: null
  });
  
  // 2. データ取得関数
  const fetchDetailedAdvice = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch("/api/nutrition-advice?detail=true");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "詳細アドバイスの取得に失敗しました");
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "データの取得に失敗しました");
      }
      
      // 3. アドバイスデータの設定
      setState({
        loading: false,
        error: null,
        advice: data.advice ? {
          content: data.advice.content,
          recommended_foods: data.advice.recommended_foods
        } : null
      });
      
      // 4. 既読状態の更新
      if (data.advice && data.advice.id && !data.advice.is_read) {
        try {
          await fetch("/api/nutrition-advice", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: data.advice.id })
          });
        } catch (readError) {
          console.error("既読更新エラー:", readError);
        }
      }
    } catch (err) {
      console.error("詳細アドバイス取得エラー:", err);
      setState({
        loading: false,
        error: err instanceof Error ? err.message : "詳細アドバイスを読み込めませんでした",
        advice: null
      });
      
      toast.error("詳細アドバイスの読み込みに失敗しました");
    }
  };
  
  // 5. 初回読み込み
  useEffect(() => {
    fetchDetailedAdvice();
  }, []);

  // 6. UI描画
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg sm:text-xl font-bold">栄養アドバイス詳細</CardTitle>
        
        {/* 更新ボタン */}
        {!state.loading && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchDetailedAdvice}
            disabled={state.loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">更新</span>
          </Button>
        )}
      </CardHeader>
      
      <CardContent>
        {state.loading ? (
          // ローディング表示
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        ) : state.error ? (
          // エラー表示
          <div className="text-gray-500 py-4 text-center">
            <p>{state.error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchDetailedAdvice}
              className="mt-4"
            >
              再読み込み
            </Button>
          </div>
        ) : state.advice ? (
          // アドバイス表示
          <div className="space-y-6">
            {/* 詳細アドバイス */}
            <div className="p-5 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
              <div className="text-green-700 whitespace-pre-line">
                {state.advice.content}
              </div>
            </div>
            
            {/* 推奨食品リスト */}
            {state.advice.recommended_foods && state.advice.recommended_foods.length > 0 && (
              <div className="p-5 rounded-lg border border-green-100 bg-white">
                <h3 className="text-green-800 font-semibold mb-3">今日のおすすめ食品</h3>
                <ul className="space-y-2">
                  {state.advice.recommended_foods.map((food, index) => (
                    <li key={index} className="flex items-start">
                      <span className="inline-flex w-6 h-6 rounded-full bg-green-100 text-green-600 flex-shrink-0 items-center justify-center mr-2 mt-0.5 text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{food}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          // データなし表示
          <p className="text-green-700 py-4 text-center">
            今日の栄養バランスは良好です。このまま栄養バランスの良い食事を続けましょう。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**実装ポイント**:
1. 詳細表示に適したレイアウト構造
2. 推奨食品リストの視覚的に魅力的な表示
3. 手動更新機能の実装
4. ユーザーエクスペリエンスを考慮したローディング/エラー表示
5. アクセシビリティ対応（スクリーンリーダー支援等）

**スタイリングガイドライン**:
- リスト表示の視認性を高める番号付け
- 十分な余白と適切なフォントサイズ
- 色のコントラスト比に配慮（WCAG AAレベル）
- モバイル/デスクトップ両方での最適表示

## 6. ページへの統合

### 6.1 ホーム画面への統合

**ファイル**: `src/components/home/home-client.tsx`

**修正箇所**:
```tsx
// 1. インポート追加
import { AdviceCard } from "./advice-card";

// 2. 既存の静的アドバイス表示を以下のコンポーネントに置き換え
// 既存コード:
{/* <Card className="w-full overflow-hidden">
    <CardHeader className="pb-2">
        <CardTitle className="text-lg sm:text-xl font-bold">本日の栄養アドバイス</CardTitle>
    </CardHeader>
    <CardContent>
        <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
            {nutritionData && nutritionData.deficient_nutrients && nutritionData.deficient_nutrients.length > 0 ? (
                // ...静的アドバイスコード
            ) : (
                // ...静的アドバイスコード
            )}
        </div>
    </CardContent>
</Card> */}

// 新しいコード:
<AdviceCard />
```

### 6.2 ダッシュボードへの統合

**ファイル**: `src/components/dashboard/tabs-container.tsx`

**修正箇所**:
```tsx
// 1. インポート追加
import { DetailedNutritionAdvice } from "./nutrition-advice";

// 2. 栄養アドバイスタブの追加
// 既存の Tabs コンポーネント内に新しいタブを追加

// 既存コード:
<Tabs defaultValue="nutrition" className="w-full">
  <TabsList className="grid grid-cols-2">
    <TabsTrigger value="nutrition">栄養状況</TabsTrigger>
    <TabsTrigger value="meals">食事履歴</TabsTrigger>
  </TabsList>
  <TabsContent value="nutrition">
    {/* 栄養タブコンテンツ */}
  </TabsContent>
  <TabsContent value="meals">
    {/* 食事タブコンテンツ */}
  </TabsContent>
</Tabs>

// 新しいコード:
<Tabs defaultValue="nutrition" className="w-full">
  <TabsList className="grid grid-cols-3">
    <TabsTrigger value="nutrition">栄養状況</TabsTrigger>
    <TabsTrigger value="advice">栄養アドバイス</TabsTrigger>
    <TabsTrigger value="meals">食事履歴</TabsTrigger>
  </TabsList>
  <TabsContent value="nutrition">
    {/* 既存の栄養タブコンテンツ */}
  </TabsContent>
  <TabsContent value="advice">
    <DetailedNutritionAdvice />
  </TabsContent>
  <TabsContent value="meals">
    {/* 既存の食事タブコンテンツ */}
  </TabsContent>
</Tabs>
```

**実装ポイント**:
1. 既存のタブ構造との一貫性維持
2. URLパラメータによるタブ選択状態の保持
3. モバイル表示での最適化

### 6.3 遷移パラメータの処理

**ファイル**: `src/components/dashboard/tabs-container.tsx`

**追加コード**:
```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

// コンポーネント内部に追加
export function TabsContainer() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("nutrition");
  
  // URLパラメータからタブ値を取得
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["nutrition", "advice", "meals"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {/* 既存のタブ構造 */}
    </Tabs>
  );
}
```

## 7. テスト計画と検証方法

### 7.1 ユニットテスト

**APIエンドポイントのテスト**:
1. 認証済みユーザーが正常にアドバイスを取得できるか
2. 詳細モードで正しいデータが返されるか
3. エラー状態が適切に処理されるか

**UIコンポーネントのテスト**:
1. ローディング状態が正しく表示されるか
2. エラー状態が適切に処理されるか
3. データが正しく表示されるか
4. 「詳しく見る」ボタンが正しく機能するか

### 7.2 統合テスト

1. ホーム画面からダッシュボードへの遷移が正しく機能するか
2. タブ間の切り替えが正しく機能するか
3. 異なるデバイスサイズでのレスポンシブ表示

### 7.3 エッジケーステスト

1. データがない新規ユーザーの挙動
2. 不足栄養素がない場合のアドバイス内容
3. 推奨食品リストがない場合の表示
4. 非常に長いアドバイスコンテンツの表示

### 7.4 手動検証手順

```
1. アプリにログインする
2. ホーム画面でアドバイスカードを確認
   - ローディング表示が適切か
   - アドバイスが表示されるか
   - 「詳しく見る」ボタンが表示されるか

3. 「詳しく見る」ボタンをクリック
   - ダッシュボードに遷移するか
   - アドバイスタブが選択されているか

4. ダッシュボードでの詳細表示を確認
   - 詳細アドバイスが表示されるか
   - 推奨食品リストが表示されるか
   - 更新ボタンが機能するか

5. 異なるデバイスでの表示確認
   - モバイル（iPhone SE, iPhone X, Galaxy S20等）
   - タブレット（iPad Mini, iPad Pro等）
   - デスクトップ（1080p, 1440p等）
```

## 8. 今後の拡張ポイント

1. **アドバイスのバリエーション増加**
   - 妊娠週数ごとの特化型アドバイス
   - 食事記録に基づく特定のアドバイス

2. **インタラクティブ要素**
   - アドバイスに関するフィードバック機能
   - アドバイスに基づく食品選択機能

3. **パーソナライゼーション強化**
   - 過去の食事傾向の分析
   - 好みや食事制限に基づくカスタマイズ

このガイド通りに実装することで、ユーザーに価値のあるAIアドバイス機能が完成します。各ステップは互いに依存関係があり、順番に実装していくことが重要です。特に、データベースとAPIエンドポイントの実装が最も基盤となる部分ですので、ここを丁寧に行うことで後の実装がスムーズになります。
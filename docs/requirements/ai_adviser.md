## AI栄養アドバイザー機能の実装計画

### 1. データベース対応

```sql
-- daily_nutrition_advice テーブルの追加
CREATE TABLE daily_nutrition_advice (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  advice_type TEXT NOT NULL, -- 'daily', 'meal', 'pregnancy_week', 'deficiency' など
  advice_content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, advice_date, advice_type)
);
```

### 2. AI アドバイス生成 API

```typescript
// src/app/api/generate-nutrition-advice/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { userId, adviceType, nutritionData, pregnancyWeek } = await request.json();
    
    // セッション確認
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== userId) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }
    
    // ユーザープロフィール取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!profile) {
      return NextResponse.json({ error: 'プロフィールが見つかりません' }, { status: 404 });
    }
    
    // Gemini API設定
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: { temperature: 0.7 }
    });
    
    // アドバイスタイプに応じてプロンプト作成
    let prompt = '';
    
    switch (adviceType) {
      case 'daily':
        prompt = `
          あなたは妊婦向けの栄養アドバイザーです。以下の情報に基づいて、親しみやすく、温かみのある短い栄養アドバイスを作成してください。
          
          妊娠週数: ${profile.pregnancy_week}週（第${profile.trimester}期）
          本日の栄養摂取状況:
          カロリー: 目標の${nutritionData.calories_percent}%（${nutritionData.actual_calories}kcal / ${nutritionData.target_calories}kcal）
          タンパク質: 目標の${nutritionData.protein_percent}%（${nutritionData.actual_protein}g / ${nutritionData.target_protein}g）
          鉄分: 目標の${nutritionData.iron_percent}%（${nutritionData.actual_iron}mg / ${nutritionData.target_iron}mg）
          葉酸: 目標の${nutritionData.folic_acid_percent}%（${nutritionData.actual_folic_acid}μg / ${nutritionData.target_folic_acid}μg）
          カルシウム: 目標の${nutritionData.calcium_percent}%（${nutritionData.actual_calcium}mg / ${nutritionData.target_calcium}mg）
          ビタミンD: 目標の${nutritionData.vitamin_d_percent}%（${nutritionData.actual_vitamin_d}μg / ${nutritionData.target_vitamin_d}μg）
          
          特に不足している栄養素や過剰な摂取に注意するようアドバイスし、妊娠${profile.pregnancy_week}週目に重要な栄養素について触れてください。
          アドバイスは200文字以内で、親しみやすく実用的なものにしてください。専門用語は避け、簡単な言葉で説明してください。
        `;
        break;
        
      case 'meal':
        prompt = `
          あなたは妊婦向けの栄養アドバイザーです。以下の食事内容に基づいて、次回の食事で補うと良い栄養素についての親しみやすいアドバイスを作成してください。
          
          妊娠週数: ${profile.pregnancy_week}週（第${profile.trimester}期）
          今回の食事内容: ${nutritionData.foods.map(f => f.name).join('、')}
          摂取栄養素:
          カロリー: ${nutritionData.calories}kcal
          タンパク質: ${nutritionData.protein}g
          鉄分: ${nutritionData.iron}mg
          葉酸: ${nutritionData.folic_acid}μg
          カルシウム: ${nutritionData.calcium}mg
          ビタミンD: ${nutritionData.vitamin_d}μg
          
          この食事の良い点と、次回補うと良い栄養素について具体的な食品例を挙げて150文字以内でアドバイスしてください。
        `;
        break;
        
      case 'pregnancy_week':
        prompt = `
          あなたは妊婦向けの栄養アドバイザーです。妊娠${profile.pregnancy_week}週目の女性に向けた栄養アドバイスを作成してください。
          
          現在の妊娠期（第${profile.trimester}期）で特に重要な栄養素と、それを含む食品について具体的に説明してください。
          また、胎児の発育状況と関連づけて、なぜその栄養素が重要なのかを簡潔に説明してください。
          
          アドバイスは200文字以内で、親しみやすく温かみのある文体で作成してください。
        `;
        break;
        
      default:
        prompt = `
          あなたは妊婦向けの栄養アドバイザーです。妊娠${profile.pregnancy_week}週目の女性に向けた一般的な栄養アドバイスを作成してください。
          アドバイスは150文字以内で、親しみやすく実用的なものにしてください。
        `;
    }
    
    // Gemini APIでアドバイス生成
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    
    const adviceContent = result.response.text();
    
    // アドバイスをデータベースに保存
    const { data: advice, error } = await supabase
      .from('daily_nutrition_advice')
      .upsert({
        user_id: userId,
        advice_date: new Date().toISOString().split('T')[0],
        advice_type: adviceType,
        advice_content: adviceContent
      })
      .select()
      .single();
      
    if (error) throw error;
    
    return NextResponse.json({ success: true, advice });
  } catch (error) {
    console.error('アドバイス生成エラー:', error);
    return NextResponse.json(
      { error: 'アドバイスの生成に失敗しました' },
      { status: 500 }
    );
  }
}
```

### 3. アドバイス取得・表示関数

```typescript
// src/lib/api.ts に追加
export const getNutritionAdvice = async (adviceType = 'daily') => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('ログインセッションが無効です');
    }

    const today = new Date().toISOString().split('T')[0];
    
    // 既存のアドバイスを確認
    const { data: existingAdvice, error } = await supabase
      .from('daily_nutrition_advice')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('advice_date', today)
      .eq('advice_type', adviceType)
      .single();
      
    if (!error && existingAdvice) {
      // 既存のアドバイスを既読にして返す
      await supabase
        .from('daily_nutrition_advice')
        .update({ is_read: true })
        .eq('id', existingAdvice.id);
        
      return existingAdvice;
    }
    
    // 栄養データ取得
    const nutritionData = await getNutritionProgress(today);
    
    // プロフィール取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    
    // 新しいアドバイスを生成
    const response = await fetch('/api/generate-nutrition-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        adviceType,
        nutritionData,
        pregnancyWeek: profile.pregnancy_week
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'アドバイス生成エラー');
    }
    
    const { advice } = await response.json();
    return advice;
  } catch (error) {
    console.error('栄養アドバイス取得エラー:', error);
    return null;
  }
};
```

### 4. AIアドバイスコンポーネント

```tsx
// src/components/nutrition/ai-advisor.tsx
import { useState, useEffect } from 'react';
import { getNutritionAdvice } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIAdvisorProps {
  adviceType?: 'daily' | 'meal' | 'pregnancy_week';
  className?: string;
}

export function AIAdvisor({ adviceType = 'daily', className }: AIAdvisorProps) {
  const [advice, setAdvice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAdvice = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getNutritionAdvice(adviceType);
      
      if (result) {
        setAdvice(result.advice_content);
      } else {
        setAdvice('今日のアドバイスを取得できませんでした。');
      }
    } catch (err) {
      console.error('アドバイス読み込みエラー:', err);
      setError('アドバイスの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdvice();
  }, [adviceType]);

  return (
    <Card className={`border-green-100 overflow-hidden ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex-shrink-0">
            <Sparkles className="h-5 w-5 text-green-500" />
          </div>
          
          <div className="flex-1 min-h-[80px]">
            {loading ? (
              <div className="flex items-center h-full">
                <p className="text-sm text-muted-foreground">栄養アドバイスを作成中...</p>
              </div>
            ) : error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-700">{advice}</p>
                <div className="flex justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-xs text-gray-500 p-0 h-auto"
                    onClick={loadAdvice}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    更新
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 5. ダッシュボードへの導入例

```tsx
// src/app/(authenticated)/dashboard/page.tsx
import { AIAdvisor } from '@/components/nutrition/ai-advisor';
import { NutritionChart } from '@/components/dashboard/nutrition-chart';
// 他のインポート...

export default function DashboardPage() {
  // 状態とデータ取得...

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold text-green-600">栄養管理ダッシュボード</h1>
      
      {/* AI栄養アドバイザー */}
      <AIAdvisor adviceType="daily" className="bg-gradient-to-r from-green-50 to-blue-50" />
      
      {/* 栄養バランスチャート */}
      <NutritionChart nutritionData={nutritionData} />
      
      {/* 他のコンポーネント... */}
    </div>
  );
}
```

### 6. ホームページへの導入例

```tsx
// src/app/(authenticated)/home/page.tsx
import { AIAdvisor } from '@/components/nutrition/ai-advisor';
import { DailyRecordCard } from '@/components/home/daily-record-card';
// 他のインポート...

export default function HomePage() {
  // 状態とデータ取得...
  
  // 妊娠週数が変わったかチェック
  const isNewPregnancyWeek = profile && profile.auto_update_week && 
    localStorage.getItem('last_pregnancy_week') !== profile.pregnancy_week.toString();
  
  useEffect(() => {
    if (isNewPregnancyWeek && profile) {
      localStorage.setItem('last_pregnancy_week', profile.pregnancy_week.toString());
    }
  }, [profile, isNewPregnancyWeek]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold text-green-600">ホーム</h1>
      
      {/* 妊娠週数アドバイス（新しい週に入った時のみ表示） */}
      {isNewPregnancyWeek && (
        <AIAdvisor 
          adviceType="pregnancy_week" 
          className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-100" 
        />
      )}
      
      {/* 今日の栄養状態 */}
      <DailyRecordCard nutritionData={nutritionData} />
      
      {/* AIアドバイザー */}
      <AIAdvisor adviceType="daily" />
      
      {/* 他のコンポーネント... */}
    </div>
  );
}
```

### 7. 食事記録後のアドバイス表示

```tsx
// src/components/meals/recognition-editor.tsx の handleSave 関数内に追加
const handleSave = async () => {
  try {
    // 既存の保存処理...
    
    console.log('食事保存成功:', response);
    
    // 食事に基づくアドバイスを生成（非同期で行い、保存処理を遅延させない）
    generateMealAdvice(editedData.foods, editedData.nutrition);
    
    // 保存成功後、データを更新してからリダイレクト
    setTimeout(() => {
      toast.success('食事を記録しました！');
      router.push('/home');
    }, 1000);
  } catch (error) {
    // エラー処理...
  }
};

// 食事アドバイス生成関数
const generateMealAdvice = async (foods, nutrition) => {
  try {
    const response = await fetch('/api/generate-nutrition-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        adviceType: 'meal',
        nutritionData: { foods, ...nutrition }
      })
    });
    
    if (response.ok) {
      // アドバイス生成成功（結果は保存され、ホーム画面でロードされる）
      console.log('食事アドバイス生成成功');
    }
  } catch (error) {
    console.error('食事アドバイス生成エラー:', error);
    // 失敗してもユーザー体験を妨げないよう、エラーは表示しない
  }
};
```

## 特徴と利点

1. **コンテキスト認識型アドバイス**:
   - 妊娠週数に応じたパーソナライズされたアドバイス
   - 実際の栄養摂取状況に基づく実践的なアドバイス
   - 食事内容から次に必要な栄養素の提案

2. **複数のトリガーポイント**:
   - 日次の栄養サマリーに基づくアドバイス
   - 新しい妊娠週数に入った時の重要情報
   - 食事記録直後の即時フィードバック

3. **ユーザーエンゲージメント向上**:
   - パーソナライズされたコンテンツによる継続的な価値提供
   - 専門知識の簡潔で親しみやすい伝達
   - 利用頻度向上によるデータ蓄積とサービス改善

この機能により、アプリはただの食事記録ツールから、妊婦さん一人ひとりに寄り添う「デジタル栄養カウンセラー」へと進化します。妊娠の各段階で必要な栄養についての知識も自然に身につけられるため、教育的な価値も提供できます。
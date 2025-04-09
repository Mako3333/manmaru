'use client';

import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Paper, Divider, Chip } from '@mui/material';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface Method {
  type: 'GET' | 'POST' | 'PUT' | 'DELETE';
  color: string;
}

const METHOD_STYLES: Record<string, Method> = {
  GET: { type: 'GET', color: '#2196f3' },
  POST: { type: 'POST', color: '#ff9800' },
  PUT: { type: 'PUT', color: '#4caf50' },
  DELETE: { type: 'DELETE', color: '#f44336' }
};

interface ApiEndpoint {
  id: string;
  title: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  requestParams?: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  requestBody?: string;
  responseExample: string;
  notes?: string[];
}

const endpoints: ApiEndpoint[] = [
  {
    id: 'meal-analyze',
    title: '食事解析',
    description: 'テキスト入力または画像から食事内容を解析し、栄養計算を行います。',
    method: 'POST',
    endpoint: '/api/v2/meal/analyze',
    requestParams: [
      {
        name: 'text',
        type: 'string',
        description: '解析するテキスト入力（例: "ご飯 味噌汁 鮭の塩焼き"）',
        required: false
      },
      {
        name: 'image',
        type: 'string',
        description: '解析する画像（Base64エンコード文字列）',
        required: false
      },
      {
        name: 'meal_type',
        type: 'string',
        description: '食事タイプ（例: "朝食", "昼食", "夕食", "間食"）',
        required: false
      }
    ],
    requestBody: `{\n  \"text\": \"ご飯 味噌汁 鮭の塩焼き\",\n  \"meal_type\": \"朝食\"\n}`,
    responseExample: `{\n  \"success\": true,\n  \"data\": {\n    \"foods\": [\n      {\n        \"name\": \"ご飯\",\n        \"quantity\": \"茶碗1杯\",\n        \"confidence\": 0.95\n      },\n      {\n        \"name\": \"味噌汁\",\n        \"quantity\": \"1杯\",\n        \"confidence\": 0.93\n      },\n      {\n        \"name\": \"鮭の塩焼き\",\n        \"quantity\": \"1切れ\",\n        \"confidence\": 0.89\n      }\n    ],\n    \"nutritionResult\": {\n      \"nutrition\": {\n        \"totalCalories\": 450,\n        \"totalNutrients\": [\n          { \"name\": \"たんぱく質\", \"value\": 22.5, \"unit\": \"g\" },\n          { \"name\": \"脂質\", \"value\": 12.3, \"unit\": \"g\" },\n          { \"name\": \"炭水化物\", \"value\": 65.7, \"unit\": \"g\" },\n          { \"name\": \"鉄分\", \"value\": 1.8, \"unit\": \"mg\" },\n          { \"name\": \"葉酸\", \"value\": 58.2, \"unit\": \"mcg\" },\n          { \"name\": \"カルシウム\", \"value\": 85.3, \"unit\": \"mg\" },\n          { \"name\": \"ビタミンD\", \"value\": 8.4, \"unit\": \"mcg\" }\n        ],\n        \"foodItems\": [ /* 食品ごとの詳細な栄養情報 (省略される場合あり) */ ],\n        \"pregnancySpecific\": {\n          \"folatePercentage\": 14.55,\n          \"ironPercentage\": 8.57,\n          \"calciumPercentage\": 10.66\n        }\n      },\n      \"reliability\": {\n        \"confidence\": 0.92,\n        \"balanceScore\": 78,\n        \"completeness\": 0.85\n      }\n    },\n    \"processingTimeMs\": 1248\n  },\n  \"meta\": {\n    \"processingTimeMs\": 1352\n  }\n}`,
    notes: ['textとimageのどちらかを指定する必要があります']
  },
  {
    id: 'food-parse',
    title: '食品テキスト解析',
    description: 'テキスト入力から食品情報を解析し、栄養計算を行います。',
    method: 'POST',
    endpoint: '/api/v2/food/parse',
    requestParams: [
      {
        name: 'text',
        type: 'string',
        description: '解析するテキスト（例: "ご飯 200g、納豆 1パック、目玉焼き 1個"）',
        required: true
      }
    ],
    requestBody: `{
  "text": "ご飯 200g、納豆 1パック、目玉焼き 1個"
}`,
    responseExample: `{
  "success": true,
  "data": {
    "foods": [
      {
        "name": "ご飯",
        "quantity": "200g",
        "confidence": 0.98
      },
      {
        "name": "納豆",
        "quantity": "1パック",
        "confidence": 0.96
      },
      {
        "name": "目玉焼き",
        "quantity": "1個",
        "confidence": 0.95
      }
    ],
    "nutritionResult": {
      "nutrition": {
        "calories": 380,
        "protein": 18.2,
        "iron": 2.4,
        "folic_acid": 43.5,
        "calcium": 65.8,
        "vitamin_d": 3.2,
        "extended_nutrients": {
          "fat": 10.5,
          "carbohydrate": 55.3
        }
      },
      "reliability": {
        "confidence": 0.96,
        "balanceScore": 72,
        "completeness": 0.92
      }
    }
  },
  "meta": {
    "processingTimeMs": 857
  }
}`
  },
  {
    id: 'recipe-parse',
    title: 'レシピ解析',
    description: 'レシピURLまたはレシピテキストを解析し、栄養計算を行います。',
    method: 'POST',
    endpoint: '/api/v2/recipe/parse',
    requestParams: [
      {
        name: 'url',
        type: 'string',
        description: '解析するレシピのURL',
        required: true
      }
    ],
    requestBody: `{
  "url": "https://cookpad.com/recipe/1234567"
}`,
    responseExample: `{
  "success": true,
  "data": {
    "recipe": {
      "title": "簡単ヘルシー 鮭とほうれん草のクリームパスタ",
      "servings": 2,
      "ingredients": [
        {
          "name": "パスタ",
          "quantity": "200g",
          "confidence": 0.99
        },
        {
          "name": "鮭",
          "quantity": "2切れ",
          "confidence": 0.97
        },
        {
          "name": "ほうれん草",
          "quantity": "1束",
          "confidence": 0.95
        }
      ]
    },
    "nutritionResult": {
      "nutrition": {
        "calories": 650,
        "protein": 35.2,
        "iron": 3.1,
        "folic_acid": 127.5,
        "calcium": 92.4,
        "vitamin_d": 12.8,
        "extended_nutrients": {
          "fat": 18.7,
          "carbohydrate": 85.3
        }
      },
      "perServing": {
        "calories": 325,
        "protein": 17.6,
        "iron": 1.55,
        "folic_acid": 63.75,
        "calcium": 46.2,
        "vitamin_d": 6.4
      },
      "reliability": {
        "confidence": 0.9,
        "completeness": 0.88
      }
    }
  },
  "meta": {
    "processingTimeMs": 2134
  }
}`
  },
  {
    id: 'nutrition-advice',
    title: '栄養アドバイス取得',
    description: '妊娠週数や栄養摂取状況に基づいた栄養アドバイスを取得します。',
    method: 'GET',
    endpoint: '/api/v2/nutrition/advice',
    requestParams: [
      {
        name: 'date',
        type: 'string',
        description: 'アドバイスを取得する日付 (YYYY-MM-DD形式)',
        required: false
      },
      {
        name: 'force',
        type: 'boolean',
        description: '既存のアドバイスがあっても強制的に再生成する場合は true',
        required: false
      },
      {
        name: 'detail',
        type: 'boolean',
        description: '詳細なアドバイスを取得する場合は true',
        required: false
      }
    ],
    responseExample: `{
  "success": true,
  "data": {
    "advice": {
      "summary": "今日は鉄分とカルシウムの摂取量が不足しています。鉄分を含む食品（ほうれん草、レバー、赤身肉など）とカルシウムを含む食品（乳製品、小魚、緑黄色野菜など）を積極的に摂りましょう。",
      "details": [
        {
          "nutrient": "iron",
          "status": "不足",
          "recommendation": "ほうれん草、レバー、赤身肉などの鉄分が豊富な食品を取り入れましょう。ビタミンCと一緒に摂ると吸収率が高まります。",
          "importance": "鉄分は胎児の脳の発達と貧血予防に重要です。特に妊娠後期は必要量が増加します。"
        },
        {
          "nutrient": "calcium",
          "status": "不足",
          "recommendation": "牛乳、ヨーグルト、小魚、豆腐、緑黄色野菜などからカルシウムを摂りましょう。",
          "importance": "カルシウムは胎児の骨や歯の形成に必要です。不足すると母体の骨からカルシウムが溶け出してしまいます。"
        }
      ],
      "weekInfo": {
        "week": 24,
        "keyNutrients": ["iron", "calcium", "folic_acid"],
        "tip": "妊娠24週は胎児の成長が著しく、鉄分の必要量が特に増えます。鉄分を多く含む食品を意識して摂取しましょう。"
      }
    },
    "recommendedFoods": [
      { "name": "ほうれん草のおひたし", "reason": "鉄分と葉酸が豊富です" },
      { "name": "ひじきの煮物", "reason": "鉄分とカルシウムが含まれます" },
      { "name": "ヨーグルト", "reason": "手軽にカルシウムを摂取できます" }
    ]
  },
  "meta": {
    "processingTimeMs": 350
  }
}`
  }
];

// エラーコードの定義 (現在未使用)
// const errorCodes = {
//   400: '不正なリクエスト',
//   401: '認証エラー',
//   404: 'リソースが見つかりません',
//   500: 'サーバー内部エラー'
// };

const ApiDocsComponent: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null | undefined>(
    endpoints.length > 0 ? endpoints[0] : null
  );

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    const newEndpoint = endpoints[newValue];

    if (newEndpoint !== undefined) {
      setSelectedEndpoint(newEndpoint);
    } else {
      setSelectedEndpoint(null);
    }
  };

  const methodStyle = selectedEndpoint ? METHOD_STYLES[selectedEndpoint.method] : null;

  return (
    <Box sx={{ display: 'flex' }}>
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={activeTab}
        onChange={handleTabChange}
        aria-label="Vertical API tabs"
        sx={{ borderRight: 1, borderColor: 'divider', minWidth: 200 }}
      >
        {endpoints.map((ep, index) => (
          <Tab key={ep.id} label={ep.title} id={`vertical-tab-${index}`} aria-controls={`vertical-tabpanel-${index}`} />
        ))}
      </Tabs>
      <Box sx={{ flexGrow: 1, p: 3 }}>
        {selectedEndpoint && (
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              {selectedEndpoint.title}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body1" paragraph>
              {selectedEndpoint.description}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {methodStyle && (
                <Chip
                  label={methodStyle.type}
                  sx={{
                    backgroundColor: methodStyle.color,
                    color: 'white',
                    fontWeight: 'bold',
                    mr: 1
                  }}
                />
              )}
              <Typography variant="body1" component="code" sx={{ background: '#f5f5f5', p: 0.5, borderRadius: 1 }}>
                {selectedEndpoint.endpoint}
              </Typography>
            </Box>

            {selectedEndpoint.requestParams && selectedEndpoint.requestParams.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  リクエストパラメータ
                </Typography>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {selectedEndpoint.requestParams.map((param, index) => (
                    <li key={index} style={{ marginBottom: '8px' }}>
                      <code>{param.name}</code> ({param.type}) {param.required ? <Chip label="必須" size="small" color="error" sx={{ ml: 1 }} /> : ''}
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                        {param.description}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {selectedEndpoint.requestBody && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  リクエストボディ例
                </Typography>
                <SyntaxHighlighter language="json" style={docco}>
                  {selectedEndpoint.requestBody}
                </SyntaxHighlighter>
              </>
            )}

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              レスポンス例 (成功時)
            </Typography>
            <SyntaxHighlighter language="json" style={docco}>
              {selectedEndpoint.responseExample}
            </SyntaxHighlighter>

            {selectedEndpoint.notes && selectedEndpoint.notes.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  備考
                </Typography>
                <ul>
                  {selectedEndpoint.notes.map((note, index) => (
                    <li key={index}><Typography variant="body2">{note}</Typography></li>
                  ))}
                </ul>
              </>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default ApiDocsComponent; 
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
        requestBody: `{
  "text": "ご飯 味噌汁 鮭の塩焼き",
  "meal_type": "朝食"
}`,
        responseExample: `{
  "success": true,
  "data": {
    "foods": [
      {
        "name": "ご飯",
        "quantity": "茶碗1杯",
        "confidence": 0.95
      },
      {
        "name": "味噌汁",
        "quantity": "1杯",
        "confidence": 0.93
      },
      {
        "name": "鮭の塩焼き",
        "quantity": "1切れ",
        "confidence": 0.89
      }
    ],
    "nutritionResult": {
      "nutrition": {
        "calories": 450,
        "protein": 22.5,
        "iron": 1.8,
        "folic_acid": 58.2,
        "calcium": 85.3,
        "vitamin_d": 8.4,
        "extended_nutrients": {
          "fat": 12.3,
          "carbohydrate": 65.7
        }
      },
      "reliability": {
        "confidence": 0.92,
        "balanceScore": 78,
        "completeness": 0.85
      }
    },
    "processingTimeMs": 1248
  },
  "meta": {
    "processingTimeMs": 1352
  }
}`,
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
        "developmentStage": "胎児は約30cmになり、肺の発達が進んでいます。"
      }
    },
    "timestamp": "2024-04-01T15:30:45Z"
  },
  "meta": {
    "processingTimeMs": 520
  }
}`
    }
];

const errorCodes = [
    { code: 'AUTH_REQUIRED', description: '認証が必要です' },
    { code: 'AUTH_INVALID', description: '認証情報が無効です' },
    { code: 'DATA_VALIDATION_ERROR', description: '入力データが無効です' },
    { code: 'DATA_NOT_FOUND', description: '要求されたデータが見つかりません' },
    { code: 'AI_ANALYSIS_ERROR', description: 'AI解析中にエラーが発生しました' },
    { code: 'FOOD_NOT_FOUND', description: '食品データが見つかりません' },
    { code: 'NUTRITION_CALCULATION_ERROR', description: '栄養計算中にエラーが発生しました' },
    { code: 'FOOD_RECOGNITION_ERROR', description: '食品認識中にエラーが発生しました' }
];

const ApiDocsComponent: React.FC = () => {
    // 必ず最初のエンドポイントは存在するため、初期値として使用
    const initialEndpoint = endpoints.length > 0 ? endpoints[0] : null;
    const [selectedTab, setSelectedTab] = useState(0);
    const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(initialEndpoint);

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setSelectedTab(newValue);
        if (newValue >= 0 && newValue < endpoints.length) {
            // 配列の範囲内であることを確認済み
            setSelectedEndpoint(endpoints[newValue]);
        } else {
            setSelectedEndpoint(null);
        }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: 1200, margin: '0 auto', p: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom color="primary">
                manmaru API v2 ドキュメント
            </Typography>

            <Typography variant="body1" paragraph>
                このドキュメントではmanmaruアプリケーションのAPI v2の使用方法について説明します。
                APIはREST形式で提供され、すべてのエンドポイントは標準化されたJSON形式のレスポンスを返します。
            </Typography>

            <Box sx={{ my: 4 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                    認証
                </Typography>
                <Typography variant="body1" paragraph>
                    ほとんどのAPIエンドポイントでは認証が必要です。認証はJWTトークンを使用して行われます。
                    リクエストヘッダーに<code>Authorization</code>ヘッダーとしてトークンを含める必要があります。
                </Typography>
                <Paper sx={{ p: 2, my: 2, borderRadius: 2, bgcolor: '#f5f5f5' }}>
                    <Typography component="pre" sx={{ fontSize: '0.9rem', fontFamily: 'monospace', m: 0 }}>
                        Authorization: Bearer {'{your_jwt_token}'}
                    </Typography>
                </Paper>
            </Box>

            <Box sx={{ my: 4 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                    レスポンス形式
                </Typography>
                <Typography variant="body1" paragraph>
                    すべてのAPIレスポンスは次の標準形式で返されます:
                </Typography>
                <Paper sx={{ p: 2, my: 2, borderRadius: 2 }}>
                    <SyntaxHighlighter language="json" style={docco}>
                        {`{
  "success": boolean,  // リクエストの成功/失敗
  "data": any,         // 成功時のレスポンスデータ（オプション）
  "error": {           // エラー時の情報（オプション）
    "code": string,    // エラーコード
    "message": string, // エラーメッセージ
    "details": any,    // 詳細情報（開発モードのみ）
    "suggestions": string[] // 解決策の提案（オプション）
  },
  "meta": {            // メタ情報（オプション）
    "processingTimeMs": number, // 処理時間（ミリ秒）
    "warning": string  // 警告メッセージ（オプション）
  }
}`}
                    </SyntaxHighlighter>
                </Paper>
            </Box>

            <Box sx={{ my: 4 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                    エンドポイント
                </Typography>

                <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs
                            value={selectedTab}
                            onChange={handleTabChange}
                            variant="scrollable"
                            scrollButtons="auto"
                        >
                            {endpoints.map((endpoint) => (
                                <Tab key={endpoint.id} label={endpoint.title} />
                            ))}
                            <Tab label="エラーコード" />
                        </Tabs>
                    </Box>

                    {selectedTab < endpoints.length ? (
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Chip
                                    label={selectedEndpoint.method}
                                    sx={{
                                        bgcolor: METHOD_STYLES[selectedEndpoint.method]?.color || '#9e9e9e',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        mr: 2
                                    }}
                                />
                                <Typography variant="h6" component="span">
                                    {selectedEndpoint.endpoint}
                                </Typography>
                            </Box>

                            <Typography variant="body1" paragraph>
                                {selectedEndpoint.description}
                            </Typography>

                            {selectedEndpoint.requestParams && (
                                <>
                                    <Typography variant="h6" gutterBottom>
                                        リクエストパラメータ
                                    </Typography>
                                    <Paper sx={{ overflow: 'auto', mb: 3 }}>
                                        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <Box component="thead">
                                                <Box component="tr" sx={{ bgcolor: '#f5f5f5' }}>
                                                    <Box component="th" sx={{ p: 2, textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                        パラメータ
                                                    </Box>
                                                    <Box component="th" sx={{ p: 2, textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                        型
                                                    </Box>
                                                    <Box component="th" sx={{ p: 2, textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                        説明
                                                    </Box>
                                                    <Box component="th" sx={{ p: 2, textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                        必須
                                                    </Box>
                                                </Box>
                                            </Box>
                                            <Box component="tbody">
                                                {selectedEndpoint.requestParams.map((param, index) => (
                                                    <Box component="tr" key={index} sx={{ '&:nth-of-type(even)': { bgcolor: '#f9f9f9' } }}>
                                                        <Box component="td" sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
                                                            {param.name}
                                                        </Box>
                                                        <Box component="td" sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
                                                            <code>{param.type}</code>
                                                        </Box>
                                                        <Box component="td" sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
                                                            {param.description}
                                                        </Box>
                                                        <Box component="td" sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
                                                            {param.required ? (
                                                                <Chip size="small" label="必須" sx={{ bgcolor: '#f44336', color: 'white' }} />
                                                            ) : (
                                                                <Chip size="small" label="省略可" sx={{ bgcolor: '#9e9e9e', color: 'white' }} />
                                                            )}
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Box>
                                    </Paper>
                                </>
                            )}

                            {selectedEndpoint.requestBody && (
                                <>
                                    <Typography variant="h6" gutterBottom>
                                        リクエスト例
                                    </Typography>
                                    <Paper sx={{ p: 2, my: 2, borderRadius: 2 }}>
                                        <SyntaxHighlighter language="json" style={docco}>
                                            {selectedEndpoint.requestBody}
                                        </SyntaxHighlighter>
                                    </Paper>
                                </>
                            )}

                            <Typography variant="h6" gutterBottom>
                                レスポンス例
                            </Typography>
                            <Paper sx={{ p: 2, my: 2, borderRadius: 2 }}>
                                <SyntaxHighlighter language="json" style={docco}>
                                    {selectedEndpoint.responseExample}
                                </SyntaxHighlighter>
                            </Paper>

                            {selectedEndpoint.notes && selectedEndpoint.notes.length > 0 && (
                                <>
                                    <Typography variant="h6" gutterBottom>
                                        注意事項
                                    </Typography>
                                    <Paper sx={{ p: 2, my: 2, borderRadius: 2, bgcolor: '#fff8e1' }}>
                                        <ul style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>
                                            {selectedEndpoint.notes.map((note, index) => (
                                                <li key={index}>{note}</li>
                                            ))}
                                        </ul>
                                    </Paper>
                                </>
                            )}
                        </Box>
                    ) : (
                        <Box sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                エラーコード一覧
                            </Typography>
                            <Typography variant="body1" paragraph>
                                APIがエラーを返す場合、以下のようなエラーコードが含まれます:
                            </Typography>
                            <Paper sx={{ overflow: 'auto' }}>
                                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <Box component="thead">
                                        <Box component="tr" sx={{ bgcolor: '#f5f5f5' }}>
                                            <Box component="th" sx={{ p: 2, textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                コード
                                            </Box>
                                            <Box component="th" sx={{ p: 2, textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                説明
                                            </Box>
                                        </Box>
                                    </Box>
                                    <Box component="tbody">
                                        {errorCodes.map((error, index) => (
                                            <Box component="tr" key={index} sx={{ '&:nth-of-type(even)': { bgcolor: '#f9f9f9' } }}>
                                                <Box component="td" sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
                                                    <code>{error.code}</code>
                                                </Box>
                                                <Box component="td" sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
                                                    {error.description}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </Paper>
                        </Box>
                    )}
                </Box>
            </Box>

            <Divider sx={{ my: 4 }} />

            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                    関連リソース
                </Typography>
                <ul>
                    <li>
                        <Typography variant="body1" component="a" href="/docs/nutrition-types" color="primary">
                            栄養素データ型リファレンス
                        </Typography>
                    </li>
                    <li>
                        <Typography variant="body1" component="a" href="/docs/food-database" color="primary">
                            食品データベースリファレンス
                        </Typography>
                    </li>
                </ul>
            </Box>

            <Box sx={{ mt: 8, pt: 2, borderTop: '1px solid #ddd', textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    © 2023-2024 manmaru. All rights reserved.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    API バージョン: v2.0.0
                </Typography>
            </Box>
        </Box>
    );
};

export default ApiDocsComponent; 
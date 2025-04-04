/**
 * 栄養アドバイスの生成タイプ
 *
 * - DAILY_INITIAL: その日の初回アクセス時に生成される基本的なアドバイス
 * - AFTER_MEALS: 3食記録後に生成される、Tips中心のアドバイス
 * - MANUAL_REFRESH: ユーザーが更新ボタンを押した際に生成されるアドバイス
 */
export type AdviceType = 'DAILY_INITIAL' | 'AFTER_MEALS' | 'MANUAL_REFRESH'; 
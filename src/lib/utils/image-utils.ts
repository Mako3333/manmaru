/**
 * 画像処理用のユーティリティ関数
 * 画像のBase64エンコードとGemini API用のフォーマット変換を行う
 */

/**
 * 画像ファイルをBase64形式に変換する
 * @param file - 変換する画像ファイル
 * @returns Base64エンコードされた画像データ（プレフィックス付き）
 */
export const encodeImageToBase64 = async (file: File): Promise<string> => {
    try {
        // FileReaderを使用してファイルを読み込む
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                if (!reader.result) {
                    reject(new Error('ファイルの読み込みに失敗しました'));
                    return;
                }

                // 結果を文字列として取得
                const base64String = reader.result.toString();

                // 改行文字を削除
                const cleanedBase64 = base64String.replace(/[\r\n]/g, '');

                // プレフィックスがない場合は追加
                // 画像のMIMEタイプを取得（デフォルトはjpeg）
                const mimeType = file.type || 'image/jpeg';

                if (cleanedBase64.startsWith('data:')) {
                    resolve(cleanedBase64);
                } else {
                    resolve(`data:${mimeType};base64,${cleanedBase64}`);
                }
            };

            reader.onerror = () => {
                reject(new Error('ファイルの読み込み中にエラーが発生しました'));
            };

            // ファイルをBase64としてエンコード
            reader.readAsDataURL(file);
        });
    } catch (error) {
        console.error('Base64エンコード中にエラーが発生しました:', error);
        throw error;
    }
};

/**
 * Gemini API用の画像コンテンツオブジェクトを作成する
 * @param base64Data - Base64エンコードされた画像データ
 * @returns Gemini API用の画像コンテンツオブジェクト
 */
export const createImageContent = (base64Data: string): {
    mimeType: string;
    data: string;
} => {
    try {
        // Base64データからMIMEタイプを抽出
        let mimeType = 'image/jpeg'; // デフォルト値
        let data = base64Data;

        // プレフィックスがある場合は処理
        if (base64Data.startsWith('data:')) {
            const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                mimeType = matches[1];
                data = matches[2]; // プレフィックスを除いたBase64データ
            }
        }

        return {
            mimeType,
            data
        };
    } catch (error) {
        console.error('画像コンテンツの作成中にエラーが発生しました:', error);
        throw error;
    }
}; 
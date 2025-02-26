const fs = require('fs');
const path = require('path');

// 画像ファイルの実際のパスを指定（例：publicフォルダ内など）
const imagePath = path.join(__dirname, 'public', 'test_image.jpg');
// または絶対パスで指定
// const imagePath = 'E:\\path\\to\\your\\test_image.jpg';

// 画像ファイルを読み込みBase64エンコード
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');

// 改行を削除して出力
console.log(base64Image.replace(/[\r\n]/g, ''));

// ファイルに保存（改行なし）
fs.writeFileSync('encoded_image.txt', base64Image.replace(/[\r\n]/g, ''));

// クリップボードにコピー（オプション）
// require('clipboardy').writeSync(base64Image); 
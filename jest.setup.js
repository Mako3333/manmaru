// jest.setup.js
// Jest環境をセットアップする
// @testing-library/jest-domはexpectをグローバルに拡張するためここでは直接requireしない

// フェッチポリフィル
require('whatwg-fetch');

// Jest で TextEncoder/TextDecoder を利用可能にする
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// ReadableStreamが未定義の場合の対応
if (typeof ReadableStream === 'undefined') {
    global.ReadableStream = class MockReadableStream {
        constructor() { }
        getReader() {
            return {
                read: () => Promise.resolve({ done: true, value: undefined }),
                releaseLock: () => { }
            };
        }
    };
}

// IntersectionObserver のモック
class IntersectionObserver {
    observe() { return null; }
    disconnect() { return null; }
    unobserve() { return null; }
}

global.IntersectionObserver = IntersectionObserver;
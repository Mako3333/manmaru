// jest.setup.js
// import を require に戻す
require('@testing-library/jest-dom');
require('whatwg-fetch'); // polyfill fetch

// Jest で TextEncoder/TextDecoder を利用可能にする
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// IntersectionObserver のモック
class IntersectionObserver {
    // ... existing code ...
}
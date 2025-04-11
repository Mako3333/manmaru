// jest.setup.js
// Jest環境をセットアップする
// @testing-library/jest-domはexpectをグローバルに拡張するためここでは直接requireしない

// フェッチポリフィル
require('whatwg-fetch');

// Jest で TextEncoder/TextDecoder を利用可能にする
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Response.jsonのモック
if (typeof Response.prototype.json !== 'function') {
    Response.prototype.json = function () {
        return Promise.resolve(JSON.parse(this._bodyText || '{}'));
    };
}

// ReadableStreamが未定義の場合の対応
if (typeof ReadableStream === 'undefined') {
    global.ReadableStream = class MockReadableStream {
        constructor(source) {
            this._source = source;
        }

        getReader() {
            return {
                read: () => Promise.resolve({ done: true, value: undefined }),
                releaseLock: () => { }
            };
        }

        // JSON化可能なプロパティを追加（JSONシリアライズエラー防止）
        toJSON() {
            return {};
        }
    };

    // fetch APIのレスポンスで使われる関連メソッドを実装
    global.Response.prototype.clone = function () {
        return new Response(this.body, {
            status: this.status,
            statusText: this.statusText,
            headers: this.headers
        });
    };
}

// NextResponseのモック
const nextMock = jest.requireMock('next/server');
if (typeof nextMock.NextResponse.json !== 'function') {
    nextMock.NextResponse.json = function (body, init) {
        const jsonStr = JSON.stringify(body);
        const response = new Response(jsonStr, init);
        response.json = () => Promise.resolve(body);
        return response;
    };
}

// IntersectionObserver のモック
class IntersectionObserver {
    observe() { return null; }
    disconnect() { return null; }
    unobserve() { return null; }
}

global.IntersectionObserver = IntersectionObserver;
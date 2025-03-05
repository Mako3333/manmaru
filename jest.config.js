const nextJest = require('next/jest');

const createJestConfig = nextJest({
    // next.config.jsとテスト環境用の.envファイルが配置されたディレクトリのパス
    dir: './',
});

// Jestに渡すカスタム設定
const customJestConfig = {
    // テストファイルのパターンを指定
    testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
    // テスト環境のセットアップファイル
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    // モジュール名のエイリアス設定
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    // テスト環境
    testEnvironment: 'jest-environment-jsdom',
};

// createJestConfigを使用することによって、next/jestが提供する設定とマージされる
module.exports = createJestConfig(customJestConfig); 
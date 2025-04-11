module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'ts-jest'
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(@testing-library/jest-dom|whatwg-fetch)/)'
    ],
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
    },
    resetMocks: false
}; 
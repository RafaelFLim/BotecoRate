const unitSuites = [
  'cep', 'ownerApproval', 'historyFilters', 'historyPhoto', 'trashEntries',
  'firebaseConfig', 'errorFeedback', 'mediaService', 'photoSync',
];
const base = {
  rootDir: __dirname,
  testEnvironment: 'node',
  transform: { '^.+\\.[cm]?jsx?$': '<rootDir>/scripts/jest-transform.cjs' },
  transformIgnorePatterns: ['/node_modules/(?!@noble/hashes/)'],
  clearMocks: true,
};

module.exports = {
  testTimeout: 30000,
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: unitSuites.map(name => `<rootDir>/tests/${name}.test.js`),
    },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/*.test.js'],
      testPathIgnorePatterns: unitSuites.map(name => `/${name}\\.test\\.js$`),
    },
  ],
  collectCoverageFrom: ['src/utils/**/*.js', 'src/services/*Protocol.js', 'src/database/*Store.js'],
  coverageDirectory: 'coverage',
};

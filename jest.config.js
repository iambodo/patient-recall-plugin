const path = require('path')

// @dhis2/cli-app-scripts restricts subpath exports to "." and "./init" (not
// even "./package.json"), so its config/ mocks can't be required directly.
// The "." export resolves to <package root>/src/index.js, so go up two
// levels to reach the package root, where config/ is a sibling of src/.
const cliAppScriptsDir = path.join(
    path.dirname(require.resolve('@dhis2/cli-app-scripts')),
    '..'
)
const cliConfigMock = (name) => path.join(cliAppScriptsDir, 'config', name)

module.exports = {
    moduleNameMapper: {
        '\\.(css|less)$': cliConfigMock('jest.identity.mock.js'),
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
            cliConfigMock('jest.file.mock.js'),
        '^styled-jsx/(css|macro)$': cliConfigMock(
            'jest.styled-jsx-css.mock.js'
        ),
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
}

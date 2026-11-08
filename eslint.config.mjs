import config from '@dhis2/config-eslint'
import { defineConfig } from 'eslint/config'
import { includeIgnoreFile } from '@eslint/compat'
import { fileURLToPath } from 'node:url'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig([
    includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
    {
        extends: [config],
    },
    {
        settings: {
            // @dhis2/config-eslint only configures the `node` resolver,
            // which can't see TypeScript-only named exports (e.g. types
            // re-exported by @tanstack/react-query, @testing-library/react).
            // Adding the typescript resolver alongside fixes false-positive
            // import/named errors without disabling resolution entirely.
            'import/resolver': {
                node: { extensions: ['.js', '.mjs', '.jsx', '.ts', '.tsx'] },
                typescript: true,
            },
        },
    },
])

/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'patient-recall-plugin',
    title: 'Patient Recall',

    entryPoints: {
        app: './src/App.tsx',
        plugin: './src/Plugin.tsx',
    },

    viteConfigExtensions: './viteConfigExtensions.mts',
}

module.exports = config

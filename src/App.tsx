import i18n from '@dhis2/d2-i18n'
import { NoticeBox } from '@dhis2/ui'
import React, { FC } from 'react'
import classes from '@/App.module.css'
import Plugin from '@/Plugin'

// Standalone dev harness for the Bulk Data Entry Plugin. Capture loads
// `src/Plugin.tsx` (the `plugin` entry point in d2.config.js) inside an
// iframe and supplies onComplete/onDefer via post-robot — here we stub those
// so the plugin UI can be exercised directly with `pnpm start`.
const App: FC = () => (
    <div className={classes.container}>
        <div className={classes.noticeContainer}>
            <NoticeBox title={i18n.t('Standalone dev preview')}>
                {i18n.t(
                    'This is the app entry point, used only to preview the plugin outside of Capture. In production, Capture loads the plugin entry point directly as a Bulk Data Entry Plugin.'
                )}
            </NoticeBox>
        </div>
        <Plugin
            configKey="overdueCheck"
            onComplete={() => console.log('onComplete called')}
            onDefer={() => console.log('onDefer called')}
        />
    </div>
)

export default App

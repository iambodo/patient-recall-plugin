import i18n from '@dhis2/d2-i18n'
import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import React, { FC } from 'react'
import { OverduePatientList } from '@/components/OverduePatientList'
import { useBulkStageEntry } from '@/hooks/useBulkStageEntry'
import { useOverdueCheck } from '@/hooks/useOverdueCheck'
import { usePluginConfig } from '@/hooks/usePluginConfig'
import { useProgramStageCompulsoryDataElements } from '@/hooks/useProgramStageCompulsoryDataElements'
import { useResultOptions } from '@/hooks/useResultOptions'
import classes from '@/Plugin.module.css'

export type BulkDataEntryPluginProps = {
    pluginSource?: string
    configKey?: string
    dataKey?: string
    onComplete: () => void
    onDefer: () => void
    trackedEntityIds?: string[]
}

const formatDateTime = (date: Date) =>
    `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`

const Plugin: FC<BulkDataEntryPluginProps> = ({
    configKey,
    onComplete,
    onDefer,
}) => {
    const {
        config,
        isLoading: isLoadingConfig,
        error: configError,
        isMalformed: isConfigMalformed,
    } = usePluginConfig(configKey)

    const {
        runCheck,
        isRunning,
        error: checkError,
        result,
        lastRunAt,
    } = useOverdueCheck({
        programId: config?.programId ?? '',
        programStageId: config?.programStageId ?? '',
        overdueAttributeId: config?.overdueAttributeId ?? '',
        overdueValue: config?.overdueValue ?? '',
        clearedValue: config?.clearedValue ?? '',
        phoneAttributeId: config?.phoneAttributeId ?? '',
        givenNameAttributeId: config?.givenNameAttributeId ?? '',
        familyNameAttributeId: config?.familyNameAttributeId ?? '',
        callEventStageId: config?.callEventStageId ?? '',
    })

    const { options: resultOptions, label: resultLabel } = useResultOptions(
        config?.resultDataElementId
    )
    const { options: reasonOptions, label: reasonLabel } = useResultOptions(
        config?.reasonDataElementId
    )

    const { uncoveredCompulsoryDataElements } =
        useProgramStageCompulsoryDataElements(
            config?.bulkEntryStageId,
            [
                config?.resultDataElementId,
                config?.resultDateDataElementId,
                config?.reasonDataElementId,
            ].filter((id): id is string => Boolean(id))
        )

    const uncoveredDateDataElementIds = uncoveredCompulsoryDataElements
        .filter((de) => de.valueType === 'DATE')
        .map((de) => de.id)
    const uncoveredNonDateDataElements = uncoveredCompulsoryDataElements.filter(
        (de) => de.valueType !== 'DATE'
    )

    const {
        saveAll,
        isSaving,
        result: saveResult,
        error: saveError,
    } = useBulkStageEntry({
        programId: config?.programId ?? '',
        bulkEntryStageId: config?.bulkEntryStageId ?? '',
        resultDataElementId: config?.resultDataElementId ?? '',
        resultDateDataElementId: config?.resultDateDataElementId,
        reasonDataElementId: config?.reasonDataElementId,
        additionalDateDataElementIds: uncoveredDateDataElementIds,
        overdueAttributeId: config?.overdueAttributeId ?? '',
        calledValue: config?.calledValue ?? '',
    })

    if (isLoadingConfig) {
        return (
            <div className={classes.loadingContainer}>
                <CircularLoader small />
            </div>
        )
    }

    if (isConfigMalformed) {
        return (
            <NoticeBox error title={i18n.t('Plugin configuration is invalid')}>
                {i18n.t(
                    'The capture/bulkDataEntry data store value\'s "config" field must be an array of configuration objects, not a single object. Check the value in the Data Store app.'
                )}
            </NoticeBox>
        )
    }

    if (configError || !config) {
        return (
            <NoticeBox error title={i18n.t('Plugin not configured')}>
                {i18n.t(
                    'No configuration was found for this plugin. Add an entry to the capture/bulkDataEntry data store key with this configKey: {{configKey}}',
                    { configKey: configKey ?? '' }
                )}
            </NoticeBox>
        )
    }

    return (
        <div className={classes.container}>
            <p className={classes.scopeLine}>
                {i18n.t('Checking patients for: {{title}}', {
                    title: config.configKey,
                })}
            </p>

            <Button primary loading={isRunning} onClick={() => runCheck()}>
                {i18n.t('Check for overdue patients')}
            </Button>

            <p className={classes.lastRun}>
                {lastRunAt
                    ? i18n.t('Last checked: {{dateTime}}', {
                          dateTime: formatDateTime(lastRunAt),
                          interpolation: { escapeValue: false },
                      })
                    : i18n.t('Not checked yet this session')}
            </p>

            {checkError && (
                <NoticeBox error title={i18n.t('Could not check patients')}>
                    {checkError.message}
                </NoticeBox>
            )}

            {result && (
                <>
                    <NoticeBox valid title={i18n.t('Overdue check complete')}>
                        <p>
                            {result.estimatedOverdueEventsIsCapped
                                ? i18n.t('1,000+ overdue visits found')
                                : i18n.t('{{count}} overdue visits found', {
                                      count: result.estimatedOverdueEvents,
                                  })}
                        </p>
                        <p>
                            {i18n.t(
                                '{{flagged}} patients newly marked overdue, {{cleared}} patients cleared',
                                {
                                    flagged: result.flaggedCount,
                                    cleared: result.clearedCount,
                                }
                            )}
                        </p>
                        <p>
                            {i18n.t(
                                '{{count}} patients shown below for action (already-actioned patients are hidden)',
                                { count: result.patients.length }
                            )}
                        </p>
                    </NoticeBox>

                    {uncoveredNonDateDataElements.length > 0 && (
                        <NoticeBox
                            warning
                            title={i18n.t('Some entries may be rejected')}
                        >
                            {i18n.t(
                                'The configured stage requires additional fields this form does not collect and cannot default automatically: {{ids}}',
                                {
                                    ids: uncoveredNonDateDataElements
                                        .map((de) => de.id)
                                        .join(', '),
                                }
                            )}
                        </NoticeBox>
                    )}

                    {saveError && (
                        <NoticeBox
                            error
                            title={i18n.t('Could not save entries')}
                        >
                            {saveError.message}
                        </NoticeBox>
                    )}

                    {saveResult && (
                        <NoticeBox valid title={i18n.t('Entries saved')}>
                            {i18n.t('{{count}} events created', {
                                count: saveResult.stats?.created ?? 0,
                            })}
                        </NoticeBox>
                    )}

                    <OverduePatientList
                        patients={result.patients}
                        resultOptions={resultOptions}
                        resultLabel={resultLabel}
                        reasonOptions={reasonOptions}
                        reasonLabel={reasonLabel}
                        reasonShowWhenResultCode={
                            config?.reasonShowWhenResultCode
                        }
                        onSaveAll={saveAll}
                        isSaving={isSaving}
                    />
                </>
            )}

            <div className={classes.footerButtons}>
                <Button onClick={() => onDefer()}>{i18n.t('Defer')}</Button>
                <Button onClick={() => onComplete()}>{i18n.t('Close')}</Button>
            </div>
        </div>
    )
}

export default Plugin

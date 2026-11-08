import { useApiDataQuery } from '@/utils/useApiDataQuery'

export type BulkDataEntryConfigEntry = {
    configKey: string
    programId: string
    programStageId: string
    overdueAttributeId: string
    /**
     * The value written to `overdueAttributeId` to flag a patient overdue,
     * and used as the `:eq:` filter to find currently-flagged patients.
     * TB's `overdueAttributeId` is BOOLEAN ("true"/"false"); other programs
     * may use a TEXT option set instead (e.g. NCD's "OVERDUE_PENDING_CALL").
     */
    overdueValue: string
    /** The value written to `overdueAttributeId` when a patient is no longer overdue. */
    clearedValue: string
    /**
     * The value written to `overdueAttributeId` when a bulk-entry row is
     * saved for a patient — distinct from `clearedValue` because "no longer
     * overdue" (the check found no overdue event) and "was just called"
     * (the user actioned them) can be different states for a TEXT option
     * set (e.g. NCD's "CALLED" vs. "UPCOMING_VISIT"). For a BOOLEAN
     * attribute this is typically the same as `clearedValue`.
     */
    calledValue: string
    phoneAttributeId: string
    givenNameAttributeId: string
    familyNameAttributeId: string
    callEventStageId: string
    bulkEntryStageId: string
    resultDataElementId: string
    resultDateDataElementId?: string
    /**
     * Optional second dropdown per row (e.g. "Reason for removal from
     * overdue list"), only shown once `resultDataElementId` is set to
     * `reasonShowWhenResultCode` (e.g. call outcome "ANSWERED"). Options are
     * read from this data element's option set.
     */
    reasonDataElementId?: string
    reasonShowWhenResultCode?: string
}

type BulkDataEntryDatastoreValue = {
    version: number
    config: BulkDataEntryConfigEntry[]
}

/**
 * Bulk Data Entry Plugins aren't configurable via the Tracker Plugin
 * Configurator app (that only covers Form Field and Enrollment plugins) — the
 * only mechanism Capture gives this plugin type is the `configKey` prop, so
 * the plugin re-reads its own datastore entry and looks itself up by that key
 * to get the program/stage/attribute IDs it needs.
 */
export const usePluginConfig = (configKey: string | undefined) => {
    const { data, isLoading, error } =
        useApiDataQuery<BulkDataEntryDatastoreValue>({
            queryKey: ['dataStore', 'capture', 'bulkDataEntry'],
            query: {
                resource: 'dataStore/capture/bulkDataEntry',
            },
            cacheTime: Infinity,
            staleTime: Infinity,
        })

    // The datastore value is hand-edited (no schema enforcement), so a
    // malformed write — e.g. `config` saved as a single object instead of an
    // array — is a real failure mode, not just a type-safety nicety. Without
    // this guard, `data.config.find` throws deep inside the component tree
    // with an unhelpful minified stack trace instead of a clear message.
    const isMalformed = Boolean(data) && !Array.isArray(data?.config)
    const config = Array.isArray(data?.config)
        ? data.config.find((entry) => entry.configKey === configKey)
        : undefined

    return {
        config,
        isLoading,
        error,
        isMalformed,
    }
}

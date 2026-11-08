import type { TrackerImportReport } from '@dhis2/api-types/v42'
import { useDataEngine } from '@dhis2/app-runtime'
import { useMutation } from '@tanstack/react-query'

export type BulkStageEntryParams = {
    programId: string
    bulkEntryStageId: string
    resultDataElementId: string
    /**
     * Optional — not every program has a dedicated "date of result" data
     * element (e.g. the event's own `occurredAt` may be the only date
     * recorded). When omitted, no extra data value is written for it.
     */
    resultDateDataElementId?: string
    /** Optional — written only for rows that have a `reasonCode`. */
    reasonDataElementId?: string
    /**
     * Other DATE-type data elements the stage marks compulsory that the
     * simple form doesn't ask for. Defaulted to each row's own result date —
     * a pragmatic stand-in, not a clinically meaningful value. Non-date
     * compulsory fields can't be safely defaulted and are left for the
     * caller to warn about instead.
     */
    additionalDateDataElementIds?: string[]
    /**
     * When saving a result for a patient, also set `overdueAttributeId` to
     * `calledValue` in the same bulk import — e.g. NCD's "HTN - Patient
     * follow-up status" moves from "Overdue Pending Call" to "Called" the
     * moment a call result is actually recorded, distinct from the overdue
     * check's own flag/clear pass.
     */
    overdueAttributeId: string
    calledValue: string
}

export type StageEntryRow = {
    trackedEntity: string
    enrollment: string
    orgUnit: string
    trackedEntityType: string
    resultCode: string
    resultDate: string
    reasonCode?: string
}

/**
 * Creates one new event per patient in the configured "bulk entry" stage —
 * the simple per-row result + date form approved for v2.0, as a single
 * synchronous bulk import so the caller gets an immediate success/failure
 * report rather than polling a job. Also updates each patient's overdue
 * attribute to `calledValue` in the same import.
 */
export const useBulkStageEntry = (params: BulkStageEntryParams) => {
    const dataEngine = useDataEngine()

    const mutation = useMutation<TrackerImportReport, Error, StageEntryRow[]>({
        mutationFn: async (rows) => {
            const occurredAt = new Date().toISOString()

            const events = rows.map((row) => ({
                program: params.programId,
                programStage: params.bulkEntryStageId,
                enrollment: row.enrollment,
                trackedEntity: row.trackedEntity,
                orgUnit: row.orgUnit,
                occurredAt,
                status: 'COMPLETED' as const,
                dataValues: [
                    {
                        dataElement: params.resultDataElementId,
                        value: row.resultCode,
                    },
                    ...(params.resultDateDataElementId
                        ? [
                              {
                                  dataElement: params.resultDateDataElementId,
                                  value: row.resultDate,
                              },
                          ]
                        : []),
                    ...(params.reasonDataElementId && row.reasonCode
                        ? [
                              {
                                  dataElement: params.reasonDataElementId,
                                  value: row.reasonCode,
                              },
                          ]
                        : []),
                    ...(params.additionalDateDataElementIds ?? []).map(
                        (dataElementId) => ({
                            dataElement: dataElementId,
                            value: row.resultDate,
                        })
                    ),
                ],
            }))

            const trackedEntities = rows.map((row) => ({
                trackedEntity: row.trackedEntity,
                trackedEntityType: row.trackedEntityType,
                orgUnit: row.orgUnit,
                attributes: [
                    {
                        attribute: params.overdueAttributeId,
                        value: params.calledValue,
                    },
                ],
            }))

            return (await dataEngine.mutate({
                resource: 'tracker',
                type: 'create',
                params: { async: false },
                data: { events, trackedEntities },
            })) as TrackerImportReport
        },
    })

    return {
        saveAll: mutation.mutate,
        saveAllAsync: mutation.mutateAsync,
        isSaving: mutation.isLoading,
        error: mutation.error,
        result: mutation.data,
        reset: mutation.reset,
    }
}

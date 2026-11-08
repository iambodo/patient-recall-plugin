import type { TrackerImportReport } from '@dhis2/api-types/v42'
import { useDataEngine } from '@dhis2/app-runtime'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { BulkDataEntryConfigEntry } from '@/hooks/usePluginConfig'

const EVENT_PAGE_SIZE = 200
const DISPLAY_CAP = 1000

export type OverdueCheckParams = Pick<
    BulkDataEntryConfigEntry,
    | 'programId'
    | 'programStageId'
    | 'overdueAttributeId'
    | 'overdueValue'
    | 'clearedValue'
    | 'phoneAttributeId'
    | 'givenNameAttributeId'
    | 'familyNameAttributeId'
    | 'callEventStageId'
>

export type OverduePatient = {
    trackedEntity: string
    enrollment: string
    orgUnit: string
    trackedEntityType: string
    name: string
    phone?: string
    scheduledDate?: string
}

export type OverdueCheckResult = {
    estimatedOverdueEvents: number
    estimatedOverdueEventsIsCapped: boolean
    flaggedCount: number
    clearedCount: number
    report: TrackerImportReport
    patients: OverduePatient[]
}

type EventsPage = {
    pager: { total: number; pageCount: number }
    events: Array<{
        trackedEntity?: string
        scheduledAt?: string
        dueDate?: string
    }>
}

type TrackedEntitiesPage = {
    pager: { total: number; pageCount: number }
    trackedEntities: Array<{
        trackedEntity: string
        trackedEntityType: string
        orgUnit: string
        enrollments?: Array<{
            enrollment: string
            program: string
            events?: Array<{
                programStage: string
                status: string
                occurredAt?: string
            }>
        }>
        attributes?: Array<{ attribute: string; value?: string }>
    }>
}

const fetchOverdueEventsByTrackedEntity = async (
    dataEngine: ReturnType<typeof useDataEngine>,
    params: OverdueCheckParams
) => {
    const scheduledDateByTrackedEntity = new Map<string, string>()
    let page = 1
    let pageCount = 1

    do {
        const response = (await dataEngine.query({
            events: {
                resource: 'tracker/events',
                params: {
                    ouMode: 'ACCESSIBLE',
                    program: params.programId,
                    programStage: params.programStageId,
                    status: 'OVERDUE',
                    fields: 'trackedEntity,scheduledAt,dueDate',
                    page,
                    pageSize: EVENT_PAGE_SIZE,
                    totalPages: true,
                },
            },
        })) as { events: EventsPage }

        for (const event of response.events.events) {
            if (event.trackedEntity) {
                scheduledDateByTrackedEntity.set(
                    event.trackedEntity,
                    event.scheduledAt ?? event.dueDate ?? ''
                )
            }
        }

        pageCount = response.events.pager.pageCount
        page += 1
    } while (page <= pageCount)

    return scheduledDateByTrackedEntity
}

const fetchCurrentlyFlaggedTrackedEntityIds = async (
    dataEngine: ReturnType<typeof useDataEngine>,
    params: OverdueCheckParams
) => {
    const flaggedIds = new Set<string>()
    let page = 1
    let pageCount = 1

    do {
        const response = (await dataEngine.query({
            trackedEntities: {
                resource: 'tracker/trackedEntities',
                params: {
                    ouMode: 'ACCESSIBLE',
                    program: params.programId,
                    filter: `${params.overdueAttributeId}:eq:${params.overdueValue}`,
                    fields: 'trackedEntity',
                    page,
                    pageSize: EVENT_PAGE_SIZE,
                    totalPages: true,
                },
            },
        })) as { trackedEntities: TrackedEntitiesPage }

        for (const te of response.trackedEntities.trackedEntities) {
            flaggedIds.add(te.trackedEntity)
        }

        pageCount = response.trackedEntities.pager.pageCount
        page += 1
    } while (page <= pageCount)

    return flaggedIds
}

type TrackedEntityDetails = Omit<OverduePatient, 'scheduledDate'> & {
    hasRecentCallEvent: boolean
}

/**
 * A patient already actioned since their last real visit shouldn't be
 * re-shown for bulk entry — otherwise every check keeps listing them and
 * "Save all" keeps creating duplicate call-stage events, since completing a
 * call-stage event never changes the overdue stage's own SCHEDULE event.
 * "Recent" means a call-stage event occurring after the latest *occurred*
 * event in the overdue-detection stage (the last real visit) — not after the
 * overdue event itself, which has no occurredAt by definition.
 */
const hasRecentCallEvent = (
    events: Array<{
        programStage: string
        status: string
        occurredAt?: string
    }>,
    params: OverdueCheckParams
) => {
    const latestOverdueStageVisit = events
        .filter((e) => e.programStage === params.programStageId && e.occurredAt)
        .map((e) => e.occurredAt as string)
        .sort()
        .pop()

    const callEvents = events.filter(
        (e) => e.programStage === params.callEventStageId && e.occurredAt
    )

    if (!latestOverdueStageVisit) {
        return callEvents.length > 0
    }

    return callEvents.some(
        (e) => (e.occurredAt as string) > latestOverdueStageVisit
    )
}

/**
 * Fetches full TEI details (type, org unit, enrollment, name/phone
 * attributes, recent-call status) for a set of IDs. Needed because the
 * events endpoint returns none of this, and the `/api/tracker` import
 * payload requires `trackedEntityType` + `orgUnit` per entity. Each TEI's own
 * `orgUnit` must be used in the write-back rather than the org unit the
 * check was run from — TEIs under an ACCESSIBLE-scoped query can belong to
 * different org units.
 */
const fetchTrackedEntityDetails = async (
    dataEngine: ReturnType<typeof useDataEngine>,
    params: OverdueCheckParams,
    trackedEntityIds: string[]
) => {
    const detailsById = new Map<string, TrackedEntityDetails>()
    if (trackedEntityIds.length === 0) {
        return detailsById
    }

    const chunkSize = 200

    for (let i = 0; i < trackedEntityIds.length; i += chunkSize) {
        const chunk = trackedEntityIds.slice(i, i + chunkSize)
        const response = (await dataEngine.query({
            trackedEntities: {
                resource: 'tracker/trackedEntities',
                params: {
                    ouMode: 'ACCESSIBLE',
                    program: params.programId,
                    trackedEntity: chunk.join(';'),
                    fields: 'trackedEntity,trackedEntityType,orgUnit,enrollments[enrollment,program,events[programStage,status,occurredAt]],attributes[attribute,value]',
                    pageSize: chunkSize,
                },
            },
        })) as { trackedEntities: TrackedEntitiesPage }

        for (const te of response.trackedEntities.trackedEntities) {
            const attributeValue = (attributeId: string) =>
                te.attributes?.find((a) => a.attribute === attributeId)?.value

            const givenName = attributeValue(params.givenNameAttributeId)
            const familyName = attributeValue(params.familyNameAttributeId)
            const enrollmentForProgram = te.enrollments?.find(
                (e) => e.program === params.programId
            )

            detailsById.set(te.trackedEntity, {
                trackedEntity: te.trackedEntity,
                trackedEntityType: te.trackedEntityType,
                orgUnit: te.orgUnit,
                enrollment: enrollmentForProgram?.enrollment ?? '',
                name: [givenName, familyName].filter(Boolean).join(' '),
                phone: attributeValue(params.phoneAttributeId),
                hasRecentCallEvent: hasRecentCallEvent(
                    enrollmentForProgram?.events ?? [],
                    params
                ),
            })
        }
    }

    return detailsById
}

export const useOverdueCheck = (params: OverdueCheckParams) => {
    const dataEngine = useDataEngine()
    const [lastRunAt, setLastRunAt] = useState<Date | undefined>(undefined)

    const mutation = useMutation<OverdueCheckResult, Error>({
        mutationFn: async () => {
            const countResponse = (await dataEngine.query({
                events: {
                    resource: 'tracker/events',
                    params: {
                        ouMode: 'ACCESSIBLE',
                        program: params.programId,
                        programStage: params.programStageId,
                        status: 'OVERDUE',
                        fields: 'event',
                        page: 1,
                        pageSize: 1,
                        totalPages: true,
                    },
                },
            })) as { events: EventsPage }

            const estimatedOverdueEvents = countResponse.events.pager.total
            const estimatedOverdueEventsIsCapped =
                estimatedOverdueEvents > DISPLAY_CAP

            const [scheduledDateByTrackedEntity, currentlyFlaggedIds] =
                await Promise.all([
                    fetchOverdueEventsByTrackedEntity(dataEngine, params),
                    fetchCurrentlyFlaggedTrackedEntityIds(dataEngine, params),
                ])

            const overdueIds = new Set(scheduledDateByTrackedEntity.keys())
            const toFlag = [...overdueIds].filter(
                (id) => !currentlyFlaggedIds.has(id)
            )
            const toClear = [...currentlyFlaggedIds].filter(
                (id) => !overdueIds.has(id)
            )
            const allChangedIds = [...toFlag, ...toClear]

            const detailsById = await fetchTrackedEntityDetails(
                dataEngine,
                params,
                // Need details for every overdue TEI to show in the patient
                // list, not just the ones whose flag actually changed.
                [...new Set([...overdueIds, ...allChangedIds])]
            )

            const patients: OverduePatient[] = [...overdueIds]
                .map((id): OverduePatient | undefined => {
                    const details = detailsById.get(id)
                    if (!details || details.hasRecentCallEvent) {
                        return undefined
                    }
                    return {
                        trackedEntity: details.trackedEntity,
                        enrollment: details.enrollment,
                        orgUnit: details.orgUnit,
                        trackedEntityType: details.trackedEntityType,
                        name: details.name,
                        phone: details.phone,
                        scheduledDate: scheduledDateByTrackedEntity.get(id),
                    }
                })
                .filter((patient): patient is OverduePatient =>
                    Boolean(patient)
                )
                .sort((a, b) =>
                    (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '')
                )

            if (allChangedIds.length === 0) {
                return {
                    estimatedOverdueEvents,
                    estimatedOverdueEventsIsCapped,
                    flaggedCount: 0,
                    clearedCount: 0,
                    patients,
                    report: {
                        status: 'OK',
                        stats: {
                            created: 0,
                            updated: 0,
                            deleted: 0,
                            ignored: 0,
                            total: 0,
                        },
                    } as TrackerImportReport,
                }
            }

            const trackedEntities = allChangedIds.map((id) => ({
                trackedEntity: id,
                trackedEntityType: detailsById.get(id)?.trackedEntityType,
                orgUnit: detailsById.get(id)?.orgUnit,
                attributes: [
                    {
                        attribute: params.overdueAttributeId,
                        value: toFlag.includes(id)
                            ? params.overdueValue
                            : params.clearedValue,
                    },
                ],
            }))

            const importResponse = (await dataEngine.mutate({
                resource: 'tracker',
                type: 'create',
                params: { async: false },
                data: { trackedEntities },
            })) as TrackerImportReport

            return {
                estimatedOverdueEvents,
                estimatedOverdueEventsIsCapped,
                flaggedCount: toFlag.length,
                clearedCount: toClear.length,
                patients,
                report: importResponse,
            }
        },
        onSuccess: () => {
            setLastRunAt(new Date())
        },
    })

    return {
        runCheck: mutation.mutate,
        runCheckAsync: mutation.mutateAsync,
        isRunning: mutation.isLoading,
        error: mutation.error,
        result: mutation.data,
        lastRunAt,
    }
}

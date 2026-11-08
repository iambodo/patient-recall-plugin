import { renderHook, waitFor } from '@testing-library/react'
import { useOverdueCheck } from './useOverdueCheck'
import { createQueryWrapper } from '@/utils/testUtils'

const PARAMS = {
    programId: 'program1',
    programStageId: 'stage1',
    overdueAttributeId: 'overdueAttr',
    overdueValue: 'true',
    clearedValue: 'false',
    phoneAttributeId: 'phoneAttr',
    givenNameAttributeId: 'givenNameAttr',
    familyNameAttributeId: 'familyNameAttr',
    callEventStageId: 'callStage',
}

const EVENTS_RESOURCE = 'tracker/events'
const TRACKED_ENTITIES_RESOURCE = 'tracker/trackedEntities'
const TRACKER_RESOURCE = 'tracker'

type MockQuery = {
    params?: Record<string, unknown>
}

const buildData = ({
    overdueTrackedEntityIds,
    flaggedTrackedEntityIds,
    trackedEntityTypeById,
    trackedEntityOrgUnitById = {},
    trackedEntityEventsById = {},
    mutateSpy,
}: {
    overdueTrackedEntityIds: string[]
    flaggedTrackedEntityIds: string[]
    trackedEntityTypeById: Record<string, string>
    trackedEntityOrgUnitById?: Record<string, string>
    trackedEntityEventsById?: Record<
        string,
        Array<{ programStage: string; status: string; occurredAt?: string }>
    >
    mutateSpy: jest.Mock
}) => ({
    [EVENTS_RESOURCE]: (_type: string, query: MockQuery) => {
        const pageSize = Number(query.params?.pageSize ?? 0)
        if (pageSize === 1) {
            return {
                pager: {
                    total: overdueTrackedEntityIds.length,
                    pageCount: 1,
                },
                events: [],
            }
        }
        return {
            pager: { total: overdueTrackedEntityIds.length, pageCount: 1 },
            events: overdueTrackedEntityIds.map((id) => ({
                trackedEntity: id,
                scheduledAt: '2026-01-01',
            })),
        }
    },
    [TRACKED_ENTITIES_RESOURCE]: (_type: string, query: MockQuery) => {
        const filter = query.params?.filter as string | undefined
        if (filter?.includes(':eq:true')) {
            return {
                pager: {
                    total: flaggedTrackedEntityIds.length,
                    pageCount: 1,
                },
                trackedEntities: flaggedTrackedEntityIds.map((id) => ({
                    trackedEntity: id,
                })),
            }
        }
        const requested = (query.params?.trackedEntity as string)?.split(';')
        return {
            pager: { total: requested?.length ?? 0, pageCount: 1 },
            trackedEntities: (requested ?? []).map((id) => ({
                trackedEntity: id,
                trackedEntityType: trackedEntityTypeById[id],
                orgUnit: trackedEntityOrgUnitById[id] ?? 'default-org-unit',
                enrollments: [
                    {
                        enrollment: `enrollment-${id}`,
                        program: 'program1',
                        events: trackedEntityEventsById[id] ?? [],
                    },
                ],
                attributes: [],
            })),
        }
    },
    [TRACKER_RESOURCE]: (_type: string, query: MockQuery) => {
        mutateSpy(query)
        return {
            status: 'OK',
            stats: { created: 0, updated: 1, deleted: 0, ignored: 0, total: 1 },
        }
    },
})

it('flags newly overdue patients and clears patients no longer overdue', async () => {
    const mutateSpy = jest.fn()

    const { result } = renderHook(() => useOverdueCheck(PARAMS), {
        wrapper: createQueryWrapper(
            buildData({
                overdueTrackedEntityIds: ['tei-overdue'],
                flaggedTrackedEntityIds: ['tei-stale-flag'],
                trackedEntityTypeById: {
                    'tei-overdue': 'type1',
                    'tei-stale-flag': 'type1',
                },
                trackedEntityOrgUnitById: {
                    'tei-overdue': 'org-unit-a',
                    'tei-stale-flag': 'org-unit-b',
                },
                mutateSpy,
            })
        ),
    })

    result.current.runCheck()

    await waitFor(() => expect(result.current.lastRunAt).toBeInstanceOf(Date))

    expect(result.current.result?.flaggedCount).toBe(1)
    expect(result.current.result?.clearedCount).toBe(1)

    const sentTrackedEntities = mutateSpy.mock.calls[0][0].data.trackedEntities
    expect(sentTrackedEntities).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                trackedEntity: 'tei-overdue',
                orgUnit: 'org-unit-a',
                attributes: [{ attribute: 'overdueAttr', value: 'true' }],
            }),
            expect.objectContaining({
                trackedEntity: 'tei-stale-flag',
                orgUnit: 'org-unit-b',
                attributes: [{ attribute: 'overdueAttr', value: 'false' }],
            }),
        ])
    )
})

it('skips the import entirely when nothing changed', async () => {
    const mutateSpy = jest.fn()

    const { result } = renderHook(() => useOverdueCheck(PARAMS), {
        wrapper: createQueryWrapper(
            buildData({
                overdueTrackedEntityIds: ['tei-1'],
                flaggedTrackedEntityIds: ['tei-1'],
                trackedEntityTypeById: { 'tei-1': 'type1' },
                mutateSpy,
            })
        ),
    })

    result.current.runCheck()

    await waitFor(() => expect(result.current.lastRunAt).toBeInstanceOf(Date))

    expect(result.current.result?.flaggedCount).toBe(0)
    expect(result.current.result?.clearedCount).toBe(0)
    expect(mutateSpy).not.toHaveBeenCalled()
})

it('caps the displayed estimate at 1,000+', async () => {
    const mutateSpy = jest.fn()

    const { result } = renderHook(() => useOverdueCheck(PARAMS), {
        wrapper: createQueryWrapper(
            buildData({
                overdueTrackedEntityIds: Array.from(
                    { length: 1001 },
                    (_, i) => `tei-${i}`
                ),
                flaggedTrackedEntityIds: [],
                trackedEntityTypeById: {},
                mutateSpy,
            })
        ),
    })

    result.current.runCheck()

    await waitFor(() => expect(result.current.lastRunAt).toBeInstanceOf(Date))

    expect(result.current.result?.estimatedOverdueEventsIsCapped).toBe(true)
})

it('hides a patient who already has a call-stage event after their last real visit', async () => {
    const mutateSpy = jest.fn()

    const { result } = renderHook(() => useOverdueCheck(PARAMS), {
        wrapper: createQueryWrapper(
            buildData({
                overdueTrackedEntityIds: ['tei-actioned', 'tei-not-actioned'],
                flaggedTrackedEntityIds: ['tei-actioned', 'tei-not-actioned'],
                trackedEntityTypeById: {
                    'tei-actioned': 'type1',
                    'tei-not-actioned': 'type1',
                },
                trackedEntityEventsById: {
                    'tei-actioned': [
                        {
                            programStage: 'stage1',
                            status: 'ACTIVE',
                            occurredAt: '2025-12-13',
                        },
                        {
                            programStage: 'callStage',
                            status: 'COMPLETED',
                            occurredAt: '2026-01-05',
                        },
                    ],
                    'tei-not-actioned': [
                        {
                            programStage: 'stage1',
                            status: 'ACTIVE',
                            occurredAt: '2025-12-13',
                        },
                    ],
                },
                mutateSpy,
            })
        ),
    })

    result.current.runCheck()

    await waitFor(() => expect(result.current.lastRunAt).toBeInstanceOf(Date))

    const patientIds = result.current.result?.patients.map(
        (p) => p.trackedEntity
    )
    expect(patientIds).toEqual(['tei-not-actioned'])
})

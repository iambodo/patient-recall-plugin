import { renderHook, waitFor } from '@testing-library/react'
import { useBulkStageEntry } from './useBulkStageEntry'
import { createQueryWrapper } from '@/utils/testUtils'

const BASE_PARAMS = {
    programId: 'program1',
    bulkEntryStageId: 'stage1',
    resultDataElementId: 'resultDe',
    overdueAttributeId: 'overdueAttr',
    calledValue: 'CALLED',
}

const ROW = {
    trackedEntity: 'tei-1',
    enrollment: 'enrollment-1',
    orgUnit: 'orgUnit-1',
    trackedEntityType: 'type-1',
    resultCode: 'POSITIVE',
    resultDate: '2026-01-10',
}

it('creates an event and updates the overdue attribute to calledValue in one import', async () => {
    const mutateSpy = jest.fn()

    const { result } = renderHook(() => useBulkStageEntry(BASE_PARAMS), {
        wrapper: createQueryWrapper({
            tracker: (_type: string, query: { data?: unknown }) => {
                mutateSpy(query.data)
                return { status: 'OK', stats: { created: 1 } }
            },
        }),
    })

    result.current.saveAll([ROW])

    await waitFor(() => expect(result.current.result).toBeDefined())

    const sentData = mutateSpy.mock.calls[0][0] as {
        events: Array<{
            dataValues: Array<{ dataElement: string; value: string }>
        }>
        trackedEntities: Array<{
            trackedEntity: string
            attributes: Array<{ attribute: string; value: string }>
        }>
    }

    expect(sentData.events[0].dataValues).toEqual([
        { dataElement: 'resultDe', value: 'POSITIVE' },
    ])
    expect(sentData.trackedEntities).toEqual([
        {
            trackedEntity: 'tei-1',
            trackedEntityType: 'type-1',
            orgUnit: 'orgUnit-1',
            attributes: [{ attribute: 'overdueAttr', value: 'CALLED' }],
        },
    ])
})

it('includes the result date data value only when resultDateDataElementId is configured', async () => {
    const mutateSpy = jest.fn()

    const { result } = renderHook(
        () =>
            useBulkStageEntry({
                ...BASE_PARAMS,
                resultDateDataElementId: 'resultDateDe',
            }),
        {
            wrapper: createQueryWrapper({
                tracker: (_type: string, query: { data?: unknown }) => {
                    mutateSpy(query.data)
                    return { status: 'OK', stats: { created: 1 } }
                },
            }),
        }
    )

    result.current.saveAll([ROW])

    await waitFor(() => expect(result.current.result).toBeDefined())

    const sentData = mutateSpy.mock.calls[0][0] as {
        events: Array<{
            dataValues: Array<{ dataElement: string; value: string }>
        }>
    }

    expect(sentData.events[0].dataValues).toEqual(
        expect.arrayContaining([
            { dataElement: 'resultDateDe', value: '2026-01-10' },
        ])
    )
})

it('writes the reason data value only for rows that have a reasonCode', async () => {
    const mutateSpy = jest.fn()

    const { result } = renderHook(
        () =>
            useBulkStageEntry({
                ...BASE_PARAMS,
                reasonDataElementId: 'reasonDe',
            }),
        {
            wrapper: createQueryWrapper({
                tracker: (_type: string, query: { data?: unknown }) => {
                    mutateSpy(query.data)
                    return { status: 'OK', stats: { created: 2 } }
                },
            }),
        }
    )

    result.current.saveAll([
        { ...ROW, resultCode: 'ANSWERED', reasonCode: 'MOVED' },
        { ...ROW, trackedEntity: 'tei-2', resultCode: 'NO_ANSWER' },
    ])

    await waitFor(() => expect(result.current.result).toBeDefined())

    const sentData = mutateSpy.mock.calls[0][0] as {
        events: Array<{
            dataValues: Array<{ dataElement: string; value: string }>
        }>
    }

    expect(sentData.events[0].dataValues).toEqual([
        { dataElement: 'resultDe', value: 'ANSWERED' },
        { dataElement: 'reasonDe', value: 'MOVED' },
    ])
    expect(sentData.events[1].dataValues).toEqual([
        { dataElement: 'resultDe', value: 'NO_ANSWER' },
    ])
})

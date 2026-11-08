import { renderHook, waitFor } from '@testing-library/react'
import { usePluginConfig } from './usePluginConfig'
import { createQueryWrapper } from '@/utils/testUtils'

const VALID_ENTRY = {
    configKey: 'overdueCheck',
    programId: 'program1',
    programStageId: 'stage1',
    overdueAttributeId: 'overdueAttr',
    overdueValue: 'true',
    clearedValue: 'false',
    calledValue: 'false',
    phoneAttributeId: 'phoneAttr',
    givenNameAttributeId: 'givenNameAttr',
    familyNameAttributeId: 'familyNameAttr',
    callEventStageId: 'callStage',
    bulkEntryStageId: 'stage1',
    resultDataElementId: 'resultDe',
}

it('finds the config entry matching configKey', async () => {
    const { result } = renderHook(() => usePluginConfig('overdueCheck'), {
        wrapper: createQueryWrapper({
            'dataStore/capture/bulkDataEntry': {
                version: 1,
                config: [VALID_ENTRY],
            },
        }),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.config).toEqual(VALID_ENTRY)
    expect(result.current.isMalformed).toBe(false)
})

it('flags the config as malformed when "config" is a single object instead of an array', async () => {
    const { result } = renderHook(() => usePluginConfig('overdueCheck'), {
        wrapper: createQueryWrapper({
            'dataStore/capture/bulkDataEntry': {
                version: 1,
                config: VALID_ENTRY,
            },
        }),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isMalformed).toBe(true)
    expect(result.current.config).toBeUndefined()
})

it('returns no config and is not malformed when configKey has no match', async () => {
    const { result } = renderHook(() => usePluginConfig('missingKey'), {
        wrapper: createQueryWrapper({
            'dataStore/capture/bulkDataEntry': {
                version: 1,
                config: [VALID_ENTRY],
            },
        }),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.config).toBeUndefined()
    expect(result.current.isMalformed).toBe(false)
})

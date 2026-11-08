import { useApiDataQuery } from '@/utils/useApiDataQuery'

type ProgramStageDataElement = {
    compulsory: boolean
    dataElement: { id: string; valueType: string }
}

type ProgramStageResponse = {
    programStageDataElements: ProgramStageDataElement[]
}

/**
 * The simple "result + date" bulk-entry form only fills two data elements,
 * but a program stage can mark other data elements as compulsory (as TB's
 * "Monitoring laboratory results" stage does with "Date of sample
 * reception") — submitting without them fails tracker import validation.
 * This surfaces any compulsory data elements the form doesn't already cover
 * so the plugin can default them rather than fail at submit time.
 */
export const useProgramStageCompulsoryDataElements = (
    programStageId: string | undefined,
    coveredDataElementIds: string[]
) => {
    const { data, isLoading, error } = useApiDataQuery<ProgramStageResponse>({
        queryKey: ['programStages', programStageId, 'dataElements'],
        query: {
            resource: 'programStages',
            id: programStageId,
            params: {
                fields: 'programStageDataElements[compulsory,dataElement[id,valueType]]',
            },
        },
        cacheTime: Infinity,
        staleTime: Infinity,
        enabled: Boolean(programStageId),
    })

    const uncoveredCompulsoryDataElements = (
        data?.programStageDataElements ?? []
    )
        .filter((psde) => psde.compulsory)
        .map((psde) => psde.dataElement)
        .filter((de) => !coveredDataElementIds.includes(de.id))

    return {
        uncoveredCompulsoryDataElements,
        isLoading,
        error,
    }
}

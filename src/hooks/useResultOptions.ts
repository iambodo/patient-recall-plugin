import { useApiDataQuery } from '@/utils/useApiDataQuery'

export type ResultOption = {
    code: string
    displayName: string
}

type DataElementResponse = {
    valueType: string
    displayFormName?: string
    optionSet?: { options: ResultOption[] }
}

/**
 * Fetches the configured result data element's option set so the bulk-entry
 * dropdown reflects whatever options the target program actually defines
 * (e.g. TB's microscopy result codes vs. an NCD program's own outcome
 * codes), rather than a hardcoded list tied to one program.
 */
export const useResultOptions = (resultDataElementId: string | undefined) => {
    const { data, isLoading, error } = useApiDataQuery<DataElementResponse>({
        queryKey: ['dataElements', resultDataElementId],
        query: {
            resource: 'dataElements',
            id: resultDataElementId,
            params: {
                fields: 'valueType,displayFormName,optionSet[options[code,displayName]]',
            },
        },
        cacheTime: Infinity,
        staleTime: Infinity,
        enabled: Boolean(resultDataElementId),
    })

    return {
        options: data?.optionSet?.options ?? [],
        label: data?.displayFormName,
        isLoading,
        error,
    }
}

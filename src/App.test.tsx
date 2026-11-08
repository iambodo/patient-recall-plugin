import { screen, waitFor } from '@testing-library/react'
import React from 'react'
import App from './App'
import { renderWithProvider } from '@/utils/testUtils'

it('renders the standalone dev preview and resolves plugin config', async () => {
    renderWithProvider(<App />, {
        'dataStore/capture/bulkDataEntry': {
            version: 1,
            config: [
                {
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
                    resultDateDataElementId: 'resultDateDe',
                },
            ],
        },
        dataElements: {
            valueType: 'TEXT',
            optionSet: { options: [] },
        },
        programStages: {
            programStageDataElements: [],
        },
    })

    await waitFor(() =>
        expect(screen.getByText(/Standalone dev preview/)).toBeInTheDocument()
    )
    await waitFor(() =>
        expect(
            screen.getByText(/Check for overdue patients/)
        ).toBeInTheDocument()
    )
})

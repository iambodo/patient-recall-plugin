import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { OverduePatientList } from './OverduePatientList'
import type { OverduePatient } from '@/hooks/useOverdueCheck'

const PATIENT: OverduePatient = {
    trackedEntity: 'tei-1',
    enrollment: 'enrollment-1',
    orgUnit: 'orgUnit-1',
    trackedEntityType: 'type-1',
    name: 'Jane Doe',
    phone: '0123456789',
    scheduledDate: '2026-01-15',
}

const RESULT_OPTIONS = [
    { code: 'NEGATIVE', displayName: 'Negative' },
    { code: 'POSITIVE', displayName: 'Positive' },
]

it('shows an empty state when there are no overdue patients', () => {
    render(
        <OverduePatientList
            patients={[]}
            resultOptions={RESULT_OPTIONS}
            onSaveAll={jest.fn()}
            isSaving={false}
        />
    )

    expect(screen.getByText(/No overdue patients/)).toBeInTheDocument()
})

it('renders patient details and disables Save all until a result is chosen', async () => {
    const onSaveAll = jest.fn()
    const user = userEvent.setup()

    render(
        <OverduePatientList
            patients={[PATIENT]}
            resultOptions={RESULT_OPTIONS}
            onSaveAll={onSaveAll}
            isSaving={false}
        />
    )

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('0123456789')).toBeInTheDocument()

    const saveButton = screen.getByRole('button', { name: /Save all/ })
    expect(saveButton).toBeDisabled()

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('Negative'))

    expect(saveButton).not.toBeDisabled()

    await user.click(saveButton)

    expect(onSaveAll).toHaveBeenCalledWith([
        expect.objectContaining({
            trackedEntity: 'tei-1',
            enrollment: 'enrollment-1',
            orgUnit: 'orgUnit-1',
            trackedEntityType: 'type-1',
            resultCode: 'NEGATIVE',
        }),
    ])
})

it('only includes rows with a chosen result when saving', async () => {
    const onSaveAll = jest.fn()
    const user = userEvent.setup()

    const secondPatient: OverduePatient = {
        ...PATIENT,
        trackedEntity: 'tei-2',
        name: 'John Smith',
    }

    render(
        <OverduePatientList
            patients={[PATIENT, secondPatient]}
            resultOptions={RESULT_OPTIONS}
            onSaveAll={onSaveAll}
            isSaving={false}
        />
    )

    const rows = screen.getAllByRole('row')
    // First row is the header.
    await user.click(within(rows[1]).getByRole('combobox'))
    await user.click(screen.getByText('Positive'))

    await user.click(screen.getByRole('button', { name: /Save all/ }))

    const savedRows = onSaveAll.mock.calls[0][0]
    expect(savedRows).toHaveLength(1)
    expect(savedRows[0].trackedEntity).toBe('tei-1')
})

const CALL_OPTIONS = [
    { code: 'ANSWERED', displayName: 'Called, answered' },
    { code: 'NO_ANSWER', displayName: 'Called, no answer' },
]
const REASON_OPTIONS = [
    { code: 'MOVED', displayName: 'Moved away' },
    { code: 'DIED', displayName: 'Died' },
]

it('only shows the reason dropdown once the call is marked answered, and saves it', async () => {
    const onSaveAll = jest.fn()
    const user = userEvent.setup()

    render(
        <OverduePatientList
            patients={[PATIENT]}
            resultOptions={CALL_OPTIONS}
            reasonOptions={REASON_OPTIONS}
            reasonLabel="Reason for removal"
            reasonShowWhenResultCode="ANSWERED"
            onSaveAll={onSaveAll}
            isSaving={false}
        />
    )

    expect(screen.getByText('Reason for removal')).toBeInTheDocument()
    // Only the call-outcome select until "answered" is chosen.
    expect(screen.getAllByRole('combobox')).toHaveLength(1)

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('Called, no answer'))
    expect(screen.getAllByRole('combobox')).toHaveLength(1)

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByText('Called, answered'))
    const combos = screen.getAllByRole('combobox')
    expect(combos).toHaveLength(2)

    await user.click(combos[1])
    await user.click(screen.getByText('Moved away'))

    await user.click(screen.getByRole('button', { name: /Save all/ }))

    expect(onSaveAll).toHaveBeenCalledWith([
        expect.objectContaining({
            resultCode: 'ANSWERED',
            reasonCode: 'MOVED',
        }),
    ])
})

it('drops a previously chosen reason when the call outcome changes', async () => {
    const onSaveAll = jest.fn()
    const user = userEvent.setup()

    render(
        <OverduePatientList
            patients={[PATIENT]}
            resultOptions={CALL_OPTIONS}
            reasonOptions={REASON_OPTIONS}
            reasonShowWhenResultCode="ANSWERED"
            onSaveAll={onSaveAll}
            isSaving={false}
        />
    )

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('Called, answered'))
    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByText('Died'))

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByText('Called, no answer'))

    await user.click(screen.getByRole('button', { name: /Save all/ }))

    const savedRow = onSaveAll.mock.calls[0][0][0]
    expect(savedRow.resultCode).toBe('NO_ANSWER')
    expect(savedRow.reasonCode).toBeUndefined()
})

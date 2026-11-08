/**
 * Reproduction of a @dhis2-ui/select bug (confirmed at v10.11.0, the version
 * pinned in this workspace's lockfile):
 *
 *   - types/index.d.ts declares:
 *       onChange: (value: string) => void
 *     with JSDoc "A callback that will be called with the new value or an
 *     empty string".
 *   - The compiled implementation
 *     (build/cjs/simple-single-select/simple-single-select.js) actually
 *     calls `onChange(option)` — the full `{ label, value }` option object —
 *     both when selecting via keyboard (`selectFocussedOption`) and via the
 *     menu's own onChange passthrough.
 *
 * TypeScript consumers who write `onChange={(value: string) => ...}` per the
 * published type get no compile-time warning, but receive an object at
 * runtime instead of a string. This is exactly what caused a real bug while
 * building OverduePatientList.tsx (see src/components/OverduePatientList.tsx
 * and CLAUDE.md "Known library bug found during v2.0 build").
 *
 * This test exercises the real, installed library — no mocking — so it
 * fails loudly (not silently stays green) if a future @dhis2-ui/select
 * upgrade ever fixes this and starts passing a bare string.
 */
import { SimpleSingleSelect } from '@dhis2/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const OPTIONS = [
    { label: 'Negative', value: 'NEGATIVE' },
    { label: 'Positive', value: 'POSITIVE' },
]

it('demonstrates the bug: onChange receives the option object, not a string, contradicting its declared type', async () => {
    const user = userEvent.setup()

    // Written exactly as the declared type signature instructs:
    // `onChange: (value: string) => void`. A consumer following the types
    // would reasonably call `.toUpperCase()` or store `value` directly in
    // string state, as OverduePatientList.tsx originally did.
    const received: unknown[] = []
    const onChange = (value: string) => {
        received.push(value)
    }

    render(
        <SimpleSingleSelect
            name="result"
            options={OPTIONS}
            onChange={onChange}
        />
    )

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Negative'))

    expect(received).toHaveLength(1)
    const actual = received[0]

    // This is the bug: `actual` is the whole option object, not the string
    // the type declares. If this assertion ever fails, the library has been
    // fixed (or this test is running against a different version) — update
    // or delete this repro rather than loosening it.
    expect(actual).toEqual({ label: 'Negative', value: 'NEGATIVE' })
    expect(typeof actual).not.toBe('string')

    // The concrete failure mode this caused in the real app: code trusting
    // the declared type assigns `value` straight into string state/props
    // (e.g. a row's `resultCode: string`). At runtime that "string" is
    // actually an object, so anything downstream expecting a string breaks
    // silently instead of at compile time.
    const resultCode = actual as string
    expect((resultCode as unknown as { value: string }).value).toBe('NEGATIVE')
    expect(() => (resultCode as unknown as string).toUpperCase()).toThrow(
        TypeError
    )
})

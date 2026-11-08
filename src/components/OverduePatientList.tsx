import i18n from '@dhis2/d2-i18n'
import {
    Button,
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableColumnHeader,
    DataTableHead,
    DataTableRow,
    Input,
    NoticeBox,
    SimpleSingleSelect,
} from '@dhis2/ui'
import React, { FC, useMemo, useState } from 'react'
import classes from '@/components/OverduePatientList.module.css'
import type { OverduePatient } from '@/hooks/useOverdueCheck'
import type { ResultOption } from '@/hooks/useResultOptions'

type RowEntry = { resultCode: string; resultDate: string; reasonCode: string }

type OverduePatientListProps = {
    patients: OverduePatient[]
    resultOptions: ResultOption[]
    resultLabel?: string
    /**
     * Optional second dropdown, only shown for a row once its result is
     * `reasonShowWhenResultCode`. Omit `reasonOptions` (or pass []) to hide
     * the column entirely.
     */
    reasonOptions?: ResultOption[]
    reasonLabel?: string
    reasonShowWhenResultCode?: string
    onSaveAll: (
        rows: Array<{
            trackedEntity: string
            enrollment: string
            orgUnit: string
            trackedEntityType: string
            resultCode: string
            resultDate: string
            reasonCode?: string
        }>
    ) => void
    isSaving: boolean
}

const formatDate = (isoDate?: string) =>
    isoDate ? new Date(isoDate).toLocaleDateString() : i18n.t('Not scheduled')

const todayIsoDate = () => new Date().toISOString().slice(0, 10)

export const OverduePatientList: FC<OverduePatientListProps> = ({
    patients,
    resultOptions,
    resultLabel,
    reasonOptions = [],
    reasonLabel,
    reasonShowWhenResultCode,
    onSaveAll,
    isSaving,
}) => {
    const [entryByTrackedEntity, setEntryByTrackedEntity] = useState<
        Record<string, RowEntry>
    >({})

    const selectOptions = useMemo(
        () =>
            resultOptions.map((option) => ({
                label: option.displayName,
                value: option.code,
            })),
        [resultOptions]
    )

    const reasonSelectOptions = useMemo(
        () =>
            reasonOptions.map((option) => ({
                label: option.displayName,
                value: option.code,
            })),
        [reasonOptions]
    )
    const hasReasonColumn =
        reasonSelectOptions.length > 0 && Boolean(reasonShowWhenResultCode)
    const showsReason = (entry: RowEntry) =>
        hasReasonColumn && entry.resultCode === reasonShowWhenResultCode

    const updateRow = (trackedEntity: string, patch: Partial<RowEntry>) => {
        setEntryByTrackedEntity((prev) => ({
            ...prev,
            [trackedEntity]: {
                resultCode: prev[trackedEntity]?.resultCode ?? '',
                resultDate: prev[trackedEntity]?.resultDate ?? todayIsoDate(),
                reasonCode: prev[trackedEntity]?.reasonCode ?? '',
                ...patch,
            },
        }))
    }

    const readyRows = patients
        .map((patient) => ({
            patient,
            entry: entryByTrackedEntity[patient.trackedEntity],
        }))
        .filter(
            (
                row
            ): row is {
                patient: OverduePatient
                entry: RowEntry
            } => Boolean(row.entry?.resultCode)
        )

    if (patients.length === 0) {
        return (
            <NoticeBox title={i18n.t('No overdue patients')}>
                {i18n.t(
                    'Run a check to see patients who are overdue for a visit.'
                )}
            </NoticeBox>
        )
    }

    return (
        <div className={classes.container}>
            <DataTable>
                <DataTableHead>
                    <DataTableRow>
                        <DataTableColumnHeader>
                            {i18n.t('Patient')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Phone')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Scheduled date')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {resultLabel ?? i18n.t('Result')}
                        </DataTableColumnHeader>
                        {hasReasonColumn && (
                            <DataTableColumnHeader>
                                {reasonLabel ?? i18n.t('Reason')}
                            </DataTableColumnHeader>
                        )}
                        <DataTableColumnHeader>
                            {i18n.t('Result date')}
                        </DataTableColumnHeader>
                    </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                    {patients.map((patient) => {
                        const entry = entryByTrackedEntity[
                            patient.trackedEntity
                        ] ?? {
                            resultCode: '',
                            resultDate: todayIsoDate(),
                            reasonCode: '',
                        }

                        return (
                            <DataTableRow key={patient.trackedEntity}>
                                <DataTableCell>{patient.name}</DataTableCell>
                                <DataTableCell>
                                    {patient.phone ?? '-'}
                                </DataTableCell>
                                <DataTableCell>
                                    {formatDate(patient.scheduledDate)}
                                </DataTableCell>
                                <DataTableCell>
                                    <SimpleSingleSelect
                                        name={`result-${patient.trackedEntity}`}
                                        options={selectOptions}
                                        selected={selectOptions.find(
                                            (option) =>
                                                option.value ===
                                                entry.resultCode
                                        )}
                                        onChange={(option) =>
                                            updateRow(patient.trackedEntity, {
                                                // A reason only applies to
                                                // the result that reveals it.
                                                reasonCode: '',
                                                resultCode:
                                                    // Despite its declared
                                                    // type, SimpleSingleSelect
                                                    // calls onChange with the
                                                    // whole {label, value}
                                                    // option, not a bare
                                                    // string (confirmed by
                                                    // reading its JS source).
                                                    (
                                                        option as unknown as {
                                                            value: string
                                                        }
                                                    ).value,
                                            })
                                        }
                                    />
                                </DataTableCell>
                                {hasReasonColumn && (
                                    <DataTableCell>
                                        {showsReason(entry) && (
                                            <SimpleSingleSelect
                                                name={`reason-${patient.trackedEntity}`}
                                                options={reasonSelectOptions}
                                                selected={reasonSelectOptions.find(
                                                    (option) =>
                                                        option.value ===
                                                        entry.reasonCode
                                                )}
                                                onChange={(option) =>
                                                    updateRow(
                                                        patient.trackedEntity,
                                                        {
                                                            // Same onChange
                                                            // shape bug as the
                                                            // result select.
                                                            reasonCode: (
                                                                option as unknown as {
                                                                    value: string
                                                                }
                                                            ).value,
                                                        }
                                                    )
                                                }
                                            />
                                        )}
                                    </DataTableCell>
                                )}
                                <DataTableCell>
                                    <Input
                                        type="date"
                                        dense
                                        value={entry.resultDate}
                                        onChange={({ value }) =>
                                            updateRow(patient.trackedEntity, {
                                                resultDate: value ?? '',
                                            })
                                        }
                                    />
                                </DataTableCell>
                            </DataTableRow>
                        )
                    })}
                </DataTableBody>
            </DataTable>

            <Button
                primary
                className={classes.saveButton}
                disabled={readyRows.length === 0}
                loading={isSaving}
                onClick={() =>
                    onSaveAll(
                        readyRows.map(({ patient, entry }) => ({
                            trackedEntity: patient.trackedEntity,
                            enrollment: patient.enrollment,
                            orgUnit: patient.orgUnit,
                            trackedEntityType: patient.trackedEntityType,
                            resultCode: entry.resultCode,
                            resultDate: entry.resultDate,
                            ...(showsReason(entry) && entry.reasonCode
                                ? { reasonCode: entry.reasonCode }
                                : {}),
                        }))
                    )
                }
            >
                {i18n.t('Save all ({{count}})', { count: readyRows.length })}
            </Button>
        </div>
    )
}

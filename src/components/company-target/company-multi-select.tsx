import { CompanyCombobox, type CompanyComboboxProps } from './company-combobox';

export type CompanyMultiSelectProps = Omit<CompanyComboboxProps, 'multi'>;

/** Multi-company combobox with checkboxes, chips, select-all-visible, clear-all. */
export function CompanyMultiSelect(props: CompanyMultiSelectProps) {
  return <CompanyCombobox {...props} multi />;
}

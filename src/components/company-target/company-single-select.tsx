import { CompanyCombobox, type CompanyComboboxProps } from './company-combobox';

export type CompanySingleSelectProps = Omit<CompanyComboboxProps, 'multi'>;

/** Single-company combobox (exactly one selection). */
export function CompanySingleSelect(props: CompanySingleSelectProps) {
  return <CompanyCombobox {...props} multi={false} />;
}

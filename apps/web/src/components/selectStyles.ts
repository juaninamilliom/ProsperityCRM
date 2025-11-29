import { StylesConfig } from 'react-select';
import type { Theme } from '../theme';

type SelectOption = { value: string; label: string };

export const getSelectStyles = (theme: Theme): StylesConfig<SelectOption, boolean> => ({
  control: (provided, state) => ({
    ...provided,
    borderRadius: 9999,
    minHeight: '2rem',
    fontSize: '0.875rem',
    borderColor: state.isFocused
      ? theme === 'dark'
        ? '#6366f1' // indigo-500
        : '#2563eb' // blue-600
      : theme === 'dark'
      ? '#475569' // slate-600
      : 'rgb(226 232 240 / var(--tw-border-opacity))', // slate-200
    boxShadow: 'none',
    ':hover': {
      borderColor: theme === 'dark' ? '#6366f1' : '#2563eb',
    },
    backgroundColor: 'transparent',
  }),
  menu: (provided) => ({
    ...provided,
    borderRadius: 16,
    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', // slate-800 / white
    color: theme === 'dark' ? '#e2e8f0' : '#0f172a', // slate-200 / slate-900
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused
      ? theme === 'dark'
        ? '#475569' // slate-600
        : '#e0f2fe' // blue-50
      : provided.backgroundColor,
    color: state.isSelected
      ? theme === 'dark'
        ? '#e2e8f0' // slate-200
        : '#1d4ed8' // blue-800
      : theme === 'dark'
      ? '#e2e8f0' // slate-200
      : '#0f172a', // slate-900
    ':active': {
      backgroundColor: theme === 'dark' ? '#334155' : '#bfdbfe', // slate-700 / blue-200
    },
  }),
  multiValue: (provided) => ({
    ...provided,
    borderRadius: 9999,
    backgroundColor: theme === 'dark' ? '#334155' : 'rgba(59,130,246,0.15)', // slate-700 / blue-500/15
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: theme === 'dark' ? '#e2e8f0' : '#1d4ed8', // slate-200 / blue-800
    fontWeight: 600,
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    borderRadius: 9999,
    ':hover': {
      backgroundColor: theme === 'dark' ? '#475569' : '#2563eb', // slate-600 / blue-600
      color: '#fff',
    },
  }),
});

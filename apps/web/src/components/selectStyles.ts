import { StylesConfig } from 'react-select';

type SelectOption = { value: string; label: string };

/** Takes no theme: every value below is a CSS custom property, so the theme is
 *  applied by the `dark` class on <html> rather than by recomputing styles. */
export const getSelectStyles = <Option = SelectOption, IsMulti extends boolean = false>(
): StylesConfig<Option, IsMulti> => {
  return {
    control: (provided, state) => ({
      ...provided,
      minHeight: 36,
      height: 36,
      paddingLeft: 4,
      paddingRight: 2,
      fontSize: 13,
      borderRadius: 'var(--r-control)',
      backgroundColor: 'var(--surface)',
      borderColor: state.isFocused ? 'var(--accent)' : 'var(--border)',
      boxShadow: state.isFocused ? '0 0 0 3px var(--sel-ring)' : 'none',
      transition: 'border-color 120ms, box-shadow 120ms',
      ':hover': { borderColor: state.isFocused ? 'var(--accent)' : 'var(--border)' },
    }),
    valueContainer: (provided) => ({ ...provided, padding: '0 6px' }),
    singleValue: (provided) => ({ ...provided, color: 'var(--ink)', fontSize: 13 }),
    input: (provided) => ({ ...provided, color: 'var(--ink)', margin: 0, padding: 0 }),
    placeholder: (provided) => ({ ...provided, color: 'var(--ink-3)', fontSize: 13 }),

    // Stock react-select draws a vertical rule before the chevron and an
    // oversized indicator. Nothing else in the app has either.
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (provided, state) => ({
      ...provided,
      padding: '0 8px 0 4px',
      color: state.isFocused ? 'var(--ink-2)' : 'var(--ink-3)',
      '& svg': { width: 15, height: 15 },
      ':hover': { color: 'var(--ink-2)' },
    }),
    clearIndicator: (provided) => ({
      ...provided,
      padding: '0 2px',
      color: 'var(--ink-3)',
      '& svg': { width: 14, height: 14 },
      ':hover': { color: 'var(--ink-2)' },
    }),

    menu: (provided) => ({
      ...provided,
      marginTop: 6,
      padding: 5,
      borderRadius: 11,
      border: '1px solid var(--border)',
      backgroundColor: 'var(--surface)',
      boxShadow: '0 12px 28px rgba(10, 12, 20, 0.16)',
      overflow: 'hidden',
      zIndex: 30,
    }),
    menuList: (provided) => ({ ...provided, padding: 0, maxHeight: 260 }),
    option: (provided, state) => ({
      ...provided,
      padding: '8px 10px',
      borderRadius: 8,
      fontSize: 12.5,
      cursor: 'pointer',
      color: state.isSelected ? 'var(--accent-ink)' : 'var(--ink)',
      backgroundColor: state.isSelected
        ? 'var(--accent-soft)'
        : state.isFocused
          ? 'var(--surface-3)'
          : 'transparent',
      ':active': { backgroundColor: 'var(--sel-bg)' },
    }),
    noOptionsMessage: (provided) => ({
      ...provided,
      padding: '10px',
      fontSize: 12.5,
      color: 'var(--ink-3)',
    }),

    multiValue: (provided) => ({
      ...provided,
      margin: '2px 4px 2px 0',
      borderRadius: 'var(--r-chip)',
      backgroundColor: 'var(--accent-soft)',
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      padding: '2px 4px 2px 8px',
      fontSize: 11.5,
      fontWeight: 500,
      color: 'var(--accent-ink)',
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      paddingLeft: 2,
      paddingRight: 6,
      borderRadius: 'var(--r-chip)',
      color: 'var(--accent-ink)',
      ':hover': { backgroundColor: 'transparent', color: 'var(--ink)' },
    }),
  };
};

export const getMultiSelectStyles = <Option = SelectOption>() =>
  getSelectStyles<Option, true>();

import { StylesConfig } from 'react-select';
import type { Theme } from '../theme';

type SelectOption = { value: string; label: string };

const palette = {
  light: {
    controlBorder: 'var(--border)',
    controlBorderFocus: 'var(--accent)',
    controlBorderHover: 'var(--accent)',
    menuBg: 'var(--surface)',
    menuColor: 'var(--ink)',
    optionHoverBg: 'var(--surface-3)',
    optionSelectedColor: 'var(--accent-ink)',
    optionColor: 'var(--ink)',
    optionActiveBg: 'var(--sel-bg)',
    multiBg: 'var(--accent-soft)',
    multiText: 'var(--accent-ink)',
    multiRemoveHoverBg: 'var(--accent)',
    valueColor: 'var(--ink)',
    placeholderColor: 'var(--ink-3)',
  },
  dark: {
    controlBorder: 'var(--border)',
    controlBorderFocus: 'var(--accent)',
    controlBorderHover: 'var(--accent)',
    menuBg: 'var(--surface)',
    menuColor: 'var(--ink)',
    optionHoverBg: 'var(--surface-3)',
    optionSelectedColor: 'var(--accent-ink)',
    optionColor: 'var(--ink)',
    optionActiveBg: 'var(--sel-bg)',
    multiBg: 'var(--accent-soft)',
    multiText: 'var(--accent-ink)',
    multiRemoveHoverBg: 'var(--accent)',
    valueColor: 'var(--ink)',
    placeholderColor: 'var(--ink-3)',
  },
} satisfies Record<Theme, Record<string, string>>;

export const getSelectStyles = <Option = SelectOption, IsMulti extends boolean = false>(
  theme: Theme,
): StylesConfig<Option, IsMulti> => {
  const colorsForTheme = palette[theme];
  return {
    control: (provided, state) => ({
      ...provided,
      borderRadius: 'var(--r-control)',
      minHeight: 36,
      height: 36,
      fontSize: 13,
      borderColor: state.isFocused
        ? `var(--select-control-border-focus, ${colorsForTheme.controlBorderFocus})`
        : `var(--select-control-border, ${colorsForTheme.controlBorder})`,
      boxShadow: 'none',
      ':hover': {
        borderColor: `var(--select-control-border-hover, ${colorsForTheme.controlBorderHover})`,
      },
      backgroundColor: 'transparent',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: `var(--select-value-color, ${colorsForTheme.valueColor})`,
    }),
    input: (provided) => ({
      ...provided,
      color: `var(--select-value-color, ${colorsForTheme.valueColor})`,
    }),
    placeholder: (provided) => ({
      ...provided,
      color: `var(--select-placeholder-color, ${colorsForTheme.placeholderColor})`,
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: 16,
      backgroundColor: `var(--select-menu-bg, ${colorsForTheme.menuBg})`,
      color: `var(--select-menu-color, ${colorsForTheme.menuColor})`,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused
        ? `var(--select-option-hover-bg, ${colorsForTheme.optionHoverBg})`
        : provided.backgroundColor,
      color: state.isSelected
        ? `var(--select-option-selected-color, ${colorsForTheme.optionSelectedColor})`
        : `var(--select-option-color, ${colorsForTheme.optionColor})`,
      ':active': {
        backgroundColor: `var(--select-option-active-bg, ${colorsForTheme.optionActiveBg})`,
      },
    }),
    multiValue: (provided) => ({
      ...provided,
      borderRadius: 9999,
      backgroundColor: `var(--select-multi-bg, ${colorsForTheme.multiBg})`,
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: `var(--select-multi-text, ${colorsForTheme.multiText})`,
      fontWeight: 600,
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      borderRadius: 9999,
      ':hover': {
        backgroundColor: `var(--select-multi-remove-hover-bg, ${colorsForTheme.multiRemoveHoverBg})`,
        color: '#fff',
      },
    }),
  };
};

export const getMultiSelectStyles = <Option = SelectOption>(theme: Theme) =>
  getSelectStyles<Option, true>(theme);

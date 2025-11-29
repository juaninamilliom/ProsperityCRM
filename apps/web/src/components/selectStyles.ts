import colors from 'tailwindcss/colors';
import { StylesConfig } from 'react-select';
import type { Theme } from '../theme';

type SelectOption = { value: string; label: string };

const palette = {
  light: {
    controlBorder: colors.slate[200],
    controlBorderFocus: colors.blue[600],
    controlBorderHover: colors.blue[600],
    menuBg: colors.white,
    menuColor: colors.slate[900],
    optionHoverBg: colors.sky[100],
    optionSelectedColor: colors.blue[800],
    optionColor: colors.slate[900],
    optionActiveBg: colors.blue[200],
    multiBg: 'rgba(37, 99, 235, 0.15)',
    multiText: colors.blue[900],
    multiRemoveHoverBg: colors.blue[600],
    valueColor: colors.slate[900],
    placeholderColor: colors.slate[400],
  },
  dark: {
    controlBorder: colors.slate[600],
    controlBorderFocus: colors.indigo[500],
    controlBorderHover: colors.indigo[500],
    menuBg: colors.slate[800],
    menuColor: colors.slate[200],
    optionHoverBg: colors.slate[600],
    optionSelectedColor: colors.slate[50],
    optionColor: colors.slate[200],
    optionActiveBg: colors.slate[700],
    multiBg: colors.slate[700],
    multiText: colors.white,
    multiRemoveHoverBg: colors.slate[600],
    valueColor: colors.slate[50],
    placeholderColor: colors.slate[400],
  },
} satisfies Record<Theme, Record<string, string>>;

export const getSelectStyles = (theme: Theme): StylesConfig<SelectOption, boolean> => {
  const colorsForTheme = palette[theme];
  return {
    control: (provided, state) => ({
      ...provided,
      borderRadius: 9999,
      minHeight: '2rem',
      fontSize: '0.875rem',
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

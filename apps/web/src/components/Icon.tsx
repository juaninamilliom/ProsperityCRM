import type { SVGProps } from 'react';

const icons = {
  edit: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14.25v4.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V7.5a2.25 2.25 0 012.25-2.25h4.5"
    />
  ),
  close: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
};

export type IconName = keyof typeof icons;

interface IconProps extends SVGProps<SVGSVGElement> {
  icon: IconName;
}

export function Icon({ icon, className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? 'h-5 w-5'}
      {...props}
    >
      {icons[icon]}
    </svg>
  );
}

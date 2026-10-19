import type { SVGProps } from 'react'

const paths = {
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="1.5" /><path d="M5 15V6a1.5 1.5 0 0 1 1.5-1.5H15" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 10h17M8 3v4m8-4v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  pin: <><path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10C5.5 15.3 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></>,
  warning: <><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" /><path d="M12 10v4.5m0 2.7v.1" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  file: <><path d="M6 3.5h8l4 4v13H6v-17Z" /><path d="M14 3.5v4h4M9 12h6m-6 3.5h6" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="m3.5 7 8.5 6.5L20.5 7" /></>,
  user: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.2m0-8.4v.1" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></>,
  hours: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2M12 3.5V5" /></>,
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}

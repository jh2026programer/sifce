// Iconos SVG simples y propios (línea, 24x24, currentColor) para no depender
// de una librería externa de íconos. Uso: <IconDashboard size={18} />
function base(children, { size = 20, strokeWidth = 1.8, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p) => base(<>
  <rect x="3" y="3" width="7" height="9" rx="1.5" />
  <rect x="14" y="3" width="7" height="5" rx="1.5" />
  <rect x="14" y="12" width="7" height="9" rx="1.5" />
  <rect x="3" y="16" width="7" height="5" rx="1.5" />
</>, p);

export const IconBuilding = (p) => base(<>
  <rect x="4" y="3" width="12" height="18" rx="1" />
  <path d="M16 8h4v13h-4" />
  <path d="M8 7h.01M12 7h.01M8 11h.01M12 11h.01M8 15h.01M12 15h.01" />
</>, p);

export const IconUsers = (p) => base(<>
  <circle cx="9" cy="8" r="3" />
  <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
  <circle cx="17.5" cy="9" r="2.3" />
  <path d="M15.7 14.2c2.6.4 4.6 2.6 4.8 5.3" />
</>, p);

export const IconBriefcase = (p) => base(<>
  <rect x="3" y="7.5" width="18" height="12" rx="1.5" />
  <path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5" />
  <path d="M3 12.5h18" />
  <path d="M10.5 12.5h3v1.6h-3z" />
</>, p);

export const IconFile = (p) => base(<>
  <path d="M7 2.5h7l4 4V21a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" />
  <path d="M14 2.5V7h4" />
  <path d="M9 13h6M9 16.5h6" />
</>, p);

export const IconChart = (p) => base(<>
  <path d="M4 20V10M11 20V4M18 20v-7" />
  <path d="M2.5 20.5h19" />
</>, p);

export const IconSliders = (p) => base(<>
  <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h13M21 18h-2" />
  <circle cx="15" cy="6" r="2" />
  <circle cx="7" cy="12" r="2" />
  <circle cx="17" cy="18" r="2" />
</>, p);

export const IconLayers = (p) => base(<>
  <path d="M12 2.5 3 7.5l9 5 9-5-9-5Z" />
  <path d="M3 12.5l9 5 9-5" />
  <path d="M3 17.5l9 5 9-5" />
</>, p);

export const IconLink = (p) => base(<>
  <path d="M9.5 14.5 14.5 9.5" />
  <path d="M11 6.5 13 4.5a3.5 3.5 0 0 1 5 5l-2 2" />
  <path d="M13 17.5 11 19.5a3.5 3.5 0 0 1-5-5l2-2" />
</>, p);

export const IconLogOut = (p) => base(<>
  <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
  <path d="M16 17l5-5-5-5" />
  <path d="M21 12H9" />
</>, p);

export const IconTarget = (p) => base(<>
  <circle cx="12" cy="12" r="8.5" />
  <circle cx="12" cy="12" r="4.5" />
  <circle cx="12" cy="12" r="0.8" fill="currentColor" />
</>, p);

export const IconTrendingUp = (p) => base(<>
  <path d="M3 17l6-6 4 4 8-8" />
  <path d="M15 6h6v6" />
</>, p);

export const IconDownload = (p) => base(<>
  <path d="M12 3v13" />
  <path d="M7 11l5 5 5-5" />
  <path d="M4 20h16" />
</>, p);

export const IconPlus = (p) => base(<>
  <path d="M12 5v14M5 12h14" />
</>, p);

export const IconUserCircle = (p) => base(<>
  <circle cx="12" cy="12" r="9" />
  <circle cx="12" cy="10" r="3" />
  <path d="M6 19c1-2.8 3.4-4 6-4s5 1.2 6 4" />
</>, p);

export const IconArrowSwitch = (p) => base(<>
  <path d="M7 4 3 8l4 4" />
  <path d="M3 8h13a3 3 0 0 1 3 3v1" />
  <path d="M17 20l4-4-4-4" />
  <path d="M21 16H8a3 3 0 0 1-3-3v-1" />
</>, p);

export const IconCompass = (p) => base(<>
  <circle cx="12" cy="12" r="9" />
  <path d="M15 9l-2 6-6 2 2-6 6-2Z" />
</>, p);

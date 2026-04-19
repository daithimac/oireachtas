export function LogoSVG({ className, size = 48 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer Compass / Magnifying Glass Ring */}
      <circle cx="45" cy="45" r="35" stroke="currentColor" strokeWidth="6" />
      
      {/* Compass Points */}
      <path d="M45 5V15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M45 75V85" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M85 45H75" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M15 45H5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />

      {/* Stylized Parliament Facade */}
      <path 
        d="M25 60V45L45 35L65 45V60H25Z" 
        fill="currentColor" 
        fillOpacity="0.15" 
      />
      <path 
        d="M25 60V45L45 35L65 45V60" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinejoin="round" 
      />
      {/* Columns */}
      <line x1="33" y1="48" x2="33" y2="60" stroke="currentColor" strokeWidth="3" />
      <line x1="45" y1="44" x2="45" y2="60" stroke="currentColor" strokeWidth="3" />
      <line x1="57" y1="48" x2="57" y2="60" stroke="currentColor" strokeWidth="3" />

      {/* Magnifying Glass Handle */}
      <path 
        d="M70 70L88 88" 
        stroke="currentColor" 
        strokeWidth="8" 
        strokeLinecap="round" 
      />
    </svg>
  );
}

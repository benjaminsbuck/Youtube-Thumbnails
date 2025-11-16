
import React from 'react';

export const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 3L9.27 6.73L5 8l3.73 3.73L8 16l4-2.5L16 16l-1.73-4.27L19 8l-4.27-.27L12 3z" />
    <path d="M5 21L7.14 18.86" />
    <path d="M17 21l-2.14-2.14" />
    <path d="M21 12l-2.14-2.14" />
    <path d="M3 12l2.14-2.14" />
    <path d="M12 3v.01" />
  </svg>
);

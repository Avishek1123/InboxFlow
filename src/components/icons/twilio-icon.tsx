export function TwilioIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect width="24" height="24" rx="6" fill="#F22F46" />
      <path
        d="M7.5 8.5c0-1.1.9-2 2-2h5c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2h-5c-1.1 0-2-.9-2-2v-7zm2.5 1.5v5h4v-5h-4z"
        fill="white"
      />
    </svg>
  );
}

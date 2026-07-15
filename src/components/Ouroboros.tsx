import { motion } from 'framer-motion';

export function Ouroboros() {
  return (
    <motion.svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      animate={{ rotate: 360 }}
      transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      className="shrink-0"
    >
      <path
        d="M18.8 6.2a8.9 8.9 0 1 0 1.1 10.4"
        stroke="#C9A961"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M18.3 5.8l3.1.6-1.5 2.7"
        stroke="#C9A961"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M20 16.5c-.6.2-1.2.2-1.8 0"
        stroke="#C9A961"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </motion.svg>
  );
}

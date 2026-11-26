import Image from 'next/image';

/** The clinic's caduceus shield (same artwork as the favicon) on a white tile, so its grey reads on dark backgrounds */
export function LogoMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`${className} rounded-xl bg-white flex items-center justify-center shrink-0 p-1.5`}>
      <Image src="/logo.png" alt="" width={304} height={332} className="h-full w-auto object-contain" priority />
    </span>
  );
}

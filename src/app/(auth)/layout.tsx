import Link from 'next/link';
import { site } from '@/lib/site';
import { SealMark } from '@/components/site/SealMark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <SealMark size={26} color="#8A5D28" />
          <span className="font-serif text-[26px] leading-none">{site.name}</span>
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}

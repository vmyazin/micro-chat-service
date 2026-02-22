import { GithubLogoIcon } from '@phosphor-icons/react/ssr';
import Image from 'next/image';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="py-10 border-t border-gray-100 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
        <Link
          href="/"
          className="flex items-center gap-3 cursor-pointer group opacity-40 grayscale hover:opacity-70 hover:grayscale-0 transition-all duration-300"
        >
          <Image
            src="/images/mc-logo-vector-8863.svg"
            alt="MicroChat"
            width={36}
            height={36}
            className="h-9 w-auto"
          />
        </Link>

        <div className="flex flex-wrap justify-center gap-8 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <a
            href="/protocol"
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Protocol
          </a>
          <a
            href="/security"
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Security
          </a>
          <a
            href="/security"
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Privacy Policy
          </a>
          <a
            href="/changelog"
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Changelog
          </a>
          <a
            href="https://github.com"
            className="hover:text-blue-600 transition-colors cursor-pointer"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <GithubLogoIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="text-xs text-gray-400 font-mono">
          &copy; 2026 MicroChat
        </div>
      </div>
    </footer>
  );
}

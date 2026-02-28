// Server Component — reads changelog.yaml at build/render time
import fs from 'node:fs';
import path from 'node:path';
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/ssr';
import yaml from 'js-yaml';
import type { Metadata } from 'next';
import { ChangelogList } from '@/components/ChangelogList';
import { Eyebrow } from '@/components/Eyebrow';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'Track the latest updates, security improvements, and new features in MicroChat.',
  openGraph: {
    title: 'Changelog | MicroChat',
    description:
      'Track the latest updates, security improvements, and new features in MicroChat.',
    url: '/changelog',
  },
};

export interface ChangelogItem {
  date: string;
  title: string;
  description: string;
}

export interface ChangelogCategory {
  category: string;
  icon: string;
  color: string;
  items: ChangelogItem[];
}

function loadChangelog(): ChangelogCategory[] {
  const filePath = path.join(process.cwd(), 'data', 'changelog.yaml');
  const raw = fs.readFileSync(filePath, 'utf8');
  return yaml.load(raw) as ChangelogCategory[];
}

export default function ChangelogPage() {
  const updates = loadChangelog();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-20">
      <SiteHeader />

      <header className="pt-40 pb-20 px-6 text-center max-w-4xl mx-auto">
        <Eyebrow
          animate={false}
          icon={
            <ClockCounterClockwiseIcon className="w-4 h-4 text-slate-600" />
          }
          className="mb-8"
        >
          Always Improving
        </Eyebrow>

        <h1
          className="text-5xl md:text-7xl mb-6 font-semibold italic text-slate-900 leading-tight"
          style={{ fontFamily: 'var(--font-bodoni)' }}
        >
          Changelog
        </h1>
        <p className="text-xl text-slate-500 font-light leading-relaxed max-w-2xl mx-auto">
          We iterate fast, focusing exclusively on things that make MicroChat
          more secure, more private, and easier to use.
        </p>
      </header>

      <ChangelogList updates={updates} />
      <SiteFooter />
    </div>
  );
}

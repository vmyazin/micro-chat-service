import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Understand the security model of MicroChat, from simple principles to deep implementation details.',
  openGraph: {
    title: 'Security | MicroChat',
    description: 'Understand the security model of MicroChat, from simple principles to deep implementation details.',
    url: '/security',
  },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

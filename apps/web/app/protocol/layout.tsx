import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Protocol',
  description: 'Deep dive into the cryptographic machinery and the MLS standard that power MicroChat.',
  openGraph: {
    title: 'Protocol | MicroChat',
    description: 'Deep dive into the cryptographic machinery and the MLS standard that power MicroChat.',
    url: '/protocol',
  },
};

export default function ProtocolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

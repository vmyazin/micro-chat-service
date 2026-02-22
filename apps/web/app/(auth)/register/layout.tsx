import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create a new MicroChat account securely with passkeys.',
  openGraph: {
    title: 'Create Account | MicroChat',
    description: 'Create a new MicroChat account securely with passkeys.',
    url: '/register',
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to MicroChat using passkeys.',
  openGraph: {
    title: 'Sign In | MicroChat',
    description: 'Sign in to MicroChat using passkeys.',
    url: '/login',
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

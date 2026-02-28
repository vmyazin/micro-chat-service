import {
  ArrowUpRightIcon,
  FileTextIcon,
  LockIcon,
  ShieldIcon,
  TreeStructureIcon,
} from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Eyebrow } from '@/components/Eyebrow';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Whitepaper',
  description:
    'Technical whitepaper describing the MicroChat security architecture, MLS protocol implementation, and cryptographic primitives.',
  openGraph: {
    title: 'Whitepaper | MicroChat',
    description:
      'Technical whitepaper describing the MicroChat security architecture, MLS protocol implementation, and cryptographic primitives.',
    url: '/whitepaper',
  },
};

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-20">
      <SiteHeader />

      {/* Hero */}
      <header className="pt-40 pb-16 px-6 text-center max-w-3xl mx-auto">
        <Eyebrow
          animate={false}
          icon={<FileTextIcon className="w-4 h-4 text-slate-600" />}
          className="mb-8"
        >
          Technical Whitepaper · Draft
        </Eyebrow>

        <h1
          className="text-5xl md:text-7xl mb-6 font-semibold italic text-slate-900 leading-tight"
          style={{ fontFamily: 'var(--font-bodoni)' }}
        >
          MicroChat Security Architecture
        </h1>
        <p className="text-xl text-slate-500 font-light leading-relaxed">
          A technical overview of our end-to-end encryption model, MLS protocol
          implementation, and threat model.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 font-mono">
          <span>Version 0.1 — Draft</span>
          <span>·</span>
          <span>RFC 9420 (MLS)</span>
          <span>·</span>
          <span>Last revised February 2026</span>
        </div>
      </header>

      {/* Paper body */}
      <main className="max-w-3xl mx-auto px-6 space-y-16">
        {/* Abstract */}
        <Section id="abstract" label="§ 0" title="Abstract">
          <p>
            MicroChat is a group messaging service built on the Messaging Layer
            Security (MLS) protocol [RFC 9420]. This document describes the
            cryptographic architecture, key management lifecycle, and threat
            model that underpin its security guarantees.
          </p>
          <p>
            The primary security properties are: <strong>end-to-end
            confidentiality</strong>, <strong>forward secrecy</strong>, and{' '}
            <strong>post-compromise security</strong>. Messages are encrypted
            on-device before transmission; the server processes only opaque
            ciphertext and never holds key material.
          </p>
          <Callout>
            This is a working draft. Sections marked{' '}
            <Badge>Pending</Badge> are placeholders for content under active
            development.
          </Callout>
        </Section>

        {/* 1. Introduction */}
        <Section id="introduction" label="§ 1" title="Introduction">
          <p>
            Existing messaging protocols either target one-to-one communication
            (Signal Protocol) or sacrifice security for scalability (server-side
            fanout). MLS addresses this gap by providing an authenticated group
            key agreement protocol that scales to large groups while preserving
            strong security guarantees.
          </p>
          <p>
            MicroChat adopts MLS as its core protocol and augments it with a
            lightweight Sealed Sender scheme to reduce server-visible metadata.
            This document is intended for security researchers, auditors, and
            engineers evaluating the system.
          </p>
        </Section>

        {/* 2. Cryptographic Primitives */}
        <Section id="primitives" label="§ 2" title="Cryptographic Primitives">
          <PrimitivesTable />
          <p className="mt-6">
            Key derivation follows the HKDF construction [RFC 5869] throughout.
            The Web Crypto API is used for all cryptographic operations in the
            browser client to ensure hardware acceleration and avoid
            side-channel vulnerabilities in JavaScript.
          </p>
        </Section>

        {/* 3. Protocol Design */}
        <Section id="protocol" label="§ 3" title="Protocol Design">
          <SubSection title="3.1 TreeKEM & Ratchet Tree">
            <p>
              MLS arranges group members as leaves of a left-balanced binary
              tree. Each interior node holds a derived key pair. A member's{' '}
              <em>path secret</em> is the sequence of private keys along its
              direct path to the root.
            </p>
            <p>
              Group key material (the <em>epoch secret</em>) is derived from
              the root node's key using HKDF. All per-message keys are derived
              from the epoch secret, ensuring that different epochs produce
              cryptographically independent key streams.
            </p>
            <p className="text-slate-400 italic">
              [Diagram: ratchet tree with 4 members — pending]
            </p>
          </SubSection>

          <SubSection title="3.2 Commits & Proposals">
            <p>
              Group state advances through{' '}
              <strong>Commits</strong>. A Commit bundles one or more{' '}
              <strong>Proposals</strong> (Add, Remove, Update) and transitions
              the group to a new epoch. Each Commit is authenticated with
              the committer's leaf credential.
            </p>
            <p>
              Application messages do not advance the epoch. This means a
              sender's burst of messages all encrypt under the same epoch key,
              with per-message nonces derived via a symmetric ratchet.
            </p>
          </SubSection>

          <SubSection title="3.3 Sealed Sender" badge="Partial">
            <p>
              To reduce server-visible metadata, MicroChat issues single-use
              blinding tokens to clients. When sending a message, a client
              presents a token in lieu of an authenticated identity. The server
              verifies the token's hash but cannot link it to the requesting
              account.
            </p>
            <p>
              The true sender identity is included inside the MLS
              ApplicationMessage ciphertext, visible only to group members with
              the current epoch key.
            </p>
          </SubSection>
        </Section>

        {/* 4. Key Lifecycle */}
        <Section id="key-lifecycle" label="§ 4" title="Key Lifecycle">
          <p>
            Keys are generated client-side using{' '}
            <code className="font-mono text-sm bg-slate-100 px-1.5 py-0.5 rounded">
              crypto.subtle.generateKey
            </code>{' '}
            and are never transmitted to the server in plaintext. Leaf key
            packages (used for initial group add operations) are uploaded in
            encrypted form and rotated after each use.
          </p>
          <p>
            On group deletion, the server deletes all stored ciphertext. Because
            no plaintext key material ever resided on the server, the stored
            blobs become permanently irrecoverable.
          </p>
          <Callout variant="pending">
            Formal key lifecycle diagram and epoch state machine — pending.
          </Callout>
        </Section>

        {/* 5. Threat Model */}
        <Section id="threat-model" label="§ 5" title="Threat Model">
          <ThreatTable />
          <p className="mt-6">
            MicroChat does <strong>not</strong> protect against a fully
            compromised client device, coercive key extraction, or traffic
            analysis by a global passive adversary. These are out of scope and
            documented in the full{' '}
            <Link href="/security/for-engineers" className="text-blue-600 hover:underline">
              threat model
            </Link>
            .
          </p>
        </Section>

        {/* 6. Limitations & Future Work */}
        <Section id="limitations" label="§ 6" title="Limitations & Future Work">
          <ul className="space-y-3 list-none pl-0">
            {[
              'Metadata minimization beyond Sealed Sender (e.g., Private Information Retrieval for message fetch)',
              'Formal verification of the key schedule using ProVerif or Tamarin',
              'Hardware security key (WebAuthn) integration for leaf credential binding',
              'Multi-device support and key consistency across sessions',
            ].map((item) => (
              <li key={item} className="flex gap-3 text-slate-600 font-light">
                <span className="text-blue-600 font-bold shrink-0">—</span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        {/* 7. References */}
        <Section id="references" label="§ 7" title="References">
          <ol className="space-y-3 list-none pl-0 font-mono text-sm text-slate-500">
            {[
              '[RFC 9420] Barnes, R. et al. "The Messaging Layer Security (MLS) Protocol." IETF, 2023.',
              '[RFC 5869] Krawczyk, H. and P. Eronen. "HMAC-based Extract-and-Expand Key Derivation Function (HKDF)." IETF, 2010.',
              '[HPKE] Barns, R. et al. "Hybrid Public Key Encryption." RFC 9180, IETF, 2022.',
              '[TreeKEM] Bhargavan, K. et al. "TreeKEM: Asynchronous Decentralized Key Management for Large Dynamic Groups." RWC 2019.',
              '[Signal] Marlinspike, M. and Perrin, T. "The Double Ratchet Algorithm." Signal, 2016.',
            ].map((ref, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 text-slate-300">{i + 1}.</span>
                {ref}
              </li>
            ))}
          </ol>
        </Section>

        {/* Footer nav */}
        <div className="pt-8 border-t border-slate-200 flex flex-wrap gap-6 text-sm">
          <Link
            href="/protocol"
            className="flex items-center gap-1.5 text-blue-600 hover:underline"
          >
            Interactive Protocol Overview
            <ArrowUpRightIcon className="w-4 h-4" />
          </Link>
          <Link
            href="/security"
            className="flex items-center gap-1.5 text-blue-600 hover:underline"
          >
            Security Model
            <ArrowUpRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  id,
  label,
  title,
  children,
}: {
  id: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-baseline gap-4 mb-6">
        <span className="font-mono text-sm text-slate-400">{label}</span>
        <h2
          className="text-2xl md:text-3xl font-bold text-slate-900"
          style={{ fontFamily: 'var(--font-bodoni)' }}
        >
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-slate-600 font-light leading-relaxed text-lg">
        {children}
      </div>
    </section>
  );
}

function SubSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        {badge && <Badge variant="warning">{badge}</Badge>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Callout({
  variant = 'info',
  children,
}: {
  variant?: 'info' | 'pending';
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-4 rounded-xl p-4 text-sm font-light border ${
        variant === 'pending'
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-blue-50 border-blue-100 text-blue-800'
      }`}
    >
      {children}
    </div>
  );
}

function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'warning';
}) {
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
        variant === 'warning'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      {children}
    </span>
  );
}

function PrimitivesTable() {
  const rows = [
    { primitive: 'Key Agreement', algorithm: 'P-256 (ECDH)', status: 'Live' },
    { primitive: 'Symmetric Encryption', algorithm: 'AES-256-GCM', status: 'Live' },
    { primitive: 'Key Derivation', algorithm: 'HKDF-SHA-256', status: 'Live' },
    { primitive: 'Digital Signatures', algorithm: 'Ed25519', status: 'Pending' },
    { primitive: 'Public Key Encryption', algorithm: 'HPKE (X25519, AES-GCM)', status: 'Pending' },
    { primitive: 'Hash', algorithm: 'SHA-256', status: 'Live' },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-5 py-3 font-semibold text-slate-700">Primitive</th>
            <th className="text-left px-5 py-3 font-semibold text-slate-700">Algorithm</th>
            <th className="text-left px-5 py-3 font-semibold text-slate-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.primitive} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="px-5 py-3 text-slate-700 font-medium">{row.primitive}</td>
              <td className="px-5 py-3 font-mono text-slate-500">{row.algorithm}</td>
              <td className="px-5 py-3">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    row.status === 'Live'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ThreatTable() {
  const rows = [
    { threat: 'Passive network observer', protected: true, notes: 'All traffic is TLS + E2E encrypted' },
    { threat: 'Compromised server', protected: true, notes: 'Server holds only opaque ciphertext' },
    { threat: 'Malicious insider', protected: true, notes: 'No plaintext key material server-side' },
    { threat: 'Stolen long-term keys', protected: true, notes: 'Forward secrecy via epoch rotation' },
    { threat: 'Compromised device', protected: false, notes: 'Out of scope — endpoint security' },
    { threat: 'Global passive adversary', protected: false, notes: 'Traffic analysis not addressed' },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-5 py-3 font-semibold text-slate-700">Threat</th>
            <th className="text-left px-5 py-3 font-semibold text-slate-700">Mitigated</th>
            <th className="text-left px-5 py-3 font-semibold text-slate-700">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.threat} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="px-5 py-3 text-slate-700 font-medium">{row.threat}</td>
              <td className="px-5 py-3">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    row.protected
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {row.protected ? 'Yes' : 'No'}
                </span>
              </td>
              <td className="px-5 py-3 text-slate-500 font-light">{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

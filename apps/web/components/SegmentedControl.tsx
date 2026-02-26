import Link from 'next/link';

type Segment = {
  value: string;
  label: string;
  href: string;
  activeClassName?: string;
};

type SegmentedControlProps = {
  segments: Segment[];
  value: string;
};

export function SegmentedControl({ segments, value }: SegmentedControlProps) {
  return (
    <div className="bg-white p-1.5 rounded-full border border-gray-200 shadow-sm flex items-center gap-1">
      {segments.map((segment) => {
        const isActive = segment.value === value;
        const activeClass =
          segment.activeClassName ?? 'bg-blue-600 text-white shadow-md';
        return (
          <Link
            key={segment.value}
            href={segment.href}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              isActive ? activeClass : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {segment.label}
          </Link>
        );
      })}
    </div>
  );
}

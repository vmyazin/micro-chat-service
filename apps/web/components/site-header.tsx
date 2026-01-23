"use client";

import { Lock, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-200/50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 cursor-pointer group">
          <div className="w-8 h-8 bg-foreground flex items-center justify-center rounded-sm transition-transform duration-300 group-hover:rotate-45">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl tracking-tight font-semibold italic font-heading text-slate-900">MicroChat</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-10 text-sm font-medium tracking-wide uppercase text-slate-900">
          <Link 
            href="/protocol" 
            className={cn(
              "hover:text-blue-600 transition-colors cursor-pointer",
              pathname === "/protocol" && "text-blue-600"
            )}
          >
            Protocol
          </Link>
          <Link 
            href="/#security" 
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Security
          </Link>
          <Link 
            href="#" 
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Whitepaper
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/chat" className="hidden md:block bg-foreground text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-600 transition-all duration-300 cursor-pointer shadow-lg shadow-black/5 active:scale-95">
            Create Private Group
          </Link>
          <button className="md:hidden">
             <Menu className="w-6 h-6 text-slate-900" />
          </button>
        </div>
      </div>
    </nav>
  );
}

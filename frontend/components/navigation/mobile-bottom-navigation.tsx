"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getMobileUserNavigationItems,
  getUserNavigationUiCopy,
  isUserNavigationItemActive
} from "@/components/navigation/user-navigation";
import type { Locale } from "@/lib/i18n";

export interface MobileBottomNavigationProps {
  currentLocation?: string;
  locale: Locale;
  onMenuOpen: () => void;
  menuOpen?: boolean;
  menuControlsId?: string;
  className?: string;
}

export function MobileBottomNavigation({
  currentLocation,
  locale,
  onMenuOpen,
  menuOpen = false,
  menuControlsId,
  className = ""
}: MobileBottomNavigationProps) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");

  useEffect(() => {
    function updateHash() {
      setCurrentHash(window.location.hash);
    }

    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  const baseLocation = currentLocation ?? pathname ?? "/";
  const resolvedLocation = baseLocation.includes("#") ? baseLocation : `${baseLocation}${currentHash}`;
  const navigationItems = getMobileUserNavigationItems(locale);
  const copy = getUserNavigationUiCopy(locale);

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden ${className}`}
      aria-label={copy.mobileNavigationLabel}
    >
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {navigationItems.map((item) => {
          const active = isUserNavigationItemActive(resolvedLocation, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`focus-ring flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[10px] font-black leading-tight transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.5 : 2} />
              <span className="w-full truncate">{item.shortLabel}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onMenuOpen}
          className={`focus-ring flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black leading-tight transition-colors ${
            menuOpen
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          aria-label={menuOpen ? copy.closeMenuLabel : copy.openMenuLabel}
          aria-expanded={menuOpen}
          aria-controls={menuControlsId}
          aria-haspopup="dialog"
        >
          <Menu aria-hidden="true" size={20} strokeWidth={menuOpen ? 2.5 : 2} />
          <span>{copy.menuLabel}</span>
        </button>
      </div>
    </nav>
  );
}

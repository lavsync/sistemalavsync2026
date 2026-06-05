"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { NAVIGATION, NAV_GROUPS, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { SessionUser } from "./types";

const STORAGE_KEY = "lavsync.sidebar.collapsed";

const widthExpanded = 264;
const widthCollapsed = 80;

export function Sidebar({
  user,
  signOutSlot,
}: {
  user: SessionUser;
  signOutSlot: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  // Persistence
  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "1") setCollapsed(true);
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? widthCollapsed : widthExpanded }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="hidden lg:block shrink-0 sticky top-4 h-[calc(100vh-32px)] ml-4 my-4 z-30"
      style={{ willChange: "width" }}
    >
      <div
        className="sidebar-shell relative h-full w-full rounded-[28px] overflow-hidden flex flex-col"
        style={{ borderRadius: 28 }}
      >
        {/* z-2 wrapper above ::before/::after layers */}
        <div className="relative z-[2] flex flex-col h-full">
          <BrandHeader collapsed={collapsed} />

          <CollapseToggle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

          <Nav pathname={pathname} collapsed={collapsed} />

          <UserCard collapsed={collapsed} user={user} signOutSlot={signOutSlot} />
        </div>
      </div>
    </motion.aside>
  );
}

/* ============ BRAND HEADER ============ */
function BrandHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={collapsed ? "px-3 pt-6 pb-4" : "px-5 pt-6 pb-4"}>
      <Link
        href="/"
        className="flex flex-col items-center group"
        aria-label="LavSync · Início"
      >
        {collapsed ? (
          // Collapsed: símbolo isolado em destaque (~60px)
          <div className="relative w-14 h-14 flex items-center justify-center sidebar-logo-glow rounded-2xl">
            <Image
              src="/brand/logo/lavsync-simbolo.png"
              alt="LavSync"
              width={120}
              height={120}
              priority
              className="w-12 h-12 object-contain"
            />
          </div>
        ) : (
          // Expanded: logo vertical branco oficial — bem grande, destaque máximo
          <Image
            src="/brand/logo/lavsync-vertical-branco.png"
            alt="LavSync"
            width={400}
            height={460}
            priority
            className="h-32 w-auto object-contain drop-shadow-[0_4px_24px_rgba(25,199,203,0.25)]"
          />
        )}
      </Link>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="brand-tagline"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-3 text-center text-[9.5px] uppercase tracking-[0.22em] font-semibold text-brand-cyan/80"
          >
            Operations OS · v1.0
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============ COLLAPSE TOGGLE ============ */
function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="px-4 -mt-1 mb-3">
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        className="group w-full h-9 rounded-xl flex items-center justify-center gap-2 text-[11px] font-semibold text-white/55 hover:text-white/90 transition-colors duration-200"
        style={{ background: "rgba(255,255,255,0.025)" }}
      >
        <motion.div
          animate={{ rotate: collapsed ? 0 : 0 }}
          className="flex items-center justify-center"
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4" />
          ) : (
            <ChevronsLeft className="w-4 h-4" />
          )}
        </motion.div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="uppercase tracking-[0.18em] overflow-hidden whitespace-nowrap"
            >
              Recolher
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}

/* ============ NAV ============ */
function Nav({
  pathname,
  collapsed,
}: {
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <nav className="flex-1 px-3 overflow-y-auto overflow-x-hidden custom-scroll-thin space-y-2 pb-2">
      {NAV_GROUPS.map((group) => {
        const items = NAVIGATION.filter((n) => n.group === group.key);
        return (
          <div key={group.key} className="space-y-1">
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="px-4 pb-1 sidebar-group-label overflow-hidden"
                >
                  {group.label}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space-y-1">
              {items.map((item) => (
                <NavPill
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/* ============ NAV PILL ============ */
function NavPill({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const pillRef = React.useRef<HTMLAnchorElement>(null);

  // Cursor-following glow on hover
  const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
    const el = pillRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--x", `${x}%`);
    el.style.setProperty("--y", `${y}%`);
  }, []);

  const content = (
    <Link
      ref={pillRef}
      href={item.href}
      onMouseMove={handleMouseMove}
      className={cn(
        "sidebar-pill group relative flex items-center overflow-hidden select-none",
        "rounded-[16px] h-[42px]",
        collapsed ? "justify-center" : "px-4 gap-3",
        active ? "sidebar-pill-active" : "text-white/65 hover:text-white"
      )}
      style={{
        transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), color 200ms",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.transform = "translateX(2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateX(0)";
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateX(2px) scale(0.985)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateX(2px)";
      }}
    >
      {/* Inner highlight when active */}
      {active && <span className="pill-shine" />}

      {/* Hover glow that follows cursor */}
      {!active && <span className="sidebar-pill-hover-glow" />}

      {/* Subtle dot anchor (replaces icon) */}
      <span
        className={cn(
          "relative z-[2] shrink-0 rounded-full transition-all duration-300",
          collapsed ? "w-2 h-2" : "w-1.5 h-1.5",
          active
            ? "bg-white shadow-[0_0_12px_rgba(255,255,255,0.85)]"
            : item.accent
            ? "bg-brand-cyan shadow-[0_0_10px_rgba(34,211,238,0.7)]"
            : "bg-white/35 group-hover:bg-white/70 group-hover:shadow-[0_0_8px_rgba(255,255,255,0.4)]"
        )}
      />

      {/* Label */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative z-[2] flex-1 min-w-0 truncate text-[13.5px] tracking-tight",
              active ? "font-semibold" : "font-medium"
            )}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Badge */}
      {item.badge && !collapsed && (
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22 }}
          className={cn(
            "relative z-[2] shrink-0 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[10px] font-bold rounded-full",
            active
              ? "bg-white/22 text-white"
              : item.accent
              ? "bg-brand-cyan/15 text-brand-cyan"
              : "bg-white/8 text-white/70"
          )}
        >
          {item.badge}
        </motion.span>
      )}
    </Link>
  );

  // Tooltip when collapsed
  if (!collapsed) return content;
  return <TooltipWrapper label={item.label} badge={item.badge}>{content}</TooltipWrapper>;
}

/* ============ TOOLTIP (collapsed state) ============ */
function TooltipWrapper({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute left-[100%] ml-3 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap"
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white"
              style={{
                background: "rgba(15, 23, 42, 0.92)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 12px 32px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.18)",
              }}
            >
              {label}
              {badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-white/80">
                  {badge}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============ USER CARD (footer) ============ */
function UserCard({
  collapsed,
  user,
  signOutSlot,
}: {
  collapsed: boolean;
  user: SessionUser;
  signOutSlot: React.ReactNode;
}) {
  return (
    <div className="p-3 mt-auto">
      <div
        className="relative rounded-2xl overflow-hidden flex items-center gap-3 p-2.5"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          backdropFilter: "blur(14px)",
        }}
      >
        {/* Avatar — gradient oficial LavSync */}
        <div className="relative shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold text-white shadow-[0_6px_18px_-6px_rgba(25,199,203,0.6)]"
            style={{
              background:
                "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)",
            }}
          >
            {user.initials}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2"
            style={{ borderColor: "#0A1322" }}
            aria-label="Online"
          />
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="user-info"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-w-0"
            >
              <div className="text-[12.5px] font-semibold text-white leading-none truncate">
                {user.name}
              </div>
              <div className="text-[10px] mt-1 text-white/45 truncate uppercase tracking-[0.12em]">
                {user.role}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!collapsed && signOutSlot}
      </div>
    </div>
  );
}

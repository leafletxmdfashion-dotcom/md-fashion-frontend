"use client";

import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Layers,
  LogOut,
  Moon,
  PackagePlus,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { hasPermission } from "@/features/auth/lib/permissions";
import { FabricFormDialog } from "@/features/fabric/components/fabric-form-dialog";
import { InwardFormDialog } from "@/features/fabric/components/inward-form-dialog";
import { useFabricOptions } from "@/features/fabric/hooks/use-fabric";
import { formatQty } from "@/features/fabric/lib/format";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/types/navigation";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

const GROUP_ORDER = ["Actions", "Fabrics", "Pages", "Account"];
const FABRIC_LIMIT = 6;

/** Ranks a command for the query: label prefix > word prefix > anywhere in label/keywords. 0 = no match. */
function score(command: Command, query: string): number {
  const label = command.label.toLowerCase();
  if (label.startsWith(query)) return 3;
  if (label.split(/[\s/·-]+/).some((word) => word.startsWith(query))) return 2;
  return `${label} ${command.hint ?? ""} ${command.keywords ?? ""}`.toLowerCase().includes(query) ? 1 : 0;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

/**
 * Sidebar search and command palette (Ctrl/⌘ + K): jump to any permitted page,
 * open a fabric's ledger by name or code, or run a quick action.
 */
export function CommandMenu({ groups }: { groups: NavGroup[] }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { data: user } = useCurrentUser();
  const { resolvedTheme, setTheme } = useTheme();
  const { mutate: logout } = useLogout();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [dialog, setDialog] = useState<{ kind: "purchase" | "fabric"; key: number } | null>(null);
  const listId = useId();
  // Rendered client-side only (the shell waits for the session), so navigator is safe here.
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

  const canViewFabric = hasPermission(user, "fabric.view");
  // Loaded the first time the palette opens, then served from cache.
  const fabrics = useFabricOptions({ enabled: open && canViewFabric });

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  const commands = useMemo<Command[]>(() => {
    const navigate = (href: string) => () => {
      setOpenMobile(false);
      router.push(href);
    };
    const list: Command[] = [];
    if (hasPermission(user, "fabric.inward")) {
      list.push({
        id: "action:purchase",
        group: "Actions",
        label: "Record fabric purchase",
        hint: "Purchase / Inward",
        icon: PackagePlus,
        keywords: "inward buy new",
        run: () => setDialog({ kind: "purchase", key: Date.now() }),
      });
    }
    if (hasPermission(user, "fabric.manage")) {
      list.push({
        id: "action:fabric",
        group: "Actions",
        label: "Add new fabric",
        hint: "Fabric Master",
        icon: Plus,
        keywords: "create fabric master",
        run: () => setDialog({ kind: "fabric", key: Date.now() }),
      });
    }
    const dark = resolvedTheme === "dark";
    list.push({
      id: "action:theme",
      group: "Actions",
      label: dark ? "Switch to light theme" : "Switch to dark theme",
      icon: dark ? Sun : Moon,
      keywords: "theme appearance mode",
      run: () => setTheme(dark ? "light" : "dark"),
    });

    for (const group of groups) {
      for (const item of group.items) {
        if (!item.href) continue;
        list.push({
          id: `page:${item.href}`,
          group: "Pages",
          label: item.title,
          hint: item.description ? `${group.title} · coming soon` : group.title,
          icon: item.icon,
          run: navigate(item.href),
        });
      }
    }

    for (const fabric of fabrics.data ?? []) {
      list.push({
        id: `fabric:${fabric.id}`,
        group: "Fabrics",
        label: fabric.name,
        hint: `${fabric.code} · ${formatQty(fabric.balance, fabric.unit)}${fabric.isActive ? "" : " · inactive"}`,
        icon: Layers,
        keywords: fabric.code,
        run: navigate(`/fabric/ledger?fabric=${fabric.id}`),
      });
    }

    list.push(
      {
        id: "account",
        group: "Account",
        label: "Account",
        icon: UserRound,
        keywords: "profile",
        run: navigate("/account"),
      },
      {
        id: "security",
        group: "Account",
        label: "Security",
        icon: ShieldCheck,
        keywords: "password sessions",
        run: navigate("/account/security"),
      },
      { id: "logout", group: "Account", label: "Log out", icon: LogOut, keywords: "sign out", run: () => logout() },
    );
    return list;
  }, [groups, fabrics.data, user, resolvedTheme, setTheme, router, setOpenMobile, logout]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    // Without a query: actions, pages and account (fabrics appear once you type).
    const matched = q
      ? commands
          .map((command) => ({ command, rank: score(command, q) }))
          .filter((entry) => entry.rank > 0)
          .sort((a, b) => b.rank - a.rank)
          .map((entry) => entry.command)
      : commands.filter((command) => command.group !== "Fabrics");
    const sections = GROUP_ORDER.map((group) => {
      const items = matched.filter((command) => command.group === group);
      return { group, items: group === "Fabrics" ? items.slice(0, FABRIC_LIMIT) : items };
    }).filter((section) => section.items.length > 0);
    return { sections, flat: sections.flatMap((section) => section.items) };
  }, [commands, q]);

  const selected = Math.min(active, Math.max(results.flat.length - 1, 0));

  useEffect(() => {
    document.getElementById(`${listId}-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [listId, selected]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const runCommand = (command: Command | undefined) => {
    if (!command) return;
    close();
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = results.flat.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: selected >= last ? 0 : selected + 1,
      ArrowUp: selected <= 0 ? last : selected - 1,
      Home: 0,
      End: last,
      PageDown: Math.min(selected + 5, last),
      PageUp: Math.max(selected - 5, 0),
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]!);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runCommand(results.flat[selected]);
    }
  };

  const positions = new Map(results.flat.map((command, position) => [command.id, position]));

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            variant="outline"
            tooltip={`Search (${shortcut})`}
            onClick={() => setOpen(true)}
            className="h-9 gap-2.5 bg-sidebar px-2.5 text-muted-foreground shadow-[0_0_0_1px_var(--sidebar-border)] hover:text-foreground"
          >
            <Search />
            <span className="flex-1">Search…</span>
            <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground">
              {shortcut}
            </kbd>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent
          showCloseButton={false}
          className="top-[12vh] flex max-h-[min(640px,76vh)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">Search and commands</DialogTitle>
          <DialogDescription className="sr-only">
            Type to search pages, fabrics and actions. Use the arrow keys to move and Enter to open.
          </DialogDescription>
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={results.flat[selected] ? `${listId}-${selected}` : undefined}
              aria-label="Search pages, fabrics and actions"
              placeholder={
                canViewFabric ? "Search pages, fabrics by name or code, actions…" : "Search pages and actions…"
              }
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <Kbd>Esc</Kbd>
          </div>

          <div id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
            {results.flat.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium">No results for “{query.trim()}”</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {fabrics.isFetching ? "Still loading fabrics…" : "Try a page name, fabric code or action."}
                </p>
              </div>
            ) : (
              results.sections.map((section) => (
                <div key={section.group} role="group" aria-label={section.group} className="pb-1.5 last:pb-0">
                  <p className="px-3 pt-2 pb-1.5 text-xs font-medium text-muted-foreground">{section.group}</p>
                  {section.items.map((command) => {
                    const position = positions.get(command.id)!;
                    const Icon = command.icon;
                    const isActive = position === selected;
                    return (
                      <div
                        key={command.id}
                        id={`${listId}-${position}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => setActive(position)}
                        onClick={() => runCommand(command)}
                        className={cn(
                          "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm",
                          isActive && "bg-accent text-accent-foreground",
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0 text-muted-foreground", isActive && "text-link")} />
                        <span className="truncate font-medium">{command.label}</span>
                        {command.hint ? (
                          <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">{command.hint}</span>
                        ) : null}
                        <CornerDownLeft
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground",
                            !command.hint && "ml-auto",
                            !isActive && "invisible",
                          )}
                          aria-hidden
                        />
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Kbd>
                <ArrowUp className="size-3" aria-label="Up" />
              </Kbd>
              <Kbd>
                <ArrowDown className="size-3" aria-label="Down" />
              </Kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>
                <CornerDownLeft className="size-3" aria-label="Enter" />
              </Kbd>
              Open
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <Kbd>Esc</Kbd>
              Close
            </span>
            <span className="ml-auto tabular-nums" aria-live="polite">
              {results.flat.length} result{results.flat.length === 1 ? "" : "s"}
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {dialog?.kind === "purchase" ? (
        <InwardFormDialog key={dialog.key} open onOpenChange={(next) => (next ? undefined : setDialog(null))} />
      ) : null}
      {dialog?.kind === "fabric" ? (
        <FabricFormDialog key={dialog.key} open onOpenChange={(next) => (next ? undefined : setDialog(null))} />
      ) : null}
    </>
  );
}

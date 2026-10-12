"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { NavGroup, NavSubItem } from "@/types/navigation";

// Muted icons that take the accent colour when their page is open.
const itemClass =
  "h-9 gap-3 px-2.5 text-sm text-sidebar-foreground 2xl:h-10 2xl:text-[15px] 2xl:[&_svg]:size-5 [&_svg]:text-muted-foreground hover:[&_svg]:text-sidebar-accent-foreground data-active:[&_svg]:text-link";

function matches(pathname: string, href: string, exact = false) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

/** Most specific sibling wins, so /inventory/movements does not also light up /inventory. */
function activeSubHref(pathname: string, items: NavSubItem[]) {
  return items.filter((item) => matches(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Renders already permission-filtered navigation (see filterNavigation). */
export function NavMain({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const { setOpenMobile, state, isMobile } = useSidebar();
  // ponytail: folded groups reset on reload; persist them if people ask.
  const [folded, setFolded] = useState<Set<string>>(new Set());
  // The mobile sheet stays open across client navigations unless closed explicitly.
  const closeMobile = () => setOpenMobile(false);
  const iconOnly = state === "collapsed" && !isMobile;

  return groups.map((group, index) => {
    const key = group.title ?? String(index);
    // Collapsed rail: every group stays open, labels give way to dashed dividers.
    const open = iconOnly || !folded.has(key);
    const toggle = () =>
      setFolded((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });

    return (
      <Collapsible
        key={key}
        open={open}
        onOpenChange={toggle}
        render={
          <SidebarGroup
            className={cn(
              "px-2 py-1.5",
              index > 0 &&
                "before:mx-2.5 before:mb-1.5 before:block before:border-t before:border-dashed before:border-sidebar-border",
            )}
          />
        }
      >
        {group.title ? (
          <SidebarGroupLabel
            render={<CollapsibleTrigger />}
            className="group/label h-7 w-full cursor-pointer gap-1 group-data-[collapsible=icon]:hidden px-2.5 text-[13px] font-medium text-muted-foreground hover:text-sidebar-accent-foreground 2xl:text-sm"
          >
            <ChevronDown
              className="size-3.5! transition-transform group-data-[panel-open]/label:rotate-0 -rotate-90"
              aria-hidden
            />
            {group.title}
          </SidebarGroupLabel>
        ) : null}
        <CollapsibleContent>
          <SidebarMenu className="gap-0.5 pt-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;

              if (item.items) {
                const activeChild = activeSubHref(pathname, item.items);
                return (
                  <Collapsible key={item.title} defaultOpen={Boolean(activeChild)} render={<SidebarMenuItem />}>
                    <CollapsibleTrigger
                      render={<SidebarMenuButton tooltip={item.title} className={cn("group/collapsible", itemClass)} />}
                    >
                      <Icon />
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform group-data-panel-open/collapsible:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((sub) => (
                          <SidebarMenuSubItem key={sub.href}>
                            <SidebarMenuSubButton
                              size="md"
                              isActive={sub.href === activeChild}
                              render={<Link href={sub.href} onClick={closeMobile} />}
                            >
                              <span>{sub.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              if (!item.href) return null;
              const isActive = matches(pathname, item.href, item.exact);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    className={itemClass}
                    tooltip={item.title}
                    isActive={isActive}
                    render={
                      <Link href={item.href} onClick={closeMobile} aria-current={isActive ? "page" : undefined} />
                    }
                  >
                    <Icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    );
  });
}

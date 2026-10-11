"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

// Readable labels that step up on large screens; muted icons turn brand red when active.
const itemClass =
  "h-9 gap-3 px-3 text-sm text-foreground/85 2xl:h-10 2xl:text-[15px] 2xl:[&_svg]:size-5 [&_svg]:text-muted-foreground data-active:[&_svg]:text-link";

function matches(pathname: string, href: string, exact = false) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

/** Most specific sibling wins, so /inventory/movements does not also light up /inventory. */
function activeSubHref(pathname: string, items: NavSubItem[]) {
  return items
    .filter((item) => matches(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Renders already permission-filtered navigation (see filterNavigation). */
export function NavMain({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  // The mobile sheet stays open across client navigations unless closed explicitly.
  const closeMobile = () => setOpenMobile(false);

  return groups.map((group, index) => (
    <SidebarGroup key={group.title ?? index} className="py-2">
      {group.title ? (
        <SidebarGroupLabel className="h-7 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase 2xl:text-xs">
          {group.title}
        </SidebarGroupLabel>
      ) : null}
      <SidebarMenu className="gap-0.5">
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
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                className={itemClass}
                tooltip={item.title}
                isActive={matches(pathname, item.href, item.exact)}
                render={<Link href={item.href} onClick={closeMobile} />}
              >
                <Icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  ));
}

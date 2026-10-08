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
} from "@/components/ui/sidebar";
import type { NavGroup, NavSubItem } from "@/types/navigation";

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

  return groups.map((group, index) => (
    <SidebarGroup key={group.title ?? index} className="py-1">
      {group.title ? <SidebarGroupLabel className="h-7 text-xs">{group.title}</SidebarGroupLabel> : null}
      <SidebarMenu className="gap-px">
        {group.items.map((item) => {
          const Icon = item.icon;

          if (item.items) {
            const activeChild = activeSubHref(pathname, item.items);
            return (
              <Collapsible key={item.title} defaultOpen={Boolean(activeChild)} render={<SidebarMenuItem />}>
                <CollapsibleTrigger
                  render={<SidebarMenuButton size="sm" tooltip={item.title} className="group/collapsible text-[13px]" />}
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
                          size="sm"
                          isActive={sub.href === activeChild}
                          render={<Link href={sub.href} />}
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
                size="sm"
                className="text-[13px]"
                tooltip={item.title}
                isActive={matches(pathname, item.href, item.exact)}
                render={<Link href={item.href} />}
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

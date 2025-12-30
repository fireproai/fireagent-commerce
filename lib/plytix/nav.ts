import "server-only";

import fs from "fs/promises";
import path from "path";

import { slugify } from "./slug";

export type PlytixNavRow = {
  SKU: string;
  nav_root: string;
  nav_group: string;
  nav_group_1?: string;
  nav_group_2?: string;
  nav_group_3?: string;
};

export type NavGroupLevel = {
  name: string;
  items: string[];
  children?: Record<string, NavGroupLevel>;
};

export type NavRoot = {
  name: string;
  groups: NavGroupLevel[];
};

export type NavTree = NavRoot[];

export type NavSlugMap = {
  roots: Array<{
    label: string;
    slug: string;
    skuCount: number;
    groups: Array<{
      label: string;
      slug: string;
      skuCount: number;
      items: Array<{
        label: string;
        slug: string;
        skuCount: number;
        items: Array<{
          label: string;
          slug: string;
          skuCount: number;
          items: Array<{
            label: string;
            slug: string;
            skuCount: number;
          }>;
        }>;
      }>;
    }>;
  }>;
  lookup: {
    rootBySlug: Record<string, string>;
    groupBySlug: Record<string, Record<string, string>>;
    group1BySlug: Record<string, Record<string, Record<string, string>>>;
    group2BySlug: Record<string, Record<string, Record<string, Record<string, string>>>>;
    group3BySlug: Record<
      string,
      Record<string, Record<string, Record<string, Record<string, string>>>>
    >;
  };
};

const NAV_REVALIDATE_SECONDS = 600;
const SAMPLE_PATH = path.join(process.cwd(), "data", "samples", "plytix_nav.sample.json");

function sanitizeRows(data: unknown[]): PlytixNavRow[] {
  return data.flatMap((raw) => {
    if (typeof raw !== "object" || raw === null) return [];

  const record = raw as Record<string, unknown>;
  const SKU = typeof record.SKU === "string" ? record.SKU.trim() : "";
  const nav_root = typeof record.nav_root === "string" ? record.nav_root.trim() : "";
  const nav_group = typeof record.nav_group === "string" ? record.nav_group.trim() : "";
  const nav_group_1 =
    typeof record.nav_group_1 === "string" ? record.nav_group_1.trim() : undefined;
  const nav_group_2 =
    typeof record.nav_group_2 === "string" ? record.nav_group_2.trim() : undefined;
  const nav_group_3 =
    typeof record.nav_group_3 === "string" ? record.nav_group_3.trim() : undefined;

  if (!SKU || !nav_root || !nav_group) return [];

  const sanitized: PlytixNavRow = { SKU, nav_root, nav_group };
  if (nav_group_1) sanitized.nav_group_1 = nav_group_1;
  if (nav_group_2) sanitized.nav_group_2 = nav_group_2;
  if (nav_group_3) sanitized.nav_group_3 = nav_group_3;
  return [sanitized];
});
}

async function loadRemoteRows(url: string): Promise<PlytixNavRow[]> {
  try {
    const response = await fetch(url, { next: { revalidate: NAV_REVALIDATE_SECONDS } });
    if (!response.ok) return [];
    const json = await response.json();
    if (!Array.isArray(json)) return [];
    return sanitizeRows(json);
  } catch {
    return [];
  }
}

async function loadLocalRows(): Promise<PlytixNavRow[]> {
  try {
    const json = await fs.readFile(SAMPLE_PATH, "utf-8");
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return sanitizeRows(parsed);
  } catch {
    return [];
  }
}

function buildNavTree(rows: PlytixNavRow[]): NavTree {
  const roots = new Map<
    string,
    {
      order: number;
      groups: Map<
        string,
        {
          order: number;
          items: Set<string>;
          children: Map<
            string,
            { order: number; items: Set<string>; children: Map<string, { order: number; items: Set<string> }> }
          >;
        }
      >;
    }
  >();

  rows.forEach((row, rowIndex) => {
    if (!roots.has(row.nav_root)) {
      roots.set(row.nav_root, { order: rowIndex, groups: new Map() });
    }
    const rootEntry = roots.get(row.nav_root)!;

    if (!rootEntry.groups.has(row.nav_group)) {
      rootEntry.groups.set(row.nav_group, {
        order: rowIndex,
        items: new Set(),
        children: new Map(),
      });
    }
    const groupEntry = rootEntry.groups.get(row.nav_group)!;

    if (row.nav_group_1) {
      groupEntry.items.add(row.nav_group_1);

      if (!groupEntry.children.has(row.nav_group_1)) {
        groupEntry.children.set(row.nav_group_1, {
          order: rowIndex,
          items: new Set(),
          children: new Map(),
        });
      }
      const group1Entry = groupEntry.children.get(row.nav_group_1)!;

      if (row.nav_group_2) {
        group1Entry.items.add(row.nav_group_2);

        if (!group1Entry.children.has(row.nav_group_2)) {
          group1Entry.children.set(row.nav_group_2, { order: rowIndex, items: new Set() });
        }
        const group2Entry = group1Entry.children.get(row.nav_group_2)!;

        if (row.nav_group_3) {
          group2Entry.items.add(row.nav_group_3);
        }
      }
    }
  });

  return Array.from(roots.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([rootName, rootData]) => ({
      name: rootName,
      groups: Array.from(rootData.groups.entries())
        .sort((a, b) => a[1].order - b[1].order)
        .map(([groupName, groupData]) => ({
          name: groupName,
          items: Array.from(groupData.items),
          children: Object.fromEntries(
            Array.from(groupData.children.entries())
              .sort((a, b) => a[1].order - b[1].order)
              .map(([group1Name, group1Data]) => [
                group1Name,
                {
                  name: group1Name,
                  items: Array.from(group1Data.items),
                  children: Object.fromEntries(
                    Array.from(group1Data.children.entries())
                      .sort((a, b) => a[1].order - b[1].order)
                      .map(([group2Name, group2Data]) => [
                        group2Name,
                        {
                          name: group2Name,
                          items: Array.from(group2Data.items),
                        },
                      ]),
                  ),
                },
              ]),
          ),
        })),
    }));
}

function buildSlugMap(tree: NavTree, rows: PlytixNavRow[]): NavSlugMap {
  const rootBySlug: Record<string, string> = {};
  const groupBySlug: Record<string, Record<string, string>> = {};
  const group1BySlug: Record<string, Record<string, Record<string, string>>> = {};
  const group2BySlug: Record<string, Record<string, Record<string, Record<string, string>>>> = {};
  const group3BySlug: Record<
    string,
    Record<string, Record<string, Record<string, Record<string, string>>>>
  > = {};

  const roots = tree.map((root) => {
    const rootSlug = slugify(root.name);
    rootBySlug[rootSlug] = root.name;

    const rootRows = rows.filter((row) => row.nav_root === root.name);
    const groups = root.groups.map((group) => {
      const groupSlug = slugify(group.name);
      if (!groupBySlug[rootSlug]) groupBySlug[rootSlug] = {};
      groupBySlug[rootSlug][groupSlug] = group.name;

      const groupRows = rootRows.filter((row) => row.nav_group === group.name);
      const group2ForRoot =
        (group2BySlug[rootSlug] = group2BySlug[rootSlug] || {})[groupSlug] ||
        (group2BySlug[rootSlug][groupSlug] = {});
      const group3ForRoot =
        (group3BySlug[rootSlug] = group3BySlug[rootSlug] || {})[groupSlug] ||
        (group3BySlug[rootSlug][groupSlug] = {});

      const items = group.items.map((item) => {
        const itemSlug = slugify(item);
        if (!group1BySlug[rootSlug]) group1BySlug[rootSlug] = {};
        if (!group1BySlug[rootSlug][groupSlug]) group1BySlug[rootSlug][groupSlug] = {};
        group1BySlug[rootSlug][groupSlug][itemSlug] = item;

        const itemRows = groupRows.filter((row) => row.nav_group_1 === item);
        const group2Lookup = (group2ForRoot[itemSlug] = group2ForRoot[itemSlug] || {});
        const group3Lookup = (group3ForRoot[itemSlug] = group3ForRoot[itemSlug] || {});
        const group1Child = group.children?.[item];

        const items2 = (group1Child?.items || []).map((item2) => {
          const item2Slug = slugify(item2);
          group2Lookup[item2Slug] = item2;

          const item2Rows = itemRows.filter((row) => row.nav_group_2 === item2);
          const item3Lookup = (group3Lookup[item2Slug] = group3Lookup[item2Slug] || {});
          const item2Child = group1Child?.children?.[item2];

          const items3 = (item2Child?.items || []).map((item3) => {
            const item3Slug = slugify(item3);
            item3Lookup[item3Slug] = item3;

            const item3Rows = item2Rows.filter((row) => row.nav_group_3 === item3);
            return { label: item3, slug: item3Slug, skuCount: item3Rows.length };
          });

          return { label: item2, slug: item2Slug, skuCount: item2Rows.length, items: items3 };
        });

        return { label: item, slug: itemSlug, skuCount: itemRows.length, items: items2 };
      });

      return { label: group.name, slug: groupSlug, skuCount: groupRows.length, items };
    });

    return { label: root.name, slug: rootSlug, skuCount: rootRows.length, groups };
  });

  return {
    roots,
    lookup: { rootBySlug, groupBySlug, group1BySlug, group2BySlug, group3BySlug },
  };
}

export async function getNavData(): Promise<{ rows: PlytixNavRow[]; tree: NavTree; slugMap: NavSlugMap }> {
  const feedUrl = process.env.PLYTIX_NAV_FEED_URL;
  const rows = feedUrl ? await loadRemoteRows(feedUrl) : await loadLocalRows();
  const tree = buildNavTree(rows);
  const slugMap = buildSlugMap(tree, rows);
  return { rows, tree, slugMap };
}

export async function getNavTree(): Promise<NavTree> {
  const { tree } = await getNavData();
  return tree;
}

export { NAV_REVALIDATE_SECONDS };

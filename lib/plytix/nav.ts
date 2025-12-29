import "server-only";

import fs from "fs/promises";
import path from "path";

import { slugify } from "./slug";

export type PlytixNavRow = {
  SKU: string;
  nav_root: string;
  nav_group: string;
  nav_group_1?: string;
};

export type NavGroup = {
  name: string;
  items: string[];
};

export type NavRoot = {
  name: string;
  groups: NavGroup[];
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
      }>;
    }>;
  }>;
  lookup: {
    rootBySlug: Record<string, string>;
    groupBySlug: Record<string, Record<string, string>>;
    group1BySlug: Record<string, Record<string, Record<string, string>>>;
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

    if (!SKU || !nav_root || !nav_group) return [];

    const sanitized: PlytixNavRow = { SKU, nav_root, nav_group };
    if (nav_group_1) sanitized.nav_group_1 = nav_group_1;
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
  const roots = new Map<string, { order: number; groups: Map<string, { order: number; items: string[] }> }>();

  rows.forEach((row, rowIndex) => {
    if (!roots.has(row.nav_root)) {
      roots.set(row.nav_root, { order: rowIndex, groups: new Map() });
    }
    const rootEntry = roots.get(row.nav_root)!;

    if (!rootEntry.groups.has(row.nav_group)) {
      rootEntry.groups.set(row.nav_group, { order: rowIndex, items: [] });
    }
    const groupEntry = rootEntry.groups.get(row.nav_group)!;

    if (row.nav_group_1 && !groupEntry.items.includes(row.nav_group_1)) {
      groupEntry.items.push(row.nav_group_1);
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
          items: groupData.items,
        })),
    }));
}

function buildSlugMap(tree: NavTree, rows: PlytixNavRow[]): NavSlugMap {
  const rootBySlug: Record<string, string> = {};
  const groupBySlug: Record<string, Record<string, string>> = {};
  const group1BySlug: Record<string, Record<string, Record<string, string>>> = {};

  const roots = tree.map((root) => {
    const rootSlug = slugify(root.name);
    rootBySlug[rootSlug] = root.name;

    const rootRows = rows.filter((row) => row.nav_root === root.name);
    const groups = root.groups.map((group) => {
      const groupSlug = slugify(group.name);
      if (!groupBySlug[rootSlug]) groupBySlug[rootSlug] = {};
      groupBySlug[rootSlug][groupSlug] = group.name;

      const groupRows = rootRows.filter((row) => row.nav_group === group.name);
      const items = group.items.map((item) => {
        const itemSlug = slugify(item);
        if (!group1BySlug[rootSlug]) group1BySlug[rootSlug] = {};
        if (!group1BySlug[rootSlug][groupSlug]) group1BySlug[rootSlug][groupSlug] = {};
        group1BySlug[rootSlug][groupSlug][itemSlug] = item;

        const itemRows = groupRows.filter((row) => row.nav_group_1 === item);
        return { label: item, slug: itemSlug, skuCount: itemRows.length };
      });

      return { label: group.name, slug: groupSlug, skuCount: groupRows.length, items };
    });

    return { label: root.name, slug: rootSlug, skuCount: rootRows.length, groups };
  });

  return {
    roots,
    lookup: { rootBySlug, groupBySlug, group1BySlug },
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

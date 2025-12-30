import fs from "node:fs/promises";
import path from "node:path";

export type PimNavItem = { slug: string; label: string; skuCount: number; items: PimNavItem[] };
export type PimNavGroup = { slug: string; label: string; skuCount: number; items: PimNavItem[] };
export type PimNavRoot = { slug: string; label: string; skuCount: number; groups: PimNavGroup[] };

type RawNav = { tree?: unknown; slug_map?: unknown; updated_at?: string };
type RawNode = Record<string, unknown>;

export type PimSlugLookup = {
  rootBySlug: Record<string, string>;
  groupBySlug: Record<string, Record<string, string>>;
  group1BySlug: Record<string, Record<string, Record<string, string>>>;
  group2BySlug: Record<string, Record<string, Record<string, Record<string, string>>>>;
  group3BySlug: Record<string, Record<string, Record<string, Record<string, Record<string, string>>>>>;
};

export type PimNav = {
  tree: PimNavRoot[];
  slug_map: { roots: PimNavRoot[]; lookup: PimSlugLookup };
  updated_at?: string;
};

export const PIM_NAV_PATH = path.join(process.cwd(), "data", "pim", "nav.json");
export const PIM_SAMPLE_PATH = path.join(process.cwd(), "data", "samples", "plytix_nav.sample.json");

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asLabel(node: RawNode): string {
  const label = node.label ?? node.name ?? node.title ?? "";
  return typeof label === "string" ? label : "";
}

function asSlug(node: RawNode): string {
  const slug = node.slug ?? "";
  return typeof slug === "string" ? slug : "";
}

function normalizeItems(raw: unknown): PimNavItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const node = (item ?? {}) as RawNode;
      const slug = asSlug(node);
      const label = asLabel(node);

      return {
        slug,
        label,
        skuCount: asNumber(node.skuCount),
        items: normalizeItems(node.items),
      };
    })
    .filter((item) => item.slug && item.label);
}

function normalizeGroups(raw: unknown): PimNavGroup[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((group) => {
      const node = (group ?? {}) as RawNode;
      const slug = asSlug(node);
      const label = asLabel(node);

      return {
        slug,
        label,
        skuCount: asNumber(node.skuCount),
        items: normalizeItems(node.items),
      };
    })
    .filter((group) => group.slug && group.label);
}

function normalizeRoots(raw: unknown): PimNavRoot[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((root) => {
      const node = (root ?? {}) as RawNode;
      const slug = asSlug(node);
      const label = asLabel(node);

      return {
        slug,
        label,
        skuCount: asNumber(node.skuCount),
        groups: normalizeGroups(node.groups),
      };
    })
    .filter((root) => root.slug && root.label);
}

export function buildLookup(tree: PimNavRoot[]): PimSlugLookup {
  const rootBySlug: Record<string, string> = {};
  const groupBySlug: Record<string, Record<string, string>> = {};
  const group1BySlug: Record<string, Record<string, Record<string, string>>> = {};
  const group2BySlug: Record<string, Record<string, Record<string, Record<string, string>>>> = {};
  const group3BySlug: Record<
    string,
    Record<string, Record<string, Record<string, Record<string, string>>>>
  > = {};

  tree.forEach((root) => {
    rootBySlug[root.slug] = root.label;
    const groupsForRoot = (groupBySlug[root.slug] = groupBySlug[root.slug] || {});
    const group1ForRoot = (group1BySlug[root.slug] = group1BySlug[root.slug] || {});
    const group2ForRoot = (group2BySlug[root.slug] = group2BySlug[root.slug] || {});
    const group3ForRoot = (group3BySlug[root.slug] = group3BySlug[root.slug] || {});

    root.groups.forEach((group) => {
      groupsForRoot[group.slug] = group.label;
      const group1ForGroup = (group1ForRoot[group.slug] = group1ForRoot[group.slug] || {});
      const group2ForGroup = (group2ForRoot[group.slug] = group2ForRoot[group.slug] || {});
      const group3ForGroup = (group3ForRoot[group.slug] = group3ForRoot[group.slug] || {});

      group.items.forEach((item) => {
        group1ForGroup[item.slug] = item.label;
        const group2ForItem = (group2ForGroup[item.slug] = group2ForGroup[item.slug] || {});
        const group3ForItem = (group3ForGroup[item.slug] = group3ForGroup[item.slug] || {});

        item.items.forEach((item2) => {
          group2ForItem[item2.slug] = item2.label;
          const group3ForItem2 = (group3ForItem[item2.slug] = group3ForItem[item2.slug] || {});

          item2.items.forEach((item3) => {
            group3ForItem2[item3.slug] = item3.label;
          });
        });
      });
    });
  });

  return { rootBySlug, groupBySlug, group1BySlug, group2BySlug, group3BySlug };
}

export async function getPimNav(): Promise<PimNav> {
  try {
    const raw = await fs.readFile(PIM_NAV_PATH, "utf-8");
    const parsed = JSON.parse(raw) as RawNav;

    const tree = normalizeRoots((parsed as RawNav).tree);
    const slugMapRoots = tree;
    const lookupFromFile = (parsed.slug_map as any)?.lookup as PimSlugLookup | undefined;
    const lookup =
      lookupFromFile?.rootBySlug &&
      lookupFromFile.groupBySlug &&
      lookupFromFile.group1BySlug &&
      lookupFromFile.group2BySlug &&
      lookupFromFile.group3BySlug
        ? lookupFromFile
        : buildLookup(tree);

    return {
      tree,
      slug_map: {
        roots: slugMapRoots.length ? slugMapRoots : tree,
        lookup,
      },
      updated_at: parsed.updated_at,
    };
  } catch {
    return {
      tree: [],
      slug_map: {
        roots: [],
        lookup: {
          rootBySlug: {},
          groupBySlug: {},
          group1BySlug: {},
          group2BySlug: {},
          group3BySlug: {},
        },
      },
    };
  }
}

export async function getPimNavRoots(): Promise<PimNavRoot[]> {
  const nav = await getPimNav();
  return nav.tree;
}

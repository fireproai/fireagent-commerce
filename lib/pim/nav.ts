import fs from "node:fs/promises";
import path from "node:path";

export type PimNavItem = { slug: string; label: string; skuCount: number };
export type PimNavGroup = { slug: string; label: string; skuCount: number; items: PimNavItem[] };
export type PimNavRoot = { slug: string; label: string; skuCount: number; groups: PimNavGroup[] };

type RawNav = { tree?: unknown; slug_map?: unknown; updated_at?: string };
type RawNode = Record<string, unknown>;

export type PimSlugLookup = {
  rootBySlug: Record<string, string>;
  groupBySlug: Record<string, Record<string, string>>;
  group1BySlug: Record<string, Record<string, Record<string, string>>>;
};

export type PimNav = {
  tree: PimNavRoot[];
  slug_map: { roots: PimNavRoot[]; lookup: PimSlugLookup };
  updated_at?: string;
};

export const PIM_NAV_PATH = path.join(process.cwd(), "data", "pim", "nav.json");

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

function buildLookup(tree: PimNavRoot[]): PimSlugLookup {
  const rootBySlug: Record<string, string> = {};
  const groupBySlug: Record<string, Record<string, string>> = {};
  const group1BySlug: Record<string, Record<string, Record<string, string>>> = {};

  tree.forEach((root) => {
    rootBySlug[root.slug] = root.label;
    if (!groupBySlug[root.slug]) groupBySlug[root.slug] = {};
    if (!group1BySlug[root.slug]) group1BySlug[root.slug] = {};

    root.groups.forEach((group) => {
      groupBySlug[root.slug][group.slug] = group.label;
      if (!group1BySlug[root.slug][group.slug]) group1BySlug[root.slug][group.slug] = {};

      group.items.forEach((item) => {
        group1BySlug[root.slug][group.slug][item.slug] = item.label;
      });
    });
  });

  return { rootBySlug, groupBySlug, group1BySlug };
}

export async function getPimNav(): Promise<PimNav> {
  try {
    const raw = await fs.readFile(PIM_NAV_PATH, "utf-8");
    const parsed = JSON.parse(raw) as RawNav;

    const tree = normalizeRoots((parsed as RawNav).tree);
    const slugMapRoots = normalizeRoots((parsed.slug_map as any)?.roots) || tree;
    const lookupFromFile = (parsed.slug_map as any)?.lookup as PimSlugLookup | undefined;
    const lookup =
      lookupFromFile?.rootBySlug && lookupFromFile.groupBySlug && lookupFromFile.group1BySlug
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
      slug_map: { roots: [], lookup: { rootBySlug: {}, groupBySlug: {}, group1BySlug: {} } },
    };
  }
}

export async function getPimNavRoots(): Promise<PimNavRoot[]> {
  const nav = await getPimNav();
  return nav.tree;
}

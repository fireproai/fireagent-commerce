import { NextResponse } from "next/server";

import { getNavData } from "lib/plytix/nav";

export const revalidate = 600;

export async function GET() {
  const { tree, slugMap } = await getNavData();
  const body = {
    updated_at: new Date().toISOString(),
    tree,
    slug_map: slugMap,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": `public, max-age=60, s-maxage=600, stale-while-revalidate=300`,
    },
  });
}

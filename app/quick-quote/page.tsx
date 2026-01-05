import Link from "next/link";

import { Card, CardContent } from "components/ui/Card";
import { Container } from "components/ui/Container";

export default function QuickQuotePage() {
  return (
    <Container className="py-8">
      <div className="grid gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Quick Quote</h1>
        <p className="text-sm text-neutral-700">
          Build a quote without adding items to your cart. Ideal for project pricing and approvals.
        </p>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="text-sm text-neutral-700">
              Use Quick Cart to search SKUs and add items into a draft cart for quote preparation.
            </div>
            <Link
              href="/quick-cart"
              className="inline-flex w-fit items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Build quote via Quick Cart
            </Link>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

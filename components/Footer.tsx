import Link from "next/link";

const links = [
  { href: "/policies/privacy", label: "Privacy Policy" },
  { href: "/policies/refund", label: "Refund Policy" },
  { href: "/policies/shipping", label: "Shipping Policy" },
  { href: "/policies/terms", label: "Terms of Service" },
];

const SHOW_COMPLIANCE_BADGES = false;

export default function Footer() {
  const regNo = process.env.NEXT_PUBLIC_COMPANY_REG_NO;
  const vatNo = process.env.NEXT_PUBLIC_COMPANY_VAT_NO;
  const ukFulfilment = process.env.NEXT_PUBLIC_UK_FULFILMENT_ADDRESS;
  const tradeNotice =
    process.env.NEXT_PUBLIC_TRADE_ONLY_NOTICE ||
    "Trade-only supplier • Professional installation required";
  const complianceStatement = process.env.NEXT_PUBLIC_COMPLIANCE_STATEMENT;
  const complianceBadges =
    process.env.NEXT_PUBLIC_COMPLIANCE_BADGES?.split(",").map((s) => s.trim()).filter(Boolean) ||
    [];

  const hasCompanyLine = regNo || vatNo;
  const companyLineParts = [regNo ? `Reg No. ${regNo}` : null, vatNo ? `VAT No. ${vatNo}` : null].filter(
    Boolean
  );

  return (
    <footer className="mt-8 border-t border-neutral-200 bg-white px-4 py-8 text-sm text-neutral-600">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 text-xs text-neutral-700 sm:grid-cols-2 md:grid-cols-3">
        <div className="flex flex-col gap-1 leading-4">
          {ukFulfilment ? (
            <>
              <p className="text-[11px] font-semibold text-neutral-800">UK Shipping &amp; Returns</p>
              <pre className="whitespace-pre-wrap text-[11px] leading-4 text-neutral-700">
                {ukFulfilment}
              </pre>
            </>
          ) : null}
          {hasCompanyLine ? (
            <p className="text-[11px] text-neutral-600">{companyLineParts.join(" • ")}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 leading-4">
          <p className="text-[11px] font-semibold text-neutral-800">Trade terms</p>
          <div className="grid grid-cols-1 gap-1">
            <span className="text-neutral-700">Trade-only supply</span>
            <span className="text-neutral-700">Professional installation required</span>
            <span className="text-neutral-700">EN54 compliant products</span>
            <span className="text-neutral-700">Suitable for UK &amp; EU installations</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 leading-4">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold text-neutral-800">Policies</p>
            <div className="grid grid-cols-1 gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-neutral-600 hover:text-neutral-900"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-neutral-600">Secure checkout powered by Shopify</p>
        </div>
      </div>

      {SHOW_COMPLIANCE_BADGES && complianceBadges.length ? (
        <div className="mx-auto mt-3 flex w-full max-w-6xl flex-wrap items-center gap-2 text-xs text-neutral-600">
          {complianceBadges.map((badge) => (
            <span
              key={badge}
              className="rounded border border-neutral-200 bg-white px-2 py-1"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}
    </footer>
  );
}

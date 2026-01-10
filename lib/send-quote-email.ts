import { Quote, QuoteLine } from "@prisma/client";

import { coerceAmount, formatMoney } from "./money";
import { formatDateUK } from "./quote-pdf";
import { getStoreCurrency } from "./shopify/storeCurrency";
import { baseUrl as fallbackBaseUrl } from "./utils";

type QuoteWithLines = Quote & { lines: QuoteLine[] };
type Provider = "resend" | "sendgrid";

type SendContext = {
  quote: QuoteWithLines;
  pdfBuffer: Buffer;
  validUntil: Date;
  bcc?: string[];
};

type EmailCopy = {
  subject: string;
  text: string;
  html: string;
  attachmentName: string;
};

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

function normalizeBaseUrl(value?: string | null) {
  const raw = (value || "").trim() || fallbackBaseUrl;
  try {
    const url = new URL(raw);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.origin;
  } catch {
    return raw.replace(/\/$/, "") || fallbackBaseUrl;
  }
}

function resolveProvider(): { name: Provider; apiKey: string } {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return { name: "resend", apiKey: resendKey };
  const sendGridKey = process.env.SENDGRID_API_KEY;
  if (sendGridKey) return { name: "sendgrid", apiKey: sendGridKey };
  throw new EmailConfigError("Email provider not configured. Set RESEND_API_KEY or SENDGRID_API_KEY.");
}

function sanitizeText(value: any) {
  const str = String(value ?? "").trim();
  return str
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\uFFFD/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseLineMoney(line: QuoteLine) {
  const qty = Number(line.qty ?? 0);
  const unit = coerceAmount(line.unit_price_ex_vat) ?? 0;
  const total = coerceAmount(line.line_total_ex_vat);
  return { qty, unit, total: total ?? unit * qty };
}

function buildLineItemsTableHTML(lines: QuoteLine[], subtotal: number, currency: string) {
  const sanitizedLines = lines.map((line) => {
    const { qty, unit, total } = parseLineMoney(line);
    return {
      sku: sanitizeText(line.sku),
      name: sanitizeText(line.name),
      qty,
      unit,
      total,
    };
  });
  const tableStyle = "border-collapse:collapse;width:100%;max-width:680px;margin:12px 0;font-size:12px;";
  const headerCellStyle =
    "border:1px solid #e5e7eb;padding:6px;text-align:left;background:#f8fafc;font-weight:600;font-size:12px;";
  const cellStyle = "border:1px solid #e5e7eb;padding:6px;font-size:12px;";
  return `
    <table style="${tableStyle}">
      <thead>
        <tr>
          <th style="${headerCellStyle};white-space:nowrap;">SKU</th>
          <th style="${headerCellStyle}">Description</th>
          <th style="${headerCellStyle};text-align:right;">Quantity</th>
          <th style="${headerCellStyle};text-align:right;">Unit</th>
          <th style="${headerCellStyle};text-align:right;">Line total</th>
        </tr>
      </thead>
      <tbody>
        ${sanitizedLines
          .map(
            (line) => `
              <tr>
                <td style="${cellStyle};white-space:nowrap;">${escapeHtml(line.sku)}</td>
                <td style="${cellStyle}">${escapeHtml(line.name)}</td>
                <td style="${cellStyle};text-align:right;">${line.qty}</td>
                <td style="${cellStyle};text-align:right;">${formatMoney(line.unit, currency)}</td>
                <td style="${cellStyle};text-align:right;">${formatMoney(line.total, currency)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
    <p style="margin:8px 0 0;font-weight:600;">Subtotal (ex VAT): ${formatMoney(subtotal, currency)}</p>
  `;
}

function buildLineItemsTableText(lines: QuoteLine[], subtotal: number, currency: string) {
  const sanitizedLines = lines.map((line) => {
    const { qty, unit, total } = parseLineMoney(line);
    return {
      sku: sanitizeText(line.sku),
      name: sanitizeText(line.name),
      qty,
      unit,
      total,
    };
  });
  const rows = [
    "Line items:",
    "SKU | Description | Qty | Unit | Line total",
    ...sanitizedLines.map(
      (line) =>
        `${line.sku} | ${line.name} | ${line.qty} | ${formatMoney(line.unit, currency)} | ${formatMoney(
          line.total,
          currency,
        )}`,
    ),
    `Subtotal (ex VAT): ${formatMoney(subtotal, currency)}`,
  ];
  return rows.join("\n");
}

async function buildEmailCopy({
  quote,
  validUntil,
  baseUrl,
}: {
  quote: QuoteWithLines;
  validUntil: Date;
  baseUrl: string;
}): Promise<EmailCopy> {
  const siteBaseUrl = normalizeBaseUrl(baseUrl);
  const currency = await getStoreCurrency();
  const revision = typeof quote.revision === "number" ? quote.revision : 0;
  const revisionSuffix = revision > 0 ? ` — Rev ${revision}` : "";
  const reference = sanitizeText(quote.reference || "");
  const referenceSuffix = reference ? ` — Ref: ${reference}` : "";
  const subjectBase = `FireAgent quote ${quote.quote_number}`;
  const subject = `${subjectBase}${revisionSuffix}${referenceSuffix}`;
  const validityText = formatDateUK(validUntil);
  const tokenExpiry = quote.publicTokenExpiresAt ? formatDateUK(quote.publicTokenExpiresAt) : formatDateUK(validUntil);
  const tokenExpiryText = tokenExpiry || validityText;
  const pdfUrl = `${siteBaseUrl}/api/quotes/${quote.quote_number}/pdf?token=${encodeURIComponent(
    quote.publicToken || "",
  )}`;
  const viewUrl = `${siteBaseUrl}/quotes/${quote.quote_number}?token=${encodeURIComponent(quote.publicToken || "")}`;
  const companyLine = sanitizeText(quote.company || "");
  const notes = sanitizeText(quote.notes || "");
  const subtotal =
    coerceAmount(quote.subtotal_ex_vat) ??
    quote.lines.reduce((sum, line) => {
      const { total } = parseLineMoney(line);
      return sum + total;
    }, 0);

  const textParts = [
    "Hello,",
    "",
    `Please find attached FireAgent quote ${quote.quote_number}${revision > 0 ? ` (Rev ${revision})` : ""}.`,
    companyLine ? `Company: ${companyLine}` : null,
    reference ? `Reference: ${reference}` : null,
    "",
    `Pricing is held until ${validityText}.`,
    "",
    "Use the links below to review, update quantities, or add this quote directly to cart:",
    `- Download PDF (no login needed): ${pdfUrl}`,
    `- View & update quote online: ${viewUrl}`,
    "",
    `Link expires after ${tokenExpiryText}.`,
    "",
    buildLineItemsTableText(quote.lines, subtotal, currency),
    notes ? `\nNotes:\n${notes}` : null,
    "",
    "Need changes? Email shop@fireagent.co.uk.",
    "",
    "Thank you,",
    "FireAgent",
  ].filter(Boolean);

  const htmlNotes = notes ? `<p style="margin:8px 0;"><strong>Notes:</strong><br/>${escapeHtml(notes).replace(/\n/g, "<br/>")}</p>` : "";
  const htmlCompany = companyLine ? `<p style="margin:0 0 4px;"><strong>Company:</strong> ${escapeHtml(companyLine)}</p>` : "";
  const htmlReference = reference ? `<p style="margin:0 0 4px;"><strong>Reference:</strong> ${escapeHtml(reference)}</p>` : "";
  const htmlTable = buildLineItemsTableHTML(quote.lines, subtotal, currency);

  const htmlFooter = `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
    <div style="display:flex;align-items:center;gap:8px;font-size:14px;color:#111827;">
      <img src="${siteBaseUrl}/brand/fireagent.png" alt="FireAgent" height="28" style="display:block;"/>
      <div>
        <div style="font-weight:700;color:#111827;">FireAgent</div>
        <div style="color:#374151;">Email: <a href="mailto:shop@fireagent.co.uk">shop@fireagent.co.uk</a></div>
      </div>
    </div>
  `;

  const htmlBody = `
    <p>Hello,</p>
    <p>Please find attached FireAgent quote <strong>${escapeHtml(quote.quote_number)}${
      revision > 0 ? ` (Rev ${revision})` : ""
    }</strong>.</p>
    ${htmlCompany}
    ${htmlReference}
    <p style="margin:8px 0;">Pricing is held until ${validityText}.</p>
    <p style="margin:8px 0;">Use the links below to review, update quantities, or add this quote directly to cart:</p>
    <ul style="margin:8px 0 12px 16px;padding:0;color:#111827;">
      <li style="margin:4px 0;"><a href="${pdfUrl}">Download PDF (no login needed)</a></li>
      <li style="margin:4px 0;"><a href="${viewUrl}">View &amp; update quote online</a></li>
    </ul>
    <p style="margin:8px 0;">Link expires after ${tokenExpiryText}.</p>
    ${htmlTable}
    ${htmlNotes}
    <p style="margin:12px 0 0;">Need changes? Email <a href="mailto:shop@fireagent.co.uk">shop@fireagent.co.uk</a>.</p>
    <p style="margin:8px 0;">Thank you,<br/>FireAgent</p>
    ${htmlFooter}
  `;

  return {
    subject,
    text: textParts.join("\n"),
    html: htmlBody,
    attachmentName: revision > 0 ? `quote-${quote.quote_number}-rev-${revision}.pdf` : `quote-${quote.quote_number}.pdf`,
  };
}

function sanitizeList(value?: string[]) {
  return (value || []).map((email) => email.trim()).filter(Boolean);
}

function validateEmails(emails: string[], label: string) {
  const invalid = emails.find((email) => !email.includes("@") || email.startsWith("<") || email.endsWith(">"));
  if (invalid) {
    throw new EmailConfigError(`${label} is invalid: ${invalid}`);
  }
}

function parseFromAddress() {
  const raw = (process.env.EMAIL_FROM || "").trim();
  if (!raw) {
    throw new EmailConfigError("EMAIL_FROM is missing or invalid");
  }

  const namedMatch = raw.match(/^(.*)<(.+@.+)>$/);
  if (namedMatch) {
    const namePart = namedMatch[1] ?? "";
    const emailPart = namedMatch[2] ?? "";
    const name = namePart.trim() || undefined;
    const email = emailPart.trim();
    if (!email.includes("@")) throw new EmailConfigError("EMAIL_FROM is missing or invalid");
    return { raw, email, name };
  }

  if (raw.includes("@")) {
    return { raw, email: raw, name: undefined };
  }

  throw new EmailConfigError("EMAIL_FROM is missing or invalid");
}

async function sendWithResend(opts: {
  apiKey: string;
  copy: EmailCopy;
  pdfBase64: string;
  to: string;
  bcc?: string[];
}) {
  const from = parseFromAddress();
  const bccList = sanitizeList(opts.bcc);
  if (bccList.length) validateEmails(bccList, "Resend BCC");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from.raw,
      to: [opts.to],
      bcc: bccList.length ? bccList : undefined,
      subject: opts.copy.subject,
      html: opts.copy.html,
      text: opts.copy.text,
      attachments: [
        {
          filename: opts.copy.attachmentName,
          content: opts.pdfBase64,
          content_type: "application/pdf",
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const message = text ? `Resend ${res.status}: ${text}` : `Resend ${res.status}`;
    throw new Error(message);
  }
}

async function sendWithSendGrid(opts: {
  apiKey: string;
  copy: EmailCopy;
  pdfBase64: string;
  to: string;
  bcc?: string[];
}) {
  const from = parseFromAddress();
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: opts.to }],
          bcc: (() => {
            const bcc = sanitizeList(opts.bcc);
            return bcc.length ? bcc.map((email) => ({ email })) : undefined;
          })(),
          subject: opts.copy.subject,
        },
      ],
      from: { email: from.email, name: from.name },
      reply_to: { email: from.email, name: from.name },
      content: [
        { type: "text/plain", value: opts.copy.text },
        { type: "text/html", value: opts.copy.html },
      ],
      attachments: [
        {
          content: opts.pdfBase64,
          filename: opts.copy.attachmentName,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    }),
  });

  if (!res.ok) {
    const payload = await res.text().catch(() => "");
    const message = payload ? `SendGrid error ${res.status}: ${payload}` : `SendGrid error ${res.status}`;
    throw new Error(message);
  }
}

export async function sendQuoteEmail(context: SendContext & { baseUrl?: string }): Promise<Provider> {
  const provider = resolveProvider();
  const copy = await buildEmailCopy({
    quote: context.quote,
    validUntil: context.validUntil,
    baseUrl: context.baseUrl || fallbackBaseUrl,
  });
  const pdfBase64 = context.pdfBuffer.toString("base64");

  console.log("[sendQuoteEmail] dispatch", {
    quoteNumber: context.quote.quote_number,
    provider: provider.name,
    hasBcc: Boolean(context.bcc?.length),
  });

  if (provider.name === "resend") {
    await sendWithResend({ apiKey: provider.apiKey, copy, pdfBase64, to: context.quote.email, bcc: context.bcc });
  } else {
    await sendWithSendGrid({ apiKey: provider.apiKey, copy, pdfBase64, to: context.quote.email, bcc: context.bcc });
  }

  return provider.name;
}

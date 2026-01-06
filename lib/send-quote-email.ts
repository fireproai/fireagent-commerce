import { Quote, QuoteLine } from "@prisma/client";

import { formatDateUK } from "./quote-pdf";
import { baseUrl } from "./utils";

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

function resolveProvider(): { name: Provider; apiKey: string } {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return { name: "resend", apiKey: resendKey };
  const sendGridKey = process.env.SENDGRID_API_KEY;
  if (sendGridKey) return { name: "sendgrid", apiKey: sendGridKey };
  throw new Error("Email provider not configured. Set RESEND_API_KEY or SENDGRID_API_KEY.");
}

function buildEmailCopy({ quote, validUntil }: { quote: QuoteWithLines; validUntil: Date }): EmailCopy {
  const subject = `FireAgent Quote ${quote.quote_number}`;
  const validityText = formatDateUK(validUntil);
  const tokenExpiry = quote.publicTokenExpiresAt ? formatDateUK(quote.publicTokenExpiresAt) : "";
  const pdfUrl = `${baseUrl}/api/quotes/${quote.quote_number}/pdf?token=${quote.publicToken}`;
  const viewUrl = `${baseUrl}/quotes/${quote.quote_number}?token=${quote.publicToken}`;
  const text = [
    `Hello,`,
    "",
    `Please find attached FireAgent quote ${quote.quote_number}.`,
    `Pricing is held until ${validityText}. Reply to this email if you want to proceed or make changes.`,
    "",
    `Download PDF (no login needed): ${pdfUrl}`,
    `View online: ${viewUrl}`,
    tokenExpiry ? `Link expires after ${tokenExpiry}.` : null,
    `Need changes? Email shop@fireagent.co.uk.`,
    "",
    "Thank you,",
    "FireAgent",
  ].join("\n");

  const html = [
    `<p>Hello,</p>`,
    `<p>Please find attached FireAgent quote <strong>${quote.quote_number}</strong>.</p>`,
    `<p>Pricing is held until ${validityText}. Reply to this email if you want to proceed or make changes.</p>`,
    `<p><a href="${pdfUrl}">Download PDF (no login needed)</a><br/>`,
    `<a href="${viewUrl}">View online</a><br/>`,
    tokenExpiry ? `<small>Link expires after ${tokenExpiry}.</small><br/>` : "",
    `<small>Need changes? Email <a href="mailto:shop@fireagent.co.uk">shop@fireagent.co.uk</a>.</small></p>`,
    `<p>Thank you,<br/>FireAgent</p>`,
  ].join("");

  return {
    subject,
    text,
    html,
    attachmentName: `quote-${quote.quote_number}.pdf`,
  };
}

function sanitizeList(value?: string[]) {
  return (value || []).map((email) => email.trim()).filter(Boolean);
}

function validateEmails(emails: string[], label: string) {
  const invalid = emails.find((email) => !email.includes("@") || email.startsWith("<") || email.endsWith(">"));
  if (invalid) {
    throw new Error(`${label} is invalid: ${invalid}`);
  }
}

function parseFromAddress() {
  const raw = (process.env.EMAIL_FROM || "").trim();
  if (!raw) {
    throw new Error("EMAIL_FROM is missing or invalid");
  }

  const namedMatch = raw.match(/^(.*)<(.+@.+)>$/);
  if (namedMatch) {
    const namePart = namedMatch[1] ?? "";
    const emailPart = namedMatch[2] ?? "";
    const name = namePart.trim() || undefined;
    const email = emailPart.trim();
    if (!email.includes("@")) throw new Error("EMAIL_FROM is missing or invalid");
    return { raw, email, name };
  }

  if (raw.includes("@")) {
    return { raw, email: raw, name: undefined };
  }

  throw new Error("EMAIL_FROM is missing or invalid");
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

export async function sendQuoteEmail(context: SendContext): Promise<Provider> {
  const provider = resolveProvider();
  const copy = buildEmailCopy({ quote: context.quote, validUntil: context.validUntil });
  const pdfBase64 = context.pdfBuffer.toString("base64");

  if (provider.name === "resend") {
    await sendWithResend({ apiKey: provider.apiKey, copy, pdfBase64, to: context.quote.email, bcc: context.bcc });
  } else {
    await sendWithSendGrid({ apiKey: provider.apiKey, copy, pdfBase64, to: context.quote.email, bcc: context.bcc });
  }

  return provider.name;
}

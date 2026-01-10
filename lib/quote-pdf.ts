import path from "path";
import PDFDocument from "pdfkit";

import { Quote, QuoteLine } from "@prisma/client";

type TableColumn = {
  key: "sku" | "name" | "qty" | "unit" | "total";
  label: string;
  width: number;
  align?: "left" | "center" | "right";
};

type TableLayout = {
  columns: TableColumn[];
  width: number;
};

export type QuoteWithLines = Quote & { lines: QuoteLine[] };

const PAGE_MARGIN = 40;
const FOOTER_HEIGHT = 75;
const BASE_COLUMNS: TableColumn[] = [
  { key: "sku", label: "SKU", width: 105, align: "left" },
  { key: "name", label: "Description", width: 220, align: "left" },
  { key: "qty", label: "Qty", width: 40, align: "right" },
  { key: "unit", label: "Unit", width: 75, align: "right" },
  { key: "total", label: "Line total", width: 80, align: "right" },
];

const LOGO_PATH = path.join(process.cwd(), "public", "brand", "fireagent.png");

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function sanitizeText(value: any) {
  const str = String(value ?? "").trim();
  return str
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\uFFFD/g, "");
}

function formatCurrency(value: number) {
  return `\u00A3${value.toFixed(2)}`;
}

export function formatDateUK(value?: Date | string | null) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function resolveSku(line: any): string {
  const candidates = [
    line?.sku,
    line?.variant_sku,
    line?.product_sku,
    line?.productId,
    line?.id,
  ]
    .filter(Boolean)
    .map((v) => String(v));
  const sku = candidates.find(
    (candidate) => candidate && candidate.toLowerCase() !== "default title"
  );
  return sanitizeText(sku || "");
}

export function normalizeStatus(
  rawStatus: any,
  validUntil: Date
): "draft" | "issued" | "expired" {
  const base =
    typeof rawStatus === "string" ? rawStatus.toLowerCase() : "draft";
  const initial: "draft" | "issued" | "expired" =
    base === "issued" || base === "expired" ? (base as any) : "draft";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(validUntil);
  expiry.setHours(0, 0, 0, 0);
  if (today > expiry) return "expired";
  return initial;
}

export function computeQuoteValidity(
  quote: Pick<Quote, "quote_date" | "status">
) {
  const quoteDate = quote.quote_date ? new Date(quote.quote_date) : new Date();
  const validUntil = new Date(quoteDate);
  validUntil.setDate(validUntil.getDate() + 30);
  const status = normalizeStatus(quote.status, validUntil);
  return { quoteDate, validUntil, status };
}

function buildTableLayout(doc: PDFKit.PDFDocument): TableLayout {
  const availableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const baseTotal = BASE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
  const scale = availableWidth / baseTotal;

  const scaledColumns = BASE_COLUMNS.map((col) => ({
    ...col,
    width: Math.floor(col.width * scale),
  }));

  if (scaledColumns.length > 0) {
    const scaledTotal = scaledColumns.reduce((sum, col) => sum + col.width, 0);
    const lastIndex = scaledColumns.length - 1;
    const lastColumn = scaledColumns[lastIndex];
    if (lastColumn) {
      lastColumn.width += availableWidth - scaledTotal;
      scaledColumns[lastIndex] = lastColumn;
    }
  }

  return { columns: scaledColumns, width: availableWidth };
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  quote: any,
  status: string,
  validUntil: Date
) {
  const { left, right } = doc.page.margins;
  const startY = doc.page.margins.top;
  const rightEdge = doc.page.width - right;

  const brandHeight = 32;
  doc.save();
  doc.font("Helvetica-Bold").fontSize(22);
  try {
    doc.image(LOGO_PATH, left, startY, { height: brandHeight });
  } catch {
    doc.text("FIREAGENT", left, startY, { align: "left" });
  }

  const panelWidth = 260;
  const panelX = rightEdge - panelWidth;
  const pad = 10;
  const labelWidth = 95;
  const rowHeight = 14;
  const revision = typeof quote?.revision === "number" ? quote.revision : 0;
  const revisionLabel = revision > 0 ? `Rev ${revision}` : null;
  const company = quote.company ? sanitizeText(quote.company) : null;
  const reference = quote.reference ? sanitizeText(quote.reference) : null;

  const metaRows: { label: string; value: string; size?: number }[] = [
    { label: "Quote No:", value: String(quote.quote_number || "") },
    ...(company ? [{ label: "Company:", value: company }] : []),
    { label: "Customer:", value: quote.email || "" },
    ...(reference ? [{ label: "Reference:", value: reference }] : []),
    ...(revisionLabel ? [{ label: "Revision:", value: revisionLabel }] : []),
    { label: "Quote Date:", value: formatDateUK(quote.quote_date) },
    { label: "Valid Until:", value: formatDateUK(validUntil) },
    { label: "Status:", value: status },
  ];

  const panelHeight = pad * 2 + metaRows.length * rowHeight;

  doc.save();
  doc
    .roundedRect(panelX, startY, panelWidth, panelHeight, 6)
    .fillOpacity(0.9)
    .fill("#f9fafb");
  doc.lineWidth(1).strokeColor("#e5e7eb").stroke();
  doc.restore();

  let cursorY = startY + pad;
  metaRows.forEach(({ label, value, size }) => {
    const fontSize = size ?? 10;
    doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#111827");
    doc.text(label, panelX + pad, cursorY, {
      width: labelWidth,
      align: "left",
    });
    doc.font("Helvetica").fontSize(fontSize).fillColor("#111827");
    doc.text(value, panelX + pad + labelWidth + 6, cursorY, {
      width: panelWidth - pad * 2 - labelWidth - 6,
      align: "right",
    });
    cursorY += rowHeight;
  });

  const headerBottom = Math.max(startY + brandHeight, startY + panelHeight);
  doc
    .moveTo(left, headerBottom + 12)
    .lineTo(rightEdge, headerBottom + 12)
    .lineWidth(1)
    .strokeColor("#e5e7eb")
    .stroke();
  doc.y = headerBottom + 22;
  doc.restore();
}

function drawTableHeader(doc: PDFKit.PDFDocument, layout: TableLayout) {
  const startY = doc.y;
  doc.save();
  doc.rect(doc.page.margins.left, startY, layout.width, 24).fill("#f3f4f6");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827");

  let x = doc.page.margins.left;
  layout.columns.forEach((col) => {
    doc.text(col.label, x + 6, startY + 6, {
      width: col.width - 12,
      align: col.align ?? "left",
    });
    x += col.width;
  });

  doc.restore();
  doc
    .moveTo(doc.page.margins.left, startY + 24)
    .lineTo(doc.page.width - doc.page.margins.right, startY + 24)
    .lineWidth(0.5)
    .strokeColor("#e5e7eb")
    .stroke();
  doc.y = startY + 28;
}

function ensureSpace(
  doc: PDFKit.PDFDocument,
  requiredHeight: number,
  startPage: (options: { includeTableHeader: boolean }) => void,
  options: { includeTableHeader: boolean }
) {
  const usableBottom =
    doc.page.height - doc.page.margins.bottom - FOOTER_HEIGHT;
  if (doc.y + requiredHeight > usableBottom) {
    doc.addPage();
    startPage(options);
  }
}

function drawLineItemRow(
  doc: PDFKit.PDFDocument,
  layout: TableLayout,
  line: any,
  rowIndex: number,
  startPage: (options: { includeTableHeader: boolean }) => void
) {
  const sku = resolveSku(line);
  const description = String(
    sanitizeText(line?.name || line?.title || line?.description || sku || "")
  );
  const values: Record<TableColumn["key"], string> = {
    sku,
    name: description || sku,
    qty: `${Number(line?.qty ?? 0)}`,
    unit: formatCurrency(Number(line?.unit_price_ex_vat ?? 0)),
    total: formatCurrency(Number(line?.line_total_ex_vat ?? 0)),
  };

  doc.font("Helvetica").fontSize(9).fillColor("#111827");
  const paddingTop = 4;
  const paddingBottom = 4;
  const skuCol = layout.columns.find((c) => c.key === "sku")!;
  const descCol = layout.columns.find((c) => c.key === "name")!;
  const descHeight = doc.heightOfString(values.name, {
    width: descCol.width - 12,
    align: "left",
  });
  const rowHeight = Math.max(18, descHeight + paddingTop + paddingBottom);

  ensureSpace(doc, rowHeight, startPage, { includeTableHeader: true });

  const rowY = doc.y;
  const xStart = doc.page.margins.left;

  doc.save();
  if (rowIndex % 2 === 1) {
    doc.rect(xStart, rowY, layout.width, rowHeight).fill("#f9fafb");
    doc.fillColor("#111827");
  }
  doc.font("Helvetica").fontSize(9);

  let x = xStart;
  layout.columns.forEach((col) => {
    const width = col.width - 12;
    const y = rowY + paddingTop;
    const options: PDFKit.Mixins.TextOptions = {
      width,
      align: col.align ?? "left",
    };
    if (col.key === "sku") {
      options.lineBreak = false;
      options.ellipsis = true;
      doc.text(values[col.key], x + 6, y, options);
    } else if (col.key === "name") {
      doc.text(values[col.key], x + 6, y, { ...options, align: "left" });
    } else {
      doc.text(values[col.key], x + 6, y, { ...options, lineBreak: false });
    }
    x += col.width;
  });
  doc.restore();

  doc
    .moveTo(xStart, rowY + rowHeight)
    .lineTo(xStart + layout.width, rowY + rowHeight)
    .lineWidth(0.25)
    .strokeColor("#e5e7eb")
    .stroke();

  doc.y = rowY + rowHeight + 4;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  totals: { subtotal: number; vat: number; totalIncVat: number },
  startPage: (options: { includeTableHeader: boolean }) => void
) {
  const boxWidth = 260;
  const boxHeight = 90;
  ensureSpace(doc, boxHeight, startPage, { includeTableHeader: false });

  const x = doc.page.width - doc.page.margins.right - boxWidth;
  const y = doc.y + 6;
  doc.save();
  doc
    .roundedRect(x, y, boxWidth, boxHeight, 6)
    .lineWidth(1)
    .strokeColor("#d1d5db")
    .stroke();

  const rows: [string, string, boolean][] = [
    ["Subtotal (ex VAT)", formatCurrency(totals.subtotal), false],
    ["VAT (20%)", formatCurrency(totals.vat), false],
    ["Total (inc VAT)", formatCurrency(totals.totalIncVat), true],
  ];

  let cursorY = y + 10;
  rows.forEach(([label, value, isStrong]) => {
    doc
      .font(isStrong ? "Helvetica-Bold" : "Helvetica")
      .fontSize(isStrong ? 12 : 11)
      .fillColor("#111827");
    doc.text(label, x + 12, cursorY, { width: boxWidth / 2, align: "left" });
    doc.text(value, x + boxWidth / 2, cursorY, {
      width: boxWidth / 2 - 12,
      align: "right",
    });
    cursorY += 24;
  });

  doc.font("Helvetica").fontSize(9).fillColor("#4b5563");
  doc.text(
    "Prices subject to availability and manufacturer changes.",
    x + 12,
    y + boxHeight - 18,
    {
      width: boxWidth - 24,
      align: "left",
    }
  );

  doc.restore();
  doc.y = y + boxHeight + 6;
}

function addFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();

  // Keep footer copy SHORT so it always fits inside the reserved footer area.
  // IMPORTANT: If this text overflows, PDFKit will auto-create extra pages.
  const footerLeftLines = [
    "FireAgent",
    "Email: shop@fireagent.co.uk",
    "Distribution: Hawker Business Park, Melton Road, Burton on the Wolds",
    "Loughborough, LE12 5",
  ];
  const leftText = footerLeftLines.join("\n");

  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);

    const footerHeight = 60; // must be <= FOOTER_HEIGHT budget used by ensureSpace
    const footerY =
      doc.page.height - doc.page.margins.bottom - footerHeight + 6;

    const footerWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftWidth = Math.floor(footerWidth * 0.68);
    const rightWidth = footerWidth - leftWidth;

    doc.save();
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280");

    // LEFT: hard constrained to footerHeight with ellipsis so it can NEVER paginate
    doc.text(leftText, doc.page.margins.left, footerY, {
      width: leftWidth,
      height: footerHeight,
      align: "left",
      ellipsis: true,
    });

    // RIGHT: page numbering aligned bottom-right
    doc.text(
      `Page ${i + 1} of ${range.count}`,
      doc.page.margins.left + leftWidth,
      footerY + footerHeight - 14,
      {
        width: rightWidth,
        height: 14,
        align: "right",
      }
    );

    doc.restore();
  }

  // Return to last page (safety). Does NOT add pages.
  doc.switchToPage(range.start + range.count - 1);
}

export async function generateQuotePdf(
  quote: QuoteWithLines,
  options?: {
    statusOverride?: "draft" | "issued" | "expired";
    validUntil?: Date;
  }
) {
  const { validUntil: computedValidUntil } = computeQuoteValidity(quote);
  const validUntil = options?.validUntil ?? computedValidUntil;
  const status =
    options?.statusOverride ?? normalizeStatus(quote.status, validUntil);

  const subtotal = Number(quote.subtotal_ex_vat ?? 0);
  const vat = subtotal * 0.2;
  const totalIncVat = subtotal + vat;

  const doc = new PDFDocument({ margin: PAGE_MARGIN, bufferPages: true });
  const bufferPromise = streamToBuffer(doc);
  const tableLayout = buildTableLayout(doc);

  const startPage = (options: { includeTableHeader: boolean }) => {
    drawHeader(doc, quote, status, validUntil);
    doc.moveDown(0.5);
    if (options.includeTableHeader) drawTableHeader(doc, tableLayout);
    if (!options.includeTableHeader) doc.moveDown(0.75);
  };

  startPage({ includeTableHeader: true });

  quote.lines.forEach((line: any, index: number) => {
    drawLineItemRow(doc, tableLayout, line, index, startPage);
  });

  doc.moveDown(0.5);
  drawTotals(doc, { subtotal, vat, totalIncVat }, startPage);

  addFooters(doc);
  doc.end();

  const buffer = await bufferPromise;
  return buffer;
}





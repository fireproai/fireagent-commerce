import path from "path";
import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import { NextRequest, NextResponse } from "next/server";

import { getQuoteByNumber } from "lib/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const PAGE_MARGIN = 40;
const FOOTER_HEIGHT = 50;
const BASE_COLUMNS: TableColumn[] = [
  { key: "sku", label: "SKU", width: 85, align: "left" },
  { key: "name", label: "Description", width: 200, align: "left" },
  { key: "qty", label: "Qty", width: 50, align: "right" },
  { key: "unit", label: "Unit (ex VAT)", width: 90, align: "right" },
  { key: "total", label: "Total (ex VAT)", width: 90, align: "right" },
];

const LOGO_PATH = path.join(process.cwd(), "public", "brand", "fireagent.png");

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function resolveParams<T extends Record<string, unknown>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

function formatCurrency(value: number) {
  return `£${value.toFixed(2)}`;
}

function buildTableLayout(doc: PDFKit.PDFDocument): TableLayout {
  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const baseTotal = BASE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
  const scale = availableWidth / baseTotal;

  const scaledColumns = BASE_COLUMNS.map((col) => ({
    ...col,
    width: Math.floor(col.width * scale),
  }));

  if (scaledColumns.length > 0) {
    const scaledTotal = scaledColumns.reduce((sum, col) => sum + col.width, 0);
    scaledColumns[scaledColumns.length - 1].width += availableWidth - scaledTotal;
  }

  return { columns: scaledColumns, width: availableWidth };
}

function drawHeader(doc: PDFKit.PDFDocument, quote: any) {
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

  const metaWidth = 220;
  const metaLines = [
    `Quote: ${quote.quote_number}`,
    `Date: ${quote.quote_date?.toISOString?.().slice(0, 10) ?? ""}`,
    `Status: ${quote.status ?? "Issued"}`,
    `Email: ${quote.email}`,
  ];

  doc.font("Helvetica").fontSize(10).fillColor("#111827");
  doc.text(metaLines.join("\n"), rightEdge - metaWidth, startY, { width: metaWidth, align: "right" });

  const headerBottom = Math.max(startY + brandHeight, doc.y);
  doc.moveTo(left, headerBottom + 12)
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
    doc.text(col.label, x + 6, startY + 6, { width: col.width - 12, align: col.align ?? "left" });
    x += col.width;
  });

  doc.restore();
  doc.moveTo(doc.page.margins.left, startY + 24)
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
  options: { includeTableHeader: boolean },
) {
  const usableBottom = doc.page.height - doc.page.margins.bottom - FOOTER_HEIGHT;
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
  startPage: (options: { includeTableHeader: boolean }) => void,
) {
  const values: Record<TableColumn["key"], string> = {
    sku: String(line.sku || ""),
    name: String(line.name || ""),
    qty: `${Number(line.qty ?? 0)}`,
    unit: formatCurrency(Number(line.unit_price_ex_vat ?? 0)),
    total: formatCurrency(Number(line.line_total_ex_vat ?? 0)),
  };

  doc.font("Helvetica").fontSize(10).fillColor("#111827");
  const paddingY = 6;
  const contentHeights = layout.columns.map((col) =>
    doc.heightOfString(values[col.key], { width: col.width - 12, align: col.align ?? "left" }),
  );
  const rowHeight = Math.max(18, Math.max(...contentHeights) + paddingY);

  ensureSpace(doc, rowHeight, startPage, { includeTableHeader: true });

  const rowY = doc.y;
  const xStart = doc.page.margins.left;

  doc.save();
  if (rowIndex % 2 === 1) {
    doc.rect(xStart, rowY, layout.width, rowHeight).fill("#f9fafb");
    doc.fillColor("#111827");
  }
  doc.font("Helvetica").fontSize(10);

  let x = xStart;
  layout.columns.forEach((col) => {
    doc.text(values[col.key], x + 6, rowY + paddingY / 2, { width: col.width - 12, align: col.align ?? "left" });
    x += col.width;
  });
  doc.restore();

  doc.moveTo(xStart, rowY + rowHeight)
    .lineTo(xStart + layout.width, rowY + rowHeight)
    .lineWidth(0.25)
    .strokeColor("#e5e7eb")
    .stroke();

  doc.y = rowY + rowHeight + 4;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  totals: { subtotal: number; vat: number; totalIncVat: number },
  startPage: (options: { includeTableHeader: boolean }) => void,
) {
  const boxWidth = 240;
  const boxHeight = 84;
  ensureSpace(doc, boxHeight, startPage, { includeTableHeader: false });

  const x = doc.page.width - doc.page.margins.right - boxWidth;
  const y = doc.y + 6;
  doc.save();
  doc.roundedRect(x, y, boxWidth, boxHeight, 6).lineWidth(1).strokeColor("#d1d5db").stroke();

  const rows: [string, string, boolean][] = [
    ["Subtotal (ex VAT)", formatCurrency(totals.subtotal), false],
    ["VAT (20%)", formatCurrency(totals.vat), false],
    ["Total (inc VAT)", formatCurrency(totals.totalIncVat), true],
  ];

  let cursorY = y + 10;
  rows.forEach(([label, value, isStrong]) => {
    doc.font(isStrong ? "Helvetica-Bold" : "Helvetica").fontSize(isStrong ? 12 : 11).fillColor("#111827");
    doc.text(label, x + 12, cursorY, { width: boxWidth / 2, align: "left" });
    doc.text(value, x + boxWidth / 2, cursorY, { width: boxWidth / 2 - 12, align: "right" });
    cursorY += 22;
  });

  doc.restore();
  doc.y = y + boxHeight + 6;
}

function addFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const footerY = doc.page.height - doc.page.margins.bottom + 8;
    const footerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
    doc.text(
      "Opening Spring 2026 – Full catalogue launching soon.",
      doc.page.margins.left,
      footerY,
      { width: footerWidth / 2, align: "left" },
    );
    doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - doc.page.margins.right - footerWidth / 2, footerY, {
      width: footerWidth / 2,
      align: "right",
    });
  }

  doc.switchToPage(range.start + range.count - 1);
}

export async function GET(request: NextRequest, context: { params: Promise<{ quote_number: string }> }) {
  try {
    const resolvedParams = await resolveParams<{ quote_number: string }>(context.params);
    const emailParam = request.nextUrl.searchParams.get("e") || "";

    const quote = await getQuoteByNumber(resolvedParams.quote_number);
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (quote.email.toLowerCase() !== emailParam.toLowerCase()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const subtotal = Number(quote.subtotal_ex_vat ?? 0);
    const vat = subtotal * 0.2;
    const totalIncVat = subtotal + vat;

    const doc = new PDFDocument({ margin: PAGE_MARGIN, bufferPages: true });
    const tableLayout = buildTableLayout(doc);

    const startPage = (options: { includeTableHeader: boolean }) => {
      drawHeader(doc, quote);
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

    const buffer = await streamToBuffer(doc);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quote-${quote.quote_number}.pdf"`,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[api/quotes/pdf] failed", error);
    const message = process.env.NODE_ENV === "production" ? "Failed to generate PDF" : error?.message || "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

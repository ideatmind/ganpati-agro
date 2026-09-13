"use client";

export function PrintReceiptButton() {
  return <button className="button receipt-print" onClick={() => window.print()}>पावती प्रिंट / PDF</button>;
}

ALTER TABLE "salesInvoiceDerived" RENAME TO "salesInvoicesDerived";

ALTER TABLE "salesInvoicesDerived" RENAME CONSTRAINT "salesInvoiceDerived_rawId_salesInvoicesRaw_id_fk" TO "salesInvoicesDerived_rawId_salesInvoicesRaw_id_fk";
import { Pool } from "@neondatabase/serverless";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function fetchRevenue() {
  try {
    /*console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));*/

    const { rows } = await pool.query<Revenue>("SELECT * FROM revenue");

    //console.log('Data fetch completed after 3 seconds.');

    return rows;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    const { rows } = await pool.query<LatestInvoiceRaw>(
      `
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5
      `
    );

    return rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    const [invoiceCount, customerCount, invoiceStatus] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM invoices"),
      pool.query("SELECT COUNT(*) FROM customers"),
      pool.query(`
        SELECT
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
        FROM invoices
      `),
    ]);

    return {
      numberOfInvoices: Number(invoiceCount.rows[0]?.count ?? 0),
      numberOfCustomers: Number(customerCount.rows[0]?.count ?? 0),
      totalPaidInvoices: formatCurrency(invoiceStatus.rows[0]?.paid ?? 0),
      totalPendingInvoices: formatCurrency(invoiceStatus.rows[0]?.pending ?? 0),
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const { rows } = await pool.query<InvoicesTable>(
      `
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1
      ORDER BY invoices.date DESC
      LIMIT $2 OFFSET $3
      `,
      [`%${query}%`, ITEMS_PER_PAGE, offset]
    );

    return rows;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const { rows } = await pool.query(
      `
      SELECT COUNT(*)
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1
      `,
      [`%${query}%`]
    );

    const totalPages = Math.ceil(Number(rows[0]?.count ?? 0) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  /*try {
    const { rows } = await pool.query<InvoiceForm>(
      `
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = $1
      `,
      [id]
    );*/

    /*return rows.map((invoice) => ({
      ...invoice,
      amount: invoice.amount / 100, // Convert amount from cents to dollars
    }))[0];*/

    //return invoice[0];
    // 格式化結果，將金額從分轉換為美元
    try {
      // 使用參數化查詢從資料庫中取得指定的發票
      const result = await pool.query(
        `
        SELECT
          id,
          customer_id,
          amount,
          status
        FROM invoices
        WHERE id = $1
        `,
        [id]
      );
      
    const invoice = result.rows.map((invoice) => ({
      ...invoice,
      amount: invoice.amount / 100,
    }));

    // 返回第一條記錄
    return invoice[0];

  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    const { rows } = await pool.query<CustomerField>(
      `
      SELECT id, name
      FROM customers
      ORDER BY name ASC
      `
    );

    return rows;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const { rows } = await pool.query<CustomersTableType>(
      `
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id) AS total_invoices,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1
      GROUP BY customers.id, customers.name, customers.email, customers.image_url
      ORDER BY customers.name ASC
      `,
      [`%${query}%`]
    );

    return rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch customer table.");
  }
}
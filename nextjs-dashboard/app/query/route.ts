import { Pool } from "@neondatabase/serverless";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function listInvoices() {
  const result = await pool.query(
    `
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = $1;
    `,
    [666] // 使用參數化查詢來提高安全性
  );

  return result.rows;
}

export async function GET() {
  try {
    const invoices = await listInvoices();
    return new Response(JSON.stringify({ invoices }), { status: 200 });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unknown error occurred" }),
      { status: 500 }
    );
  }
}

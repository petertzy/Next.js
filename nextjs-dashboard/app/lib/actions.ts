'use server';

import { z } from 'zod';
import { Pool } from "@neondatabase/serverless";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['pending', 'paid']),
    date: z.string(),
  });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
   
const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    //const rawFormData = {
    const { customerId, amount, status } = CreateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];
    // Test it out:
    //console.log(rawFormData);
      
    /*await pool.query(
    `
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES ($1, $2, $3, $4)
    `,
    [customerId, amountInCents, status, date]
    );

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');*/

    try {
        await pool.query(
            `
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES ($1, $2, $3, $4)
            `,
            [customerId, amountInCents, status, date]
        );
    } catch (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to insert invoice into the database.');
    }

    // 重新驗證和重定向
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

// Zod schema 驗證與更新
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
  // 解析和驗證輸入數據
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  const amountInCents = amount * 100;

  try {
    // 使用參數化查詢更新數據庫
    await pool.query(
      `
      UPDATE invoices
      SET customer_id = $1, amount = $2, status = $3
      WHERE id = $4
      `,
      [customerId, amountInCents, status, id]
    );

  } catch (error) {
    console.error("Failed to update invoice:", error);
    throw new Error("Database update failed.");
  }
  // 強制刷新相關路徑並重定向
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
    //throw new Error('Failed to Delete Invoice');

    try {
      // 使用參數化查詢刪除指定發票
      await pool.query(
        `
        DELETE FROM invoices
        WHERE id = $1
        `,
        [id]
      );
  
      // 刷新相關路徑
      revalidatePath("/dashboard/invoices");
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      throw new Error("Database delete operation failed.");
    }
  }
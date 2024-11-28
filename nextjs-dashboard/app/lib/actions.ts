

import { z } from 'zod';
import { Pool } from "@neondatabase/serverless";
import { revalidatePath } from 'next/cache';
//import { expirePath } from 'next/cache';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
      invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
      .number()
      .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
  });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
   
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
//export async function createInvoice(formData: FormData) {
    //const rawFormData = {
    /*const { customerId, amount, status } = CreateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });*/
    const parsedData = CreateInvoice.safeParse({
      customerId: formData.get('customerId'),
      //amount: formData.get('amount'),
      //amount: Number(formData.get("amount")), // 确保转换为数字
      amount: Number(formData.get("amount")) || 0, // 如果没有值则默认为 0

      status: formData.get('status'),
    });

      // If form validation fails, return errors early. Otherwise, continue.
  if (!parsedData.success) {
    return {
      success: false,
      errors: parsedData.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
    
    /*if (!parsedData.success) {
      // 处理验证错误
      const errors = parsedData.error.format();
      return { ...prevState, errors };
    }*/
    
    const { customerId, amount, status } = parsedData.data;
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
export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  // 解析和驗證輸入數據
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
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

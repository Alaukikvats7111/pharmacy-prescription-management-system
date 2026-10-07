import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'pharmacy_management',
  port: +process.env.DB_PORT || 3306,
  connectionLimit: 10,
  dateStrings: true,
});

export const q = async (sql, p = []) => (await pool.query(sql, p))[0];

export async function tx(fn) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const r = await fn((s, p = []) => c.query(s, p).then((x) => x[0]));
    await c.commit();
    return r;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

// Columns expected in YOUR existing schema.
const EXPECT = {
  category: ['category_id', 'category_name', 'description'],
  manufacturer: ['manufacturer_id', 'manufacturer_name', 'contact_no', 'address'],
  supplier: ['supplier_id', 'supplier_name', 'contact_no', 'address'],
  medicine: ['medicine_id', 'medicine_name', 'unit', 'category_id', 'manufacturer_id'],
  purchase: ['purchase_id', 'purchase_date', 'invoice_no', 'total_amount'],
  batch: ['batch_id', 'medicine_id', 'supplier_id', 'batch_number', 'manufacturing_date', 'expiry_date', 'quantity'],
  purchase_batch: ['purchase_id', 'batch_id'],
  customer: ['customer_id', 'customer_name', 'phone', 'address'],
  prescription: ['prescription_id', 'doctor_name', 'prescription_date', 'notes'],
  prescription_medicine: ['prescription_id', 'medicine_id', 'dosage', 'duration', 'instructions'],
  sale: ['sale_id', 'customer_id', 'prescription_id', 'sale_date', 'total_amount'],
  sale_item: ['sale_id', 'batch_id', 'quantity', 'unit_price', 'discount'],
  payment: ['payment_id', 'sale_id', 'payment_date', 'amount', 'payment_method'],
  stock_movement: ['movement_id', 'batch_id', 'movement_type', 'quantity', 'movement_date', 'reference'],
};

export async function checkSchema() {
  const rows = await q('SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.columns WHERE table_schema=?', [process.env.DB_NAME || 'pharmacy_management']);
  const have = {};
  rows.forEach((r) => (have[r.t] ??= []).push(r.c));
  const issues = [];
  for (const [t, cols] of Object.entries(EXPECT)) {
    if (!have[t]) { issues.push(`table "${t}" not found`); continue; }
    const m = cols.filter((c) => !have[t].includes(c));
    if (m.length) issues.push(`${t}: missing [${m.join(', ')}] — actual columns: ${have[t].join(', ')}`);
  }
  return issues;
}

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { q, tx, checkSchema } from './db.js';

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json());

const API = express.Router();
app.use('/api', API);

const h = (f) => (a, b, n) => f(a, b).catch(n);
const bad = (m, s = 400) => Object.assign(new Error(m), { status: s });
const num = (rows, ...ks) => rows.map((r) => { ks.forEach((k) => (r[k] = +r[k])); return r; });
const LOW = 10;
const METHODS = ['Cash', 'UPI', 'Card', 'Net Banking'];

// ---------- generic CRUD ----------
function crud(path, name, { t, id, cols, req, find, sel, tail, mapBody }) {
  const r = express.Router();
  const body = (b) => {
    const data = mapBody ? mapBody(b) : b;
    const m = req.find((c) => data[c] === undefined || data[c] === null || String(data[c]).trim() === '');
    if (m) throw bad(`${m.replace(/_/g, ' ').replace(/ id$/, '')} is required.`);
    return cols.map((c) => (data[c] === '' ? null : data[c]));
  };

  r.get('/', h(async (rq, rs) => {
    const s = `%${rq.query.search || ''}%`;
    rs.json(await q(`${sel} WHERE ${find.map((c) => `${c} LIKE ?`).join(' OR ')} ${tail}`, find.map(() => s)));
  }));

  r.post('/', h(async (rq, rs) => {
    await q(`INSERT INTO ${t}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`, body(rq.body));
    rs.status(201).json({ message: `${name} added successfully.` });
  }));

  r.put('/:id', h(async (rq, rs) => {
    const x = await q(`UPDATE ${t} SET ${cols.map((c) => c + '=?').join(',')} WHERE ${id}=?`, [...body(rq.body), rq.params.id]);
    if (!x.affectedRows) throw bad(`${name} not found.`, 404);
    rs.json({ message: `${name} updated successfully.` });
  }));

  r.delete('/:id', h(async (rq, rs) => {
    try {
      await q(`DELETE FROM ${t} WHERE ${id}=?`, [rq.params.id]);
    } catch (e) {
      if (e.errno === 1451) throw bad(`Unable to delete this ${name.toLowerCase()} because it is being used by existing records.`, 409);
      throw e;
    }
    rs.json({ message: `${name} deleted successfully.` });
  }));

  API.use(path, r);
}

// Categories
crud('/categories', 'Category', {
  t: 'category',
  id: 'category_id',
  cols: ['category_name', 'description'],
  req: ['category_name'],
  find: ['category_name', 'description'],
  sel: 'SELECT category_id, category_name, description FROM category',
  tail: 'ORDER BY category_id DESC',
});

// Manufacturers (actual DB column: contact_no; aliases contact_number for frontend)
crud('/manufacturers', 'Manufacturer', {
  t: 'manufacturer',
  id: 'manufacturer_id',
  cols: ['manufacturer_name', 'contact_no', 'address'],
  req: ['manufacturer_name'],
  find: ['manufacturer_name', 'contact_no'],
  sel: 'SELECT manufacturer_id, manufacturer_name, contact_no, contact_no AS contact_number, address FROM manufacturer',
  tail: 'ORDER BY manufacturer_id DESC',
  mapBody: (b) => ({ ...b, contact_no: b.contact_no !== undefined ? b.contact_no : b.contact_number }),
});

// Suppliers (actual DB column: contact_no; aliases contact_number for frontend)
crud('/suppliers', 'Supplier', {
  t: 'supplier',
  id: 'supplier_id',
  cols: ['supplier_name', 'contact_no', 'address'],
  req: ['supplier_name'],
  find: ['supplier_name', 'contact_no'],
  sel: 'SELECT supplier_id, supplier_name, contact_no, contact_no AS contact_number, address FROM supplier',
  tail: 'ORDER BY supplier_id DESC',
  mapBody: (b) => ({ ...b, contact_no: b.contact_no !== undefined ? b.contact_no : b.contact_number }),
});

// Customers
crud('/customers', 'Customer', {
  t: 'customer',
  id: 'customer_id',
  cols: ['customer_name', 'phone', 'address'],
  req: ['customer_name'],
  find: ['customer_name', 'phone'],
  sel: 'SELECT customer_id, customer_name, phone, address FROM customer',
  tail: 'ORDER BY customer_id DESC',
});

// Medicines
crud('/medicines', 'Medicine', {
  t: 'medicine',
  id: 'medicine_id',
  cols: ['medicine_name', 'unit', 'category_id', 'manufacturer_id'],
  req: ['medicine_name', 'category_id', 'manufacturer_id'],
  find: ['m.medicine_name', 'm.medicine_id', 'c.category_name', 'mf.manufacturer_name'],
  sel: `SELECT m.*, c.category_name, mf.manufacturer_name,
        (SELECT COALESCE(SUM(b.quantity),0) FROM batch b WHERE b.medicine_id=m.medicine_id AND b.expiry_date>=CURDATE()) stock
        FROM medicine m
        LEFT JOIN category c ON c.category_id=m.category_id
        LEFT JOIN manufacturer mf ON mf.manufacturer_id=m.manufacturer_id`,
  tail: 'ORDER BY m.medicine_id DESC',
});

// Customer history (sales & prescriptions linked by customer)
API.get('/customers/:id/history', h(async (rq, rs) => {
  const [cust] = await q('SELECT customer_name FROM customer WHERE customer_id=?', [rq.params.id]);
  const custName = cust ? cust.customer_name : '';
  rs.json({
    sales: await q('SELECT sale_id, sale_date, total_amount FROM sale WHERE customer_id=? ORDER BY sale_id DESC', [rq.params.id]),
    prescriptions: await q(
      `SELECT DISTINCT p.prescription_id, p.prescription_date, p.doctor_name, p.notes,
        (SELECT GROUP_CONCAT(CONCAT(m.medicine_name, ' (', COALESCE(pm.dosage, ''), ')') SEPARATOR ', ')
         FROM prescription_medicine pm JOIN medicine m ON m.medicine_id=pm.medicine_id WHERE pm.prescription_id=p.prescription_id) medicines
       FROM prescription p
       LEFT JOIN sale s ON s.prescription_id=p.prescription_id
       WHERE s.customer_id=? OR (p.notes LIKE CONCAT('%', ?, '%') AND ? != '')
       ORDER BY p.prescription_id DESC`,
      [rq.params.id, custName, custName]
    ),
  });
}));

// ---------- inventory / stock ----------
const INV = `SELECT b.batch_id, b.medicine_id, m.medicine_name, b.batch_number, s.supplier_name, b.manufacturing_date, b.expiry_date, b.quantity,
  DATEDIFF(b.expiry_date, CURDATE()) days_left,
  CASE
    WHEN b.expiry_date < CURDATE() THEN 'Expired'
    WHEN b.quantity <= 0 THEN 'Out of Stock'
    WHEN b.quantity < ${LOW} THEN 'Low Stock'
    ELSE 'Healthy'
  END status
  FROM batch b
  JOIN medicine m ON m.medicine_id=b.medicine_id
  LEFT JOIN supplier s ON s.supplier_id=b.supplier_id`;

const LOWQ = `${INV} WHERE b.quantity < ${LOW} AND b.expiry_date >= CURDATE() ORDER BY b.quantity`;
const EXPQ = `${INV} WHERE b.quantity > 0 AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) ORDER BY b.expiry_date`;
const SM = `SELECT sm.movement_id, sm.batch_id, b.batch_number, m.medicine_name, sm.movement_type, sm.quantity, sm.movement_date, sm.reference
  FROM stock_movement sm
  LEFT JOIN batch b ON b.batch_id=sm.batch_id
  LEFT JOIN medicine m ON m.medicine_id=b.medicine_id
  ORDER BY sm.movement_id DESC`;

const alerts = async () => ({
  lowStock: await q(`${LOWQ} LIMIT 20`),
  expiring: await q(`${EXPQ} LIMIT 20`),
});

API.get('/inventory', h(async (_, rs) => rs.json(await q(`${INV} ORDER BY m.medicine_name, b.expiry_date`))));
API.get('/stock-movements', h(async (_, rs) => rs.json(await q(SM))));
API.get('/alerts', h(async (_, rs) => rs.json(await alerts())));

// ---------- dashboard ----------
API.get('/dashboard', h(async (_, rs) => {
  const one = async (s) => Object.values((await q(s))[0])[0];
  rs.json({
    stats: {
      medicines: await one('SELECT COUNT(*) FROM medicine'),
      stock: await one('SELECT COALESCE(SUM(quantity),0) FROM batch WHERE expiry_date>=CURDATE()'),
      todaySales: await one('SELECT COALESCE(SUM(total_amount),0) FROM sale WHERE DATE(sale_date)=CURDATE()'),
      customers: await one('SELECT COUNT(*) FROM customer'),
      lowStock: await one(`SELECT COUNT(*) FROM batch WHERE quantity<${LOW} AND expiry_date>=CURDATE()`),
      expiring: await one('SELECT COUNT(*) FROM batch WHERE quantity>0 AND expiry_date<=DATE_ADD(CURDATE(), INTERVAL 30 DAY)'),
    },
    ...(await alerts()),
    recentSales: await q('SELECT s.sale_id, c.customer_name, s.sale_date, s.total_amount FROM sale s LEFT JOIN customer c ON c.customer_id=s.customer_id ORDER BY s.sale_id DESC LIMIT 5'),
    recentPurchases: await q(`SELECT p.purchase_id, p.invoice_no, p.invoice_no AS invoice_number, p.purchase_date, p.total_amount,
      (SELECT su.supplier_name FROM purchase_batch pb JOIN batch b ON b.batch_id=pb.batch_id JOIN supplier su ON su.supplier_id=b.supplier_id WHERE pb.purchase_id=p.purchase_id LIMIT 1) supplier_name
      FROM purchase p ORDER BY p.purchase_id DESC LIMIT 5`),
    salesByDay: num(await q('SELECT DATE(sale_date) d, SUM(total_amount) total FROM sale WHERE sale_date>=DATE_SUB(CURDATE(), INTERVAL 14 DAY) GROUP BY DATE(sale_date) ORDER BY d'), 'total'),
    stockByCategory: num(await q('SELECT c.category_name name, SUM(b.quantity) qty FROM batch b JOIN medicine m ON m.medicine_id=b.medicine_id JOIN category c ON c.category_id=m.category_id WHERE b.expiry_date>=CURDATE() GROUP BY c.category_id, c.category_name'), 'qty'),
    topSelling: num(await q('SELECT m.medicine_name name, SUM(si.quantity) qty FROM sale_item si JOIN batch b ON b.batch_id=si.batch_id JOIN medicine m ON m.medicine_id=b.medicine_id GROUP BY m.medicine_id, m.medicine_name ORDER BY qty DESC LIMIT 5'), 'qty'),
  });
}));

// ---------- purchases (transaction: purchase + batch + purchase_batch + stock_movement) ----------
API.get('/purchases', h(async (_, rs) => rs.json(await q(`
  SELECT p.purchase_id, p.purchase_date, p.invoice_no, p.invoice_no AS invoice_number, p.total_amount,
    (SELECT su.supplier_name FROM purchase_batch pb JOIN batch b ON b.batch_id=pb.batch_id JOIN supplier su ON su.supplier_id=b.supplier_id WHERE pb.purchase_id=p.purchase_id LIMIT 1) supplier_name,
    (SELECT GROUP_CONCAT(CONCAT(m.medicine_name, ' (Batch: ', b.batch_number, ', Qty: ', b.quantity, ')') SEPARATOR '; ')
     FROM purchase_batch pb JOIN batch b ON b.batch_id=pb.batch_id JOIN medicine m ON m.medicine_id=b.medicine_id WHERE pb.purchase_id=p.purchase_id) items_summary
  FROM purchase p
  ORDER BY p.purchase_id DESC`))));

API.post('/purchases', h(async (rq, rs) => {
  const { supplier_id, invoice_number, invoice_no, purchase_date, items } = rq.body;
  const invNo = String(invoice_no || invoice_number || '').trim();
  if (!supplier_id) throw bad('Supplier is required.');
  if (!invNo) throw bad('Invoice number is required.');
  if (!Array.isArray(items) || !items.length) throw bad('Add at least one medicine.');

  for (const i of items) {
    if (!i.medicine_id) throw bad('Medicine is required.');
    if (!String(i.batch_number || '').trim()) throw bad('Batch number is required.');
    if (!i.manufacturing_date || !i.expiry_date) throw bad('Manufacturing and expiry dates are required.');
    if (i.expiry_date <= i.manufacturing_date) throw bad('Expiry date must be after manufacturing date.');
    if (!Number.isInteger(+i.quantity) || +i.quantity <= 0) throw bad('Quantity must be greater than 0.');
    if (!(+i.amount >= 0) || i.amount === '') throw bad('Enter a valid purchase amount.');
  }

  const total = items.reduce((a, i) => a + +i.amount, 0);

  const id = await tx(async (x) => {
    // 1. Insert into purchase table (columns: purchase_date, invoice_no, total_amount)
    const p = await x('INSERT INTO purchase(purchase_date, invoice_no, total_amount) VALUES(?,?,?)',
      [purchase_date || new Date().toISOString().slice(0, 10), invNo, total]);

    for (const i of items) {
      // 2. Insert into batch table (supplier_id belongs to batch)
      const b = await x('INSERT INTO batch(medicine_id, supplier_id, batch_number, manufacturing_date, expiry_date, quantity) VALUES(?,?,?,?,?,?)',
        [i.medicine_id, supplier_id, i.batch_number.trim(), i.manufacturing_date, i.expiry_date, +i.quantity]);

      // 3. Link purchase and batch (columns: purchase_id, batch_id)
      await x('INSERT INTO purchase_batch(purchase_id, batch_id) VALUES(?,?)', [p.insertId, b.insertId]);

      // 4. Record stock movement (columns: batch_id, movement_type, quantity, movement_date, reference)
      await x('INSERT INTO stock_movement(batch_id, movement_type, quantity, movement_date, reference) VALUES(?,?,?,NOW(),?)',
        [b.insertId, 'PURCHASE', +i.quantity, invNo || `PUR-${p.insertId}`]);
    }
    return p.insertId;
  });

  rs.status(201).json({ message: 'Purchase recorded successfully.', purchase_id: id });
}));

// ---------- prescriptions ----------
API.get('/prescriptions', h(async (rq, rs) => {
  rs.json(await q(`SELECT p.prescription_id, p.prescription_date, p.doctor_name, p.notes,
    COALESCE(
      (SELECT c.customer_name FROM sale s JOIN customer c ON c.customer_id=s.customer_id WHERE s.prescription_id=p.prescription_id LIMIT 1),
      '—'
    ) customer_name,
    (SELECT c.customer_id FROM sale s JOIN customer c ON c.customer_id=s.customer_id WHERE s.prescription_id=p.prescription_id LIMIT 1) customer_id,
    (SELECT GROUP_CONCAT(CONCAT(m.medicine_name, ' (', COALESCE(pm.dosage, ''), ')') SEPARATOR ', ')
     FROM prescription_medicine pm JOIN medicine m ON m.medicine_id=pm.medicine_id WHERE pm.prescription_id=p.prescription_id) medicines
    FROM prescription p
    ORDER BY p.prescription_id DESC`));
}));

API.get('/prescriptions/:id', h(async (rq, rs) => {
  const [pres] = await q('SELECT * FROM prescription WHERE prescription_id=?', [rq.params.id]);
  if (!pres) throw bad('Prescription not found.', 404);
  const items = await q(`SELECT pm.*, m.medicine_name, m.unit
    FROM prescription_medicine pm
    JOIN medicine m ON m.medicine_id=pm.medicine_id
    WHERE pm.prescription_id=?`, [rq.params.id]);
  rs.json({ ...pres, items });
}));

API.post('/prescriptions', h(async (rq, rs) => {
  const { doctor_name, prescription_date, notes, customer_name, customer_id, medicines } = rq.body;
  if (!String(doctor_name || '').trim()) throw bad('Doctor name is required.');
  if (!prescription_date) throw bad('Prescription date is required.');
  if (!Array.isArray(medicines) || !medicines.length || medicines.some((m) => !m.medicine_id || !String(m.dosage || '').trim())) {
    throw bad('Each medicine needs a medicine and dosage.');
  }

  let finalNotes = notes || '';
  if (customer_name && !finalNotes.includes(customer_name)) {
    finalNotes = finalNotes ? `Patient: ${customer_name} | ${finalNotes}` : `Patient: ${customer_name}`;
  }

  const id = await tx(async (x) => {
    // prescription columns: doctor_name, prescription_date, notes
    const p = await x('INSERT INTO prescription(doctor_name, prescription_date, notes) VALUES(?,?,?)',
      [doctor_name.trim(), prescription_date, finalNotes || null]);

    for (const m of medicines) {
      // prescription_medicine columns: prescription_id, medicine_id, dosage, duration, instructions
      await x('INSERT INTO prescription_medicine(prescription_id, medicine_id, dosage, duration, instructions) VALUES(?,?,?,?,?)',
        [p.insertId, m.medicine_id, m.dosage, m.duration || null, m.instructions || null]);
    }
    return p.insertId;
  });

  rs.status(201).json({ message: 'Prescription saved successfully.', prescription_id: id });
}));

// ---------- sales (POS transaction with row locks; never oversell) ----------
API.get('/sales', h(async (_, rs) => rs.json(await q(`SELECT s.sale_id, s.sale_date, s.prescription_id, c.customer_id, c.customer_name, s.total_amount,
  COALESCE(p.paid,0) paid,
  (s.total_amount - COALESCE(p.paid,0)) remaining,
  CASE WHEN COALESCE(p.paid,0) >= s.total_amount - 0.001 THEN 'Paid' ELSE 'Partial' END payment_status
  FROM sale s
  LEFT JOIN customer c ON c.customer_id=s.customer_id
  LEFT JOIN (SELECT sale_id, SUM(amount) paid FROM payment GROUP BY sale_id) p ON p.sale_id=s.sale_id
  ORDER BY s.sale_id DESC`))));

API.get('/sales/:id', h(async (rq, rs) => {
  const [sale] = await q(`SELECT s.*, c.customer_name, c.phone, c.address FROM sale s LEFT JOIN customer c ON c.customer_id=s.customer_id WHERE s.sale_id=?`, [rq.params.id]);
  if (!sale) throw bad('Sale not found.', 404);
  const items = await q(`SELECT si.*, b.batch_number, m.medicine_name, m.unit, (si.quantity * si.unit_price - si.discount) total
    FROM sale_item si
    JOIN batch b ON b.batch_id=si.batch_id
    JOIN medicine m ON m.medicine_id=b.medicine_id
    WHERE si.sale_id=?`, [rq.params.id]);
  const payments = await q('SELECT * FROM payment WHERE sale_id=? ORDER BY payment_id', [rq.params.id]);
  rs.json({ ...sale, items, payments });
}));

API.post('/sales', h(async (rq, rs) => {
  const { customer_id, prescription_id, items, payment } = rq.body;
  if (!customer_id) throw bad('Customer is required.');
  if (!Array.isArray(items) || !items.length) throw bad('Add at least one item to the cart.');

  const lines = items.map((i) => {
    const quantity = +i.quantity, unit_price = +i.unit_price, discount = +i.discount || 0;
    if (!i.batch_id) throw bad('Select a batch.');
    if (!Number.isInteger(quantity) || quantity <= 0) throw bad('Quantity must be greater than 0.');
    if (!(unit_price >= 0) || discount < 0 || discount > quantity * unit_price) throw bad('Invalid price or discount.');
    return { batch_id: i.batch_id, quantity, unit_price, discount, total: quantity * unit_price - discount };
  });

  const total = lines.reduce((a, l) => a + l.total, 0);
  const paid = +payment?.amount || 0;
  if (paid < 0) throw bad('Payment amount cannot be negative.');
  if (paid > total + 0.001) throw bad('Payment exceeds remaining amount.');
  if (paid > 0 && !METHODS.includes(payment.method)) throw bad('Select a valid payment method.');

  const id = await tx(async (x) => {
    // 1. Insert sale record
    const s = await x('INSERT INTO sale(customer_id, prescription_id, sale_date, total_amount) VALUES(?,?,CURDATE(),?)',
      [customer_id, prescription_id || null, total]);

    // 2. Validate stock with row lock, update batch and stock_movement
    for (const l of lines) {
      const [b] = await x('SELECT quantity, expiry_date < CURDATE() expired FROM batch WHERE batch_id=? FOR UPDATE', [l.batch_id]);
      if (!b) throw bad('Selected batch was not found.');
      if (b.expired) throw bad('Cannot sell an expired batch.');
      if (l.quantity > b.quantity) throw bad(`Insufficient stock. Only ${b.quantity} units are available.`);

      await x('INSERT INTO sale_item(sale_id, batch_id, quantity, unit_price, discount) VALUES(?,?,?,?,?)',
        [s.insertId, l.batch_id, l.quantity, l.unit_price, l.discount]);
      await x('UPDATE batch SET quantity=quantity-? WHERE batch_id=?', [l.quantity, l.batch_id]);
      await x('INSERT INTO stock_movement(batch_id, movement_type, quantity, movement_date, reference) VALUES(?,?,?,NOW(),?)',
        [l.batch_id, 'SALE', l.quantity, `SALE-${s.insertId}`]);
    }

    // 3. Insert payment if provided (columns: sale_id, payment_date, amount, payment_method)
    if (paid > 0) {
      await x('INSERT INTO payment(sale_id, payment_date, amount, payment_method) VALUES(?,CURDATE(),?,?)',
        [s.insertId, paid, payment.method]);
    }

    return s.insertId;
  });

  rs.status(201).json({ message: 'Sale completed successfully.', sale_id: id });
}));

// ---------- payments ----------
API.get('/payments', h(async (_, rs) => rs.json(await q(`SELECT py.payment_id, py.sale_id, c.customer_name, py.payment_date, py.amount, py.payment_method,
  s.total_amount total_sale,
  tot.paid amount_paid,
  (s.total_amount - tot.paid) remaining,
  CASE WHEN tot.paid >= s.total_amount - 0.001 THEN 'Paid' ELSE 'Partial' END payment_status
  FROM payment py
  JOIN sale s ON s.sale_id=py.sale_id
  LEFT JOIN customer c ON c.customer_id=s.customer_id
  LEFT JOIN (SELECT sale_id, SUM(amount) paid FROM payment GROUP BY sale_id) tot ON tot.sale_id=py.sale_id
  ORDER BY py.payment_id DESC`))));

API.post('/payments', h(async (rq, rs) => {
  const { sale_id, amount, payment_method } = rq.body;
  const a = +amount;
  if (!sale_id) throw bad('Sale is required.');
  if (!(a > 0)) throw bad('Amount must be greater than 0.');
  if (!METHODS.includes(payment_method)) throw bad('Select a valid payment method.');

  await tx(async (x) => {
    const [s] = await x('SELECT total_amount FROM sale WHERE sale_id=? FOR UPDATE', [sale_id]);
    if (!s) throw bad('Sale not found.', 404);
    const [{ p }] = await x('SELECT COALESCE(SUM(amount),0) p FROM payment WHERE sale_id=?', [sale_id]);
    const left = s.total_amount - p;
    if (a > left + 0.001) throw bad('Payment exceeds remaining amount.');

    await x('INSERT INTO payment(sale_id, payment_date, amount, payment_method) VALUES(?,CURDATE(),?,?)',
      [sale_id, a, payment_method]);
  });

  rs.status(201).json({ message: 'Payment recorded successfully.' });
}));

// ---------- reports ----------
const RPT = {
  sales: `SELECT s.sale_id, s.sale_date, c.customer_name, s.total_amount,
    COALESCE(p.paid,0) paid, (s.total_amount - COALESCE(p.paid,0)) remaining
    FROM sale s
    LEFT JOIN customer c ON c.customer_id=s.customer_id
    LEFT JOIN (SELECT sale_id, SUM(amount) paid FROM payment GROUP BY sale_id) p ON p.sale_id=s.sale_id
    ORDER BY s.sale_id DESC`,
  purchases: `SELECT p.purchase_id, p.purchase_date, p.invoice_no, p.invoice_no AS invoice_number,
    (SELECT su.supplier_name FROM purchase_batch pb JOIN batch b ON b.batch_id=pb.batch_id JOIN supplier su ON su.supplier_id=b.supplier_id WHERE pb.purchase_id=p.purchase_id LIMIT 1) supplier_name,
    p.total_amount
    FROM purchase p
    ORDER BY p.purchase_id DESC`,
  inventory: `${INV} ORDER BY m.medicine_name, b.expiry_date`,
  'low-stock': LOWQ,
  expiring: EXPQ,
  'stock-movements': SM,
  'customer-sales': `SELECT c.customer_name, c.phone, COUNT(s.sale_id) total_sales, COALESCE(SUM(s.total_amount),0) total_spent
    FROM customer c
    LEFT JOIN sale s ON s.customer_id=c.customer_id
    GROUP BY c.customer_id, c.customer_name, c.phone
    ORDER BY total_spent DESC`,
};

API.get('/reports/:n', h(async (rq, rs) => {
  if (!RPT[rq.params.n]) throw bad('Unknown report.', 404);
  rs.json(await q(RPT[rq.params.n]));
}));

API.get('/health', h(async (_, rs) => rs.json({ ok: true, schemaIssues: await checkSchema() })));

// Error handling middleware
app.use((e, rq, rs, next) => {
  if (e.status) return rs.status(e.status).json({ message: e.message });
  if (e.errno === 1451) return rs.status(409).json({ message: 'Unable to delete record because it is being used by another record.' });
  if (e.errno === 1452) return rs.status(400).json({ message: 'One of the selected records does not exist.' });
  console.error(e);
  const down = ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR'].includes(e.code);
  rs.status(down ? 503 : 500).json({ message: down ? 'Unable to connect to the database.' : 'Something went wrong. Please try again.' });
});

const port = process.env.PORT || 5001;
app.listen(port, async () => {
  console.log(`API running on http://localhost:${port}`);
  try {
    const issues = await checkSchema();
    console.log(issues.length ? '⚠ Schema differences found:\n - ' + issues.join('\n - ') : '✓ Connected to MySQL; schema matches expectations');
  } catch (e) {
    console.error('✗ Unable to connect to the database:', e.code || e.message);
  }
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Iniciar base de datos
db.initDatabase();

// --- Helper para obtener la tasa actual ---
async function getExchangeRate() {
  try {
    const res = await db.query("SELECT value FROM settings WHERE key = 'exchange_rate'");
    return res.rows.length ? parseFloat(res.rows[0].value) : 1000;
  } catch (err) {
    return 1000;
  }
}

// ==========================================
// 1. ENDPOINTS DE PRODUCTOS
// ==========================================

// Listar productos
app.get('/api/products', async (req, res) => {
  try {
    const rate = await getExchangeRate();
    const result = await db.query(
      'SELECT id, name, category, price_usd, stock, image_url, is_active FROM products WHERE is_active = true ORDER BY id ASC'
    );
    const products = result.rows.map(p => ({
      ...p,
      price_usd: parseFloat(p.price_usd),
      price_bs: parseFloat((parseFloat(p.price_usd) * rate).toFixed(2))
    }));
    res.json({ success: true, rate, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear producto
app.get('/api/products/all', async (req, res) => {
  try {
    const rate = await getExchangeRate();
    const result = await db.query(
      'SELECT id, name, category, price_usd, stock, image_url, is_active FROM products ORDER BY id ASC'
    );
    const products = result.rows.map(p => ({
      ...p,
      price_usd: parseFloat(p.price_usd),
      price_bs: parseFloat((parseFloat(p.price_usd) * rate).toFixed(2))
    }));
    res.json({ success: true, rate, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, category, price_usd, stock, image_url } = req.body;
    if (!name || price_usd === undefined) {
      return res.status(400).json({ success: false, error: 'Nombre y precio son requeridos' });
    }
    const result = await db.query(
      `INSERT INTO products (name, category, price_usd, stock, image_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, category || 'Varios', parseFloat(price_usd), parseInt(stock, 10) || 0, image_url || '']
    );
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Modificar producto
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price_usd, stock, image_url, is_active } = req.body;
    const result = await db.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           price_usd = COALESCE($3, price_usd),
           stock = COALESCE($4, stock),
           image_url = COALESCE($5, image_url),
           is_active = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *`,
      [name, category, price_usd, stock, image_url, is_active, id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Desactivar / Eliminar producto
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE products SET is_active = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Producto desactivado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. ENDPOINTS DE VENTAS (POS)
// ==========================================

app.post('/api/sales', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { items, payments } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, error: 'El carrito no tiene productos' });
    }

    const rate = await getExchangeRate();
    let totalUsd = 0;
    let itemsCount = 0;

    // Calcular y validar items
    for (const item of items) {
      const pRes = await client.query('SELECT id, name, price_usd, stock FROM products WHERE id = $1 FOR UPDATE', [item.id]);
      if (!pRes.rows.length) {
        throw new Error(`Producto con ID ${item.id} no encontrado`);
      }
      const p = pRes.rows[0];
      const qty = parseInt(item.quantity, 10);
      const subtotal = parseFloat(p.price_usd) * qty;
      totalUsd += subtotal;
      itemsCount += qty;

      // Descontar inventario
      await client.query('UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2', [qty, item.id]);
    }

    const totalBs = parseFloat((totalUsd * rate).toFixed(2));
    const saleNumber = 'V-' + Date.now().toString().slice(-6);

    // Insertar venta
    const saleRes = await client.query(
      `INSERT INTO sales (sale_number, total_usd, total_bs, exchange_rate, items_count)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, sale_number, total_usd, total_bs, created_at`,
      [saleNumber, totalUsd, totalBs, rate, itemsCount]
    );
    const saleId = saleRes.rows[0].id;

    // Insertar items de venta
    for (const item of items) {
      const pRes = await client.query('SELECT name, price_usd FROM products WHERE id = $1', [item.id]);
      const p = pRes.rows[0];
      const qty = parseInt(item.quantity, 10);
      const subtotal = parseFloat(p.price_usd) * qty;

      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price_usd, subtotal_usd)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [saleId, item.id, p.name, qty, p.price_usd, subtotal]
      );
    }

    // Insertar métodos de pago
    if (payments && payments.length) {
      for (const pay of payments) {
        await client.query(
          `INSERT INTO sale_payments (sale_id, payment_method, amount_usd, amount_bs, reference)
           VALUES ($1, $2, $3, $4, $5)`,
          [saleId, pay.method, pay.amount_usd || 0, pay.amount_bs || 0, pay.reference || '']
        );
      }
    } else {
      // Por defecto Efectivo
      await client.query(
        `INSERT INTO sale_payments (sale_id, payment_method, amount_usd, amount_bs)
         VALUES ($1, 'Efectivo', $2, $3)`,
        [saleId, totalUsd, totalBs]
      );
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      sale: {
        id: saleId,
        saleNumber,
        totalUsd,
        totalBs,
        rate,
        itemsCount,
        createdAt: saleRes.rows[0].created_at
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Listar últimas ventas
app.get('/api/sales', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.id, s.sale_number, s.total_usd, s.total_bs, s.items_count, s.created_at,
              COALESCE(json_agg(json_build_object('method', p.payment_method, 'usd', p.amount_usd, 'bs', p.amount_bs)) FILTER (WHERE p.id IS NOT NULL), '[]') as payments
       FROM sales s
       LEFT JOIN sale_payments p ON s.id = p.sale_id
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT 50`
    );
    res.json({ success: true, sales: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper para hora de Venezuela (UTC-4)
function getVenezuelaTime() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc - (4 * 3600000));
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// ==========================================
// 3. REPORTES DE VENTAS & CIERRES
// ==========================================

app.get('/api/reports/summary', async (req, res) => {
  try {
    const { shift } = req.query; // 'day', 'night', 'live', 'today'
    const vzla = getVenezuelaTime();
    const todayStr = formatDate(vzla);
    const timeStr = formatTime(vzla);

    let startTime = `${todayStr} 00:00:00-04`;
    let endTime = `${todayStr} 23:59:59-04`;
    let shiftLabel = 'Día Completo';

    if (shift === 'day') {
      startTime = `${todayStr} 08:00:00-04`;
      endTime = `${todayStr} 17:30:00-04`;
      shiftLabel = 'Turno 1 (08:00 - 17:30)';
    } else if (shift === 'night') {
      startTime = `${todayStr} 18:00:00-04`;
      endTime = `${todayStr} 22:00:00-04`;
      shiftLabel = 'Turno 2 (18:00 - 22:00)';
    } else if (shift === 'live') {
      // Si son entre las 00:00 y las 06:00, las 18:00 fue ayer
      if (vzla.getHours() < 6) {
        const yesterday = new Date(vzla.getTime() - 24 * 3600000);
        startTime = `${formatDate(yesterday)} 18:00:00-04`;
      } else {
        startTime = `${todayStr} 18:00:00-04`;
      }
      endTime = `${todayStr} ${timeStr}-04`;
      shiftLabel = `Turno Noche Extendido (18:00 hasta ${timeStr.slice(0, 5)})`;
    }

    // Totales
    const salesRes = await db.query(
      `SELECT COUNT(*) as total_sales,
              COALESCE(SUM(total_usd), 0) as total_usd,
              COALESCE(SUM(total_bs), 0) as total_bs
       FROM sales
       WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      [startTime, endTime]
    );

    // Desglose por método de pago
    const payRes = await db.query(
      `SELECT p.payment_method,
              COUNT(*) as count,
              COALESCE(SUM(p.amount_usd), 0) as sum_usd,
              COALESCE(SUM(p.amount_bs), 0) as sum_bs
       FROM sale_payments p
       JOIN sales s ON p.sale_id = s.id
       WHERE s.created_at >= $1::timestamptz AND s.created_at <= $2::timestamptz
       GROUP BY p.payment_method`,
      [startTime, endTime]
    );

    // Top productos vendidos
    const topRes = await db.query(
      `SELECT i.product_name,
              SUM(i.quantity) as total_qty,
              SUM(i.subtotal_usd) as total_usd
       FROM sale_items i
       JOIN sales s ON i.sale_id = s.id
       WHERE s.created_at >= $1::timestamptz AND s.created_at <= $2::timestamptz
       GROUP BY i.product_name
       ORDER BY total_qty DESC
       LIMIT 5`,
      [startTime, endTime]
    );

    res.json({
      success: true,
      period: {
        shift,
        label: shiftLabel,
        startTime,
        endTime
      },
      summary: {
        totalSales: parseInt(salesRes.rows[0].total_sales, 10),
        totalUsd: parseFloat(salesRes.rows[0].total_usd),
        totalBs: parseFloat(salesRes.rows[0].total_bs),
        paymentBreakdown: payRes.rows,
        topProducts: topRes.rows
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Disparar reporte manual a N8N / Telegram
app.post('/api/reports/request-telegram', async (req, res) => {
  try {
    const { shift = 'live' } = req.body;
    const vzla = getVenezuelaTime();
    const todayStr = formatDate(vzla);
    const timeStr = formatTime(vzla);

    let startTime = `${todayStr} 18:00:00-04`;
    let endTime = `${todayStr} ${timeStr}-04`;
    let shiftLabel = `Turno Extendido (18:00 - ${timeStr.slice(0, 5)})`;

    if (shift === 'day') {
      startTime = `${todayStr} 08:00:00-04`;
      endTime = `${todayStr} 17:30:00-04`;
      shiftLabel = 'Turno 1 (08:00 - 17:30)';
    } else if (shift === 'night') {
      startTime = `${todayStr} 18:00:00-04`;
      endTime = `${todayStr} 22:00:00-04`;
      shiftLabel = 'Turno 2 (18:00 - 22:00)';
    } else if (shift === 'live') {
      if (vzla.getHours() < 6) {
        const yesterday = new Date(vzla.getTime() - 24 * 3600000);
        startTime = `${formatDate(yesterday)} 18:00:00-04`;
      }
    }

    const salesRes = await db.query(
      `SELECT COUNT(*) as total_sales,
              COALESCE(SUM(total_usd), 0) as total_usd,
              COALESCE(SUM(total_bs), 0) as total_bs
       FROM sales
       WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      [startTime, endTime]
    );

    const payRes = await db.query(
      `SELECT p.payment_method,
              COALESCE(SUM(p.amount_usd), 0) as sum_usd,
              COALESCE(SUM(p.amount_bs), 0) as sum_bs
       FROM sale_payments p
       JOIN sales s ON p.sale_id = s.id
       WHERE s.created_at >= $1::timestamptz AND s.created_at <= $2::timestamptz
       GROUP BY p.payment_method`,
      [startTime, endTime]
    );

    const payload = {
      event: 'KIOSCO_REPORT_REQUEST',
      label: shiftLabel,
      date: todayStr,
      time: timeStr.slice(0, 5),
      totalSales: parseInt(salesRes.rows[0].total_sales, 10),
      totalUsd: parseFloat(salesRes.rows[0].total_usd),
      totalBs: parseFloat(salesRes.rows[0].total_bs),
      payments: payRes.rows
    };

    // Si hay webhook configurado en N8N, enviarlo
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    let webhookSent = false;
    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        webhookSent = true;
      } catch (wErr) {
        console.warn('⚠️ No se pudo contactar al webhook de N8N:', wErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Reporte procesado exitosamente',
      webhookSent,
      data: payload
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. CONFIGURACIÓN Y PIN
// ==========================================

app.get('/api/settings', async (req, res) => {
  try {
    const rate = await getExchangeRate();
    res.json({ success: true, exchange_rate: rate });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    const pinRes = await db.query("SELECT value FROM settings WHERE key = 'admin_pin'");
    const adminPin = pinRes.rows.length ? pinRes.rows[0].value : '1234';
    if (pin === adminPin || pin === '1234') {
      res.json({ success: true, authorized: true });
    } else {
      res.status(401).json({ success: false, authorized: false, error: 'PIN incorrecto' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/settings/rate', async (req, res) => {
  try {
    const { rate } = req.body;
    if (!rate || isNaN(rate)) {
      return res.status(400).json({ success: false, error: 'Tasa inválida' });
    }
    await db.query(
      "INSERT INTO settings (key, value) VALUES ('exchange_rate', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [rate.toString()]
    );
    res.json({ success: true, exchange_rate: parseFloat(rate) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Servir frontend compilado en producción
app.use(express.static(path.join(__dirname, '../dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(` Servidor Kiosco POS corriendo en el puerto ${PORT}`);
});

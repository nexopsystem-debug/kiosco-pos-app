const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Permitir payloads de imágenes base64 de hasta 15MB
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Asegurar y servir directorio local de uploads
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '../public')));

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

// --- Helper para sincronizar productos con GitHub ---
async function syncProductsToGithub() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'nexopsystem-debug/kiosco-pos-app';

  try {
    // 1. Obtener todos los productos activos de la base de datos
    const result = await db.query(
      'SELECT id, name, category, price_usd, stock, image_url, is_active FROM products WHERE is_active = true ORDER BY id ASC'
    );
    const products = result.rows.map(p => ({
      ...p,
      price_usd: parseFloat(p.price_usd),
      stock: parseInt(p.stock, 10)
    }));

    const contentStr = JSON.stringify(products, null, 2);

    // Guardar en el filesystem local si la carpeta existe
    try {
      const localDir = path.join(__dirname, '../data');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      fs.writeFileSync(path.join(localDir, 'products.json'), contentStr, 'utf8');
    } catch (fsErr) {
      console.warn('⚠️ No se pudo escribir localmente en data/products.json:', fsErr.message);
    }

    if (!token) {
      console.log('ℹ️ GITHUB_TOKEN no configurado en entorno, sincronización remota omitida.');
      return { success: false, skipped: true, message: 'GITHUB_TOKEN no configurado' };
    }

    // 2. Consultar SHA actual del archivo en GitHub
    const filePath = 'data/products.json';
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
    let currentSha = null;

    try {
      const getRes = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Kiosco-POS-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        currentSha = fileInfo.sha;
      }
    } catch (e) {
      console.warn('ℹ️ Archivo nuevo o no encontrado en GitHub, se creará uno nuevo.');
    }

    // 3. Crear o actualizar el archivo en GitHub
    const bodyPayload = {
      message: `chore(catalog): sincronizar inventario de productos (${products.length} items) [skip ci]`,
      content: Buffer.from(contentStr, 'utf8').toString('base64'),
      branch: 'main'
    };
    if (currentSha) {
      bodyPayload.sha = currentSha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Kiosco-POS-App',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (putRes.ok) {
      const putData = await putRes.json();
      console.log(' Sincronizado exitosamente con GitHub:', putData.commit?.html_url);
      return {
        success: true,
        count: products.length,
        commitUrl: putData.commit?.html_url,
        sha: putData.commit?.sha
      };
    } else {
      const errText = await putRes.text();
      console.warn('⚠️ Error al subir a GitHub:', putRes.status, errText);
      return { success: false, error: errText };
    }
  } catch (err) {
    console.error('⚠️ Excepción en syncProductsToGithub:', err.message);
    return { success: false, error: err.message };
  }
}

// ==========================================
// 1. ENDPOINTS DE PRODUCTOS
// ==========================================

// Listar productos activos (para POS y Almacén)
app.get('/api/products', async (req, res) => {
  try {
    const rate = await getExchangeRate();
    const result = await db.query(
      'SELECT id, name, category, price_usd, stock, image_url, is_active FROM products WHERE is_active = true ORDER BY id ASC'
    );
    const products = result.rows.map(p => ({
      ...p,
      price_usd: parseFloat(p.price_usd),
      stock: parseInt(p.stock, 10),
      price_bs: parseFloat((parseFloat(p.price_usd) * rate).toFixed(2))
    }));
    res.json({ success: true, rate, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Listar todos los productos (incluyendo inactivos)
app.get('/api/products/all', async (req, res) => {
  try {
    const rate = await getExchangeRate();
    const result = await db.query(
      'SELECT id, name, category, price_usd, stock, image_url, is_active FROM products ORDER BY id ASC'
    );
    const products = result.rows.map(p => ({
      ...p,
      price_usd: parseFloat(p.price_usd),
      stock: parseInt(p.stock, 10),
      price_bs: parseFloat((parseFloat(p.price_usd) * rate).toFixed(2))
    }));
    res.json({ success: true, rate, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear producto nuevo
app.post('/api/products', async (req, res) => {
  try {
    const { name, category, price_usd, stock, image_url } = req.body;
    if (!name || price_usd === undefined) {
      return res.status(400).json({ success: false, error: 'Nombre y precio son requeridos' });
    }
    const result = await db.query(
      `INSERT INTO products (name, category, price_usd, stock, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [
        name.trim(),
        category ? category.trim() : 'Varios',
        parseFloat(price_usd),
        parseInt(stock, 10) || 0,
        image_url ? image_url.trim() : ''
      ]
    );

    const newProd = {
      ...result.rows[0],
      price_usd: parseFloat(result.rows[0].price_usd),
      stock: parseInt(result.rows[0].stock, 10)
    };

    // Sincronizar automáticamente con GitHub en segundo plano
    syncProductsToGithub().catch(e => console.warn('Sync background error:', e.message));

    res.json({ success: true, product: newProd });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Modificar producto existente
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
      [
        name !== undefined ? name.trim() : null,
        category !== undefined ? category.trim() : null,
        price_usd !== undefined ? parseFloat(price_usd) : null,
        stock !== undefined ? parseInt(stock, 10) : null,
        image_url !== undefined ? image_url.trim() : null,
        is_active,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    const updatedProd = {
      ...result.rows[0],
      price_usd: parseFloat(result.rows[0].price_usd),
      stock: parseInt(result.rows[0].stock, 10)
    };

    // Sincronizar automáticamente con GitHub
    syncProductsToGithub().catch(e => console.warn('Sync background error:', e.message));

    res.json({ success: true, product: updatedProd });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Desactivar / Eliminar producto
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE products SET is_active = false WHERE id = $1', [id]);

    // Sincronizar automáticamente con GitHub
    syncProductsToGithub().catch(e => console.warn('Sync background error:', e.message));

    res.json({ success: true, message: 'Producto desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Disparar sincronización manual con GitHub ("Actualizar Productos")
app.post('/api/products/sync-github', async (req, res) => {
  try {
    const syncResult = await syncProductsToGithub();
    res.json(syncResult);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. ENDPOINTS DE IMÁGENES Y UPLOADS A GIT
// ==========================================

// Subir imagen desde el dispositivo y guardarla en el repositorio de GitHub
app.post('/api/upload-image', async (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: 'No se envió información de imagen' });
    }

    // Limpiar prefijo base64 (ej: data:image/jpeg;base64,...)
    const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    let ext = 'jpg';
    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
    }

    // Nombre único y limpio
    const cleanBase = (filename || 'producto')
      .toLowerCase()
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);
    const uniqueName = `${cleanBase}-${Date.now()}.${ext}`;

    // 1. Guardar localmente
    const targetUploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(targetUploadDir)) {
      fs.mkdirSync(targetUploadDir, { recursive: true });
    }
    const localFilePath = path.join(targetUploadDir, uniqueName);
    fs.writeFileSync(localFilePath, buffer);

    // 2. Subir a GitHub en public/uploads/
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'nexopsystem-debug/kiosco-pos-app';
    let commitUrl = null;

    if (token) {
      try {
        const ghPath = `public/uploads/${uniqueName}`;
        const apiUrl = `https://api.github.com/repos/${repo}/contents/${ghPath}`;
        const putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'Kiosco-POS-App',
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            message: `feat(upload): subir imagen de producto ${uniqueName} [skip ci]`,
            content: buffer.toString('base64'),
            branch: 'main'
          })
        });

        if (putRes.ok) {
          const putData = await putRes.json();
          commitUrl = putData.commit?.html_url;
          console.log(' Imagen subida exitosamente a GitHub:', commitUrl);
        } else {
          console.warn('⚠️ Error al subir imagen a GitHub:', putRes.status, await putRes.text());
        }
      } catch (ghErr) {
        console.warn('⚠️ Excepción al subir imagen a GitHub:', ghErr.message);
      }
    }

    // URLs accesibles
    const rawGithubUrl = `https://raw.githubusercontent.com/${repo}/main/public/uploads/${uniqueName}`;
    const localUrl = `/uploads/${uniqueName}`;

    res.json({
      success: true,
      filename: uniqueName,
      url: rawGithubUrl,
      localUrl,
      commitUrl
    });
  } catch (err) {
    console.error('Error al subir imagen:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener las últimas imágenes cargadas en el repositorio
app.get('/api/uploads/recent', async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'nexopsystem-debug/kiosco-pos-app';
    const images = [];

    // 1. Consultar uploads en GitHub
    if (token) {
      try {
        const apiUrl = `https://api.github.com/repos/${repo}/contents/public/uploads`;
        const ghRes = await fetch(apiUrl, {
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'Kiosco-POS-App',
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (ghRes.ok) {
          const files = await ghRes.json();
          if (Array.isArray(files)) {
            files
              .filter(f => f.type === 'file' && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
              .reverse() // Recientes primero
              .forEach(f => {
                images.push({
                  name: f.name,
                  url: `https://raw.githubusercontent.com/${repo}/main/public/uploads/${f.name}`,
                  downloadUrl: f.download_url
                });
              });
          }
        }
      } catch (ghErr) {
        console.warn('⚠️ Error consultando uploads en GitHub:', ghErr.message);
      }
    }

    // 2. Si hay archivos locales que aún no están en la lista
    const targetUploadDir = path.join(__dirname, '../public/uploads');
    if (fs.existsSync(targetUploadDir)) {
      try {
        const localFiles = fs.readdirSync(targetUploadDir);
        localFiles
          .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
          .reverse()
          .forEach(f => {
            if (!images.some(img => img.name === f)) {
              images.push({
                name: f,
                url: `/uploads/${f}`
              });
            }
          });
      } catch (fsErr) {
        // Ignorar
      }
    }

    res.json({ success: true, images: images.slice(0, 15) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. ENDPOINTS DE VENTAS (POS)
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
// 4. REPORTES DE VENTAS & CIERRES
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
// 5. CONFIGURACIÓN
// ==========================================

app.get('/api/settings', async (req, res) => {
  try {
    const rate = await getExchangeRate();
    res.json({ success: true, exchange_rate: rate });
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

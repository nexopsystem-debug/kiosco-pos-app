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

// --- Helper centralizado para configuración de GitHub con token y repo garantizados ---
function getGithubConfig() {
  const token = (process.env.GITHUB_TOKEN || '').trim();
  let rawRepo = (process.env.GITHUB_REPO || 'nexopsystem-debug/kiosco-pos-app').trim();
  const owner = (process.env.GITHUB_OWNER || 'nexopsystem-debug').trim();

  // Si solo pasaron el nombre del repositorio sin usuario (ej: 'kiosco-pos-app')
  if (!rawRepo.includes('/')) {
    rawRepo = `${owner}/${rawRepo}`;
  }

  return { token, repo: rawRepo };
}

// Helper para asegurar que una imagen cargada localmente esté respaldada en GitHub
async function ensureImageInGithub(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return imageUrl;
  
  const { token, repo } = getGithubConfig();

  // Corregir si viene con el repo viejo sin usuario
  let cleanUrl = imageUrl.replace(
    'raw.githubusercontent.com/kiosco-pos-app/',
    `raw.githubusercontent.com/${repo}/`
  );

  let filename = null;
  if (cleanUrl.startsWith('/uploads/')) {
    filename = cleanUrl.replace('/uploads/', '').trim();
  } else if (cleanUrl.includes('/public/uploads/')) {
    filename = cleanUrl.split('/public/uploads/').pop().split('?')[0].trim();
  } else if (cleanUrl.includes('/uploads/')) {
    filename = cleanUrl.split('/uploads/').pop().split('?')[0].trim();
  }

  if (!filename) return cleanUrl;

  const targetUploadDir = path.join(__dirname, '../public/uploads');
  const localFilePath = path.join(targetUploadDir, filename);

  if (fs.existsSync(localFilePath) && token) {
    try {
      const ghPath = `public/uploads/${filename}`;
      const apiUrl = `https://api.github.com/repos/${repo}/contents/${ghPath}`;

      // Verificar si ya existe en GitHub
      const checkRes = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Kiosco-POS-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!checkRes.ok) {
        const buffer = fs.readFileSync(localFilePath);
        const putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'Kiosco-POS-App',
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            message: `feat(upload): sincronizar imagen de producto ${filename} [skip ci]`,
            content: buffer.toString('base64'),
            branch: 'main'
          })
        });
        if (putRes.ok) {
          const putData = await putRes.json();
          console.log(`✅ Imagen ${filename} sincronizada exitosamente con GitHub:`, putData.commit?.html_url);
        } else {
          console.warn(`⚠️ Error al sincronizar ${filename} en GitHub:`, putRes.status);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Excepción asegurando imagen ${filename} en GitHub:`, err.message);
    }
  }

  // Devolver URL canónica de GitHub
  return `https://raw.githubusercontent.com/${repo}/main/public/uploads/${filename}`;
}

// --- Helper para sincronizar productos con GitHub ---
async function syncProductsToGithub() {
  const { token, repo } = getGithubConfig();

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

// --- Helper para sincronizar categorías con GitHub ---
async function syncCategoriesToGithub() {
  const { token, repo } = getGithubConfig();

  try {
    const result = await db.query(
      'SELECT id, name, created_at FROM categories ORDER BY name ASC'
    );
    const categories = result.rows;
    const contentStr = JSON.stringify(categories, null, 2);

    // Guardar localmente
    try {
      const localDir = path.join(__dirname, '../data');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      fs.writeFileSync(path.join(localDir, 'categories.json'), contentStr, 'utf8');
    } catch (fsErr) {
      console.warn('⚠️ No se pudo escribir localmente en data/categories.json:', fsErr.message);
    }

    if (!token) {
      return { success: false, skipped: true, message: 'GITHUB_TOKEN no configurado' };
    }

    const filePath = 'data/categories.json';
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
        const fileData = await getRes.json();
        currentSha = fileData.sha;
      }
    } catch (checkErr) {
      // Archivo nuevo
    }

    const payload = {
      message: `chore(categories): sincronizar categorías (${categories.length} categorías) [skip ci]`,
      content: Buffer.from(contentStr, 'utf8').toString('base64'),
      branch: 'main'
    };
    if (currentSha) {
      payload.sha = currentSha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Kiosco-POS-App',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });

    if (putRes.ok) {
      const resData = await putRes.json();
      return {
        success: true,
        count: categories.length,
        commitUrl: resData.commit?.html_url,
        sha: resData.commit?.sha
      };
    } else {
      const errText = await putRes.text();
      return { success: false, error: errText };
    }
  } catch (err) {
    console.error('⚠️ Excepción en syncCategoriesToGithub:', err.message);
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
      'SELECT id, name, category, price_usd, stock, image_url, is_active, created_at, updated_at FROM products WHERE is_active = true ORDER BY COALESCE(updated_at, created_at) DESC, id DESC'
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
      'SELECT id, name, category, price_usd, stock, image_url, is_active, created_at, updated_at FROM products ORDER BY COALESCE(updated_at, created_at) DESC, id DESC'
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

    let finalImageUrl = image_url ? image_url.trim() : '';
    if (finalImageUrl) {
      finalImageUrl = await ensureImageInGithub(finalImageUrl);
    }

    const result = await db.query(
      `INSERT INTO products (name, category, price_usd, stock, image_url, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP) RETURNING *`,
      [
        name.trim(),
        category ? category.trim() : 'Varios',
        parseFloat(price_usd),
        parseInt(stock, 10) || 0,
        finalImageUrl
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

    let finalImageUrl = image_url !== undefined ? image_url.trim() : null;
    if (finalImageUrl) {
      finalImageUrl = await ensureImageInGithub(finalImageUrl);
    }

    const result = await db.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           price_usd = COALESCE($3, price_usd),
           stock = COALESCE($4, stock),
           image_url = COALESCE($5, image_url),
           is_active = COALESCE($6, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [
        name !== undefined ? name.trim() : null,
        category !== undefined ? category.trim() : null,
        price_usd !== undefined ? parseFloat(price_usd) : null,
        stock !== undefined ? parseInt(stock, 10) : null,
        finalImageUrl,
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
    const [syncResult, syncCategoriesResult] = await Promise.all([
      syncProductsToGithub(),
      syncCategoriesToGithub()
    ]);
    res.json({
      ...syncResult,
      categoriesCount: syncCategoriesResult.count
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. ENDPOINTS DE CATEGORÍAS
// ==========================================

// Listar categorías con conteo de productos asociados
app.get('/api/categories', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.id, c.name, COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON LOWER(p.category) = LOWER(c.name) AND p.is_active = true
      GROUP BY c.id, c.name
      ORDER BY c.name ASC
    `);
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear nueva categoría
app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, error: 'El nombre de la categoría es obligatorio' });
    }

    const result = await db.query(
      `INSERT INTO categories (name) 
       VALUES ($1) 
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name 
       RETURNING id, name`,
      [cleanName]
    );

    const category = result.rows[0];

    // Sincronizar con GitHub en segundo plano
    syncCategoriesToGithub().catch(e => console.warn('Sync categories error:', e.message));

    res.json({ success: true, category });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Modificar / Renombrar categoría existente
app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const newName = (name || '').trim();

    if (!newName) {
      return res.status(400).json({ success: false, error: 'El nombre de la categoría no puede estar vacío' });
    }

    // Obtener nombre actual
    const currentRes = await db.query('SELECT name FROM categories WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Categoría no encontrada' });
    }
    const oldName = currentRes.rows[0].name;

    // Actualizar nombre en tabla de categorías
    const updateRes = await db.query(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name',
      [newName, id]
    );

    // Actualizar automáticamente todos los productos que tenían la categoría anterior
    await db.query(
      'UPDATE products SET category = $1 WHERE LOWER(category) = LOWER($2)',
      [newName, oldName]
    );

    // Sincronizar catálogo y categorías con GitHub en segundo plano
    syncCategoriesToGithub().catch(e => console.warn('Sync error:', e.message));
    syncProductsToGithub().catch(e => console.warn('Sync error:', e.message));

    res.json({
      success: true,
      category: updateRes.rows[0],
      oldName,
      newName
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar categoría
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const currentRes = await db.query('SELECT name FROM categories WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Categoría no encontrada' });
    }
    const catName = currentRes.rows[0].name;

    // Reasignar productos de esta categoría a 'Varios'
    await db.query("UPDATE products SET category = 'Varios' WHERE LOWER(category) = LOWER($1)", [catName]);

    // Eliminar la categoría
    await db.query('DELETE FROM categories WHERE id = $1', [id]);

    // Sincronizar con GitHub en segundo plano
    syncCategoriesToGithub().catch(e => console.warn('Sync error:', e.message));
    syncProductsToGithub().catch(e => console.warn('Sync error:', e.message));

    res.json({ success: true, message: `Categoría "${catName}" eliminada y sus productos reasignados a "Varios"` });
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

    // 1. Guardar localmente de inmediato para disponibilidad instantánea (0ms)
    const targetUploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(targetUploadDir)) {
      fs.mkdirSync(targetUploadDir, { recursive: true });
    }
    const localFilePath = path.join(targetUploadDir, uniqueName);
    fs.writeFileSync(localFilePath, buffer);

    // 2. Subir a GitHub en public/uploads/
    const { token, repo } = getGithubConfig();
    let commitUrl = null;
    let gitUploaded = false;

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
          gitUploaded = true;
          console.log('✅ Imagen subida exitosamente a GitHub:', commitUrl);
        } else {
          const errBody = await putRes.text();
          console.warn('⚠️ Error al subir imagen a GitHub:', putRes.status, errBody);
        }
      } catch (ghErr) {
        console.warn('⚠️ Excepción al subir imagen a GitHub:', ghErr.message);
      }
    }

    // URLs accesibles (raw de GitHub para persistencia, local para renderizado instantáneo)
    const rawGithubUrl = `https://raw.githubusercontent.com/${repo}/main/public/uploads/${uniqueName}`;
    const localUrl = `/uploads/${uniqueName}`;

    res.json({
      success: true,
      filename: uniqueName,
      url: rawGithubUrl,
      localUrl,
      gitUploaded,
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
    const { token, repo } = getGithubConfig();
    const images = [];
    const seenNames = new Set();

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
                seenNames.add(f.name);
                images.push({
                  name: f.name,
                  url: `https://raw.githubusercontent.com/${repo}/main/public/uploads/${f.name}`,
                  localUrl: `/uploads/${f.name}`,
                  downloadUrl: f.download_url
                });
              });
          }
        }
      } catch (ghErr) {
        console.warn('⚠️ Error consultando uploads en GitHub:', ghErr.message);
      }
    }

    // 2. Si hay archivos locales que aún no están en la lista (o mientras GitHub propaga CDN)
    const targetUploadDir = path.join(__dirname, '../public/uploads');
    if (fs.existsSync(targetUploadDir)) {
      try {
        const localFiles = fs.readdirSync(targetUploadDir);
        localFiles
          .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
          .reverse()
          .forEach(f => {
            if (!seenNames.has(f)) {
              seenNames.add(f);
              images.push({
                name: f,
                url: `https://raw.githubusercontent.com/${repo}/main/public/uploads/${f}`,
                localUrl: `/uploads/${f}`
              });
            }
          });
      } catch (fsErr) {
        // Ignorar
      }
    }

    res.json({ success: true, images: images.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

    res.json({ success: true, images: images.slice(0, 15) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. ENDPOINTS DE VENTAS (POS)
// ==========================================

// Función auxiliar para notificar stock bajo a Telegram y N8N
async function notifyLowStock(lowStockAlerts) {
  if (!lowStockAlerts || !lowStockAlerts.length) return;
  const token = process.env.TELEGRAM_BOT_TOKEN || '9165377394:AAH59wqZeB1AeKUQJzxJcXd2L0DJFk808mw';
  const chatId = process.env.TELEGRAM_CHAT_ID || '7827395871';

  const itemsList = lowStockAlerts.map(i => `• *${i.name}*: le quedan *${i.stock} ${i.stock === 1 ? 'unidad' : 'unidades'}*`).join('\n');
  const text = [
    '⚠️ *ALERTA DE STOCK BAJO - KIOSCO*',
    '━━━━━━━━━━━━━━━━━━━━━━',
    'Se ha concretado una venta y los siguientes productos están por agotarse (menos de 5 unidades):',
    '',
    itemsList,
    '',
    '👉 *Acción sugerida:* Reponer inventario desde el Almacén.',
    `📅 ${new Date().toLocaleDateString('es-VE')} - ⏰ ${new Date().toLocaleTimeString('es-VE', { timeZone: 'America/Caracas' })}`
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });
    console.log('✅ Alerta de stock bajo enviada a Telegram');
  } catch (err) {
    console.warn('⚠️ No se pudo enviar alerta de stock a Telegram:', err.message);
  }

  // Notificar también a N8N Webhook si está disponible
  const alertWebhook = process.env.N8N_ALERT_WEBHOOK_URL || 'https://nexop-n8n.nexopsystem.com/webhook/kiosco-stock-alert';
  try {
    await fetch(alertWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'low_stock_alert',
        items: lowStockAlerts,
        timestamp: new Date().toISOString()
      })
    });
  } catch (wErr) {
    // Webhook opcional
  }
}

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
    const lowStockAlerts = [];
    const createdAt = req.body.offline_created_at ? new Date(req.body.offline_created_at) : new Date();

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

      // Descontar inventario y detectar stock bajo (< 5)
      const updRes = await client.query(
        'UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2 RETURNING id, name, stock',
        [qty, item.id]
      );
      const newStock = updRes.rows[0].stock;
      if (newStock < 5) {
        lowStockAlerts.push({ id: item.id, name: updRes.rows[0].name, stock: newStock });
      }
    }

    const totalBs = parseFloat((totalUsd * rate).toFixed(2));
    const saleNumber = req.body.sale_number || ('V-' + Date.now().toString().slice(-6));

    // Insertar venta (admite timestamp original si proviene de sincronización offline)
    const saleRes = await client.query(
      `INSERT INTO sales (sale_number, total_usd, total_bs, exchange_rate, items_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, sale_number, total_usd, total_bs, created_at`,
      [saleNumber, totalUsd, totalBs, rate, itemsCount, createdAt]
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

    // Notificar alerta de stock bajo a Telegram en segundo plano
    if (lowStockAlerts.length > 0) {
      notifyLowStock(lowStockAlerts).catch(e => console.warn('Aviso de stock error:', e.message));
    }

    res.json({
      success: true,
      sale: {
        id: saleId,
        saleNumber,
        totalUsd,
        totalBs,
        rate,
        itemsCount,
        createdAt: saleRes.rows[0].created_at,
        is_offline_sync: !!req.body.is_offline_sync
      },
      lowStockAlerts
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

// Endpoint detallado de Contabilidad en tiempo real (todos los productos vendidos + totales en $ y Bs)
app.get('/api/reports/accounting', async (req, res) => {
  try {
    const { period = 'today' } = req.query; // 'today', 'day', 'night', 'live', 'all'
    const vzla = getVenezuelaTime();
    const todayStr = formatDate(vzla);
    const timeStr = formatTime(vzla);

    let startTime = `${todayStr} 00:00:00-04`;
    let endTime = `${todayStr} 23:59:59-04`;
    let periodLabel = 'Hoy (Día Completo)';

    if (period === 'day') {
      startTime = `${todayStr} 08:00:00-04`;
      endTime = `${todayStr} 17:30:00-04`;
      periodLabel = 'Turno 1 (08:00 - 17:30)';
    } else if (period === 'night') {
      startTime = `${todayStr} 18:00:00-04`;
      endTime = `${todayStr} 22:00:00-04`;
      periodLabel = 'Turno 2 (18:00 - 22:00)';
    } else if (period === 'live') {
      if (vzla.getHours() < 6) {
        const yesterday = new Date(vzla.getTime() - 24 * 3600000);
        startTime = `${formatDate(yesterday)} 18:00:00-04`;
      } else {
        startTime = `${todayStr} 18:00:00-04`;
      }
      endTime = `${todayStr} ${timeStr}-04`;
      periodLabel = `Turno Extendido (18:00 hasta ${timeStr.slice(0, 5)})`;
    } else if (period === 'yesterday') {
      const yesterday = new Date(vzla.getTime() - 24 * 3600000);
      const yStr = formatDate(yesterday);
      startTime = `${yStr} 00:00:00-04`;
      endTime = `${yStr} 23:59:59-04`;
      periodLabel = `Ayer (${yStr})`;
    } else if (period === 'week') {
      const wStart = new Date(vzla.getTime() - 6 * 24 * 3600000);
      const wStr = formatDate(wStart);
      startTime = `${wStr} 00:00:00-04`;
      endTime = `${todayStr} 23:59:59-04`;
      periodLabel = `Esta Semana (${wStr} al ${todayStr})`;
    } else if (period === 'month') {
      const mStr = `${vzla.getFullYear()}-${String(vzla.getMonth() + 1).padStart(2, '0')}-01`;
      startTime = `${mStr} 00:00:00-04`;
      endTime = `${todayStr} 23:59:59-04`;
      periodLabel = `Este Mes (${mStr} al ${todayStr})`;
    } else if (period === 'custom' && req.query.date) {
      startTime = `${req.query.date} 00:00:00-04`;
      endTime = `${req.query.date} 23:59:59-04`;
      periodLabel = `Fecha: ${req.query.date}`;
    } else if (period === 'all') {
      startTime = '2020-01-01 00:00:00-04';
      endTime = `${todayStr} 23:59:59-04`;
      periodLabel = 'Todo el Histórico Acumulado';
    }

    // 1. Resumen global de ventas
    const salesRes = await db.query(
      `SELECT COUNT(*) as total_sales,
              COALESCE(SUM(total_usd), 0) as total_usd,
              COALESCE(SUM(total_bs), 0) as total_bs,
              COALESCE(SUM(items_count), 0) as total_items
       FROM sales
       WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      [startTime, endTime]
    );

    // 2. Desglose por método de pago
    const payRes = await db.query(
      `SELECT p.payment_method,
              COUNT(*) as count,
              COALESCE(SUM(p.amount_usd), 0) as sum_usd,
              COALESCE(SUM(p.amount_bs), 0) as sum_bs
       FROM sale_payments p
       JOIN sales s ON p.sale_id = s.id
       WHERE s.created_at >= $1::timestamptz AND s.created_at <= $2::timestamptz
       GROUP BY p.payment_method
       ORDER BY sum_usd DESC`,
      [startTime, endTime]
    );

    // 3. Detalle completo de productos vendidos en el período
    const productsSoldRes = await db.query(
      `SELECT COALESCE(p.id, i.product_id) as product_id,
              i.product_name,
              COALESCE(p.category, 'Varios') as category,
              COALESCE(p.image_url, '') as image_url,
              SUM(i.quantity)::int as total_quantity,
              ROUND(AVG(i.unit_price_usd), 2)::numeric as unit_price_usd,
              ROUND(SUM(i.subtotal_usd), 2)::numeric as total_usd,
              ROUND(SUM(i.subtotal_usd * COALESCE(s.exchange_rate, 1000)), 2)::numeric as total_bs
       FROM sale_items i
       JOIN sales s ON i.sale_id = s.id
       LEFT JOIN products p ON i.product_id = p.id
       WHERE s.created_at >= $1::timestamptz AND s.created_at <= $2::timestamptz
       GROUP BY COALESCE(p.id, i.product_id), i.product_name, p.category, p.image_url
       ORDER BY total_usd DESC, total_quantity DESC`,
      [startTime, endTime]
    );

    // 4. Últimas ventas del período
    const recentSalesRes = await db.query(
      `SELECT s.id, s.sale_number, s.total_usd, s.total_bs, s.items_count, s.created_at,
              COALESCE(json_agg(DISTINCT jsonb_build_object('method', p.payment_method, 'usd', p.amount_usd, 'bs', p.amount_bs)) FILTER (WHERE p.id IS NOT NULL), '[]') as payments
       FROM sales s
       LEFT JOIN sale_payments p ON s.id = p.sale_id
       WHERE s.created_at >= $1::timestamptz AND s.created_at <= $2::timestamptz
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT 30`,
      [startTime, endTime]
    );

    res.json({
      success: true,
      period: {
        id: period,
        label: periodLabel,
        startTime,
        endTime,
        currentTime: `${todayStr} ${timeStr}`
      },
      summary: {
        totalSales: parseInt(salesRes.rows[0].total_sales, 10),
        totalUsd: parseFloat(salesRes.rows[0].total_usd),
        totalBs: parseFloat(salesRes.rows[0].total_bs),
        totalItemsSold: parseInt(salesRes.rows[0].total_items, 10),
        paymentBreakdown: payRes.rows.map(r => ({
          method: r.payment_method,
          count: parseInt(r.count, 10),
          sumUsd: parseFloat(r.sum_usd),
          sumBs: parseFloat(r.sum_bs)
        }))
      },
      productsSold: productsSoldRes.rows.map(r => ({
        productId: r.product_id,
        productName: r.product_name,
        category: r.category,
        imageUrl: r.image_url,
        totalQuantity: parseInt(r.total_quantity, 10),
        unitPriceUsd: parseFloat(r.unit_price_usd),
        unitPriceBs: parseFloat((parseFloat(r.unit_price_usd) * 1000).toFixed(2)),
        totalUsd: parseFloat(r.total_usd),
        totalBs: parseFloat(r.total_bs)
      })),
      recentSales: recentSalesRes.rows
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
// 4.1 CIERRE OFICIAL DE JORNADA / CAJA
// ==========================================

// Previsualización de los datos que se consolidarán en el cierre de hoy
app.get('/api/reports/daily-closing/preview', async (req, res) => {
  try {
    const vzla = getVenezuelaTime();
    const todayStr = formatDate(vzla);
    const timeStr = formatTime(vzla);

    const shift1Start = `${todayStr} 08:00:00-04`;
    const shift1End = `${todayStr} 17:30:00-04`;
    const shift2Start = `${todayStr} 18:00:00-04`;
    const shift2End = `${todayStr} 22:00:00-04`;
    const dayStart = `${todayStr} 00:00:00-04`;
    const dayEnd = `${todayStr} 23:59:59-04`;

    // Turno 1
    const s1 = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_usd), 0) as usd, COALESCE(SUM(total_bs), 0) as bs
       FROM sales WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      [shift1Start, shift1End]
    );

    // Turno 2
    const s2 = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_usd), 0) as usd, COALESCE(SUM(total_bs), 0) as bs
       FROM sales WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      [shift2Start, shift2End]
    );

    // Día Completo
    const dayTot = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_usd), 0) as usd, COALESCE(SUM(total_bs), 0) as bs, COALESCE(SUM(items_count), 0) as items
       FROM sales WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      [dayStart, dayEnd]
    );

    // Desglose Pagos Día Completo
    const payRes = await db.query(
      `SELECT p.payment_method, COUNT(*) as count, COALESCE(SUM(p.amount_usd), 0) as sum_usd, COALESCE(SUM(p.amount_bs), 0) as sum_bs
       FROM sale_payments p
       JOIN sales s ON p.sale_id = s.id
       WHERE s.created_at >= $1::timestamptz AND s.created_at <= $2::timestamptz
       GROUP BY p.payment_method ORDER BY sum_usd DESC`,
      [dayStart, dayEnd]
    );

    const paymentBreakdown = {
      divisaUsd: { usd: 0, bs: 0, ops: 0 },
      pagoMovilBs: { usd: 0, bs: 0, ops: 0 },
      efectivoBs: { usd: 0, bs: 0, ops: 0 },
      puntoBs: { usd: 0, bs: 0, ops: 0 }
    };

    payRes.rows.forEach(r => {
      const m = r.payment_method || '';
      const u = parseFloat(r.sum_usd) || 0;
      const b = parseFloat(r.sum_bs) || 0;
      const c = parseInt(r.count, 10) || 0;
      if (m.includes('Divisa') || m.includes('Efectivo $') || m.includes('$')) {
        paymentBreakdown.divisaUsd.usd += u;
        paymentBreakdown.divisaUsd.bs += b;
        paymentBreakdown.divisaUsd.ops += c;
      } else if (m.includes('Móvil') || m.includes('Movil')) {
        paymentBreakdown.pagoMovilBs.usd += u;
        paymentBreakdown.pagoMovilBs.bs += b;
        paymentBreakdown.pagoMovilBs.ops += c;
      } else if (m.includes('Efectivo Bs')) {
        paymentBreakdown.efectivoBs.usd += u;
        paymentBreakdown.efectivoBs.bs += b;
        paymentBreakdown.efectivoBs.ops += c;
      } else if (m.includes('Punto') || m.includes('Tarjeta')) {
        paymentBreakdown.puntoBs.usd += u;
        paymentBreakdown.puntoBs.bs += b;
        paymentBreakdown.puntoBs.ops += c;
      }
    });

    res.json({
      success: true,
      date: todayStr,
      currentTime: timeStr.slice(0, 5),
      shift1: {
        count: parseInt(s1.rows[0].count, 10),
        ticketsCount: parseInt(s1.rows[0].count, 10),
        usd: parseFloat(s1.rows[0].usd),
        totalUsd: parseFloat(s1.rows[0].usd),
        bs: parseFloat(s1.rows[0].bs),
        totalBs: parseFloat(s1.rows[0].bs)
      },
      shift2: {
        count: parseInt(s2.rows[0].count, 10),
        ticketsCount: parseInt(s2.rows[0].count, 10),
        usd: parseFloat(s2.rows[0].usd),
        totalUsd: parseFloat(s2.rows[0].usd),
        bs: parseFloat(s2.rows[0].bs),
        totalBs: parseFloat(s2.rows[0].bs)
      },
      day: {
        count: parseInt(dayTot.rows[0].count, 10),
        ticketsCount: parseInt(dayTot.rows[0].count, 10),
        usd: parseFloat(dayTot.rows[0].usd),
        totalUsd: parseFloat(dayTot.rows[0].usd),
        bs: parseFloat(dayTot.rows[0].bs),
        totalBs: parseFloat(dayTot.rows[0].bs),
        items: parseInt(dayTot.rows[0].items, 10),
        itemsCount: parseInt(dayTot.rows[0].items, 10)
      },
      dayTotal: {
        count: parseInt(dayTot.rows[0].count, 10),
        ticketsCount: parseInt(dayTot.rows[0].count, 10),
        usd: parseFloat(dayTot.rows[0].usd),
        totalUsd: parseFloat(dayTot.rows[0].usd),
        bs: parseFloat(dayTot.rows[0].bs),
        totalBs: parseFloat(dayTot.rows[0].bs),
        items: parseInt(dayTot.rows[0].items, 10),
        itemsCount: parseInt(dayTot.rows[0].items, 10)
      },
      paymentBreakdown,
      payments: payRes.rows.map(r => ({
        method: r.payment_method,
        count: parseInt(r.count, 10),
        sumUsd: parseFloat(r.sum_usd),
        sumBs: parseFloat(r.sum_bs)
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ejecución y registro oficial del Cierre de Caja
app.post('/api/reports/daily-closing', async (req, res) => {
  try {
    const closed_by = req.body.closed_by || req.body.cashier_name || 'Cajero Principal';
    const cash_drawer_usd = req.body.cash_drawer_usd !== undefined ? req.body.cash_drawer_usd : 0;
    const notes = req.body.notes || '';
    const vzla = getVenezuelaTime();
    const todayStr = formatDate(vzla);
    const timeStr = formatTime(vzla);

    const shift1Start = `${todayStr} 08:00:00-04`;
    const shift1End = `${todayStr} 17:30:00-04`;
    const shift2Start = `${todayStr} 18:00:00-04`;
    const shift2End = `${todayStr} 22:00:00-04`;
    const dayStart = `${todayStr} 00:00:00-04`;
    const dayEnd = `${todayStr} 23:59:59-04`;

    const s1 = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_usd), 0) as usd, COALESCE(SUM(total_bs), 0) as bs
       FROM sales WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      [shift1Start, shift1End]
    );

    const s2 = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_usd), 0) as usd, COALESCE(SUM(total_bs), 0) as bs
       FROM sales WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      [shift2Start, shift2End]
    );

    const dayTot = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_usd), 0) as usd, COALESCE(SUM(total_bs), 0) as bs, COALESCE(SUM(items_count), 0) as items
       FROM sales WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      [dayStart, dayEnd]
    );

    const payRes = await db.query(
      `SELECT p.payment_method, COUNT(*) as count, COALESCE(SUM(p.amount_usd), 0) as sum_usd, COALESCE(SUM(p.amount_bs), 0) as sum_bs
       FROM sale_payments p
       JOIN sales s ON p.sale_id = s.id
       WHERE s.created_at >= $1::timestamptz AND s.created_at <= $2::timestamptz
       GROUP BY p.payment_method ORDER BY sum_usd DESC`,
      [dayStart, dayEnd]
    );

    const payments = payRes.rows.map(r => ({
      method: r.payment_method,
      count: parseInt(r.count, 10),
      sumUsd: parseFloat(r.sum_usd),
      sumBs: parseFloat(r.sum_bs)
    }));

    const s1Count = parseInt(s1.rows[0].count, 10);
    const s1Usd = parseFloat(s1.rows[0].usd);
    const s1Bs = parseFloat(s1.rows[0].bs);

    const s2Count = parseInt(s2.rows[0].count, 10);
    const s2Usd = parseFloat(s2.rows[0].usd);
    const s2Bs = parseFloat(s2.rows[0].bs);

    const dayCount = parseInt(dayTot.rows[0].count, 10);
    const dayUsd = parseFloat(dayTot.rows[0].usd);
    const dayBs = parseFloat(dayTot.rows[0].bs);
    const dayItems = parseInt(dayTot.rows[0].items, 10);

    // Calcular efectivo reportado en Divisas
    const cashDivisas = payments.find(p => p.method.toLowerCase().includes('divisa'))?.sumUsd || 0;
    const drawerInput = parseFloat(cash_drawer_usd) || 0;
    const diffUsd = drawerInput > 0 ? parseFloat((drawerInput - cashDivisas).toFixed(2)) : 0;

    // Guardar en tabla daily_closings
    const insertRes = await db.query(
      `INSERT INTO daily_closings (
        closing_date, shift1_sales_count, shift1_total_usd, shift1_total_bs,
        shift2_sales_count, shift2_total_usd, shift2_total_bs,
        day_sales_count, day_total_usd, day_total_bs, day_items_sold,
        payment_breakdown, cash_drawer_usd, cash_difference_usd, notes, closed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        todayStr, s1Count, s1Usd, s1Bs,
        s2Count, s2Usd, s2Bs,
        dayCount, dayUsd, dayBs, dayItems,
        JSON.stringify(payments), drawerInput, diffUsd, notes, closed_by
      ]
    );

    // Guardar en kiosco_report_logs para auditoría
    await db.query(
      `INSERT INTO kiosco_report_logs (
        report_date, report_time, shift_label, total_sales, total_usd, total_bs, payment_breakdown, requested_by, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        todayStr, timeStr.slice(0, 5), 'CIERRE_CAJA_COMPLETO', dayCount, dayUsd, dayBs,
        JSON.stringify(payments), closed_by, 'CIERRE_CAJA_MANUAL'
      ]
    );

    // Formatear y Enviar Notificación a Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN || '9165377394:AAH59wqZeB1AeKUQJzxJcXd2L0DJFk808mw';
    const chatId = process.env.TELEGRAM_CHAT_ID || '7827395871';

    const payLines = payments.map(p => `• *${p.method}:* $${p.sumUsd.toFixed(2)} (Bs. ${p.sumBs.toLocaleString('es-VE')}) - ${p.count} ops`).join('\n') || '• Sin ventas registradas';

    let diffText = '';
    if (drawerInput > 0) {
      const diffLabel = diffUsd >= 0 ? `+$${diffUsd.toFixed(2)} (Sobrante)` : `-$${Math.abs(diffUsd).toFixed(2)} (Faltante)`;
      diffText = `\n💵 *Efectivo en Gaveta:* $${drawerInput.toFixed(2)}\n⚖️ *Diferencia Caja:* ${diffLabel}`;
    }

    const tgMessage = [
      '🏁 *CIERRE OFICIAL DE JORNADA - KIOSCO*',
      '━━━━━━━━━━━━━━━━━━━━━━',
      `📅 *Fecha:* ${todayStr}`,
      `⏰ *Hora:* ${timeStr.slice(0, 5)} (Caracas)`,
      `👤 *Responsable:* ${closed_by}`,
      '',
      '📊 *DETALLE POR TURNOS:*',
      `• *Turno 1 (08:00 - 17:30):* $${s1Usd.toFixed(2)} (Bs. ${s1Bs.toLocaleString('es-VE')}) [${s1Count} ventas]`,
      `• *Turno 2 (18:00 - 22:00):* $${s2Usd.toFixed(2)} (Bs. ${s2Bs.toLocaleString('es-VE')}) [${s2Count} ventas]`,
      '',
      '💰 *TOTAL CONSOLIDADO DEL DÍA:*',
      `💵 *$${dayUsd.toFixed(2)} USD*`,
      `🇻🇪 *Bs. ${dayBs.toLocaleString('es-VE')}*`,
      `🧾 *Total Ventas:* ${dayCount} tickets (${dayItems} productos despachados)`,
      '',
      '💳 *RECAUDACIÓN POR FORMA DE PAGO:*',
      payLines,
      diffText,
      notes ? `\n📝 *Notas:* ${notes}` : '',
      '',
      '✅ *ESTADO:* Jornada cerrada exitosamente en sistema. Contadores del día listos para la próxima apertura.'
    ].filter(Boolean).join('\n');

    let tgSuccess = false;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: tgMessage,
          parse_mode: 'Markdown'
        })
      });
      tgSuccess = true;
    } catch (tgErr) {
      console.warn('⚠️ No se pudo enviar mensaje de cierre a Telegram:', tgErr.message);
    }

    // Notificar a N8N Webhook si existe
    const n8nWebhook = process.env.N8N_WEBHOOK_URL || 'https://nexop-n8n.nexopsystem.com/webhook/kiosco-reporte';
    try {
      await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'KIOSCO_DAILY_CLOSING',
          date: todayStr,
          time: timeStr.slice(0, 5),
          shift1: { count: s1Count, usd: s1Usd, bs: s1Bs },
          shift2: { count: s2Count, usd: s2Usd, bs: s2Bs },
          day: { count: dayCount, usd: dayUsd, bs: dayBs, items: dayItems },
          payments,
          closedBy: closed_by
        })
      });
    } catch (e) {
      // Opcional
    }

    res.json({
      success: true,
      message: 'Cierre de caja registrado y enviado exitosamente',
      telegramNotified: tgSuccess,
      closing: insertRes.rows[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Historial de Cierres de Caja para consultar días pasados
app.get('/api/reports/daily-closing/history', async (req, res) => {
  try {
    const closingsRes = await db.query(
      `SELECT * FROM daily_closings ORDER BY closing_date DESC, closed_at DESC LIMIT 30`
    );
    const mapped = closingsRes.rows.map(r => ({
      ...r,
      cashier_name: r.closed_by,
      difference_usd: r.cash_difference_usd,
      created_at: r.closed_at,
      shift1_tickets_count: r.shift1_sales_count,
      shift2_tickets_count: r.shift2_sales_count,
      day_tickets_count: r.day_sales_count
    }));
    res.json({
      success: true,
      history: mapped,
      closings: mapped
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

app.post('/api/settings/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    const dbRes = await db.query("SELECT value FROM settings WHERE key = 'admin_pin'");
    const currentPin = dbRes.rows.length > 0 ? dbRes.rows[0].value : '2200';
    if (pin && pin.toString().trim() === currentPin.toString().trim()) {
      return res.json({ success: true, authorized: true });
    }
    return res.status(401).json({ success: false, authorized: false, error: 'Contraseña incorrecta' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/settings/pin', async (req, res) => {
  try {
    const { current_pin, new_pin } = req.body;
    const dbRes = await db.query("SELECT value FROM settings WHERE key = 'admin_pin'");
    const savedPin = dbRes.rows.length > 0 ? dbRes.rows[0].value : '2200';
    if (!current_pin || current_pin.toString().trim() !== savedPin.toString().trim()) {
      return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });
    }
    if (!new_pin || new_pin.toString().trim().length < 4) {
      return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 4 dígitos' });
    }
    await db.query(
      "INSERT INTO settings (key, value) VALUES ('admin_pin', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [new_pin.toString().trim()]
    );
    res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
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

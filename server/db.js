const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://kiosco_user:Kiosco2026PassSecure@localhost:5432/kiosco_db';

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log(' Conectado exitosamente a PostgreSQL');

    // Tabla de Productos
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Varios',
        price_usd NUMERIC(10, 2) NOT NULL,
        stock INTEGER DEFAULT 20,
        image_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de Categorías
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Categorías iniciales por defecto
    await client.query(`
      INSERT INTO categories (name) VALUES 
        ('Bebidas'), ('Snacks'), ('Golosinas'), ('Víveres'), ('Cigarros'), ('Varios')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Sincronizar cualquier categoría existente en la tabla de productos
    await client.query(`
      INSERT INTO categories (name)
      SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) != ''
      ON CONFLICT (name) DO NOTHING;
    `);

    // Tabla de Ventas
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        sale_number VARCHAR(50),
        total_usd NUMERIC(10, 2) NOT NULL,
        total_bs NUMERIC(15, 2) NOT NULL,
        exchange_rate NUMERIC(10, 2) DEFAULT 1000,
        items_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'COMPLETED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabla de Items de Venta
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER,
        product_name VARCHAR(255),
        quantity INTEGER NOT NULL,
        unit_price_usd NUMERIC(10, 2) NOT NULL,
        subtotal_usd NUMERIC(10, 2) NOT NULL
      );
    `);

    // Tabla de Métodos de Pago por Venta
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        payment_method VARCHAR(100) NOT NULL,
        amount_usd NUMERIC(10, 2) DEFAULT 0,
        amount_bs NUMERIC(15, 2) DEFAULT 0,
        reference VARCHAR(100)
      );
    `);

    // Tabla de Configuración (Tasa, PIN, etc)
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Configuraciones por defecto
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES 
        ('exchange_rate', '1000'),
        ('admin_pin', '1234')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Corrección histórica idempotente para venta de prueba #2 reportada por usuario ($1.40 dividida en Divisas $1.00 y Pago Móvil $0.40)
    await client.query(`
      UPDATE sale_payments 
      SET amount_usd = 1.00, amount_bs = 1000.00 
      WHERE sale_id = 2 AND payment_method LIKE '%Divisas%' AND amount_usd = 1.40;
      
      UPDATE sale_payments 
      SET amount_usd = 0.40, amount_bs = 400.00 
      WHERE sale_id = 2 AND payment_method LIKE '%Pago%' AND amount_usd = 1.40;
    `);

    // Seed de productos de prueba si está vacía
    const countRes = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      console.log(' Sembrando productos iniciales de muestra para el Kiosco...');
      const sampleProducts = [
        ['Coca-Cola 1.5L', 'Bebidas', 2.00, 24, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80'],
        ['Doritos Mega Queso', 'Snacks', 1.50, 18, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80'],
        ['Galletas Oreo Paquete', 'Golosinas', 0.80, 30, 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80'],
        ['Agua Mineral Minalba 500ml', 'Bebidas', 0.50, 40, 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'],
        ['Chocolate Savoy con Leche', 'Golosinas', 1.20, 15, 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=500&auto=format&fit=crop&q=80'],
        ['Maltín Polar Botella', 'Bebidas', 1.00, 20, 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=80'],
        ['Papas Ruffles Original', 'Snacks', 1.50, 12, 'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=500&auto=format&fit=crop&q=80'],
        ['Pirulin Lata 300g', 'Golosinas', 3.50, 8, 'https://images.unsplash.com/photo-1582293041079-7814c2f12063?w=500&auto=format&fit=crop&q=80'],
        ['Chicles Trident Menta', 'Golosinas', 0.50, 25, 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500&auto=format&fit=crop&q=80'],
        ['Jugo del Valle Naranja 250ml', 'Bebidas', 0.90, 16, 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&auto=format&fit=crop&q=80'],
        ['Cigarrillos Belmont 20s', 'Varios', 2.50, 10, 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80'],
        ['Encendedor Clipper / Bic', 'Varios', 0.70, 20, 'https://images.unsplash.com/photo-1512418490979-92798cec1380?w=500&auto=format&fit=crop&q=80']
      ];

      for (const prod of sampleProducts) {
        await client.query(
          `INSERT INTO products (name, category, price_usd, stock, image_url) VALUES ($1, $2, $3, $4, $5)`,
          prod
        );
      }
      console.log(' Productos iniciales cargados.');
    }

    client.release();
  } catch (err) {
    console.error('⚠️ Error al inicializar PostgreSQL:', err.message);
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDatabase,
};

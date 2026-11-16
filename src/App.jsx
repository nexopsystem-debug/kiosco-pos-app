import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  Search,
  Filter,
  CreditCard,
  Banknote,
  Smartphone,
  Coins,
  CheckCircle2,
  AlertCircle,
  FileText,
  Edit,
  X,
  Send,
  RefreshCw,
  Clock,
  Package,
  Sparkles,
  ChevronRight,
  Receipt,
  Warehouse,
  GitBranch,
  Save,
  UploadCloud,
  Check,
  Tag
} from 'lucide-react';

const PRESET_IMAGES = [
  { label: 'Refresco Cola', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80' },
  { label: 'Snacks / Papas', url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80' },
  { label: 'Galletas', url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80' },
  { label: 'Agua Mineral', url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80' },
  { label: 'Chocolate', url: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=500&auto=format&fit=crop&q=80' },
  { label: 'Malta / Botella', url: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=80' },
  { label: 'Dulces / Chicles', url: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500&auto=format&fit=crop&q=80' },
  { label: 'Jugo / Frutas', url: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&auto=format&fit=crop&q=80' },
  { label: 'Cigarrillos', url: 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80' },
  { label: 'Encendedor', url: 'https://images.unsplash.com/photo-1512418490979-92798cec1380?w=500&auto=format&fit=crop&q=80' }
];

const COMMON_CATEGORIES = ['Bebidas', 'Snacks', 'Golosinas', 'Víveres', 'Cigarros', 'Varios'];

export default function App() {
  // Pestaña activa: 'pos' (Venta) o 'inventory' (Almacén)
  const [activeTab, setActiveTab] = useState('pos');

  // Estado de Productos y Tasa
  const [products, setProducts] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Carrito / Cantidades seleccionadas { [productId]: quantity }
  const [cart, setCart] = useState({});

  // Modales
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSaleData, setLastSaleData] = useState(null);

  // Modal Agregar / Editar Producto
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Varios',
    price_usd: '',
    stock: '20',
    image_url: ''
  });
  const [savingProduct, setSavingProduct] = useState(false);

  // Estados de Sincronización con GitHub
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Estados de Pago
  const [paymentMethods, setPaymentMethods] = useState({
    divisas: { selected: true, amountUsd: '', amountBs: '' },
    pagoMovil: { selected: false, amountUsd: '', amountBs: '' },
    puntoVenta: { selected: false, amountUsd: '', amountBs: '' },
    efectivoBs: { selected: false, amountUsd: '', amountBs: '' }
  });
  const [cashReceivedUsd, setCashReceivedUsd] = useState('');

  // Estados de Reporte
  const [reportShift, setReportShift] = useState('live'); // 'day', 'night', 'live'
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState('');

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4500);
  };

  // Cargar productos y tasa inicial
  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (data.rate) setExchangeRate(data.rate);
      } else {
        setError(data.error || 'Error al cargar productos');
      }
    } catch (err) {
      setError('No se pudo conectar al servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Categorías dinámicas
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category || 'Varios'));
    return ['Todos', ...Array.from(cats)];
  }, [products]);

  // Productos filtrados
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Estadísticas del Almacén
  const warehouseStats = useMemo(() => {
    const totalCount = products.length;
    let totalUnits = 0;
    let totalValueUsd = 0;
    products.forEach(p => {
      totalUnits += p.stock || 0;
      totalValueUsd += (p.price_usd || 0) * (p.stock || 0);
    });
    return {
      totalCount,
      totalUnits,
      totalValueUsd: parseFloat(totalValueUsd.toFixed(2)),
      totalValueBs: parseFloat((totalValueUsd * exchangeRate).toFixed(2))
    };
  }, [products, exchangeRate]);

  // Cálculos del Carrito
  const { totalUsd, totalBs, totalItemsCount } = useMemo(() => {
    let usd = 0;
    let count = 0;
    Object.entries(cart).forEach(([id, qty]) => {
      if (qty > 0) {
        const prod = products.find(p => p.id === parseInt(id, 10));
        if (prod) {
          usd += prod.price_usd * qty;
          count += qty;
        }
      }
    });
    const bs = usd * exchangeRate;
    return {
      totalUsd: parseFloat(usd.toFixed(2)),
      totalBs: parseFloat(bs.toFixed(2)),
      totalItemsCount: count
    };
  }, [cart, products, exchangeRate]);

  // Manipulación de cantidades en el carrito
  const updateQuantity = (id, delta) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const setDirectQuantity = (id, val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed <= 0) {
      setCart(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } else {
      setCart(prev => ({ ...prev, [id]: parsed }));
    }
  };

  const clearCart = () => {
    if (totalItemsCount > 0) {
      if (window.confirm('¿Deseas vaciar todos los productos seleccionados?')) {
        setCart({});
      }
    }
  };

  // Abrir modal de cobro
  const handleOpenPayment = () => {
    if (totalItemsCount === 0) return;
    setCashReceivedUsd(totalUsd.toString());
    setShowPaymentModal(true);
  };

  // Vuelto / Cambio calculado
  const vueltoCalculado = useMemo(() => {
    const received = parseFloat(cashReceivedUsd) || 0;
    const diff = received - totalUsd;
    if (diff > 0) {
      return {
        usd: parseFloat(diff.toFixed(2)),
        bs: parseFloat((diff * exchangeRate).toFixed(2))
      };
    }
    return { usd: 0, bs: 0 };
  }, [cashReceivedUsd, totalUsd, exchangeRate]);

  // Concretar Venta
  const handleConfirmSale = async () => {
    try {
      const items = Object.entries(cart)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({ id: parseInt(id, 10), quantity: qty }));

      const payments = [];
      if (paymentMethods.divisas.selected) {
        payments.push({ method: 'Divisas ($)', amount_usd: totalUsd, amount_bs: totalBs });
      }
      if (paymentMethods.pagoMovil.selected) {
        payments.push({ method: 'Pago Móvil', amount_usd: totalUsd, amount_bs: totalBs });
      }
      if (paymentMethods.puntoVenta.selected) {
        payments.push({ method: 'Punto de Venta', amount_usd: totalUsd, amount_bs: totalBs });
      }
      if (paymentMethods.efectivoBs.selected) {
        payments.push({ method: 'Efectivo (Bs)', amount_usd: totalUsd, amount_bs: totalBs });
      }

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, payments })
      });

      const data = await res.json();
      if (data.success) {
        setLastSaleData({
          ...data.sale,
          itemsCount: totalItemsCount,
          vuelto: vueltoCalculado
        });
        setShowPaymentModal(false);
        setShowSuccessModal(true);
        setCart({});
        loadProducts(); // Actualizar inventario en vivo
      } else {
        alert('Error al registrar venta: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión al procesar la venta');
    }
  };

  // Cargar Reporte
  const fetchReport = async (shift) => {
    try {
      setReportLoading(true);
      setTelegramStatus('');
      const res = await fetch(`/api/reports/summary?shift=${shift}`);
      const data = await res.json();
      if (data.success) {
        setReportData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleOpenReport = () => {
    setReportShift('live');
    fetchReport('live');
    setShowReportModal(true);
  };

  const handleSendTelegramReport = async () => {
    try {
      setTelegramStatus('Enviando a Telegram...');
      const res = await fetch('/api/reports/request-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift: reportShift })
      });
      const data = await res.json();
      if (data.success) {
        setTelegramStatus(
          data.webhookSent
            ? ' ¡Reporte enviado exitosamente a Telegram!'
            : ' Reporte procesado en sistema (Webhook listo).'
        );
      }
    } catch (err) {
      setTelegramStatus('⚠️ Error al enviar reporte');
    }
  };

  // Abrir Modal de Producto (Nuevo o Editar)
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: 'Snacks',
      price_usd: '',
      stock: '20',
      image_url: PRESET_IMAGES[1].url
    });
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      category: prod.category || 'Varios',
      price_usd: prod.price_usd.toString(),
      stock: prod.stock.toString(),
      image_url: prod.image_url || ''
    });
    setShowProductModal(true);
  };

  // Guardar Producto (Crear o Actualizar)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price_usd) {
      alert('Por favor ingrese el nombre y precio del producto');
      return;
    }

    try {
      setSavingProduct(true);
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productForm.name,
          category: productForm.category,
          price_usd: parseFloat(productForm.price_usd),
          stock: parseInt(productForm.stock, 10) || 0,
          image_url: productForm.image_url
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowProductModal(false);
        showToast(
          editingProduct
            ? ` ${productForm.name} actualizado y sincronizado en GitHub`
            : ` ${productForm.name} agregado y respaldado en GitHub`
        );
        loadProducts(); // Actualización inmediata en tiempo real
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión al guardar producto');
    } finally {
      setSavingProduct(false);
    }
  };

  // Desactivar / Eliminar Producto
  const handleDeleteProduct = async (id, name) => {
    if (window.confirm(`¿Seguro que deseas eliminar "${name}" del catálogo?`)) {
      try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast(`🗑️ ${name} eliminado y actualizado en GitHub`);
          loadProducts();
        }
      } catch (e) {
        alert('Error al eliminar producto');
      }
    }
  };

  // Ajuste rápido de stock en Almacén (+ / -)
  const handleQuickStock = async (prod, delta) => {
    const newStock = Math.max(0, (prod.stock || 0) + delta);
    try {
      // Optimistic update
      setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, stock: newStock } : p));
      await fetch(`/api/products/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock })
      });
    } catch (e) {
      loadProducts();
    }
  };

  // Disparar sincronización manual con GitHub
  const handleManualSyncGithub = async () => {
    try {
      setSyncingGithub(true);
      const res = await fetch('/api/products/sync-github', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(` Respaldo completado en GitHub (${data.count} productos)`);
      } else {
        showToast(`ℹ️ GitHub: ${data.message || 'Sincronizado'}`);
      }
    } catch (err) {
      showToast('⚠️ Error al conectar con GitHub');
    } finally {
      setSyncingGithub(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-100 flex flex-col ${activeTab === 'pos' ? 'pb-36 md:pb-28' : 'pb-16'}`}>
      {/* ============================================================ */}
      {/* 1. ENCABEZADO SUPERIOR LIMPIO Y PROFESIONAL                 */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-lg px-4 py-3 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo y Nombre estrictamente: Kiosco */}
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-emerald-500 rounded-xl text-slate-950 font-black text-xl shadow-md flex items-center justify-center">
              🏪
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white leading-none">
                Kiosco
              </h1>
            </div>
          </div>

          {/* Selector de Vistas: Venta (POS) vs Almacén (Inventario) */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-inner">
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'pos'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Venta</span>
              {totalItemsCount > 0 && (
                <span className="bg-slate-900 text-emerald-400 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {totalItemsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'inventory'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Warehouse className="w-4 h-4" />
              <span>Almacén</span>
            </button>
          </div>

          {/* Badge de Tasa Fija */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 flex items-center space-x-1.5 shadow-inner">
            <Coins className="w-4 h-4 text-amber-400" />
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block leading-none font-medium">Tasa Fija</span>
              <span className="text-xs font-black text-amber-400 font-mono">1.000 Bs/$</span>
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda Común */}
        <div className="max-w-6xl mx-auto mt-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeTab === 'pos' ? "Buscar producto para vender..." : "Buscar producto en almacén..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/90 text-white placeholder-slate-400 pl-10 pr-9 py-2 rounded-xl text-xs sm:text-sm border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Categorías Táctiles (Scroll Horizontal) */}
        <div className="max-w-6xl mx-auto mt-2 flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* ============================================================ */}
      {/* TOAST FLOTANTE DE NOTIFICACIÓN                                */}
      {/* ============================================================ */}
      {toastMessage && (
        <div className="fixed top-20 right-4 left-4 sm:left-auto z-50 bg-slate-900 text-white border border-emerald-500/50 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-2.5 animate-in slide-in-from-top duration-300 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-xs sm:text-sm font-semibold">{toastMessage}</p>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. VISTA A: PUNTO DE VENTA (POS)                             */}
      {/* ============================================================ */}
      {activeTab === 'pos' && (
        <main className="max-w-6xl mx-auto w-full px-3 py-3 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
              <p className="text-sm font-medium">Cargando catálogo del kiosco...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm max-w-md mx-auto my-12 border border-slate-200">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No se encontraron productos</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Prueba buscando otro término o ve al Almacén para agregar nuevos productos.
              </p>
              <button
                onClick={() => {
                  setActiveTab('inventory');
                  handleOpenAddProduct();
                }}
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm"
              >
                + Agregar Producto en Almacén
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
              {filteredProducts.map(product => {
                const qty = cart[product.id] || 0;
                const isSelected = qty > 0;
                const isLowStock = product.stock <= 5;

                return (
                  <div
                    key={product.id}
                    className={`bg-white rounded-2xl overflow-hidden border transition-all duration-200 flex flex-col justify-between shadow-sm relative ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Badge de Stock Bajo */}
                    {isLowStock && (
                      <div className="absolute top-2 left-2 z-10 bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        Stock: {product.stock}
                      </div>
                    )}

                    {/* Imagen y Click para sumar */}
                    <div
                      onClick={() => updateQuantity(product.id, 1)}
                      className="relative cursor-pointer aspect-square bg-slate-100 overflow-hidden group select-none"
                    >
                      <img
                        src={product.image_url || 'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=400'}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-emerald-500 text-white p-2 rounded-full shadow-lg">
                          <Plus className="w-5 h-5" />
                        </span>
                      </div>

                      {/* Badge contador actual */}
                      {isSelected && (
                        <div className="absolute bottom-2 right-2 bg-emerald-600 text-white font-black text-sm px-2.5 py-0.5 rounded-xl shadow-lg border border-emerald-400">
                          x{qty}
                        </div>
                      )}
                    </div>

                    {/* Detalles del Producto */}
                    <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {product.category}
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 leading-tight mt-0.5">
                          {product.name}
                        </h3>
                      </div>

                      <div className="mt-2">
                        {/* Precios Dólar y Bolívares */}
                        <div className="flex items-baseline justify-between">
                          <span className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                            ${product.price_usd.toFixed(2)}
                          </span>
                          <span className="text-xs font-bold text-slate-500 font-mono">
                            {product.price_bs.toLocaleString('es-VE')} Bs
                          </span>
                        </div>

                        {/* Contador Táctil [-] [input] [+] */}
                        <div className="mt-2.5 flex items-center justify-between bg-slate-100 rounded-xl p-1 border border-slate-200">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            disabled={qty === 0}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base transition-all active:scale-90 ${
                              qty > 0
                                ? 'bg-white text-slate-700 shadow-sm hover:bg-red-50 hover:text-red-600'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <input
                            type="number"
                            value={qty === 0 ? '' : qty}
                            placeholder="0"
                            onChange={e => setDirectQuantity(product.id, e.target.value)}
                            className="w-12 text-center bg-transparent font-black text-sm sm:text-base text-slate-800 focus:outline-none"
                          />

                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-base shadow-sm hover:bg-emerald-600 active:scale-90 transition-all"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ============================================================ */}
      {/* 3. VISTA B: ALMACÉN E INVENTARIO                            */}
      {/* ============================================================ */}
      {activeTab === 'inventory' && (
        <main className="max-w-6xl mx-auto w-full px-3 py-4 flex-1">
          {/* Header del Almacén con Estadísticas y Acciones */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Warehouse className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-lg sm:text-xl font-black text-slate-800">
                    Almacén e Inventario
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gestiona productos, precios, fotos y sincronización directa con GitHub.
                </p>
              </div>

              {/* Botones de Acción de Almacén */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleManualSyncGithub}
                  disabled={syncingGithub}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95 shadow-sm"
                  title="Respaldar archivo data/products.json en GitHub"
                >
                  {syncingGithub ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <GitBranch className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>{syncingGithub ? 'Sincronizando...' : 'Respaldar en GitHub'}</span>
                </button>

                <button
                  onClick={handleOpenAddProduct}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 text-slate-950" />
                  <span>+ Agregar Producto</span>
                </button>
              </div>
            </div>

            {/* Métrica Rápida */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Productos</span>
                <span className="text-lg sm:text-xl font-black text-slate-800 font-mono">
                  {warehouseStats.totalCount} items
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Stock Total</span>
                <span className="text-lg sm:text-xl font-black text-slate-800 font-mono">
                  {warehouseStats.totalUnits} u.
                </span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                <span className="text-[10px] text-emerald-700 font-bold uppercase block">Valor Total</span>
                <span className="text-base sm:text-xl font-black text-emerald-700 font-mono">
                  ${warehouseStats.totalValueUsd.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Productos en Almacén */}
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-500" />
              <p className="text-xs">Cargando inventario...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No hay productos en esta búsqueda</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredProducts.map(product => {
                const isLow = product.stock <= 5;
                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all hover:border-slate-300"
                  >
                    {/* Imagen e Info */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <img
                        src={product.image_url || PRESET_IMAGES[0].url}
                        alt={product.name}
                        className="w-16 h-16 sm:w-14 sm:h-14 rounded-xl object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md uppercase">
                            {product.category}
                          </span>
                          {isLow && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                              Bajo stock
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-slate-800 truncate mt-0.5">
                          {product.name}
                        </h4>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-sm font-black text-emerald-600 font-mono">
                            ${product.price_usd.toFixed(2)}
                          </span>
                          <span className="text-xs font-bold text-slate-400 font-mono">
                            {product.price_bs.toLocaleString('es-VE')} Bs
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stock y Acciones */}
                    <div className="flex items-center justify-between w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Control de Stock */}
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                        <button
                          onClick={() => handleQuickStock(product, -1)}
                          className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold text-xs hover:bg-slate-200 border border-slate-200"
                          title="Restar 1 al stock"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="px-2 text-center min-w-[50px]">
                          <span className="text-[9px] text-slate-400 block uppercase font-bold leading-none">Stock</span>
                          <span className="text-xs font-black text-slate-800 font-mono">{product.stock}</span>
                        </div>
                        <button
                          onClick={() => handleQuickStock(product, 1)}
                          className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold text-xs hover:bg-slate-200 border border-slate-200"
                          title="Sumar 1 al stock"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Botones Editar y Borrar */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditProduct(product)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95"
                        >
                          <Edit className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id, product.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ============================================================ */}
      {/* 4. BARRA INFERIOR FIJA (SOLO EN MODO POS / VENTA)             */}
      {/* ============================================================ */}
      {activeTab === 'pos' && (
        <footer className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-800 shadow-2xl px-3 py-2.5 sm:px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
            {/* Total Acumulado en Vivo */}
            <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
                    {totalItemsCount} {totalItemsCount === 1 ? 'producto' : 'productos'} seleccionados
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight leading-none">
                      ${totalUsd.toFixed(2)}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-300 font-mono">
                      ({totalBs.toLocaleString('es-VE')} Bs)
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón rápido cancelar */}
              {totalItemsCount > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-all active:scale-95 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
              )}
            </div>

            {/* Botones de Acción */}
            <div className="w-full md:w-auto flex items-center gap-2">
              {/* Botón Solicitar Reporte */}
              <button
                onClick={handleOpenReport}
                className="flex-1 md:flex-none px-3.5 py-3 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all active:scale-95"
              >
                <FileText className="w-4 h-4" />
                <span>Reporte</span>
              </button>

              {/* Botón Verde Concretar Venta */}
              <button
                onClick={handleOpenPayment}
                disabled={totalItemsCount === 0}
                className={`flex-2 md:flex-none px-5 py-3 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                  totalItemsCount > 0
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 text-slate-950" />
                <span>CONCRETAR VENTA</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* ============================================================ */}
      {/* 5. MODAL AGREGAR / EDITAR PRODUCTO (ALMACÉN)                 */}
      {/* ============================================================ */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  {editingProduct ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800">
                    {editingProduct ? 'Editar Producto' : 'Agregar Nuevo Producto'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Se actualizará en tiempo real y se guardará en GitHub
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveProduct} className="mt-4 space-y-3.5">
              {/* Nombre */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Doritos Mega Queso 150g"
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Precio y Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Precio ($ USD) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.05"
                      required
                      placeholder="1.50"
                      value={productForm.price_usd}
                      onChange={e => setProductForm({ ...productForm, price_usd: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-7 pr-3 py-2.5 text-sm font-black font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  {productForm.price_usd && !isNaN(productForm.price_usd) && (
                    <span className="text-[11px] font-bold text-slate-500 block mt-1 font-mono">
                      = {(parseFloat(productForm.price_usd) * exchangeRate).toLocaleString('es-VE')} Bs
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Cantidad en Stock
                  </label>
                  <input
                    type="number"
                    placeholder="20"
                    value={productForm.stock}
                    onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-black font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Categoría con chips sugeridos */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Categoría
                </label>
                <input
                  type="text"
                  placeholder="Ej: Snacks, Bebidas, Golosinas"
                  value={productForm.category}
                  onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {COMMON_CATEGORIES.map(cat => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setProductForm({ ...productForm, category: cat })}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                        productForm.category === cat
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Imagen del Producto */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  URL de Imagen del Producto
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={productForm.image_url}
                  onChange={e => setProductForm({ ...productForm, image_url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                />

                {/* Vista Previa de Imagen */}
                {productForm.image_url && (
                  <div className="mt-2 flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <img
                      src={productForm.image_url}
                      alt="Vista previa"
                      className="w-14 h-14 object-cover rounded-lg bg-slate-200 border"
                      onError={e => {
                        e.target.src = 'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=200';
                      }}
                    />
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Vista previa activa</span>
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[200px] block">
                        {productForm.name || 'Producto'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Galería de imágenes rápidas */}
                <div className="mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    O toca una imagen de muestra rápida:
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setProductForm({ ...productForm, image_url: preset.url })}
                        className={`relative rounded-lg overflow-hidden border aspect-square p-0.5 transition-all ${
                          productForm.image_url === preset.url
                            ? 'ring-2 ring-emerald-500 border-emerald-500 scale-95'
                            : 'border-slate-200 hover:opacity-80'
                        }`}
                        title={preset.label}
                      >
                        <img src={preset.url} alt={preset.label} className="w-full h-full object-cover rounded" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botones Guardar */}
              <div className="mt-5 flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="flex-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  {savingProduct ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{editingProduct ? 'Actualizar Producto' : 'Guardar y Subir a GitHub'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. MODAL DE PAGO (BOTTOM SHEET EN MÓVIL)                      */}
      {/* ============================================================ */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b pb-3.5">
              <div>
                <h2 className="text-lg font-black text-slate-800">Concretar Venta</h2>
                <p className="text-xs text-slate-500">Seleccione la forma de pago</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen Total */}
            <div className="my-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-800 uppercase block">Total a Cobrar</span>
                <span className="text-3xl font-black text-emerald-700 font-mono">${totalUsd.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-emerald-600 font-bold block">En Bolívares</span>
                <span className="text-lg font-black text-emerald-800 font-mono">
                  {totalBs.toLocaleString('es-VE')} Bs
                </span>
              </div>
            </div>

            {/* Opciones de Pago (Selección Múltiple) */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Formas de Pago:
              </label>

              {/* 1. Divisas $ */}
              <div
                onClick={() =>
                  setPaymentMethods(p => ({
                    ...p,
                    divisas: { ...p.divisas, selected: !p.divisas.selected }
                  }))
                }
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  paymentMethods.divisas.selected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Divisas ($ Efectivo)</h4>
                    <p className="text-[11px] text-slate-500">Billetes en USD</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={paymentMethods.divisas.selected}
                  readOnly
                  className="w-5 h-5 accent-emerald-500 rounded"
                />
              </div>

              {/* Input de Monto Recibido para cálculo de vuelto */}
              {paymentMethods.divisas.selected && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Monto Recibido en Dólares ($):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.5"
                      value={cashReceivedUsd}
                      onChange={e => setCashReceivedUsd(e.target.value)}
                      placeholder={totalUsd.toString()}
                      className="w-full bg-white pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-base font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {vueltoCalculado.usd > 0 && (
                    <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-900">Vuelto a entregar:</span>
                      <span className="font-black text-amber-700 font-mono text-sm">
                        ${vueltoCalculado.usd.toFixed(2)} ({vueltoCalculado.bs.toLocaleString('es-VE')} Bs)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Pago Móvil */}
              <div
                onClick={() =>
                  setPaymentMethods(p => ({
                    ...p,
                    pagoMovil: { ...p.pagoMovil, selected: !p.pagoMovil.selected }
                  }))
                }
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  paymentMethods.pagoMovil.selected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Pago Móvil</h4>
                    <p className="text-[11px] text-slate-500">Transferencia inmediata en Bs</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={paymentMethods.pagoMovil.selected}
                  readOnly
                  className="w-5 h-5 accent-emerald-500 rounded"
                />
              </div>

              {/* 3. Punto de Venta */}
              <div
                onClick={() =>
                  setPaymentMethods(p => ({
                    ...p,
                    puntoVenta: { ...p.puntoVenta, selected: !p.puntoVenta.selected }
                  }))
                }
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  paymentMethods.puntoVenta.selected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Punto de Venta</h4>
                    <p className="text-[11px] text-slate-500">Tarjeta de Débito / Crédito</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={paymentMethods.puntoVenta.selected}
                  readOnly
                  className="w-5 h-5 accent-emerald-500 rounded"
                />
              </div>

              {/* 4. Efectivo Bs */}
              <div
                onClick={() =>
                  setPaymentMethods(p => ({
                    ...p,
                    efectivoBs: { ...p.efectivoBs, selected: !p.efectivoBs.selected }
                  }))
                }
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  paymentMethods.efectivoBs.selected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Efectivo en Bolívares</h4>
                    <p className="text-[11px] text-slate-500">Billetes en Bs</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={paymentMethods.efectivoBs.selected}
                  readOnly
                  className="w-5 h-5 accent-emerald-500 rounded"
                />
              </div>
            </div>

            {/* Botones de Confirmación */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 active:scale-95 transition-all"
              >
                Regresar
              </button>
              <button
                onClick={handleConfirmSale}
                className="flex-2 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>CONFIRMAR Y GUARDAR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. MODAL DE VENTA EXITOSA / TICKET                            */}
      {/* ============================================================ */}
      {showSuccessModal && lastSaleData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-800">¡Venta Concretada!</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Ticket #{lastSaleData.saleNumber}</p>

            <div className="my-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Productos:</span>
                <span className="font-bold text-slate-800">{lastSaleData.itemsCount} unidades</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto USD:</span>
                <span className="font-black text-emerald-600 font-mono text-sm">
                  ${lastSaleData.totalUsd?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto Bs:</span>
                <span className="font-black text-slate-700 font-mono">
                  {lastSaleData.totalBs?.toLocaleString('es-VE')} Bs
                </span>
              </div>
              {lastSaleData.vuelto?.usd > 0 && (
                <div className="pt-2 border-t flex justify-between text-amber-700 font-bold">
                  <span>Vuelto:</span>
                  <span className="font-mono">
                    ${lastSaleData.vuelto.usd.toFixed(2)} ({lastSaleData.vuelto.bs.toLocaleString('es-VE')} Bs)
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all"
            >
              Nueva Venta
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. MODAL DE SOLICITAR REPORTE (CIERRES Y N8N / TELEGRAM)      */}
      {/* ============================================================ */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-500" />
                <h2 className="text-lg font-black text-slate-800">Corte de Caja y Reporte</h2>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas de Turno */}
            <div className="grid grid-cols-3 gap-1.5 my-3 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  setReportShift('day');
                  fetchReport('day');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  reportShift === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Turno 1
                <span className="block text-[9px] font-normal text-slate-400">08:00 - 17:30</span>
              </button>

              <button
                onClick={() => {
                  setReportShift('night');
                  fetchReport('night');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  reportShift === 'night' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Turno 2
                <span className="block text-[9px] font-normal text-slate-400">18:00 - 22:00</span>
              </button>

              <button
                onClick={() => {
                  setReportShift('live');
                  fetchReport('live');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  reportShift === 'live' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Extendido ⭐
                <span className="block text-[9px] font-normal opacity-90">18:00 - Ahora</span>
              </button>
            </div>

            {/* Contenido del Reporte */}
            {reportLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-xs">Calculando corte...</p>
              </div>
            ) : reportData?.summary ? (
              <div className="space-y-3">
                {/* Cuadros de Totales */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ventas Concretadas</span>
                    <span className="text-2xl font-black text-slate-800 font-mono">
                      {reportData.summary.totalSales}
                    </span>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Total General</span>
                    <span className="text-xl font-black text-emerald-700 font-mono">
                      ${reportData.summary.totalUsd?.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-600 block font-mono">
                      {reportData.summary.totalBs?.toLocaleString('es-VE')} Bs
                    </span>
                  </div>
                </div>

                {/* Desglose por Método de Pago */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                    Arqueo por Forma de Pago:
                  </h4>
                  {reportData.summary.paymentBreakdown?.length === 0 ? (
                    <p className="text-xs text-slate-400">No hay pagos registrados en este periodo.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {reportData.summary.paymentBreakdown.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-600">{p.payment_method}:</span>
                          <span className="font-bold text-slate-800 font-mono">
                            ${parseFloat(p.sum_usd).toFixed(2)} / {parseFloat(p.sum_bs).toLocaleString('es-VE')} Bs
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Estado de envío a Telegram */}
                {telegramStatus && (
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs font-bold text-sky-800 text-center">
                    {telegramStatus}
                  </div>
                )}

                {/* Botón Disparar a Telegram vía N8N */}
                <button
                  onClick={handleSendTelegramReport}
                  className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  <Send className="w-4 h-4 text-slate-950" />
                  <span>DISPARAR REPORTE A TELEGRAM</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

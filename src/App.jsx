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
  Lock,
  Edit,
  X,
  Send,
  RefreshCw,
  Clock,
  Package,
  Sparkles,
  ChevronRight,
  Receipt
} from 'lucide-react';

export default function App() {
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
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSaleData, setLastSaleData] = useState(null);

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

  // Estados de Admin / Edición de Productos
  const [pinInput, setPinInput] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPinError, setAdminPinError] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Varios',
    price_usd: '',
    stock: '',
    image_url: ''
  });

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

  // Categorías únicas
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

      // Formatear pagos seleccionados
      const payments = [];
      if (paymentMethods.divisas.selected) {
        payments.push({
          method: 'Divisas ($)',
          amount_usd: totalUsd,
          amount_bs: totalBs
        });
      }
      if (paymentMethods.pagoMovil.selected) {
        payments.push({
          method: 'Pago Móvil',
          amount_usd: totalUsd,
          amount_bs: totalBs
        });
      }
      if (paymentMethods.puntoVenta.selected) {
        payments.push({
          method: 'Punto de Venta',
          amount_usd: totalUsd,
          amount_bs: totalBs
        });
      }
      if (paymentMethods.efectivoBs.selected) {
        payments.push({
          method: 'Efectivo (Bs)',
          amount_usd: totalUsd,
          amount_bs: totalBs
        });
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
        loadProducts(); // Actualizar inventario
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
            : ' Generado en sistema (Webhook N8N listo para recepcionar).'
        );
      }
    } catch (err) {
      setTelegramStatus('⚠️ Error al enviar reporte');
    }
  };

  // Autenticación de PIN Admin
  const handleVerifyPin = async () => {
    try {
      const res = await fetch('/api/settings/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });
      const data = await res.json();
      if (data.success && data.authorized) {
        setIsAdminAuthenticated(true);
        setAdminPinError('');
      } else {
        setAdminPinError('PIN incorrecto (Por defecto: 1234)');
      }
    } catch (err) {
      setAdminPinError('Error de verificación');
    }
  };

  // Guardar producto nuevo o editado
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm)
      });
      const data = await res.json();
      if (data.success) {
        setEditingProduct(null);
        setProductForm({ name: '', category: 'Varios', price_usd: '', stock: '', image_url: '' });
        loadProducts();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error al guardar producto');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('¿Desactivar este producto del kiosco?')) {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      loadProducts();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-36 md:pb-28">
      {/* 1. ENCABEZADO SUPERIOR TÁCTIL */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-emerald-500 rounded-xl text-slate-950 font-black text-xl shadow-sm">
              🏪
            </span>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-white leading-tight">
                Kiosco G
              </h1>
              <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Punto de Venta
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tasa de cambio badge */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 flex items-center space-x-1.5 shadow-inner">
              <Coins className="w-4 h-4 text-amber-400" />
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block leading-none">Tasa Fija</span>
                <span className="text-xs font-bold text-amber-400 font-mono">1.000 Bs/$</span>
              </div>
            </div>

            {/* Botón Admin PIN */}
            <button
              onClick={() => {
                setShowAdminModal(true);
                setPinInput('');
                setAdminPinError('');
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 active:scale-95"
              title="Administrar Productos"
            >
              <Edit className="w-5 h-5 text-emerald-400" />
            </button>
          </div>
        </div>

        {/* Barra de Búsqueda Rápida */}
        <div className="max-w-6xl mx-auto mt-2.5">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar producto... (ej: Coca Cola, Doritos)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/90 text-white placeholder-slate-400 pl-11 pr-4 py-2.5 rounded-xl text-sm border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
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
        <div className="max-w-6xl mx-auto mt-2.5 flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
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

      {/* 2. CATÁLOGO DE PRODUCTOS (GRID RESPONSIVE) */}
      <main className="max-w-6xl mx-auto w-full px-3 py-3 flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
            <p className="text-sm font-medium">Cargando catálogo del kiosco...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm max-w-md mx-auto my-12 border border-slate-200">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">No hay productos encontrados</h3>
            <p className="text-xs text-slate-400 mt-1">
              Prueba buscando otro término o agrega nuevos productos en el panel de edición.
            </p>
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

      {/* 3. BARRA INFERIOR FIJA (PIE DE PÁGINA STICKY) */}
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

      {/* ============================================================ */}
      {/* 4. MODAL DE PAGO (BOTTOM SHEET EN MÓVIL)                      */}
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
      {/* 5. MODAL DE VENTA EXITOSA / TICKET                            */}
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
      {/* 6. MODAL DE SOLICITAR REPORTE (CIERRES Y N8N / TELEGRAM)      */}
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

      {/* ============================================================ */}
      {/* 7. MODAL DE ADMINISTRACIÓN Y EDICIÓN DE PRODUCTOS (PIN)       */}
      {/* ============================================================ */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-black text-slate-800">Administrar Productos</h2>
              </div>
              <button
                onClick={() => setShowAdminModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isAdminAuthenticated ? (
              /* Pantalla de bloqueo por PIN */
              <div className="py-8 text-center max-w-xs mx-auto">
                <div className="w-14 h-14 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Acceso Administrativo</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">Ingrese el PIN de seguridad para gestionar productos</p>

                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-32 mx-auto text-center tracking-widest text-2xl font-black py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2 font-mono"
                />

                {adminPinError && (
                  <p className="text-xs text-rose-500 font-semibold mb-3">{adminPinError}</p>
                )}

                <button
                  onClick={handleVerifyPin}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition-all"
                >
                  Verificar PIN
                </button>
              </div>
            ) : (
              /* Panel de Gestión de Productos */
              <div className="mt-4 space-y-4">
                {/* Formulario de Crear / Editar */}
                <form onSubmit={handleSaveProduct} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {editingProduct ? 'Editar Producto' : 'Agregar Nuevo Producto'}
                  </h3>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">Nombre</label>
                    <input
                      type="text"
                      required
                      value={productForm.name}
                      onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="Ej: Galleta Club Social"
                      className="w-full bg-white px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-0.5">Categoría</label>
                      <input
                        type="text"
                        value={productForm.category}
                        onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                        placeholder="Snacks"
                        className="w-full bg-white px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-0.5">Precio ($)</label>
                      <input
                        type="number"
                        step="0.05"
                        required
                        value={productForm.price_usd}
                        onChange={e => setProductForm({ ...productForm, price_usd: e.target.value })}
                        placeholder="1.00"
                        className="w-full bg-white px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-0.5">Stock</label>
                      <input
                        type="number"
                        value={productForm.stock}
                        onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                        placeholder="20"
                        className="w-full bg-white px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-0.5">URL de Imagen</label>
                    <input
                      type="url"
                      value={productForm.image_url}
                      onChange={e => setProductForm({ ...productForm, image_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-white px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    {editingProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(null);
                          setProductForm({ name: '', category: 'Varios', price_usd: '', stock: '', image_url: '' });
                        }}
                        className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black shadow-sm"
                    >
                      {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
                    </button>
                  </div>
                </form>

                {/* Lista de Productos Existentes */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Productos Activos ({products.length}):
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {products.map(p => (
                      <div
                        key={p.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.image_url || 'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=100'}
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-200"
                          />
                          <div>
                            <h5 className="text-xs font-bold text-slate-800">{p.name}</h5>
                            <span className="text-[11px] text-emerald-600 font-mono font-bold">
                              ${p.price_usd.toFixed(2)} / {p.price_bs.toLocaleString('es-VE')} Bs
                            </span>
                            <span className="text-[10px] text-slate-400 ml-2">Stock: {p.stock}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setProductForm({
                                name: p.name,
                                category: p.category,
                                price_usd: p.price_usd.toString(),
                                stock: p.stock.toString(),
                                image_url: p.image_url || ''
                              });
                            }}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 bg-white rounded-lg border border-slate-200"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 bg-white rounded-lg border border-slate-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

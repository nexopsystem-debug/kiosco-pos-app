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
  Tag,
  Camera,
  Image as ImageIcon,
  BarChart3,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  Lock,
  Unlock,
  KeyRound,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDownAZ
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

  // Carrito / Cantidades seleccionadas { [productId]: quantity } con persistencia en localStorage
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('kiosco_active_cart');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persistir carrito activo para que no se pierda al recargar la página o cerrar navegador
  useEffect(() => {
    try {
      if (Object.keys(cart).length === 0) {
        localStorage.removeItem('kiosco_active_cart');
      } else {
        localStorage.setItem('kiosco_active_cart', JSON.stringify(cart));
      }
    } catch (e) {
      console.warn('Error al respaldar carrito localmente:', e);
    }
  }, [cart]);

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

  // Estados de Sincronización con GitHub y Almacenamiento de Fotos
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [recentImages, setRecentImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Estados de Gestión de Categorías
  const [categoriesList, setCategoriesList] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Estados de Protección / PIN de Administración (2200)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => sessionStorage.getItem('kiosco_admin_unlocked') === 'true');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pendingAdminAction, setPendingAdminAction] = useState(null);

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

  // Estados de Contabilidad en Tiempo Real y Filtros Extendidos
  const [accountingPeriod, setAccountingPeriod] = useState('today'); // 'today', 'yesterday', 'week', 'month', 'day', 'night', 'live', 'custom', 'all'
  const [accountingCustomDate, setAccountingCustomDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [accountingData, setAccountingData] = useState(null);
  const [accountingLoading, setAccountingLoading] = useState(false);
  const [accountingSearch, setAccountingSearch] = useState('');
  const [accountingCategory, setAccountingCategory] = useState('Todos');

  // Estados de Cierre de Caja Oficial
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [closingPreview, setClosingPreview] = useState(null);
  const [closingLoading, setClosingLoading] = useState(false);
  const [closingSubmitting, setClosingSubmitting] = useState(false);
  const [closingCashDrawerUsd, setClosingCashDrawerUsd] = useState('');
  const [closingCashierName, setClosingCashierName] = useState('Cajero Principal');
  const [closingNotes, setClosingNotes] = useState('');
  const [closingsHistory, setClosingsHistory] = useState([]);
  const [showClosingsHistory, setShowClosingsHistory] = useState(false);

  // Estados de Conectividad y Modo Offline
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineSalesQueue, setOfflineSalesQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kiosco_offline_sales') || '[]');
    } catch {
      return [];
    }
  });
  const [syncingOffline, setSyncingOffline] = useState(false);

  // Estados de Navegación, Header Inteligente y Scroll
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showHeader, setShowHeader] = useState(true);

  // Estados de Ordenamiento y Destacado en Almacén
  const [warehouseSortOrder, setWarehouseSortOrder] = useState('recent'); // 'recent' | 'alpha'
  const [highlightedProductId, setHighlightedProductId] = useState(null);

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4500);
  };

  // Cargar productos y tasa inicial con soporte de caché offline
  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (data.rate) setExchangeRate(data.rate);
        try {
          localStorage.setItem('kiosco_products_cache', JSON.stringify(data.products || []));
        } catch (e) {}
      } else {
        throw new Error(data.error || 'Error al cargar productos');
      }
    } catch (err) {
      // Intentar cargar productos desde caché local offline
      try {
        const cached = localStorage.getItem('kiosco_products_cache');
        if (cached) {
          const prods = JSON.parse(cached);
          if (prods && prods.length > 0) {
            setProducts(prods);
            showToast('📦 Catálogo cargado desde memoria local (Modo Offline)');
            setError('');
            return;
          }
        }
      } catch (e) {}
      setError('No se pudo conectar al servidor');
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar ventas guardadas localmente hacia PostgreSQL
  const syncOfflineSales = async () => {
    if (syncingOffline) return;
    let queue = [];
    try {
      queue = JSON.parse(localStorage.getItem('kiosco_offline_sales') || '[]');
    } catch {
      queue = [];
    }
    if (!queue.length) return;

    try {
      setSyncingOffline(true);
      showToast(`🔄 Sincronizando ${queue.length} venta(s) guardadas localmente...`);
      const remainingQueue = [];

      for (const sale of queue) {
        try {
          const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: sale.items,
              payments: sale.payments,
              sale_number: sale.saleNumber,
              offline_created_at: sale.offline_created_at || sale.createdAt,
              is_offline_sync: true
            })
          });
          const data = await res.json();
          if (!data.success) {
            remainingQueue.push(sale);
          }
        } catch (e) {
          remainingQueue.push(sale);
        }
      }

      setOfflineSalesQueue(remainingQueue);
      localStorage.setItem('kiosco_offline_sales', JSON.stringify(remainingQueue));

      if (remainingQueue.length === 0) {
        showToast('✅ Todas las ventas offline fueron sincronizadas con el servidor');
        loadProducts();
      } else {
        showToast(`⚠️ Quedan ${remainingQueue.length} ventas pendientes por sincronizar`);
      }
    } catch (err) {
      console.warn('Error sincronizando ventas offline:', err);
    } finally {
      setSyncingOffline(false);
    }
  };

  // Detectar cambios de conexión a internet
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('📶 Conexión restaurada (En Línea)');
      syncOfflineSales();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('⚠️ Sin conexión a internet. Activado Modo Offline de respaldo.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar las imágenes más recientes guardadas en el repositorio
  const loadRecentImages = async () => {
    try {
      const res = await fetch('/api/uploads/recent');
      const data = await res.json();
      if (data.success && Array.isArray(data.images)) {
        setRecentImages(data.images);
      }
    } catch (err) {
      console.warn('No se pudieron obtener imágenes recientes:', err);
    }
  };

  // Cargar categorías desde la base de datos
  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        setCategoriesList(data.categories);
      }
    } catch (err) {
      console.warn('Error al cargar categorías:', err);
    }
  };

  // Cargar reporte de contabilidad en tiempo real con filtros extendidos
  const loadAccountingReport = async (period = accountingPeriod, customDate = accountingCustomDate) => {
    try {
      setAccountingLoading(true);
      const url = period === 'custom'
        ? `/api/reports/accounting?period=custom&date=${encodeURIComponent(customDate)}`
        : `/api/reports/accounting?period=${period}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAccountingData(data);
      }
    } catch (err) {
      console.warn('Error al cargar datos contables:', err);
    } finally {
      setAccountingLoading(false);
    }
  };

  // Cargar vista previa del cierre de caja del día
  const handleOpenClosingModal = async () => {
    try {
      setClosingLoading(true);
      setShowClosingModal(true);
      setClosingCashDrawerUsd('');
      setClosingNotes('');
      const res = await fetch('/api/reports/daily-closing/preview');
      const data = await res.json();
      if (data.success) {
        setClosingPreview(data);
      } else {
        showToast('⚠️ No se pudo obtener la vista previa del cierre.');
      }
    } catch (err) {
      console.error('Error al cargar vista previa del cierre:', err);
      showToast('⚠️ Error al conectar con el servidor.');
    } finally {
      setClosingLoading(false);
    }
  };

  // Confirmar y registrar Cierre Oficial de Caja
  const handleConfirmDailyClosing = async () => {
    try {
      setClosingSubmitting(true);
      const payload = {
        cashier_name: closingCashierName || 'Cajero Principal',
        cash_drawer_usd: closingCashDrawerUsd !== '' ? parseFloat(closingCashDrawerUsd) : null,
        notes: closingNotes || ''
      };
      const res = await fetch('/api/reports/daily-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setShowClosingModal(false);
        showToast('✅ ¡Cierre de caja completado y reporte oficial enviado a Telegram!');
        loadAccountingReport(accountingPeriod, accountingCustomDate);
        loadClosingsHistory();
      } else {
        showToast(`❌ Error al ejecutar cierre: ${data.error || 'Desconocido'}`);
      }
    } catch (err) {
      console.error('Error al registrar cierre de caja:', err);
      showToast('❌ Error de conexión al registrar cierre.');
    } finally {
      setClosingSubmitting(false);
    }
  };

  // Cargar historial de cierres diarios guardados
  const loadClosingsHistory = async () => {
    try {
      const res = await fetch('/api/reports/daily-closing/history');
      const data = await res.json();
      if (data.success) {
        setClosingsHistory(data.history || []);
      }
    } catch (err) {
      console.warn('Error al cargar historial de cierres:', err);
    }
  };

  useEffect(() => {
    loadProducts();
    loadRecentImages();
    loadCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'accounting') {
      loadAccountingReport(accountingPeriod, accountingCustomDate);
      loadClosingsHistory();
    }
  }, [activeTab, accountingPeriod]);

  // Control de scroll para botón flotante "Subir" y barra superior inteligente (auto-hide en scroll down, show en scroll up)
  useEffect(() => {
    let prevScroll = window.scrollY;
    const handleScroll = () => {
      const currentScroll = window.scrollY;

      // Mostrar botón flotante de subir si el scroll supera los 250px
      if (currentScroll > 250) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }

      // Barra superior inteligente: siempre visible cerca del tope superior
      if (currentScroll <= 30) {
        setShowHeader(true);
      } else if (currentScroll > prevScroll && currentScroll > 80) {
        // Haciendo scroll hacia abajo: ocultar suavemente
        setShowHeader(false);
      } else if (currentScroll < prevScroll) {
        // Haciendo scroll hacia arriba: desplegar inmediatamente
        setShowHeader(true);
      }

      prevScroll = currentScroll;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Productos vendidos filtrados en contabilidad
  const filteredAccountingProducts = useMemo(() => {
    if (!accountingData?.productsSold) return [];
    return accountingData.productsSold.filter(p => {
      const matchesSearch = p.productName.toLowerCase().includes(accountingSearch.toLowerCase()) ||
                            p.category.toLowerCase().includes(accountingSearch.toLowerCase());
      const matchesCategory = accountingCategory === 'Todos' || p.category === accountingCategory;
      return matchesSearch && matchesCategory;
    });
  }, [accountingData, accountingSearch, accountingCategory]);

  // Categorías dinámicas unificadas para filtros
  const categories = useMemo(() => {
    const fromList = categoriesList.map(c => c.name);
    const fromProds = products.map(p => p.category || 'Varios');
    const combined = Array.from(new Set([...fromList, ...fromProds])).filter(Boolean);
    return ['Todos', ...combined];
  }, [categoriesList, products]);

  // Productos filtrados
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Productos de Almacén ordenados según selección (Recientes primero o Alfabético A-Z)
  const warehouseProducts = useMemo(() => {
    if (warehouseSortOrder === 'alpha') {
      return [...filteredProducts].sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
      );
    }
    // Por defecto 'recent': mantiene el orden del backend (COALESCE(updated_at, created_at) DESC)
    return filteredProducts;
  }, [filteredProducts, warehouseSortOrder]);

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
    const prod = products.find(p => p.id === id);
    if (delta > 0 && prod && prod.stock !== undefined && prod.stock !== null) {
      const current = cart[id] || 0;
      if (current >= prod.stock) {
        showToast(`⚠️ No hay más unidades disponibles de ${prod.name} (Stock: ${prod.stock})`);
        return;
      }
    }
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
    const prod = products.find(p => p.id === id);
    if (isNaN(parsed) || parsed <= 0) {
      setCart(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } else {
      if (prod && prod.stock !== undefined && prod.stock !== null && parsed > prod.stock) {
        showToast(`⚠️ Stock máximo disponible de ${prod.name}: ${prod.stock}`);
        setCart(prev => ({ ...prev, [id]: prod.stock }));
      } else {
        setCart(prev => ({ ...prev, [id]: parsed }));
      }
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
  // Métodos de pago seleccionados
  const selectedPaymentKeys = useMemo(() => {
    return Object.keys(paymentMethods).filter(k => paymentMethods[k].selected);
  }, [paymentMethods]);

  // Suma de montos asignados en USD cuando hay múltiples métodos seleccionados
  const totalAssignedUsd = useMemo(() => {
    if (selectedPaymentKeys.length <= 1) {
      return totalUsd;
    }
    return selectedPaymentKeys.reduce((acc, k) => {
      const val = parseFloat(paymentMethods[k].amountUsd);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [paymentMethods, selectedPaymentKeys, totalUsd]);

  const remainingToAssignUsd = useMemo(() => {
    return parseFloat((totalUsd - totalAssignedUsd).toFixed(2));
  }, [totalUsd, totalAssignedUsd]);

  const handleOpenPayment = () => {
    if (totalItemsCount === 0) return;
    setPaymentMethods({
      divisas: { selected: true, amountUsd: totalUsd.toFixed(2), amountBs: totalBs.toFixed(2) },
      pagoMovil: { selected: false, amountUsd: '', amountBs: '' },
      puntoVenta: { selected: false, amountUsd: '', amountBs: '' },
      efectivoBs: { selected: false, amountUsd: '', amountBs: '' }
    });
    setCashReceivedUsd(totalUsd.toString());
    setShowPaymentModal(true);
  };

  // Alternar selección de método de pago
  const togglePaymentMethod = (key) => {
    setPaymentMethods(prev => {
      const currentlySelected = prev[key].selected;
      const willBeSelected = !currentlySelected;
      
      const newMethods = {
        ...prev,
        [key]: {
          ...prev[key],
          selected: willBeSelected,
          amountUsd: '',
          amountBs: ''
        }
      };

      const selectedKeys = Object.keys(newMethods).filter(k => newMethods[k].selected);

      // Si no queda ninguno, no permitir deseleccionar el último
      if (selectedKeys.length === 0) {
        return prev;
      }

      // Si queda un único método, asignarle automáticamente el 100% de la venta
      if (selectedKeys.length === 1) {
        const onlyKey = selectedKeys[0];
        newMethods[onlyKey] = {
          ...newMethods[onlyKey],
          amountUsd: totalUsd.toFixed(2),
          amountBs: totalBs.toFixed(2)
        };
      } else if (willBeSelected) {
        // Si activamos un método nuevo en pago mixto, sugerirle el restante
        const sumOthers = selectedKeys
          .filter(k => k !== key)
          .reduce((acc, k) => acc + (parseFloat(newMethods[k].amountUsd) || 0), 0);
        const rem = Math.max(0, parseFloat((totalUsd - sumOthers).toFixed(2)));
        if (rem > 0) {
          newMethods[key].amountUsd = rem.toFixed(2);
          newMethods[key].amountBs = (rem * exchangeRate).toFixed(2);
        }
      }

      return newMethods;
    });
  };

  // Cambiar monto en USD para un método de pago
  const handlePaymentAmountChangeUsd = (key, val) => {
    const num = parseFloat(val);
    setPaymentMethods(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        amountUsd: val,
        amountBs: isNaN(num) ? '' : (num * exchangeRate).toFixed(2)
      }
    }));
  };

  // Cambiar monto en Bs para un método de pago
  const handlePaymentAmountChangeBs = (key, val) => {
    const num = parseFloat(val);
    setPaymentMethods(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        amountBs: val,
        amountUsd: isNaN(num) ? '' : (num / exchangeRate).toFixed(2)
      }
    }));
  };

  // Asignar el restante exacto a un método específico
  const handleAssignRemaining = (targetKey) => {
    const sumOthers = selectedPaymentKeys
      .filter(k => k !== targetKey)
      .reduce((acc, k) => acc + (parseFloat(paymentMethods[k].amountUsd) || 0), 0);
    const rem = Math.max(0, parseFloat((totalUsd - sumOthers).toFixed(2)));
    setPaymentMethods(prev => ({
      ...prev,
      [targetKey]: {
        ...prev[targetKey],
        amountUsd: rem.toFixed(2),
        amountBs: (rem * exchangeRate).toFixed(2)
      }
    }));
  };

  // Vuelto / Cambio calculado
  const vueltoCalculado = useMemo(() => {
    const received = parseFloat(cashReceivedUsd) || 0;
    const assignedDivisas = selectedPaymentKeys.length > 1
      ? (parseFloat(paymentMethods.divisas.amountUsd) || 0)
      : totalUsd;
    const diff = received - assignedDivisas;
    if (diff > 0 && paymentMethods.divisas.selected && assignedDivisas > 0) {
      return {
        usd: parseFloat(diff.toFixed(2)),
        bs: parseFloat((diff * exchangeRate).toFixed(2))
      };
    }
    return { usd: 0, bs: 0 };
  }, [cashReceivedUsd, totalUsd, exchangeRate, paymentMethods, selectedPaymentKeys]);

  // Concretar Venta
  const handleConfirmSale = async () => {
    try {
      const items = Object.entries(cart)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({ id: parseInt(id, 10), quantity: qty }));

      if (items.length === 0) {
        alert('No hay productos en la venta actual');
        return;
      }

      if (selectedPaymentKeys.length === 0) {
        alert('Debes seleccionar al menos una forma de pago');
        return;
      }

      const methodNames = {
        divisas: 'Divisas ($)',
        pagoMovil: 'Pago Móvil',
        puntoVenta: 'Punto de Venta',
        efectivoBs: 'Efectivo (Bs)'
      };

      const payments = [];

      if (selectedPaymentKeys.length === 1) {
        const key = selectedPaymentKeys[0];
        payments.push({
          method: methodNames[key],
          amount_usd: totalUsd,
          amount_bs: totalBs
        });
      } else {
        // En pago mixto validamos que los montos sumen exactamente el total
        if (Math.abs(remainingToAssignUsd) > 0.01) {
          if (remainingToAssignUsd > 0) {
            alert(`⚠️ Falta asignar $${remainingToAssignUsd.toFixed(2)} (${(remainingToAssignUsd * exchangeRate).toLocaleString('es-VE')} Bs) para cubrir el total de la venta.`);
          } else {
            alert(`⚠️ La suma de los métodos supera el total de la venta por $${Math.abs(remainingToAssignUsd).toFixed(2)}. Por favor ajusta los montos.`);
          }
          return;
        }

        for (const key of selectedPaymentKeys) {
          const usd = parseFloat(paymentMethods[key].amountUsd) || 0;
          const bs = parseFloat(paymentMethods[key].amountBs) || (usd * exchangeRate);
          if (usd > 0) {
            payments.push({
              method: methodNames[key],
              amount_usd: parseFloat(usd.toFixed(2)),
              amount_bs: parseFloat(bs.toFixed(2))
            });
          }
        }
      }

      if (payments.length === 0) {
        alert('Debes asignar un monto válido mayor a cero a las formas de pago');
        return;
      }

      let res;
      let data;
      let isOfflineSale = false;

      try {
        res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, payments })
        });
        if (res.ok) {
          data = await res.json();
        } else {
          isOfflineSale = true;
        }
      } catch (networkErr) {
        console.warn('Fallo de red al registrar venta, guardando localmente (offline):', networkErr);
        isOfflineSale = true;
      }

      if (!isOfflineSale && data && data.success) {
        setLastSaleData({
          ...data.sale,
          itemsCount: totalItemsCount,
          vuelto: vueltoCalculado,
          payments: payments
        });
        setShowPaymentModal(false);
        setShowSuccessModal(true);
        setCart({});
        loadProducts(); // Actualizar inventario en vivo
        loadAccountingReport(accountingPeriod); // Actualizar contabilidad en tiempo real

        if (data.lowStockAlerts && data.lowStockAlerts.length > 0) {
          const names = data.lowStockAlerts.map(a => `${a.name} (${a.stock} disp.)`).join(', ');
          showToast(`⚠️ Alerta Telegram: Stock bajo en ${names}`);
        }
      } else if (isOfflineSale || !res || !res.ok) {
        // Encolar venta en modo offline (LocalStorage)
        const offlineSaleId = 'OFF-' + Date.now();
        const offlineCreatedAt = new Date().toISOString();
        const offlineSaleRecord = {
          id: offlineSaleId,
          items,
          payments,
          total_usd: totalFinalUSD,
          total_bs: totalFinalBS,
          created_at: offlineCreatedAt,
          itemsCount: totalItemsCount,
          vuelto: vueltoCalculado,
          isOffline: true
        };
        const updatedQueue = [...offlineSalesQueue, offlineSaleRecord];
        setOfflineSalesQueue(updatedQueue);
        localStorage.setItem('kiosco_offline_sales', JSON.stringify(updatedQueue));

        // Descontar inventario localmente en memoria
        setProducts(prev => prev.map(p => {
          const bought = items.find(it => it.id === p.id);
          if (bought) {
            return { ...p, stock: Math.max(0, (p.stock || 0) - bought.quantity) };
          }
          return p;
        }));

        setLastSaleData({
          id: offlineSaleId,
          total_usd: totalFinalUSD,
          total_bs: totalFinalBS,
          created_at: offlineCreatedAt,
          itemsCount: totalItemsCount,
          vuelto: vueltoCalculado,
          payments: payments,
          isOffline: true
        });
        setShowPaymentModal(false);
        setShowSuccessModal(true);
        setCart({});
        showToast('📱 Venta guardada en Modo Offline. Se sincronizará automáticamente cuando vuelva internet.');
      } else {
        alert('Error al registrar venta: ' + (data?.error || 'Desconocido'));
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

  // Control de Acceso y Clave de Administrador (2200)
  const handleRequestAdminAccess = (targetAction = 'inventory') => {
    if (isAdminUnlocked) {
      if (targetAction === 'inventory') setActiveTab('inventory');
      else if (targetAction === 'add_product') handleOpenAddProduct();
      else if (targetAction === 'category') setShowCategoryModal(true);
      else if (typeof targetAction === 'function') targetAction();
      return;
    }
    setPinInput('');
    setPinError('');
    setPendingAdminAction(() => targetAction);
    setShowPinModal(true);
  };

  const handleVerifyPin = async (e) => {
    if (e) e.preventDefault();
    const pin = pinInput.trim();
    if (!pin) {
      setPinError('Ingrese la clave de 4 dígitos');
      return;
    }

    try {
      setPinLoading(true);
      setPinError('');
      const res = await fetch('/api/settings/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (data.success && data.authorized) {
        setIsAdminUnlocked(true);
        sessionStorage.setItem('kiosco_admin_unlocked', 'true');
        setShowPinModal(false);
        setPinInput('');

        if (pendingAdminAction === 'inventory') {
          setActiveTab('inventory');
        } else if (pendingAdminAction === 'add_product') {
          handleOpenAddProduct();
        } else if (pendingAdminAction === 'category') {
          setShowCategoryModal(true);
        } else if (typeof pendingAdminAction === 'function') {
          pendingAdminAction();
        }
        setPendingAdminAction(null);
      } else {
        setPinError(data.error || 'Clave incorrecta');
      }
    } catch (err) {
      if (pin === '2200') {
        setIsAdminUnlocked(true);
        sessionStorage.setItem('kiosco_admin_unlocked', 'true');
        setShowPinModal(false);
        setPinInput('');
        if (pendingAdminAction === 'inventory') setActiveTab('inventory');
      } else {
        setPinError('Clave incorrecta');
      }
    } finally {
      setPinLoading(false);
    }
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    sessionStorage.removeItem('kiosco_admin_unlocked');
    setActiveTab('pos');
  };

  // Abrir Modal de Producto (Nuevo o Editar)
  const handleOpenAddProduct = () => {
    if (!isAdminUnlocked) {
      handleRequestAdminAccess('add_product');
      return;
    }
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: 'Snacks',
      price_usd: '',
      stock: '20',
      image_url: recentImages.length > 0 ? recentImages[0].url : PRESET_IMAGES[1].url
    });
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (prod) => {
    if (!isAdminUnlocked) {
      handleRequestAdminAccess(() => handleOpenEditProduct(prod));
      return;
    }
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
        const savedId = editingProduct ? editingProduct.id : (data.product?.id || null);
        if (savedId) {
          setHighlightedProductId(savedId);
          setTimeout(() => setHighlightedProductId(null), 8000);
        }
        setWarehouseSortOrder('recent'); // Colocar en primer lugar de la lista
        setShowProductModal(false);
        showToast(
          editingProduct
            ? `✅ ${productForm.name} actualizado y colocado al inicio del Almacén`
            : `✅ ${productForm.name} agregado y colocado al inicio del Almacén`
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

  // Compresión de imagen en cliente (para optimizar consumo y rapidez en móvil/tablet)
  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  // Subir imagen desde el dispositivo y guardarla en el repositorio de GitHub
  const handleImageFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      // Redimensionar para subir rápido desde teléfonos/tablets
      const compressedData = await compressImage(file);

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          data: compressedData
        })
      });

      const data = await res.json();
      if (data.success) {
        setProductForm(prev => ({ ...prev, image_url: data.url }));
        showToast('📸 Foto subida y guardada en GitHub con éxito');
        loadRecentImages();
      } else {
        alert('Error al subir imagen: ' + (data.error || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error al subir imagen:', err);
      alert('Error al procesar la imagen seleccionada');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Disparar sincronización manual ("Actualizar Productos")
  const handleManualSyncGithub = async () => {
    try {
      setSyncingGithub(true);
      const [syncRes] = await Promise.all([
        fetch('/api/products/sync-github', { method: 'POST' }),
        loadRecentImages(),
        loadProducts(),
        loadCategories()
      ]);
      const data = await syncRes.json();
      if (data.success) {
        showToast(`✅ Catálogo, categorías e imágenes sincronizados en GitHub (${data.count} productos)`);
      } else {
        showToast(`ℹ️ ${data.message || 'Catálogo actualizado'}`);
      }
    } catch (err) {
      showToast('⚠️ Error al actualizar productos');
    } finally {
      setSyncingGithub(false);
    }
  };

  // Crear nueva categoría
  const handleCreateCategory = async (e) => {
    if (e) e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    try {
      setCreatingCategory(true);
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🏷️ Categoría "${name}" creada exitosamente`);
        setNewCategoryName('');
        await loadCategories();
      } else {
        alert('Error: ' + (data.error || 'No se pudo crear la categoría'));
      }
    } catch (err) {
      alert('Error de conexión al crear categoría');
    } finally {
      setCreatingCategory(false);
    }
  };

  // Guardar edición de categoría (renombrar)
  const handleUpdateCategory = async (id) => {
    const name = editingCategoryName.trim();
    if (!name) return;

    try {
      setSavingCategory(true);
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✏️ Categoría actualizada a "${name}" y productos sincronizados`);
        setEditingCategoryId(null);
        setEditingCategoryName('');
        await Promise.all([loadCategories(), loadProducts()]);
      } else {
        alert('Error: ' + (data.error || 'No se pudo actualizar la categoría'));
      }
    } catch (err) {
      alert('Error de conexión al actualizar categoría');
    } finally {
      setSavingCategory(false);
    }
  };

  // Eliminar categoría
  const handleDeleteCategory = async (cat) => {
    const count = cat.product_count || 0;
    const msg = count > 0
      ? `¿Eliminar la categoría "${cat.name}"? Los ${count} productos asociados pasarán a la categoría "Varios".`
      : `¿Eliminar la categoría "${cat.name}"?`;

    if (window.confirm(msg)) {
      try {
        const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast(`🗑️ Categoría "${cat.name}" eliminada`);
          await Promise.all([loadCategories(), loadProducts()]);
        } else {
          alert('Error: ' + (data.error || 'No se pudo eliminar la categoría'));
        }
      } catch (err) {
        alert('Error de conexión al eliminar categoría');
      }
    }
  };

  return (
    <div className={`min-h-screen bg-slate-100 flex flex-col ${activeTab === 'pos' ? 'pb-36 md:pb-28' : 'pb-16'}`}>
      {/* ============================================================ */}
      {/* 1. ENCABEZADO SUPERIOR LIMPIO Y PROFESIONAL                 */}
      {/* ============================================================ */}
      <header className={`sticky top-0 z-30 bg-slate-900 text-white shadow-lg px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 transition-transform duration-300 ease-in-out ${
        showHeader ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3">
          {/* Fila 1 en móvil / Izquierda en desktop: Logo, Pill de Conexión y Tasa Fija (en móvil) */}
          <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3 w-full md:w-auto">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 sm:p-2 bg-emerald-500 rounded-xl text-slate-950 font-black text-lg sm:text-xl shadow-md flex items-center justify-center">
                🏪
              </span>
              <div>
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-none">
                  Kiosco
                </h1>
              </div>
              {/* Pill indicador online/offline */}
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
              }`}>
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span className="hidden sm:inline">{isOnline ? 'En Línea' : 'Offline'}</span>
              </div>
            </div>

            {/* Badge de Tasa Fija en móvil (visible a la derecha de la fila 1) */}
            <div className="flex md:hidden bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 items-center space-x-1.5 shadow-inner">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <div className="text-right">
                <span className="text-[8px] text-slate-400 block leading-none font-medium">Tasa Fija</span>
                <span className="text-[11px] font-black text-amber-400 font-mono">1.000 Bs/$</span>
              </div>
            </div>
          </div>

          {/* Fila 2 en móvil / Centro en desktop: Selector de Vistas */}
          <div className="grid grid-cols-3 md:flex bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-inner w-full md:w-auto">
            <button
              onClick={() => setActiveTab('pos')}
              className={`justify-center px-2 sm:px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 transition-all ${
                activeTab === 'pos'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
              <span>Venta</span>
              {totalItemsCount > 0 && (
                <span className="bg-slate-900 text-emerald-400 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {totalItemsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleRequestAdminAccess('inventory')}
              className={`justify-center px-2 sm:px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 transition-all ${
                activeTab === 'inventory'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
              <span>Almacén</span>
              {isAdminUnlocked ? (
                <Unlock className="w-3 h-3 text-emerald-300 ml-0.5 shrink-0" />
              ) : (
                <Lock className="w-3 h-3 text-slate-400 ml-0.5 shrink-0" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('accounting')}
              className={`justify-center px-2 sm:px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 transition-all ${
                activeTab === 'accounting'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
              <span>Contabilidad</span>
            </button>
          </div>

          {/* Badge de Tasa Fija en Desktop (oculto en móvil para no duplicar) */}
          <div className="hidden md:flex bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 items-center space-x-1.5 shadow-inner">
            <Coins className="w-4 h-4 text-amber-400" />
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block leading-none font-medium">Tasa Fija</span>
              <span className="text-xs font-black text-amber-400 font-mono">1.000 Bs/$</span>
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda y Categorías (Solo en Venta y Almacén) */}
        {activeTab !== 'accounting' && (
          <>
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
          </>
        )}
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
      {/* BANNER DE SINCRONIZACIÓN OFFLINE                            */}
      {/* ============================================================ */}
      {offlineSalesQueue.length > 0 && (
        <div className="max-w-6xl mx-auto w-full px-3 pt-3">
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-2 shadow-md font-medium text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                <strong>{offlineSalesQueue.length} venta(s) guardada(s) localmente</strong> esperando conexión para sincronizar.
              </span>
            </div>
            <button
              onClick={syncOfflineSales}
              disabled={syncingOffline || !isOnline}
              className={`px-3 py-1.5 rounded-xl text-xs font-black shadow-sm shrink-0 transition-all ${
                isOnline
                  ? 'bg-slate-900 text-amber-400 hover:bg-slate-800'
                  : 'bg-amber-600/50 text-slate-800 cursor-not-allowed'
              }`}
            >
              {syncingOffline ? 'Sincronizando...' : isOnline ? 'Sincronizar Ahora' : 'Esperando Red'}
            </button>
          </div>
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
                    {/* Badge de Stock Bajo o Agotado */}
                    {product.stock === 0 ? (
                      <div className="absolute top-2 left-2 z-10 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        🚫 Agotado
                      </div>
                    ) : isLowStock ? (
                      <div className="absolute top-2 left-2 z-10 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        ⚠️ Quedan {product.stock}
                      </div>
                    ) : null}

                    {/* Imagen y Click para sumar (Contenedor 1:1 Cuadrado Centrado) */}
                    <div
                      onClick={() => product.stock > 0 && updateQuantity(product.id, 1)}
                      className={`relative aspect-square bg-slate-100 overflow-hidden group select-none flex items-center justify-center ${
                        product.stock === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      }`}
                    >
                      <img
                        src={product.image_url || 'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=400'}
                        alt={product.name}
                        className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      {product.stock > 0 ? (
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-emerald-500 text-white p-2 rounded-full shadow-lg">
                            <Plus className="w-5 h-5" />
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                          <span className="bg-rose-600 text-white font-bold text-xs px-2.5 py-1 rounded-xl shadow">
                            Agotado
                          </span>
                        </div>
                      )}

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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setWarehouseSortOrder(prev => prev === 'alpha' ? 'recent' : 'alpha')}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 shadow-sm ${
                    warehouseSortOrder === 'alpha'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title={warehouseSortOrder === 'alpha' ? 'Orden alfabético A-Z activado. Clic para ordenar por recientes' : 'Orden por recientes activado. Clic para ordenar alfabéticamente A-Z'}
                >
                  <ArrowDownAZ className={`w-4 h-4 ${warehouseSortOrder === 'alpha' ? 'text-slate-950' : 'text-emerald-400'}`} />
                  <span>{warehouseSortOrder === 'alpha' ? 'Orden: A-Z' : 'Orden: Recientes'}</span>
                </button>

                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95 shadow-sm"
                  title="Crear y editar categorías de productos"
                >
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <span>Categorías</span>
                </button>

                <button
                  onClick={handleManualSyncGithub}
                  disabled={syncingGithub}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95 shadow-sm"
                  title="Actualizar catálogo y últimas imágenes desde GitHub"
                >
                  {syncingGithub ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>{syncingGithub ? 'Actualizando...' : 'Actualizar Productos'}</span>
                </button>

                <button
                  onClick={handleOpenAddProduct}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 text-slate-950" />
                  <span>+ Agregar Producto</span>
                </button>

                <button
                  onClick={handleLockAdmin}
                  className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-rose-200 transition-all active:scale-95 shadow-sm"
                  title="Bloquear acceso de administrador"
                >
                  <Lock className="w-4 h-4 text-rose-600" />
                  <span>Bloquear</span>
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
          ) : warehouseProducts.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No hay productos en esta búsqueda</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {warehouseProducts.map(product => {
                const isLow = product.stock <= 5;
                const isHighlighted = product.id === highlightedProductId;
                return (
                  <div
                    key={product.id}
                    className={`bg-white rounded-2xl p-3 sm:p-4 border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
                      isHighlighted
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Imagen 1:1 Cuadrada Centrada e Info */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-16 h-16 sm:w-14 sm:h-14 aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                        <img
                          src={product.image_url || PRESET_IMAGES[0].url}
                          alt={product.name}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md uppercase">
                            {product.category}
                          </span>
                          {isHighlighted && (
                            <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-md animate-pulse">
                              ¡Recién editado!
                            </span>
                          )}
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
      {/* 4. VISTA C: CONTABILIDAD Y REPORTE FINANCIERO EN TIEMPO REAL */}
      {/* ============================================================ */}
      {activeTab === 'accounting' && (
        <main className="max-w-6xl mx-auto w-full px-3 py-4 flex-1">
          {/* Header de Contabilidad con Filtro de Períodos y Acciones */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-lg sm:text-xl font-black text-slate-800">
                    Contabilidad en Tiempo Real
                  </h2>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    En Vivo
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reporte de productos vendidos y monto total recaudado en $ USD y Bs al instante.
                </p>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => loadAccountingReport(accountingPeriod, accountingCustomDate)}
                  disabled={accountingLoading}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95 shadow-sm"
                  title="Recargar reporte en vivo"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${accountingLoading ? 'animate-spin' : ''}`} />
                  <span>{accountingLoading ? 'Actualizando...' : 'Actualizar'}</span>
                </button>

                <button
                  onClick={handleOpenReport}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                  title="Solicitar reporte para Telegram"
                >
                  <Send className="w-3.5 h-3.5 text-slate-950" />
                  <span>Solicitar Reporte</span>
                </button>

                <button
                  onClick={handleOpenClosingModal}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/25 transition-all active:scale-95 border border-amber-300/30"
                  title="Cierre oficial del día y reporte consolidado a Telegram"
                >
                  <Lock className="w-3.5 h-3.5 text-white" />
                  <span>Cierre de Caja</span>
                </button>

                <button
                  onClick={() => setShowClosingsHistory(!showClosingsHistory)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                    showClosingsHistory
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                  title="Ver u ocultar historial de cierres de caja anteriores"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{showClosingsHistory ? 'Ocultar Cierres' : 'Historial Cierres'}</span>
                </button>
              </div>
            </div>

            {/* Selector de Período / Turno / Fechas */}
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap sm:flex-nowrap">
              {[
                { id: 'today', label: 'Hoy (Día Completo)' },
                { id: 'yesterday', label: 'Ayer' },
                { id: 'week', label: 'Esta Semana' },
                { id: 'month', label: 'Este Mes' },
                { id: 'day', label: 'Turno 1 (08:00 - 17:30)' },
                { id: 'night', label: 'Turno 2 (18:00 - 22:00)' },
                { id: 'live', label: 'Turno Extendido' },
                { id: 'all', label: 'Todo el Histórico' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setAccountingPeriod(p.id);
                    loadAccountingReport(p.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                    accountingPeriod === p.id
                      ? 'bg-slate-900 text-emerald-400 shadow-sm border border-slate-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  {p.label}
                </button>
              ))}

              {/* Selector de Fecha Específica */}
              <div className={`flex items-center gap-1 rounded-xl px-2 py-1 shrink-0 border transition-all ${
                accountingPeriod === 'custom'
                  ? 'bg-slate-900 text-emerald-400 border-slate-800'
                  : 'bg-slate-100 text-slate-600 border-slate-200/80'
              }`}>
                <span className="text-[11px] font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Fecha:
                </span>
                <input
                  type="date"
                  value={accountingCustomDate}
                  onChange={(e) => {
                    setAccountingCustomDate(e.target.value);
                    setAccountingPeriod('custom');
                    loadAccountingReport('custom', e.target.value);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Tarjetas KPI de Totales ($ y Bs) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4">
              {/* Total $ USD */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 p-3.5 rounded-2xl border border-emerald-200/70 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                    Total Vendido ($)
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-1">
                  ${(accountingData?.summary?.totalUsd || 0).toFixed(2)}
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                  Tasa fija: 1.000 Bs/$
                </span>
              </div>

              {/* Total Bs */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100/40 p-3.5 rounded-2xl border border-blue-200/70 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-blue-800 font-bold uppercase tracking-wider">
                    Total Vendido (Bs)
                  </span>
                  <Coins className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-700 font-mono mt-1">
                  Bs. {(accountingData?.summary?.totalBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-blue-600 font-semibold block mt-0.5">
                  Moneda nacional
                </span>
              </div>

              {/* Unidades Vendidas */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 p-3.5 rounded-2xl border border-amber-200/70 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                    Unidades Vendidas
                  </span>
                  <Package className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-800 font-mono mt-1">
                  {accountingData?.summary?.totalItemsSold || 0} u.
                </div>
                <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                  Artículos despachados
                </span>
              </div>

              {/* Tickets / Ventas Concretadas */}
              <div className="bg-gradient-to-br from-slate-50 to-purple-50 p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                    Ventas Concretadas
                  </span>
                  <Receipt className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono mt-1">
                  {accountingData?.summary?.totalSales || 0}
                </div>
                <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                  Promedio: ${(
                    accountingData?.summary?.totalSales
                      ? (accountingData.summary.totalUsd / accountingData.summary.totalSales).toFixed(2)
                      : '0.00'
                  )} / venta
                </span>
              </div>
            </div>

            {/* Desglose de Métodos de Pago */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">
                Recaudación por Forma de Pago:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'Divisas', label: '💵 Divisas ($)', color: 'border-emerald-200 bg-emerald-50/50 text-emerald-800' },
                  { key: 'Pago Móvil', label: '📱 Pago Móvil', color: 'border-blue-200 bg-blue-50/50 text-blue-800' },
                  { key: 'Punto de Venta', label: '💳 Punto de Venta', color: 'border-purple-200 bg-purple-50/50 text-purple-800' },
                  { key: 'Efectivo', label: '🪙 Efectivo Bs', color: 'border-amber-200 bg-amber-50/50 text-amber-800' },
                ].map(method => {
                  const found = accountingData?.summary?.paymentBreakdown?.find(p =>
                    p.method.toLowerCase().includes(method.key.toLowerCase())
                  );
                  const sumUsd = found ? found.sumUsd : 0;
                  const sumBs = found ? found.sumBs : 0;
                  const count = found ? found.count : 0;

                  return (
                    <div key={method.key} className={`p-2.5 rounded-xl border ${method.color} flex flex-col justify-between`}>
                      <span className="text-[10px] font-bold block">{method.label}</span>
                      <div className="mt-1">
                        <span className="text-sm font-black font-mono block">${sumUsd.toFixed(2)}</span>
                        <span className="text-[10px] font-bold opacity-80 font-mono block">
                          Bs. {sumBs.toLocaleString('es-VE')} ({count} ops)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sección de Productos Vendidos en Tiempo Real */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <span>Productos Vendidos ({filteredAccountingProducts.length})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Unidades vendidas y monto recaudado en $ y Bs por cada producto
                </p>
              </div>

              {/* Buscador dentro de Contabilidad */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar producto vendido..."
                  value={accountingSearch}
                  onChange={e => setAccountingSearch(e.target.value)}
                  className="w-full bg-slate-100 text-slate-800 placeholder-slate-400 pl-8 pr-7 py-1.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {accountingSearch && (
                  <button
                    onClick={() => setAccountingSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Productos Vendidos */}
            {accountingLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-500" />
                <p className="text-xs">Cargando reporte de productos vendidos...</p>
              </div>
            ) : filteredAccountingProducts.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No hay ventas registradas en este período</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Prueba cambiando el turno arriba a "Todo el Histórico" o realiza ventas en el Punto de Venta.
                </p>
                <button
                  onClick={() => setActiveTab('pos')}
                  className="mt-3 px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm"
                >
                  Ir a Punto de Venta
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-2">
                {filteredAccountingProducts.map((p, idx) => (
                  <div
                    key={`${p.productId || idx}-${p.productName}`}
                    className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-2xl transition-all"
                  >
                    {/* Foto 1:1 Cuadrada Centrada y Nombres */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center shadow-inner">
                        <img
                          src={p.imageUrl || PRESET_IMAGES[0].url}
                          alt={p.productName}
                          className="w-full h-full object-cover object-center"
                          onError={e => {
                            e.target.src = 'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=200';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md uppercase">
                            {p.category}
                          </span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                            {p.totalQuantity} {p.totalQuantity === 1 ? 'unidad' : 'unidades'}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-800 truncate mt-0.5">
                          {p.productName}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                          P. Unit: ${p.unitPriceUsd.toFixed(2)} / {p.unitPriceBs.toLocaleString('es-VE')} Bs
                        </span>
                      </div>
                    </div>

                    {/* Total Recaudado por Producto ($ y Bs) */}
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4 pl-16 sm:pl-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">
                          Subtotal Recaudado
                        </span>
                        <div className="text-base sm:text-lg font-black text-emerald-600 font-mono mt-0.5">
                          ${p.totalUsd.toFixed(2)}
                        </div>
                        <div className="text-xs font-bold text-slate-500 font-mono">
                          Bs. {p.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historial de Ventas Recientes en el Período */}
          {accountingData?.recentSales && accountingData.recentSales.length > 0 && (
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <h3 className="text-base font-black text-slate-800 mb-3 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <span>Tickets de Venta Recientes ({accountingData.recentSales.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {accountingData.recentSales.map(sale => {
                  const saleDate = new Date(sale.created_at);
                  const timeFormatted = saleDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={sale.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                        <span className="font-mono font-black text-slate-800">{sale.sale_number}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{timeFormatted}</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-[11px] text-slate-500 font-bold">{sale.items_count} items</span>
                        <div className="text-right">
                          <span className="font-mono font-black text-emerald-600 text-sm block">
                            ${parseFloat(sale.total_usd).toFixed(2)}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 block">
                            Bs. {parseFloat(sale.total_bs).toLocaleString('es-VE')}
                          </span>
                        </div>
                      </div>
                      {sale.payments && Array.isArray(sale.payments) && sale.payments.length > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 flex items-center gap-1 flex-wrap">
                          {sale.payments.map((pay, i) => (
                            <span key={i} className="text-[9px] bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                              {pay.method}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historial de Cierres Diarios Oficiales */}
          {showClosingsHistory && (
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm mt-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-black text-slate-800">
                    Historial de Cierres Diarios Oficiales
                  </h3>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    {closingsHistory.length} registros
                  </span>
                </div>
                <button
                  onClick={loadClosingsHistory}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Actualizar
                </button>
              </div>

              {closingsHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No hay cierres de caja registrados aún. Haz clic en "Cierre de Caja" para generar el primer cierre oficial.
                </div>
              ) : (
                <div className="space-y-3">
                  {closingsHistory.map(c => {
                    const closingDate = new Date(c.created_at);
                    const dateFormatted = closingDate.toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                    const timeFormatted = closingDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
                    const variance = c.difference_usd !== null && c.difference_usd !== undefined ? parseFloat(c.difference_usd) : null;

                    return (
                      <div key={c.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800 text-sm">{c.closing_date}</span>
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                              {c.cashier_name || 'Cajero Principal'}
                            </span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Reporte Telegram
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {dateFormatted} - {timeFormatted}
                          </span>
                        </div>

                        {/* Comparación Turnos y Total Consolidado */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2.5">
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Turno 1 (Día)</span>
                            <div className="text-sm font-black text-slate-700 font-mono mt-0.5">
                              ${parseFloat(c.shift1_total_usd || 0).toFixed(2)}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Bs. {parseFloat(c.shift1_total_bs || 0).toLocaleString('es-VE')} ({c.shift1_tickets_count || 0} tickets)
                            </span>
                          </div>

                          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Turno 2 (Noche)</span>
                            <div className="text-sm font-black text-slate-700 font-mono mt-0.5">
                              ${parseFloat(c.shift2_total_usd || 0).toFixed(2)}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Bs. {parseFloat(c.shift2_total_bs || 0).toLocaleString('es-VE')} ({c.shift2_tickets_count || 0} tickets)
                            </span>
                          </div>

                          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                            <span className="text-[10px] text-emerald-800 font-bold block uppercase">Total Consolidado Día</span>
                            <div className="text-base font-black text-emerald-700 font-mono mt-0.5">
                              ${parseFloat(c.day_total_usd || 0).toFixed(2)}
                            </div>
                            <span className="text-[10px] text-emerald-600 block font-mono font-bold">
                              Bs. {parseFloat(c.day_total_bs || 0).toLocaleString('es-VE')} ({c.day_tickets_count || 0} tickets)
                            </span>
                          </div>
                        </div>

                        {/* Arqueo y Notas */}
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-2">
                            {c.cash_drawer_usd !== null && c.cash_drawer_usd !== undefined && (
                              <span className="text-slate-600">
                                💵 Efectivo en Caja: <strong className="font-mono">${parseFloat(c.cash_drawer_usd).toFixed(2)}</strong>
                              </span>
                            )}
                            {variance !== null && (
                              <span className={`px-2 py-0.5 rounded font-bold font-mono ${
                                variance === 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : variance > 0
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {variance === 0 ? '✓ Cuadre Perfecto' : variance > 0 ? `+ Sobrante: $${variance.toFixed(2)}` : `- Faltante: -$${Math.abs(variance).toFixed(2)}`}
                              </span>
                            )}
                          </div>
                          {c.notes && (
                            <span className="text-slate-500 italic truncate max-w-xs">
                              Nota: {c.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  {(categoriesList.length > 0 ? categoriesList.map(c => c.name) : COMMON_CATEGORIES).map(cat => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setProductForm({ ...productForm, category: cat })}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                        productForm.category === cat
                          ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-dashed border-emerald-500 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 transition-all flex items-center gap-1"
                    title="Crear o editar categorías"
                  >
                    <Plus className="w-3 h-3 text-emerald-600" />
                    <span>Gestionar</span>
                  </button>
                </div>
              </div>

              {/* Imagen del Producto */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    URL de Imagen del Producto
                  </label>
                  {/* Botón para subir desde el dispositivo directamente a Git */}
                  <label
                    htmlFor="device-image-upload"
                    className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs border border-emerald-300 transition-all active:scale-95 shadow-sm ${
                      uploadingImage ? 'opacity-50 pointer-events-none' : ''
                    }`}
                    title="Tomar foto con la cámara o seleccionar de la galería de este dispositivo"
                  >
                    {uploadingImage ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span>Subiendo a Git...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Subir desde dispositivo</span>
                      </>
                    )}
                  </label>
                  <input
                    type="file"
                    id="device-image-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileUpload}
                    disabled={uploadingImage}
                  />
                </div>

                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://... o pulsa 'Subir desde dispositivo'"
                    value={productForm.image_url}
                    onChange={e => setProductForm({ ...productForm, image_url: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none pr-8"
                  />
                  {productForm.image_url && (
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, image_url: '' })}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      title="Limpiar imagen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Vista Previa de Imagen (Contenedor 1:1 Cuadrado) */}
                {productForm.image_url && (
                  <div className="mt-2 flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-14 h-14 aspect-square rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0 flex items-center justify-center">
                      <img
                        src={productForm.image_url}
                        alt="Vista previa"
                        className="w-full h-full object-cover object-center"
                        onError={e => {
                          e.target.src = 'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=200';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold block">Vista previa activa</span>
                      <span className="text-xs font-bold text-slate-700 truncate block">
                        {productForm.name || 'Producto'}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-mono truncate block">
                        {productForm.image_url.includes('raw.githubusercontent.com')
                          ? '✓ Guardada en repositorio GitHub'
                          : productForm.image_url.startsWith('/uploads')
                          ? '✓ Guardada localmente'
                          : 'Enlace externo web'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Galería de imágenes rápidas */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      O toca una imagen de muestra rápida:
                    </span>
                    {recentImages.length > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {recentImages.length} en GitHub
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                    {/* Imágenes más recientes subidas al repositorio */}
                    {recentImages.map((imgItem, idx) => (
                      <button
                        type="button"
                        key={`recent-${idx}`}
                        onClick={() => setProductForm({ ...productForm, image_url: imgItem.url })}
                        className={`relative rounded-lg overflow-hidden border aspect-square p-0.5 transition-all group ${
                          productForm.image_url === imgItem.url
                            ? 'ring-2 ring-emerald-500 border-emerald-500 scale-95 shadow-sm'
                            : 'border-slate-200 hover:opacity-80'
                        }`}
                        title={`GitHub: ${imgItem.name}`}
                      >
                        <img
                          src={imgItem.url}
                          alt={imgItem.name}
                          className="w-full h-full object-cover rounded"
                          onError={e => {
                            e.target.src = 'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=200';
                          }}
                        />
                        <span className="absolute bottom-0 right-0 bg-emerald-700/90 text-white text-[8px] font-bold px-1 rounded-tl leading-tight">
                          git
                        </span>
                      </button>
                    ))}

                    {/* Presets iniciales */}
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        type="button"
                        key={`preset-${idx}`}
                        onClick={() => setProductForm({ ...productForm, image_url: preset.url })}
                        className={`relative rounded-lg overflow-hidden border aspect-square p-0.5 transition-all ${
                          productForm.image_url === preset.url
                            ? 'ring-2 ring-emerald-500 border-emerald-500 scale-95 shadow-sm'
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

            {/* Opciones de Pago (Selección Múltiple y Pago Mixto) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Formas de Pago:
                </label>
                {selectedPaymentKeys.length > 1 && (
                  <span className="text-[11px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                    Pago Mixto Activo ({selectedPaymentKeys.length})
                  </span>
                )}
              </div>

              {selectedPaymentKeys.length > 1 && (
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-xs text-sky-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-sky-800 leading-snug">
                    Ingresa el monto correspondiente a cada forma de pago hasta completar el total de <strong>${totalUsd.toFixed(2)}</strong>.
                  </p>
                </div>
              )}

              {/* 1. Divisas $ */}
              <div
                onClick={() => togglePaymentMethod('divisas')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethods.divisas.selected
                    ? 'border-emerald-500 bg-emerald-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
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
                    onChange={() => {}}
                    className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                {/* Monto específico si es pago mixto */}
                {paymentMethods.divisas.selected && selectedPaymentKeys.length > 1 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 pt-3 border-t border-emerald-200/60 grid grid-cols-2 gap-2"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">
                        Monto ($ USD):
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentMethods.divisas.amountUsd}
                          onChange={(e) => handlePaymentAmountChangeUsd('divisas', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white pl-6 pr-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-600 block">
                          Monto (Bs):
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAssignRemaining('divisas')}
                          className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 rounded active:scale-95 transition-all"
                        >
                          Restante
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={paymentMethods.divisas.amountBs}
                          onChange={(e) => handlePaymentAmountChangeBs('divisas', e.target.value)}
                          placeholder="0"
                          className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input de Monto Recibido para cálculo de vuelto */}
              {paymentMethods.divisas.selected && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      Efectivo USD entregado por cliente:
                    </label>
                    <span className="text-[10px] font-semibold text-slate-500">Para vuelto</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.5"
                      value={cashReceivedUsd}
                      onChange={e => setCashReceivedUsd(e.target.value)}
                      placeholder={selectedPaymentKeys.length > 1 ? (paymentMethods.divisas.amountUsd || '0') : totalUsd.toString()}
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
                onClick={() => togglePaymentMethod('pagoMovil')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethods.pagoMovil.selected
                    ? 'border-sky-500 bg-sky-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
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
                    onChange={() => {}}
                    className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
                  />
                </div>

                {/* Monto específico si es pago mixto */}
                {paymentMethods.pagoMovil.selected && selectedPaymentKeys.length > 1 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 pt-3 border-t border-sky-200/60 grid grid-cols-2 gap-2"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">
                        Monto ($ USD):
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentMethods.pagoMovil.amountUsd}
                          onChange={(e) => handlePaymentAmountChangeUsd('pagoMovil', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white pl-6 pr-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-600 block">
                          Monto (Bs):
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAssignRemaining('pagoMovil')}
                          className="text-[9px] font-black uppercase text-sky-800 bg-sky-100 hover:bg-sky-200 px-1.5 py-0.5 rounded active:scale-95 transition-all"
                        >
                          Restante
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={paymentMethods.pagoMovil.amountBs}
                          onChange={(e) => handlePaymentAmountChangeBs('pagoMovil', e.target.value)}
                          placeholder="0"
                          className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Punto de Venta */}
              <div
                onClick={() => togglePaymentMethod('puntoVenta')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethods.puntoVenta.selected
                    ? 'border-purple-500 bg-purple-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
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
                    onChange={() => {}}
                    className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
                  />
                </div>

                {/* Monto específico si es pago mixto */}
                {paymentMethods.puntoVenta.selected && selectedPaymentKeys.length > 1 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 pt-3 border-t border-purple-200/60 grid grid-cols-2 gap-2"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">
                        Monto ($ USD):
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentMethods.puntoVenta.amountUsd}
                          onChange={(e) => handlePaymentAmountChangeUsd('puntoVenta', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white pl-6 pr-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-600 block">
                          Monto (Bs):
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAssignRemaining('puntoVenta')}
                          className="text-[9px] font-black uppercase text-purple-800 bg-purple-100 hover:bg-purple-200 px-1.5 py-0.5 rounded active:scale-95 transition-all"
                        >
                          Restante
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={paymentMethods.puntoVenta.amountBs}
                          onChange={(e) => handlePaymentAmountChangeBs('puntoVenta', e.target.value)}
                          placeholder="0"
                          className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Efectivo Bs */}
              <div
                onClick={() => togglePaymentMethod('efectivoBs')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethods.efectivoBs.selected
                    ? 'border-amber-500 bg-amber-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
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
                    onChange={() => {}}
                    className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                {/* Monto específico si es pago mixto */}
                {paymentMethods.efectivoBs.selected && selectedPaymentKeys.length > 1 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 pt-3 border-t border-amber-200/60 grid grid-cols-2 gap-2"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">
                        Monto ($ USD):
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentMethods.efectivoBs.amountUsd}
                          onChange={(e) => handlePaymentAmountChangeUsd('efectivoBs', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white pl-6 pr-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-600 block">
                          Monto (Bs):
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAssignRemaining('efectivoBs')}
                          className="text-[9px] font-black uppercase text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded active:scale-95 transition-all"
                        >
                          Restante
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={paymentMethods.efectivoBs.amountBs}
                          onChange={(e) => handlePaymentAmountChangeBs('efectivoBs', e.target.value)}
                          placeholder="0"
                          className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cuadre de Pago Mixto */}
            {selectedPaymentKeys.length > 1 && (
              <div className={`mt-3.5 p-3.5 rounded-2xl border text-xs transition-all ${
                Math.abs(remainingToAssignUsd) <= 0.01
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : remainingToAssignUsd > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex justify-between items-center mb-1 font-bold">
                  <span>Total de la Venta:</span>
                  <span className="font-black font-mono text-sm">${totalUsd.toFixed(2)} ({totalBs.toLocaleString('es-VE')} Bs)</span>
                </div>
                <div className="flex justify-between items-center mb-1.5 text-[11px]">
                  <span>Total Asignado:</span>
                  <span className="font-bold font-mono">${totalAssignedUsd.toFixed(2)} ({(totalAssignedUsd * exchangeRate).toLocaleString('es-VE')} Bs)</span>
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between font-bold">
                  {Math.abs(remainingToAssignUsd) <= 0.01 ? (
                    <span className="text-emerald-700 flex items-center gap-1.5 font-black">
                      <CheckCircle2 className="w-4 h-4" /> ¡Montos cuadran exactamente!
                    </span>
                  ) : remainingToAssignUsd > 0 ? (
                    <span className="text-amber-800 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Falta asignar: ${remainingToAssignUsd.toFixed(2)} ({(remainingToAssignUsd * exchangeRate).toLocaleString('es-VE')} Bs)
                    </span>
                  ) : (
                    <span className="text-rose-700 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Excede por: ${Math.abs(remainingToAssignUsd).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}

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
            <h2 className="text-xl font-black text-slate-800">
              {lastSaleData.isOffline ? '¡Venta Guardada (Offline)!' : '¡Venta Concretada!'}
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Ticket #{lastSaleData.saleNumber || lastSaleData.id}
            </p>

            {lastSaleData.isOffline && (
              <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>Guardada en memoria local. Se sincronizará al volver la conexión.</span>
              </div>
            )}

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
              {lastSaleData.payments && lastSaleData.payments.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">
                    Forma(s) de Pago:
                  </span>
                  <div className="space-y-1">
                    {lastSaleData.payments.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span className="text-slate-600">{p.method}:</span>
                        <span className="font-mono font-bold text-slate-800">
                          ${p.amount_usd.toFixed(2)} ({p.amount_bs?.toLocaleString('es-VE')} Bs)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {/* ============================================================ */}
      {/* 9. MODAL DE GESTIÓN DE CATEGORÍAS (CREAR Y EDITAR)           */}
      {/* ============================================================ */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                  <Tag className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white">
                    Gestión de Categorías
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Crea y edita las categorías del kiosco en tiempo real
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryId(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Formulario Crear Nueva Categoría */}
              <form onSubmit={handleCreateCategory} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Nueva Categoría
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej: Helados, Víveres, Enlatados..."
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={creatingCategory || !newCategoryName.trim()}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95"
                  >
                    {creatingCategory ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Crear</span>
                  </button>
                </div>
              </form>

              {/* Lista de Categorías Existentes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Categorías ({categoriesList.length})
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Al editar el nombre se actualizan todos sus productos
                  </span>
                </div>

                <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                  {categoriesList.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No hay categorías registradas.
                    </div>
                  ) : (
                    categoriesList.map(cat => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all gap-2"
                      >
                        {editingCategoryId === cat.id ? (
                          // Modo Edición
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingCategoryName}
                              onChange={e => setEditingCategoryName(e.target.value)}
                              className="flex-1 bg-slate-50 border border-emerald-500 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateCategory(cat.id)}
                              disabled={savingCategory || !editingCategoryName.trim()}
                              className="p-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all active:scale-95 shadow-sm shrink-0"
                              title="Guardar nombre"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(null);
                                setEditingCategoryName('');
                              }}
                              className="p-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all shrink-0"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          // Modo Lectura
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                                <Tag className="w-4 h-4 text-emerald-600" />
                              </span>
                              <div className="min-w-0">
                                <span className="text-xs sm:text-sm font-bold text-slate-800 truncate block">
                                  {cat.name}
                                </span>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  {cat.product_count || 0} {(cat.product_count === 1) ? 'producto' : 'productos'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategoryId(cat.id);
                                  setEditingCategoryName(cat.name);
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                                title="Editar nombre de categoría"
                              >
                                <Edit className="w-3.5 h-3.5 text-slate-600" />
                                <span className="hidden sm:inline">Editar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all active:scale-95"
                                title="Eliminar categoría"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryId(null);
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95"
              >
                Listo / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 10. MODAL DE CLAVE DE ADMINISTRADOR (PIN 2200)               */}
      {/* ============================================================ */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xs sm:max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-200">
            {/* Header Icon */}
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
              <KeyRound className="w-7 h-7 text-emerald-600" />
            </div>

            <h3 className="text-lg font-black text-slate-800">
              Acceso de Administrador
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Ingresa la clave para gestionar productos e inventario.
            </p>

            <form onSubmit={handleVerifyPin}>
              <div className="mb-4">
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  placeholder="••••"
                  autoFocus
                  className="w-full text-center text-3xl font-black font-mono tracking-widest py-3 px-4 bg-slate-100 border-2 border-slate-300 rounded-2xl focus:border-emerald-500 focus:bg-white focus:outline-none transition-all"
                />
                {pinError && (
                  <p className="text-xs font-bold text-rose-600 mt-2 bg-rose-50 py-1.5 px-3 rounded-xl border border-rose-200 animate-in fade-in">
                    {pinError}
                  </p>
                )}
              </div>

              {/* Teclado Numérico Táctil (Tablet / Teléfono) */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (pinInput.length < 6) {
                        setPinInput(prev => prev + num.toString());
                        setPinError('');
                      }
                    }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 active:bg-emerald-500 active:text-white rounded-xl text-lg font-black text-slate-800 transition-all shadow-sm active:scale-95"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput(prev => prev.slice(0, -1));
                    setPinError('');
                  }}
                  className="py-3 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 rounded-xl text-xs font-bold text-slate-700 transition-all shadow-sm active:scale-95"
                >
                  Borrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pinInput.length < 6) {
                      setPinInput(prev => prev + '0');
                      setPinError('');
                    }
                  }}
                  className="py-3 bg-slate-100 hover:bg-slate-200 active:bg-emerald-500 active:text-white rounded-xl text-lg font-black text-slate-800 transition-all shadow-sm active:scale-95"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError('');
                  }}
                  className="py-3 bg-rose-100 hover:bg-rose-200 active:bg-rose-300 rounded-xl text-xs font-bold text-rose-700 transition-all shadow-sm active:scale-95"
                >
                  C
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="flex-1 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pinLoading || !pinInput}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {pinLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Ingresar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 11. MODAL DE CIERRE OFICIAL DE CAJA (FIN DE JORNADA)         */}
      {/* ============================================================ */}
      {showClosingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                    Cierre de Caja Oficial
                  </h3>
                  <p className="text-[11px] text-amber-300 font-medium">
                    Consolida Turno 1 + Turno 2 y envía reporte a Telegram
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClosingModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {closingLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                  <span>Calculando arqueo y consolidado del día...</span>
                </div>
              ) : closingPreview ? (
                <>
                  {/* Fecha de Cierre */}
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200/80 p-3 rounded-2xl text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-700" />
                      <span className="font-bold text-amber-900">Fecha de Cierre:</span>
                    </div>
                    <span className="font-mono font-black text-amber-900 text-sm">
                      {closingPreview.date}
                    </span>
                  </div>

                  {/* Resumen de los 2 Turnos */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Turno 1 */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>Turno 1 (Día)</span>
                        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-mono">08:00 - 17:30</span>
                      </div>
                      <div className="text-base font-black text-slate-800 font-mono">
                        ${(closingPreview.shift1?.totalUsd || 0).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Bs. {(closingPreview.shift1?.totalBs || 0).toLocaleString('es-VE')}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                        {closingPreview.shift1?.ticketsCount || 0} tickets emitidos
                      </div>
                    </div>

                    {/* Turno 2 */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>Turno 2 (Noche)</span>
                        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-mono">18:00 - 22:00</span>
                      </div>
                      <div className="text-base font-black text-slate-800 font-mono">
                        ${(closingPreview.shift2?.totalUsd || 0).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Bs. {(closingPreview.shift2?.totalBs || 0).toLocaleString('es-VE')}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                        {closingPreview.shift2?.ticketsCount || 0} tickets emitidos
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta Consolidada del Día Completo */}
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-4 rounded-2xl shadow-md">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 block">
                      Total Consolidado de la Jornada
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <div>
                        <div className="text-2xl sm:text-3xl font-black font-mono leading-none">
                          ${(closingPreview.dayTotal?.totalUsd || 0).toFixed(2)}
                        </div>
                        <div className="text-xs font-bold text-emerald-100 font-mono mt-1">
                          Bs. {(closingPreview.dayTotal?.totalBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <span className="bg-emerald-400/20 border border-emerald-300/30 px-2 py-1 rounded-lg font-bold block text-[11px]">
                          {closingPreview.dayTotal?.ticketsCount || 0} ventas totales
                        </span>
                        <span className="text-[10px] text-emerald-100 block mt-1">
                          {closingPreview.dayTotal?.itemsCount || 0} productos vendidos
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Desglose por Método de Pago */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                    <h4 className="font-bold text-slate-700 mb-2 flex items-center justify-between">
                      <span>Recaudación por Forma de Pago:</span>
                      <span className="text-[10px] text-slate-400 font-mono">Tasa: 1.000 Bs/$</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">💵 Divisas ($)</span>
                        <span className="font-black text-slate-800 font-mono text-xs">
                          ${(closingPreview.paymentBreakdown?.divisaUsd?.usd || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ({closingPreview.paymentBreakdown?.divisaUsd?.ops || 0} ops)
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">📱 Pago Móvil</span>
                        <span className="font-black text-slate-800 font-mono text-xs">
                          Bs. {(closingPreview.paymentBreakdown?.pagoMovilBs?.bs || 0).toLocaleString('es-VE')}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ${(closingPreview.paymentBreakdown?.pagoMovilBs?.usd || 0).toFixed(2)} ({closingPreview.paymentBreakdown?.pagoMovilBs?.ops || 0} ops)
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">🇻🇪 Efectivo Bs</span>
                        <span className="font-black text-slate-800 font-mono text-xs">
                          Bs. {(closingPreview.paymentBreakdown?.efectivoBs?.bs || 0).toLocaleString('es-VE')}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ({closingPreview.paymentBreakdown?.efectivoBs?.ops || 0} ops)
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">💳 Punto de Venta</span>
                        <span className="font-black text-slate-800 font-mono text-xs">
                          Bs. {(closingPreview.paymentBreakdown?.puntoBs?.bs || 0).toLocaleString('es-VE')}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ({closingPreview.paymentBreakdown?.puntoBs?.ops || 0} ops)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Arqueo de Caja / Conteo Físico en Efectivo */}
                  <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200 text-xs">
                    <label className="block font-bold text-amber-900 mb-1">
                      Arqueo de Efectivo en Gaveta ($ USD):
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={closingCashDrawerUsd}
                          onChange={(e) => setClosingCashDrawerUsd(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 bg-white border border-amber-200 rounded-xl font-mono font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      {closingCashDrawerUsd !== '' && (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Diferencia</span>
                          {(() => {
                            const expected = closingPreview.paymentBreakdown?.divisaUsd?.usd || 0;
                            const actual = parseFloat(closingCashDrawerUsd) || 0;
                            const diff = actual - expected;
                            return (
                              <span className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                                Math.abs(diff) < 0.01
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : diff > 0
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {Math.abs(diff) < 0.01 ? '✓ Cuadre Exacto' : diff > 0 ? `+ Sobrante: $${diff.toFixed(2)}` : `- Faltante: -$${Math.abs(diff).toFixed(2)}`}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nombre del Cajero y Notas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Cajero / Responsable:</label>
                      <input
                        type="text"
                        value={closingCashierName}
                        onChange={(e) => setClosingCashierName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Ej. Cajero Principal"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Notas u Observaciones:</label>
                      <input
                        type="text"
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Ej. Todo cuadrado sin novedades"
                      />
                    </div>
                  </div>

                  {/* Nota aclaratoria sobre la persistencia */}
                  <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
                    <span className="text-base leading-none">ℹ️</span>
                    <div>
                      <strong>Reinicio Automático para el Siguiente Día:</strong> Todos los datos de hoy quedan archivados permanentemente en la base de datos y en el Historial de Contabilidad. A partir de medianoche o en la próxima jornada, los contadores de "Hoy" comenzarán limpios en $0.00 automáticamente.
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer de Acciones del Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowClosingModal(false)}
                className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmDailyClosing}
                disabled={closingLoading || closingSubmitting}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {closingSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Guardando Cierre y Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Ejecutar Cierre y Enviar Reporte Oficial</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante para subir rápidamente al inicio de la página */}
      <button
        onClick={scrollToTop}
        aria-label="Subir al inicio"
        className={`fixed right-4 z-40 p-3 rounded-full bg-slate-900/90 hover:bg-slate-900 text-emerald-400 hover:text-emerald-300 border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all duration-300 active:scale-90 flex items-center justify-center ${
          activeTab === 'pos' ? 'bottom-28 md:bottom-24' : 'bottom-6 sm:bottom-8'
        } ${
          showScrollTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        title="Subir al inicio"
      >
        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
}

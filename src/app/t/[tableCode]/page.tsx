'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, Category, Order } from '@/types/database';
import { VegNonVegBadge } from '@/components/VegNonVegBadge';
import { CallWaiterModal } from '@/components/CallWaiterModal';
import { LiveOrderList } from '@/components/LiveOrderList';
import { isItemInMealWindow, isItemAvailableToday } from '@/lib/meal-timing';
import { apiUrl } from '@/lib/base-path';
import {
  Lock,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Bell,
  AlertTriangle,
  Languages,
  Check,
  UtensilsCrossed,
  Ban,
  ClipboardList,
  Clock,
  Flame,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

import { useTranslation } from '@/lib/i18n';

interface CartItem {
  item: MenuItem;
  quantity: number;
  notes: string;
}

export default function TablePage({ params }: { params: Promise<{ tableCode?: string; table_code?: string }> }) {
  const resolvedParams = use(params);
  const rawCode = resolvedParams.tableCode || resolvedParams.table_code || '';
  const tableCode = rawCode.toUpperCase();

  // Authentication & Session State
  const [pin, setPin] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState(`Table ${tableCode}`);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  // Menu & Data state
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const { language, setLanguage, t } = useTranslation();

  // Cart & Ordering
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [isLiveOrdersOpen, setIsLiveOrdersOpen] = useState(false);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [orderingInProgress, setOrderingInProgress] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);

  // Initialize Anonymous Auth, device_id, and check for existing open table session
  useEffect(() => {
    // 1. Sign in anonymously with Supabase Auth if there is no session
    async function initAnonymousAuth() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          await supabase.auth.signInAnonymously();
        }
      } catch (err) {
        console.warn('Supabase anonymous auth initialization:', err);
      }
    }
    initAnonymousAuth();

    // 2. Persistent device ID for table ordering
    let id = localStorage.getItem('cafe_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('cafe_device_id', id);
    }
    setDeviceId(id);

    // 3. If device already joined an open session for this table, skip the PIN screen
    async function checkExistingSession() {
      const savedToken =
        localStorage.getItem(`cafe_session_${tableCode}`) ||
        sessionStorage.getItem(`cafe_session_${tableCode}`);
      const savedSessionId =
        localStorage.getItem(`cafe_session_id_${tableCode}`) ||
        sessionStorage.getItem(`cafe_session_id_${tableCode}`);
      const savedTableNum =
        localStorage.getItem(`cafe_table_num_${tableCode}`) ||
        sessionStorage.getItem(`cafe_table_num_${tableCode}`);

      if (!savedToken || !savedSessionId) return;

      try {
        const res = await fetch(
          apiUrl(`/api/table/session?table_code=${encodeURIComponent(tableCode)}&session_id=${encodeURIComponent(savedSessionId)}&session_token=${encodeURIComponent(savedToken)}`)
        );
        const data = await res.json();

        if (data && data.success && data.active) {
          // Already joined active session -> skip PIN screen
          setSessionToken(savedToken);
          setSessionId(data.session_id || savedSessionId);
          if (data.table_number || savedTableNum) setTableNumber(data.table_number || savedTableNum);
          setIsPinVerified(true);
        } else {
          // Session closed or expired -> clear storage to prompt for fresh PIN
          localStorage.removeItem(`cafe_session_${tableCode}`);
          localStorage.removeItem(`cafe_session_id_${tableCode}`);
          sessionStorage.removeItem(`cafe_session_${tableCode}`);
          sessionStorage.removeItem(`cafe_session_id_${tableCode}`);
        }
      } catch {
        // If offline/check fails, prompt for PIN rather than assuming active
        localStorage.removeItem(`cafe_session_${tableCode}`);
        localStorage.removeItem(`cafe_session_id_${tableCode}`);
        sessionStorage.removeItem(`cafe_session_${tableCode}`);
        sessionStorage.removeItem(`cafe_session_id_${tableCode}`);
      }
    }

    checkExistingSession();
  }, [tableCode]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockCountdown <= 0) {
      if (isLocked) setIsLocked(false);
      return;
    }
    const timer = setInterval(() => {
      setLockCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockCountdown, isLocked]);

  // Handle PIN verification
  async function handleVerifyPin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (pin.length !== 4) {
      setPinError(
        language === 'hi'
          ? 'कृपया 4-अंकों का पिन दर्ज करें।'
          : 'Please enter a 4-digit PIN.'
      );
      return;
    }

    setVerifyingPin(true);
    setPinError(null);

    const defaultInvalidMsg =
      language === 'hi'
        ? 'अमान्य पिन। कृपया मैनेजर से बात करें और अपना पिन दोबारा प्राप्त करें।'
        : 'Invalid PIN. Please talk to the manager and get your PIN again.';

    try {
      const res = await fetch(apiUrl('/api/table/verify-pin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_code: tableCode, pin, device_id: deviceId }),
      });

      const data = await res.json();

      if (data.locked) {
        setIsLocked(true);
        const remSec = data.lock_remaining_seconds || 300;
        setLockCountdown(remSec);
        const remMin = Math.max(1, Math.ceil(remSec / 60));
        setPinError(
          language === 'hi'
            ? `बहुत सारे गलत प्रयास। टेबल ${remMin} मिनट के लिए लॉक है। कृपया मैनेजर से बात करें।`
            : `Too many wrong attempts. Table is locked for ${remMin} minute(s). Please talk to manager.`
        );
        return;
      }

      if (!data.success) {
        setPinError(defaultInvalidMsg);
        return;
      }

      // Success: store session info in both localStorage and sessionStorage
      setSessionToken(data.session_token);
      setSessionId(data.session_id);
      const tableNum = data.table_number || `Table ${tableCode}`;
      setTableNumber(tableNum);
      setIsPinVerified(true);

      localStorage.setItem(`cafe_session_${tableCode}`, data.session_token);
      localStorage.setItem(`cafe_session_id_${tableCode}`, data.session_id);
      localStorage.setItem(`cafe_table_num_${tableCode}`, tableNum);

      sessionStorage.setItem(`cafe_session_${tableCode}`, data.session_token);
      sessionStorage.setItem(`cafe_session_id_${tableCode}`, data.session_id);
      sessionStorage.setItem(`cafe_table_num_${tableCode}`, tableNum);
    } catch {
      setPinError(defaultInvalidMsg);
    } finally {
      setVerifyingPin(false);
    }
  }

  // Fetch Menu and Categories
  const refreshMenu = React.useCallback(async () => {
    const supabase = createClient();
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (catData) setCategories(catData);

    const { data: itemsData } = await supabase
      .from('menu_items')
      .select('*')
      .order('name_en', { ascending: true });
    if (itemsData) setMenuItems(itemsData);
  }, []);

  useEffect(() => {
    if (!isPinVerified) return;

    refreshMenu();

    const supabase = createClient();

    // Realtime subscription on menu items (e.g. availability toggle syncs live to all menus)
    const channel = supabase
      .channel('public:menu_items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        payload => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MenuItem;
            setMenuItems(prev => prev.map(it => (it.id === updated.id ? { ...it, ...updated } : it)));
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as MenuItem;
            setMenuItems(prev => [...prev, inserted]);
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setMenuItems(prev => prev.filter(it => it.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPinVerified, refreshMenu]);

  // Fetch and Subscribe to Table Shared Orders
  useEffect(() => {
    if (!isPinVerified || !sessionId) return;

    const supabase = createClient();

    async function fetchOrders() {
      try {
        const res = await fetch(apiUrl(`/api/table/orders?sessionId=${sessionId}`));
        const result = await res.json();
        if (result.success && Array.isArray(result.orders)) {
          setTableOrders(result.orders as Order[]);
          return;
        }
      } catch {
        // Fallback to direct query if available
      }
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (data) setTableOrders(data as Order[]);
    }

    fetchOrders();
    const pollInterval = setInterval(fetchOrders, 10000);

    // Subscribe to order updates for this table session
    const orderChannel = supabase
      .channel(`table_orders_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    // Subscribe to session status changes (e.g. manager closes session at billing counter)
    const sessionChannel = supabase
      .channel(`table_session_status_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'table_sessions',
          filter: `id=eq.${sessionId}`,
        },
        payload => {
          const updated = payload.new as { status?: string };
          if (updated && updated.status === 'CLOSED') {
            setIsSessionEnded(true);
            setIsPinVerified(false);
            setCart([]);
            localStorage.removeItem(`cafe_session_${tableCode}`);
            localStorage.removeItem(`cafe_session_id_${tableCode}`);
            sessionStorage.removeItem(`cafe_session_${tableCode}`);
            sessionStorage.removeItem(`cafe_session_id_${tableCode}`);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [isPinVerified, sessionId, tableCode]);

  // Cart Management
  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { item, quantity: 1, notes: '' }];
    });
  }

  function updateQuantity(itemId: string, delta: number) {
    setCart(prev =>
      prev
        .map(i => {
          if (i.item.id === itemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function updateItemNotes(itemId: string, notes: string) {
    setCart(prev =>
      prev.map(i => (i.item.id === itemId ? { ...i, notes } : i))
    );
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Submit Order: calls place_order(session_id, items) / place_table_order
  async function handlePlaceOrder() {
    if ((!sessionToken && !sessionId) || cart.length === 0) return;

    setOrderingInProgress(true);
    setCartError(null);

    try {
      // NEVER send prices from the client! Only item_id, quantity, and notes (max 150 chars)
      const itemsPayload = cart.map(c => ({
        item_id: c.item.id,
        quantity: c.quantity,
        notes: (c.notes || '').trim().slice(0, 150),
      }));

      const res = await fetch(apiUrl('/api/table/order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          session_token: sessionToken,
          device_id: deviceId,
          items: itemsPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = String(data.message || '');
        const isSessionClosed =
          msg.toLowerCase().includes('session') &&
          (msg.toLowerCase().includes('closed') || msg.toLowerCase().includes('invalid'));
        const isUnavailable =
          msg.toLowerCase().includes('available') ||
          msg.toLowerCase().includes('timing') ||
          msg.toLowerCase().includes('not available');

        if (isSessionClosed) {
          setCartError(
            language === 'hi'
              ? 'टेबल सत्र समाप्त हो चुका है। कृपया नया पिन पाने के लिए मैनेजर से संपर्क करें।'
              : 'Session is closed or invalid. Please ask manager for a new PIN.'
          );
          // Expire session and show PIN screen
          setIsPinVerified(false);
          localStorage.removeItem(`cafe_session_${tableCode}`);
          localStorage.removeItem(`cafe_session_id_${tableCode}`);
          sessionStorage.removeItem(`cafe_session_${tableCode}`);
          sessionStorage.removeItem(`cafe_session_id_${tableCode}`);
        } else if (isUnavailable) {
          setCartError(
            language === 'hi'
              ? 'कुछ आइटम आज उपलब्ध नहीं हैं। मेनू को अपडेट कर दिया गया है।'
              : msg || 'One or more items became unavailable today. Menu has been refreshed.'
          );
          await refreshMenu();
        } else {
          setCartError(
            msg || (language === 'hi' ? 'ऑर्डर भेजने में त्रुटि।' : 'Failed to place order.')
          );
          await refreshMenu();
        }
      } else {
        // Order success: show short confirmation and clear cart
        setCart([]);
        setIsCartOpen(false);
        setCartError(null);
        setActiveTab('orders');
        setOrderSuccessMessage(
          language === 'hi'
            ? 'ऑर्डर सफलतापूर्वक भेजा गया! रसोई में तैयारी शुरू हो गई है।'
            : 'Order placed successfully! Sent straight to the kitchen.'
        );
        setTimeout(() => setOrderSuccessMessage(null), 4500);
      }
    } catch {
      setCartError(
        language === 'hi'
          ? 'नेटवर्क या सर्वर त्रुटि। कृपया पुनः प्रयास करें।'
          : 'Error placing order. Please check your connection and try again.'
      );
      await refreshMenu();
    } finally {
      setOrderingInProgress(false);
    }
  }

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      // 1. Hide items outside their breakfast/lunch time window (Asia/Kolkata)
      if (!isItemInMealWindow(item)) {
        return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
        return false;
      }

      // 3. Veg / Non-Veg filter
      if (dietFilter === 'veg' && !item.is_veg) {
        return false;
      }
      if (dietFilter === 'nonveg' && item.is_veg) {
        return false;
      }

      // 4. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesEn = item.name_en.toLowerCase().includes(query);
        const matchesHi = item.name_hi.toLowerCase().includes(query);
        return matchesEn || matchesHi;
      }

      return true;
    });
  }, [menuItems, selectedCategory, dietFilter, searchQuery]);

  // Split orders for this session into "Your order" (this phone) and "Others at your table"
  const myOrders = useMemo(() => {
    return tableOrders.filter(o => o.device_id === deviceId);
  }, [tableOrders, deviceId]);

  const otherOrders = useMemo(() => {
    return tableOrders.filter(o => o.device_id !== deviceId);
  }, [tableOrders, deviceId]);

  const totalTableAmount = useMemo(() => {
    return tableOrders.reduce((acc, order) => {
      const itemsSum =
        order.order_items?.reduce(
          (sum, it) => (it.status !== 'CANCELLED' ? sum + it.price_per_unit * it.quantity : sum),
          0
        ) || 0;
      return acc + itemsSum;
    }, 0);
  }, [tableOrders]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 animate-spin" />
            <span>{language === 'hi' ? 'प्राप्त हुआ' : 'Received'}</span>
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            <Flame className="w-3 h-3 text-orange-600" />
            <span>{language === 'hi' ? 'तैयार हो रहा है' : 'Preparing'}</span>
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <UtensilsCrossed className="w-3 h-3" />
            <span>{language === 'hi' ? 'तैयार है' : 'Ready'}</span>
          </span>
        );
      case 'SERVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>{language === 'hi' ? 'परोसा गया' : 'Served'}</span>
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {status}
          </span>
        );
    }
  };

  // -------------------------------------------------------------
  // FULL-SCREEN: SESSION ENDED NOTIFICATION (Manager closed session)
  // -------------------------------------------------------------
  if (isSessionEnded) {
    return (
      <div className="min-h-screen bg-linear-to-b from-amber-500/15 via-white to-amber-50 flex flex-col justify-center items-center p-6 text-center animate-fade-in">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-amber-100 p-8 flex flex-col items-center">
          <div className="w-20 h-20 bg-amber-500 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
            {language === 'hi' ? 'सत्र समाप्त हो गया है। धन्यवाद!' : 'Session ended. Thank you!'}
          </h1>

          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            {language === 'hi'
              ? `मैनेजर द्वारा ${tableNumber} का बिल काउंटर पर पूरा हो चुका है और सत्र समाप्त कर दिया गया है। हमारे साथ भोजन करने के लिए धन्यवाद!`
              : `Your dining session at ${tableNumber} has been closed by the manager at the counter. All ordering is now finished. Thank you for dining with Brew & Bites Cafe!`}
          </p>

          <div className="w-full p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 font-medium mb-6 text-left space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{language === 'hi' ? 'लॉयल्टी रिवॉर्ड' : 'Loyalty Rewards'}</span>
            </div>
            <p>
              {language === 'hi'
                ? 'प्रत्येक 5 विज़िट के बाद, आपकी अगली विज़िट (6, 11, 16...) पर 1 मुफ़्त कॉफ़ी मिलती है!'
                : 'After every 5 visits, your next visit receives 1 Free Coffee!'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSessionEnded(false);
              setPin('');
              setPinError(null);
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-sm shadow-lg shadow-amber-600/30 transition cursor-pointer"
          >
            {language === 'hi' ? 'नया सत्र शुरू करें' : 'Start New Session'}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 1: 4-DIGIT PIN AUTHENTICATION SCREEN
  // -------------------------------------------------------------
  if (!isPinVerified) {
    const lockMinutes = Math.max(1, Math.ceil(lockCountdown / 60));

    return (
      <div className="min-h-screen bg-linear-to-b from-amber-500/10 via-amber-50/50 to-white flex flex-col justify-center items-center p-4">
        {/* Top Header with Cafe Branding & Language Switch */}
        <div className="w-full max-w-sm flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              ☕
            </div>
            <span className="font-bold text-sm text-gray-800">
              {language === 'hi' ? 'ब्रू एंड बाइट्स कैफे' : 'Brew & Bites Cafe'}
            </span>
          </div>

          {/* Hindi / English Toggle */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-200 bg-white shadow-xs text-xs font-semibold text-gray-700 hover:bg-amber-50 active:scale-95 transition"
            title="Toggle Hindi / English"
          >
            <Languages className="w-3.5 h-3.5 text-amber-600" />
            <span>{language === 'en' ? 'हिन्दी' : 'English'}</span>
          </button>
        </div>

        {/* PIN Card */}
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-amber-100 p-6 sm:p-8 text-center animate-fade-in">
          <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
            <Lock className="w-7 h-7" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            {language === 'hi'
              ? `${tableNumber} में आपका स्वागत है`
              : `Welcome to ${tableNumber}`}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-5 leading-relaxed">
            {language === 'hi'
              ? 'मेनू देखने और ऑर्डर करने के लिए मैनेजर द्वारा दिया गया 4-अंकों का पिन दर्ज करें।'
              : 'Enter the 4-digit PIN provided by your server to view the menu and start ordering.'}
          </p>

          {isLocked ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-5 mb-4 text-left">
              <div className="flex items-center gap-2 text-red-700 font-bold mb-1 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{language === 'hi' ? 'टेबल लॉक है' : 'Table Locked'}</span>
              </div>
              <p className="text-xs sm:text-sm text-red-600 mb-3 font-medium leading-normal">
                {language === 'hi'
                  ? `बहुत सारे गलत प्रयास। टेबल ${lockMinutes} मिनट के लिए लॉक है। कृपया मैनेजर से बात करें।`
                  : `Too many wrong attempts. Table is locked for ${lockMinutes} minute(s). Please talk to manager.`}
              </p>
              <div className="flex items-center justify-between text-xs font-semibold text-red-700 bg-red-100/60 p-2.5 rounded-xl">
                <span>{language === 'hi' ? 'समय शेष:' : 'Lock countdown:'}</span>
                <span className="font-mono text-sm font-bold">
                  {Math.floor(lockCountdown / 60)}:
                  {(lockCountdown % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerifyPin} className="space-y-4 sm:space-y-5">
              {/* Hidden native input for keyboard accessibility */}
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(val);
                  setPinError(null);
                }}
                className="sr-only"
                autoFocus
              />

              {/* 4 Large Digit Boxes */}
              <div className="flex justify-center gap-2.5 sm:gap-3 my-2">
                {[0, 1, 2, 3].map(index => {
                  const digit = pin[index] || '';
                  return (
                    <div
                      key={index}
                      className={`w-14 h-16 sm:w-16 sm:h-20 rounded-2xl border-2 flex items-center justify-center text-3xl font-extrabold select-none transition-all ${
                        digit
                          ? 'border-amber-500 bg-amber-50 text-amber-900 scale-105 shadow-sm ring-4 ring-amber-500/10'
                          : 'border-gray-200 bg-gray-50 text-gray-300'
                      }`}
                    >
                      {digit || ''}
                    </div>
                  );
                })}
              </div>

              {/* Error Message */}
              {pinError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold leading-relaxed animate-shake">
                  {pinError}
                </div>
              )}

              {/* Virtual Large Touch Keypad */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5 max-w-xs mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(btn => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => {
                      if (btn === 'C') {
                        setPin('');
                        setPinError(null);
                      } else if (btn === '⌫') {
                        setPin(prev => prev.slice(0, -1));
                        setPinError(null);
                      } else {
                        if (pin.length < 4) {
                          const newPin = pin + btn;
                          setPin(newPin);
                          setPinError(null);
                        }
                      }
                    }}
                    className="h-12 sm:h-13 rounded-2xl bg-gray-100/90 hover:bg-amber-100 text-gray-800 hover:text-amber-950 font-extrabold text-xl active:scale-95 transition-all flex items-center justify-center shadow-2xs cursor-pointer select-none"
                  >
                    {btn}
                  </button>
                ))}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={pin.length !== 4 || verifyingPin}
                className="w-full py-3.5 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-base shadow-lg shadow-amber-600/30 transition-all disabled:opacity-50 disabled:shadow-none cursor-pointer"
              >
                {verifyingPin
                  ? language === 'hi'
                    ? 'सत्यापित हो रहा है...'
                    : 'Verifying PIN...'
                  : language === 'hi'
                  ? 'मेनू खोलें'
                  : 'Open Menu'}
              </button>
            </form>
          )}

          <p className="text-[11px] sm:text-xs text-gray-400 mt-5 leading-normal">
            {language === 'hi'
              ? 'गलत पिन या गलत टेबल? 4-अंकों का कोड पाने के लिए कैफे मैनेजर से संपर्क करें।'
              : 'Wrong PIN or wrong table? Ask the cafe manager for the 4-digit code.'}
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 2: ACTIVE TABLE MENU & ORDERING INTERFACE
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-28 text-gray-900 font-sans">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/80 px-4 py-3 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-amber-500/20">
              ☕
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-gray-900 leading-tight">
                  Brew &amp; Bites
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {tableNumber}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">Live ordering active</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Language switch */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
              title="Toggle Hindi / English"
            >
              <Languages className="w-3.5 h-3.5 text-amber-600" />
              <span>{language === 'en' ? 'हिन्दी' : 'English'}</span>
            </button>

            {/* Call Waiter Button */}
            <button
              onClick={() => setIsCallWaiterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{t('common.callWaiter', 'Call Waiter')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Success Notification Banner */}
      {orderSuccessMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-emerald-600 text-white px-5 py-2.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span>{orderSuccessMessage}</span>
        </div>
      )}

      {/* Top Tab Switcher: Menu vs Orders */}
      <div className="max-w-3xl mx-auto px-4 pt-3">
        <div className="bg-gray-200/80 p-1 rounded-2xl flex items-center text-xs font-bold shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-amber-600" />
            <span>{language === 'hi' ? 'मेनू' : 'Menu'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-amber-600" />
            <span>{language === 'hi' ? 'ऑर्डर्स' : 'Orders'}</span>
            {tableOrders.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white shadow-2xs">
                {tableOrders.reduce((sum, o) => sum + (o.order_items?.length || 0), 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {activeTab === 'menu' ? (
          <>
        {/* Search Bar & Veg / Non-Veg Filter Chips with Green/Red Indicators */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={language === 'hi' ? 'मेनू में खोजें...' : 'Search items, coffee, bites...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-hidden focus:border-amber-500 shadow-2xs"
            />
          </div>

          {/* 3-way Veg / Non-Veg Filter with Green/Red Indicators */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs self-start sm:self-auto shadow-2xs">
            <button
              type="button"
              onClick={() => setDietFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                dietFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {language === 'hi' ? 'सभी' : 'All'}
            </button>

            <button
              type="button"
              onClick={() => setDietFilter('veg')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                dietFilter === 'veg'
                  ? 'bg-white text-green-700 shadow-xs ring-1 ring-green-600/20'
                  : 'text-gray-600 hover:text-green-700'
              }`}
            >
              <VegNonVegBadge isVeg={true} size="sm" />
              <span>{language === 'hi' ? 'शाकाहारी' : 'Veg'}</span>
            </button>

            <button
              type="button"
              onClick={() => setDietFilter('nonveg')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                dietFilter === 'nonveg'
                  ? 'bg-white text-red-700 shadow-xs ring-1 ring-red-600/20'
                  : 'text-gray-600 hover:text-red-700'
              }`}
            >
              <VegNonVegBadge isVeg={false} size="sm" />
              <span>{language === 'hi' ? 'माँसाहारी' : 'Non-Veg'}</span>
            </button>
          </div>
        </div>

        {/* Category Filter Chips Horizontal Scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none py-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-2xs cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-600/20'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-amber-50/50 hover:border-amber-200'
            }`}
          >
            {language === 'hi' ? 'सभी' : 'All Items'}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-2xs cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-600/20'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-amber-50/50 hover:border-amber-200'
              }`}
            >
              {language === 'hi' ? cat.name_hi : cat.name_en}
            </button>
          ))}
        </div>

        {/* Table Orders Quick Banner */}
        {tableOrders.length > 0 && (
          <div
            onClick={() => setIsLiveOrdersOpen(true)}
            className="p-3 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center justify-between cursor-pointer shadow-xs hover:border-amber-400 transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                {tableOrders.reduce((sum, o) => sum + (o.order_items?.length || 0), 0)}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">
                  {language === 'hi' ? 'टेबल ऑर्डर गतिविधि' : 'Shared Table Order Activity'}
                </p>
                <p className="text-[11px] text-gray-600">
                  {language === 'hi'
                    ? 'देखें आपने और टेबल के अन्य लोगों ने क्या ऑर्डर किया है।'
                    : 'Tap to view what you and others at this table ordered.'}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-700 underline">
              {language === 'hi' ? 'लाइव देखें' : 'View Live'}
            </span>
          </div>
        )}

        {/* Menu Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {filteredItems.map(item => {
            const isAvailable = isItemAvailableToday(item);
            const cartQty = cart.find(c => c.item.id === item.id)?.quantity || 0;

            const primaryName = language === 'hi' ? item.name_hi : item.name_en;
            const secondaryName = language === 'hi' ? item.name_en : item.name_hi;
            const description = language === 'hi'
              ? item.description_hi || item.description_en
              : item.description_en || item.description_hi;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-3 flex gap-3 shadow-2xs transition-all relative overflow-hidden ${
                  !isAvailable
                    ? 'opacity-60 grayscale-[30%] bg-gray-50 border-gray-200 border-dashed'
                    : 'border-gray-200 hover:border-amber-300'
                }`}
              >
                {/* Photo (Lazy loaded, fallback icon) */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-amber-50/50 relative flex items-center justify-center border border-gray-100">
                  {item.image_url && !failedImages[item.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={primaryName}
                      loading="lazy"
                      onError={() =>
                        setFailedImages(prev => ({ ...prev, [item.id]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-amber-600/70 bg-amber-50/70 p-2 text-center">
                      <UtensilsCrossed className="w-6 h-6 text-amber-500 mb-1" />
                      <span className="text-[10px] font-semibold text-amber-700/60 leading-none">
                        Brew &amp; Bites
                      </span>
                    </div>
                  )}

                  {/* Unavailable overlay badge */}
                  {!isAvailable && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-1.5 text-center">
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider leading-tight">
                        {language === 'hi' ? 'आज उपलब्ध नहीं है' : 'Not available today'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Item Info */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    {/* Header: Veg/Non-veg indicator badge + Primary Name */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="mt-0.5 shrink-0">
                          <VegNonVegBadge isVeg={item.is_veg} size="sm" />
                        </span>
                        <h3 className="font-bold text-sm text-gray-900 leading-snug line-clamp-1">
                          {primaryName}
                        </h3>
                      </div>
                    </div>

                    {/* Secondary language title */}
                    <p className="text-[11px] text-gray-400 font-medium line-clamp-1 ml-5">
                      {secondaryName}
                    </p>

                    {/* Description */}
                    {description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">
                        {description}
                      </p>
                    )}
                  </div>

                  {/* Footer: Price in Rupees & Action Button */}
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100">
                    <div>
                      <span className="text-base font-extrabold text-gray-900">
                        ₹{item.price}
                      </span>
                    </div>

                    {/* Actions: Add / Stepper or Disabled "Not available today" */}
                    {isAvailable ? (
                      cartQty > 0 ? (
                        <div className="flex items-center gap-2 bg-amber-500 text-white rounded-xl px-2 py-1 shadow-xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-5 h-5 flex items-center justify-center font-bold hover:bg-amber-600 rounded-md cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{cartQty}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-5 h-5 flex items-center justify-center font-bold hover:bg-amber-600 rounded-md cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-800 border border-amber-200 text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{language === 'hi' ? 'जोड़ें' : 'Add'}</span>
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="px-2.5 py-1.5 rounded-xl bg-gray-100 text-gray-400 text-[11px] font-semibold cursor-not-allowed border border-gray-200 flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3 shrink-0" />
                        <span>{language === 'hi' ? 'आज उपलब्ध नहीं है' : 'Not available today'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <p className="text-sm">
              {language === 'hi' ? 'कोई आइटम नहीं मिला।' : 'No items found matching your filter.'}
            </p>
          </div>
        )}
      </>
    ) : (
      /* ORDERS TAB: REALTIME TABLE SESSION ACTIVITY */
      <div className="space-y-4 animate-fade-in">
        {tableOrders.length === 0 ? (
          <div className="py-16 text-center text-gray-400 bg-white rounded-3xl border border-gray-200 p-8 shadow-xs">
            <UtensilsCrossed className="w-14 h-14 mx-auto mb-3 opacity-30 text-amber-600" />
            <h3 className="text-base font-bold text-gray-700">
              {language === 'hi' ? 'अभी कोई ऑर्डर नहीं है' : 'No orders placed yet'}
            </h3>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              {language === 'hi'
                ? 'मेनू ब्राउज़ करें और अपना पहला ऑर्डर दें!'
                : 'Browse the menu and place your first round of order!'}
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className="py-2.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
            >
              {language === 'hi' ? 'मेनू देखें' : 'Browse Menu'}
            </button>
          </div>
        ) : (
          <>
            {/* 1. "Your order" (Highlighted Section for this device) */}
            <div className="bg-white rounded-2xl border-2 border-emerald-500/40 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-extrabold text-sm text-gray-900">
                    {language === 'hi' ? 'आपका ऑर्डर' : 'Your Order'}
                  </h3>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {language === 'hi' ? 'यह फोन' : 'This Phone'}
                </span>
              </div>

              {myOrders.length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-gray-50 p-3.5 rounded-xl border border-dashed border-gray-200 text-center">
                  {language === 'hi'
                    ? 'आपने अभी तक इस फोन से कोई आइटम ऑर्डर नहीं किया है।'
                    : 'You have not ordered any items from this phone yet.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {myOrders.map(order => (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-50/15 shadow-2xs"
                    >
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-500">
                          {new Date(order.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="space-y-2">
                        {order.order_items?.map(item => (
                          <div
                            key={item.id}
                            className="flex justify-between items-start text-sm"
                          >
                            <div>
                              <span className="font-bold text-gray-800">
                                {item.quantity}x{' '}
                                {language === 'hi' ? item.item_name_hi : item.item_name_en}
                              </span>
                              {item.item_notes && (
                                <p className="text-xs text-amber-700 italic mt-0.5">
                                  Note: {item.item_notes}
                                </p>
                              )}
                            </div>
                            <span className="font-extrabold text-gray-900 shrink-0 ml-2">
                              ₹{item.price_per_unit * item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. "Others at your table" (No names shown) */}
            {otherOrders.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <h3 className="font-bold text-sm text-gray-800">
                      {language === 'hi'
                        ? 'आपकी टेबल पर अन्य ऑर्डर'
                        : 'Others at your table'}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    {otherOrders.length}{' '}
                    {otherOrders.length > 1
                      ? language === 'hi'
                        ? 'ऑर्डर्स'
                        : 'orders'
                      : language === 'hi'
                      ? 'ऑर्डर'
                      : 'order'}
                  </span>
                </div>

                <div className="space-y-3">
                  {otherOrders.map(order => (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 shadow-2xs"
                    >
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-500">
                          {new Date(order.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="space-y-2">
                        {order.order_items?.map(item => (
                          <div
                            key={item.id}
                            className="flex justify-between items-start text-sm"
                          >
                            <div>
                              <span className="text-gray-700 font-medium">
                                {item.quantity}x{' '}
                                {language === 'hi' ? item.item_name_hi : item.item_name_en}
                              </span>
                              {item.item_notes && (
                                <p className="text-xs text-gray-500 italic mt-0.5">
                                  Note: {item.item_notes}
                                </p>
                              )}
                            </div>
                            <span className="text-gray-700 font-bold shrink-0 ml-2">
                              ₹{item.price_per_unit * item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table Running Total & Notice */}
            <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex justify-between items-center text-sm font-semibold text-gray-900">
                <span>
                  {language === 'hi' ? 'टेबल का कुल बिल:' : 'Table Running Total:'}
                </span>
                <span className="text-lg text-amber-700 font-black">
                  ₹{totalTableAmount}
                </span>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center text-xs text-amber-900 font-medium border border-amber-200 leading-normal">
                ℹ️{' '}
                {language === 'hi'
                  ? 'बिल केवल काउंटर पर दिया जाता है। जब आप भोजन समाप्त कर लें, तो कृपया काउंटर पर जाकर बिल का भुगतान करें।'
                  : 'Billing is done only at the counter. When you are ready, please visit the counter to settle your bill.'}
              </div>
            </div>
          </>
        )}
      </div>
    )}
  </main>

      {/* Floating Bottom Sticky Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-3 left-4 right-4 z-40 max-w-lg mx-auto">
          <div className="bg-amber-600 text-white p-3.5 rounded-2xl shadow-xl shadow-amber-600/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-100 uppercase tracking-wider">
                  {cartItemCount}{' '}
                  {cartItemCount === 1
                    ? language === 'hi'
                      ? 'आइटम कार्ट में'
                      : 'item in cart'
                    : language === 'hi'
                    ? 'आइटम कार्ट में'
                    : 'items in cart'}
                </p>
                <p className="text-base font-extrabold">₹{cartTotal}</p>
              </div>
            </div>

            <button
              onClick={() => {
                setCartError(null);
                setIsCartOpen(true);
              }}
              className="py-2.5 px-5 bg-white text-amber-800 hover:bg-amber-50 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              {language === 'hi' ? 'कार्ट देखें' : 'Review & Order'}
            </button>
          </div>
        </div>
      )}

      {/* Cart Sheet / Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[88vh] rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            {/* Sheet Header */}
            <div className="px-5 py-4 bg-amber-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">
                  {language === 'hi' ? 'आपकी कार्ट' : 'Your Cart'}
                </h3>
                <p className="text-xs text-amber-100">{tableNumber}</p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sheet Content */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3.5">
              {/* Error banner if item became unavailable or session closed */}
              {cartError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-start gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{cartError}</span>
                </div>
              )}

              {/* Cart Items List */}
              {cart.map(c => (
                <div
                  key={c.item.id}
                  className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/60 flex flex-col gap-2.5"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <VegNonVegBadge isVeg={c.item.is_veg} size="sm" />
                      <span className="font-bold text-sm text-gray-900 line-clamp-1">
                        {language === 'hi' ? c.item.name_hi : c.item.name_en}
                      </span>
                    </div>
                    <span className="font-extrabold text-sm text-gray-900 shrink-0 ml-2">
                      ₹{c.item.price * c.quantity}
                    </span>
                  </div>

                  {/* Quantity Stepper & Price Snapshot */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 font-medium">
                      ₹{c.item.price} each
                    </span>

                    <div className="flex items-center gap-2 bg-amber-500 text-white rounded-xl px-2 py-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(c.item.id, -1)}
                        className="w-5 h-5 flex items-center justify-center font-bold hover:bg-amber-600 rounded-md cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{c.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(c.item.id, 1)}
                        className="w-5 h-5 flex items-center justify-center font-bold hover:bg-amber-600 rounded-md cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Optional Note Field (Max 150 characters, e.g. "less spicy") */}
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={150}
                      placeholder={
                        language === 'hi'
                          ? 'विशेष निर्देश (जैसे कम तीखा, एक्स्ट्रा शुगर)...'
                          : 'Special notes (e.g. less spicy, no onions)...'
                      }
                      value={c.notes}
                      onChange={e => updateItemNotes(c.item.id, e.target.value)}
                      className="w-full text-xs px-3 py-2 pr-14 rounded-xl border border-gray-200 bg-white focus:outline-hidden focus:border-amber-500 shadow-2xs"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono select-none">
                      {(c.notes || '').length}/150
                    </span>
                  </div>
                </div>
              ))}

              {/* Total Summary */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span>{language === 'hi' ? 'इस राउंड का कुल' : 'Round Total'}</span>
                  <span className="text-amber-700 font-extrabold text-base">₹{cartTotal}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {language === 'hi'
                    ? '* सभी मानक कर (GST) शामिल हैं।'
                    : '* Prices are inclusive of all standard food taxes.'}
                </p>
              </div>

              {/* Counter Billing Notice */}
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <span className="text-base">ℹ️</span>
                <span>
                  <strong>{language === 'hi' ? 'काउंटर बिलिंग:' : 'Counter Billing:'}</strong>{' '}
                  {language === 'hi'
                    ? 'बिल केवल काउंटर पर दिया जाता है। आपके फोन से कोई भुगतान नहीं लिया जाता।'
                    : 'You will receive a consolidated bill at the counter when you finish dining. No payment is taken through your phone.'}
                </span>
              </div>
            </div>

            {/* Sheet Footer Buttons */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="py-3 px-4 rounded-xl border border-gray-300 font-semibold text-xs text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                {language === 'hi' ? 'और जोड़ें' : 'Add More'}
              </button>
              <button
                type="button"
                disabled={orderingInProgress || cart.length === 0}
                onClick={handlePlaceOrder}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {orderingInProgress ? (
                  <span>
                    {language === 'hi'
                      ? 'रसोई में भेजा जा रहा है...'
                      : 'Sending to Kitchen...'}
                  </span>
                ) : (
                  <span>
                    {language === 'hi'
                      ? `ऑर्डर भेजें (₹${cartTotal})`
                      : `Place Order (₹${cartTotal})`}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Shared Table Orders Drawer */}
      <LiveOrderList
        orders={tableOrders}
        deviceId={deviceId}
        isOpen={isLiveOrdersOpen}
        onClose={() => setIsLiveOrdersOpen(false)}
        tableNumber={tableNumber}
      />

      {/* Floating Call Waiter Button - visible ONLY while table session is open */}
      {isPinVerified && !isSessionEnded && (
        <button
          type="button"
          onClick={() => setIsCallWaiterOpen(true)}
          className={`fixed right-4 z-30 flex items-center gap-2 py-2.5 px-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-500/30 border border-white/20 active:scale-95 transition-all duration-300 cursor-pointer ${
            cart.length > 0 ? 'bottom-22' : 'bottom-5'
          }`}
          title="Call Waiter"
        >
          <Bell className="w-4 h-4 animate-bounce" />
          <span>{language === 'hi' ? 'वेटर बुलाएं' : 'Call Waiter'}</span>
        </button>
      )}

      {/* Call Waiter Sheet Modal */}
      {sessionToken && isPinVerified && !isSessionEnded && (
        <CallWaiterModal
          isOpen={isCallWaiterOpen}
          onClose={() => setIsCallWaiterOpen(false)}
          sessionToken={sessionToken}
          sessionId={sessionId}
          tableNumber={tableNumber}
        />
      )}
    </div>
  );
}

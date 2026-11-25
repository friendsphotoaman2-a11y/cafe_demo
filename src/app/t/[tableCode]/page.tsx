'use client';

import React, { useState, useEffect, useMemo, useRef, use } from 'react';
import confetti from 'canvas-confetti';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, Category, Order } from '@/types/database';
import { VegNonVegBadge } from '@/components/VegNonVegBadge';
import { CallWaiterModal } from '@/components/CallWaiterModal';
import { LiveOrderList } from '@/components/LiveOrderList';
import { TableOrdersFeed } from '@/components/TableOrdersFeed';
import { isItemInMealWindow, isItemAvailableToday } from '@/lib/meal-timing';
import { apiUrl } from '@/lib/base-path';
import {
  Lock,
  Unlock,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Bell,
  AlertTriangle,
  Languages,
  Check,
  UtensilsCrossed,
  Ban,
  ClipboardList,
  CheckCircle2,
  Sparkles,
  Delete,
  Receipt,
  X,
  ArrowRight,
  ArrowUpDown,
  Clock,
  Coffee,
  Loader2,
} from 'lucide-react';

import { useTranslation } from '@/lib/i18n';

interface CartItem {
  item: MenuItem;
  quantity: number;
  notes: string;
}

const NOTE_PRESETS = [
  { id: 'less_spicy', en: 'Less spicy', hi: 'कम तीखा' },
  { id: 'less_sugar', en: 'Less sugar', hi: 'कम चीनी' },
  { id: 'no_ice', en: 'No ice', hi: 'बिना बर्फ' },
  { id: 'extra_hot', en: 'Extra hot', hi: 'ज्यादा गर्म' },
] as const;

export default function TablePage({ params }: { params: Promise<{ tableCode?: string; table_code?: string }> }) {
  const resolvedParams = use(params);
  const rawCode = resolvedParams.tableCode || resolvedParams.table_code || '';
  const tableCode = rawCode.toUpperCase();

  // Authentication & Session State
  const [pin, setPin] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinUnlockSuccess, setPinUnlockSuccess] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [tableNotFound, setTableNotFound] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
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
  const [cafeName, setCafeName] = useState('Brew & Bites Cafe');
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [sortBy, setSortBy] = useState<'recommended' | 'price_asc' | 'price_desc'>('recommended');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const { language, setLanguage, t } = useTranslation();

  // Dish Quick-View Modal state
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [dishModalNote, setDishModalNote] = useState('');

  // Cart & Ordering
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [isLiveOrdersOpen, setIsLiveOrdersOpen] = useState(false);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [orderingInProgress, setOrderingInProgress] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [gstRatePercent, setGstRatePercent] = useState(5.0);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  // Haptic feedback helper
  const triggerHaptic = (ms: number | number[] = 35) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore on unsupported browsers
      }
    }
  };

  const checkExistingSession = React.useCallback(async () => {
    setIsCheckingSession(true);
    setTableNotFound(false);
    setAccessError(null);

    // Clear any stale client-side PIN requirement flags
    try {
      localStorage.removeItem('pinRequired');
      localStorage.removeItem('cafe_pin_required');
      localStorage.removeItem(`cafe_pin_required_${tableCode}`);
      sessionStorage.removeItem('pinRequired');
      sessionStorage.removeItem('cafe_pin_required');
      sessionStorage.removeItem(`cafe_pin_required_${tableCode}`);
    } catch {}

    const savedToken =
      localStorage.getItem(`cafe_session_${tableCode}`) ||
      sessionStorage.getItem(`cafe_session_${tableCode}`);
    const savedSessionId =
      localStorage.getItem(`cafe_session_id_${tableCode}`) ||
      sessionStorage.getItem(`cafe_session_id_${tableCode}`);
    const savedTableNum =
      localStorage.getItem(`cafe_table_num_${tableCode}`) ||
      sessionStorage.getItem(`cafe_table_num_${tableCode}`);

    try {
      const queryParams = new URLSearchParams({
        table_code: tableCode,
      });
      if (savedSessionId) queryParams.set('session_id', savedSessionId);
      if (savedToken) queryParams.set('session_token', savedToken);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(apiUrl(`/api/table/session?${queryParams.toString()}`), {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();

      if (res.status === 404 || data?.access === 'not_found') {
        setTableNotFound(true);
        setIsPinVerified(false);
        return;
      }

      if (!res.ok || !data?.success) {
        setAccessError(data?.message || 'Unable to verify table access. Please retry.');
        return;
      }

      if (data.access === 'granted' || data.active) {
        const token = data.session_token || savedToken;
        const sessId = data.session_id || savedSessionId;
        const tblNum = data.table_number || savedTableNum || `Table ${tableCode}`;

        setSessionToken(token);
        setSessionId(sessId);
        setTableNumber(tblNum);
        setIsPinVerified(true);

        try {
          if (token) {
            localStorage.setItem(`cafe_session_${tableCode}`, token);
            sessionStorage.setItem(`cafe_session_${tableCode}`, token);
          }
          if (sessId) {
            localStorage.setItem(`cafe_session_id_${tableCode}`, sessId);
            sessionStorage.setItem(`cafe_session_id_${tableCode}`, sessId);
          }
          localStorage.setItem(`cafe_table_num_${tableCode}`, tblNum);
          sessionStorage.setItem(`cafe_table_num_${tableCode}`, tblNum);
        } catch {}
      } else {
        if (data.table_number) setTableNumber(data.table_number);
        setIsPinVerified(false);
        try {
          localStorage.removeItem(`cafe_session_${tableCode}`);
          localStorage.removeItem(`cafe_session_id_${tableCode}`);
          sessionStorage.removeItem(`cafe_session_${tableCode}`);
          sessionStorage.removeItem(`cafe_session_id_${tableCode}`);
        } catch {}
      }
    } catch {
      if (savedToken && savedSessionId) {
        setSessionToken(savedToken);
        setSessionId(savedSessionId);
        setIsPinVerified(true);
      } else {
        setAccessError('Connection error while checking table access. Please retry.');
      }
    } finally {
      setIsCheckingSession(false);
    }
  }, [tableCode]);

  // Initialize Anonymous Auth, device_id, saved cart, and open table session
  useEffect(() => {
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

    let id = localStorage.getItem('cafe_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('cafe_device_id', id);
    }
    setDeviceId(id);

    // Restore unsent cart items for this table on refresh
    try {
      const savedCart = sessionStorage.getItem(`cafe_cart_${tableCode}`);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {}

    checkExistingSession();
  }, [tableCode, checkExistingSession]);

  // Persist cart cleanly across accidental refreshes
  useEffect(() => {
    try {
      if (cart.length > 0) {
        sessionStorage.setItem(`cafe_cart_${tableCode}`, JSON.stringify(cart));
      } else {
        sessionStorage.removeItem(`cafe_cart_${tableCode}`);
      }
    } catch {}
  }, [cart, tableCode]);

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

  // Handle PIN verification with unlock animation
  async function handleVerifyPin(e?: React.FormEvent, pinToVerify?: string) {
    if (e) e.preventDefault();
    if (verifyingPin || pinUnlockSuccess) return;
    const targetPin = pinToVerify !== undefined ? pinToVerify : pin;
    if (targetPin.length !== 4) {
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(apiUrl('/api/table/verify-pin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_code: tableCode, pin: targetPin, device_id: deviceId }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (data.locked) {
        triggerHaptic([70, 40, 70]);
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
        triggerHaptic([60, 40, 60]);
        setPinError(data.message || defaultInvalidMsg);
        setPin('');
        return;
      }

      // Brief emerald unlock celebration before opening menu
      triggerHaptic([35, 35, 65]);
      setPinUnlockSuccess(true);

      setSessionToken(data.session_token);
      setSessionId(data.session_id);
      const tableNum = data.table_number || `Table ${tableCode}`;
      setTableNumber(tableNum);

      try {
        localStorage.setItem(`cafe_session_${tableCode}`, data.session_token);
        localStorage.setItem(`cafe_session_id_${tableCode}`, data.session_id);
        localStorage.setItem(`cafe_table_num_${tableCode}`, tableNum);

        sessionStorage.setItem(`cafe_session_${tableCode}`, data.session_token);
        sessionStorage.setItem(`cafe_session_id_${tableCode}`, data.session_id);
        sessionStorage.setItem(`cafe_table_num_${tableCode}`, tableNum);
      } catch {}

      setTimeout(() => {
        setPinUnlockSuccess(false);
        setIsPinVerified(true);
      }, 420);
    } catch (err: unknown) {
      triggerHaptic([60, 40, 60]);
      if (err instanceof Error && err.name === 'AbortError') {
        setPinError(
          language === 'hi'
            ? 'कनेक्शन टाइम आउट। कृपया इंटरनेट जांचें और फिर प्रयास करें।'
            : 'Connection timed out. Please check your internet and try again.'
        );
      } else {
        setPinError(defaultInvalidMsg);
      }
    } finally {
      clearTimeout(timeoutId);
      setVerifyingPin(false);
    }
  }

  // Keypad button press handler with haptic feedback & auto-submit on 4th digit
  function handleKeypadPress(btn: string) {
    if (verifyingPin || pinUnlockSuccess) return;
    triggerHaptic(35);
    if (btn === 'C') {
      setPin('');
      setPinError(null);
    } else if (btn === 'DEL' || btn === '⌫') {
      setPin(prev => prev.slice(0, -1));
      setPinError(null);
    } else {
      if (pin.length < 4) {
        const nextPin = pin + btn;
        setPin(nextPin);
        setPinError(null);
        if (nextPin.length === 4) {
          handleVerifyPin(undefined, nextPin);
        }
      }
    }
  }

  const keyboardActionsRef = useRef<{
    press: (btn: string) => void;
    submit: () => void;
    pinLen: number;
  }>({
    press: () => {},
    submit: () => {},
    pinLen: 0,
  });

  useEffect(() => {
    keyboardActionsRef.current = {
      press: handleKeypadPress,
      submit: () => handleVerifyPin(),
      pinLen: pin.length,
    };
  });

  // Desktop physical keyboard support for PIN entry & Escape modal close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (selectedDish) {
          setSelectedDish(null);
          return;
        }
        if (isCartOpen && !orderingInProgress) {
          setIsCartOpen(false);
          return;
        }
      }

      if (isPinVerified || isCheckingSession || isSessionEnded || isLocked) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        keyboardActionsRef.current.press(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        keyboardActionsRef.current.press('DEL');
      } else if (e.key === 'Delete') {
        e.preventDefault();
        keyboardActionsRef.current.press('C');
      } else if (e.key === 'Enter' && keyboardActionsRef.current.pinLen === 4) {
        e.preventDefault();
        keyboardActionsRef.current.submit();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPinVerified, isCheckingSession, isSessionEnded, isLocked, selectedDish, isCartOpen, orderingInProgress]);

  // Fetch Menu, Categories, and Settings (Stale-While-Revalidate with sessionStorage)
  const refreshMenu = React.useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        const cachedCats = sessionStorage.getItem('cafe_cached_categories');
        const cachedItems = sessionStorage.getItem('cafe_cached_items');
        if (cachedCats) setCategories(JSON.parse(cachedCats));
        if (cachedItems) setMenuItems(JSON.parse(cachedItems));
      } catch {}
    }

    const supabase = createClient();
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (catData) {
      setCategories(catData);
      try {
        sessionStorage.setItem('cafe_cached_categories', JSON.stringify(catData));
      } catch {}
    }

    const { data: itemsData } = await supabase
      .from('menu_items')
      .select('*')
      .order('name_en', { ascending: true });
    if (itemsData) {
      setMenuItems(itemsData);
      try {
        sessionStorage.setItem('cafe_cached_items', JSON.stringify(itemsData));
      } catch {}
    }

    const { data: settingsData } = await supabase
      .from('manager_settings')
      .select('cafe_name, gst_rate_percent, cafe_tagline')
      .eq('id', 1)
      .maybeSingle();

    if (settingsData) {
      if (settingsData.cafe_name) setCafeName(settingsData.cafe_name);
      setGstRatePercent(Number(settingsData.gst_rate_percent) || 5.0);
      try {
        if (settingsData.cafe_tagline?.trim().startsWith('{')) {
          const meta = JSON.parse(settingsData.cafe_tagline);
          if (meta.tax_enabled !== undefined) {
            setTaxEnabled(Boolean(meta.tax_enabled));
          }
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    refreshMenu();
  }, [refreshMenu]);

  // Realtime Menu Item Updates
  useEffect(() => {
    if (!isPinVerified) return;

    const supabase = createClient();
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
  }, [isPinVerified]);

  // Fetch and Subscribe to Table Shared Orders & Session Status
  useEffect(() => {
    if (!isPinVerified || !sessionId) return;

    const supabase = createClient();

    async function fetchOrders() {
      if (!sessionId || !sessionToken) return;
      try {
        const res = await fetch(
          apiUrl(`/api/table/orders?sessionId=${encodeURIComponent(sessionId)}&sessionToken=${encodeURIComponent(sessionToken)}`),
          { cache: 'no-store' }
        );
        const result = await res.json();
        if (result.success && Array.isArray(result.orders)) {
          setTableOrders(result.orders as Order[]);
        }
      } catch {}
    }

    fetchOrders();
    const pollInterval = setInterval(fetchOrders, 5000);

    const handleOnline = () => {
      setRealtimeConnected(true);
      fetchOrders();
    };
    const handleOffline = () => setRealtimeConnected(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchOrders();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

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
        () => fetchOrders()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        () => fetchOrders()
      )
      .subscribe(status => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

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
            sessionStorage.removeItem(`cafe_cart_${tableCode}`);
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
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [isPinVerified, sessionId, sessionToken, tableCode]);

  // Cart Helpers
  function addToCart(item: MenuItem, customNote?: string) {
    triggerHaptic(40);
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.item.id === item.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                notes: customNote !== undefined && customNote.trim() ? customNote.trim().slice(0, 150) : i.notes,
              }
            : i
        );
      }
      return [...prev, { item, quantity: 1, notes: (customNote || '').trim().slice(0, 150) }];
    });
  }

  function updateQuantity(itemId: string, delta: number) {
    triggerHaptic(delta > 0 ? 35 : 55);
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
    setCart(prev => prev.map(i => (i.item.id === itemId ? { ...i, notes } : i)));
  }

  function appendNotePreset(itemId: string, currentNote: string, presetText: string) {
    triggerHaptic(20);
    const trimmed = currentNote.trim();
    if (trimmed.toLowerCase().includes(presetText.toLowerCase())) return;
    const next = trimmed ? `${trimmed}, ${presetText}` : presetText;
    updateItemNotes(itemId, next.slice(0, 150));
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const gstAmount = useMemo(() => {
    return taxEnabled ? Math.round(((cartTotal * gstRatePercent) / 100) * 100) / 100 : 0;
  }, [cartTotal, taxEnabled, gstRatePercent]);

  const grandTotal = cartTotal + gstAmount;

  // Submit Order
  async function handlePlaceOrder() {
    if ((!sessionToken && !sessionId) || cart.length === 0) return;

    triggerHaptic([40, 60, 40]);
    setOrderingInProgress(true);
    setCartError(null);

    try {
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
          localStorage.removeItem(`cafe_session_${tableCode}`);
          localStorage.removeItem(`cafe_session_id_${tableCode}`);
          sessionStorage.removeItem(`cafe_session_${tableCode}`);
          sessionStorage.removeItem(`cafe_session_id_${tableCode}`);
          setCartError(
            language === 'hi'
              ? 'टेबल सत्र समाप्त हो गया था। कृपया पुनः प्रयास करें।'
              : 'Session ended or refreshed. Please tap Place Order again.'
          );
          await checkExistingSession();
        } else if (isUnavailable) {
          setCartError(
            language === 'hi'
              ? 'कुछ आइटम आज उपलब्ध नहीं हैं। मेनू को अपडेट कर दिया गया है।'
              : msg || 'One or more items became unavailable today. Menu has been refreshed.'
          );
          await refreshMenu();
        } else {
          setCartError(msg || (language === 'hi' ? 'ऑर्डर भेजने में त्रुटि।' : 'Failed to place order.'));
          await refreshMenu();
        }
      } else {
        triggerHaptic([60, 50, 100]);
        setCart([]);
        sessionStorage.removeItem(`cafe_cart_${tableCode}`);
        setIsCartOpen(false);
        setCartError(null);
        setActiveTab('orders');

        try {
          confetti({
            particleCount: 65,
            spread: 70,
            origin: { y: 0.72 },
            colors: ['#f59e0b', '#10b981', '#fbbf24', '#ffffff'],
          });
        } catch {}

        setOrderSuccessMessage(
          language === 'hi'
            ? 'ऑर्डर सफलतापूर्वक भेजा गया! किचन में तैयारी शुरू हो गई है।'
            : 'Order placed! Sent straight to the kitchen.'
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

  // Filtered & Sorted Menu Items
  const filteredItems = useMemo(() => {
    const list = menuItems.filter(item => {
      if (!isItemInMealWindow(item)) return false;
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
      if (dietFilter === 'veg' && !item.is_veg) return false;
      if (dietFilter === 'nonveg' && item.is_veg) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          item.name_en.toLowerCase().includes(query) ||
          item.name_hi.toLowerCase().includes(query)
        );
      }

      return true;
    });

    if (sortBy === 'price_asc') return [...list].sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [menuItems, selectedCategory, dietFilter, searchQuery, sortBy]);

  const hasReadyOrder = useMemo(
    () => tableOrders.some(o => o.status === 'READY'),
    [tableOrders]
  );

  // -------------------------------------------------------------
  // FULL-SCREEN: SESSION ENDED NOTIFICATION
  // -------------------------------------------------------------
  if (isSessionEnded) {
    return (
      <div className="min-h-[100dvh] bg-linear-to-b from-[#fdf8f0] via-white to-amber-50 flex flex-col justify-center items-center px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center animate-fade-in">
        <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-amber-200/70 p-6 sm:p-8 flex flex-col items-center animate-scale-up">
          <div className="w-20 h-20 bg-linear-to-br from-emerald-500 to-emerald-600 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30 animate-float">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight mb-2">
            {language === 'hi' ? 'धन्यवाद! फिर पधारें' : 'Session Ended. Thank You!'}
          </h1>

          <p className="text-sm text-stone-600 mb-6 leading-relaxed">
            {language === 'hi'
              ? `${tableNumber} का बिल काउंटर पर पूरा हो चुका है। हमारे साथ भोजन करने के लिए धन्यवाद!`
              : `Your dining session at ${tableNumber} has been settled at the counter. Thank you for dining with ${cafeName}!`}
          </p>

          <div className="w-full p-4 bg-amber-50/90 rounded-2xl border border-amber-200 text-xs text-amber-950 font-medium mb-6 text-left space-y-1.5">
            <div className="flex items-center gap-2 font-black text-amber-950">
              <Coffee className="w-4 h-4 text-amber-600" />
              <span>{language === 'hi' ? 'लॉयल्टी रिवॉर्ड' : 'Loyalty Rewards'}</span>
            </div>
            <p className="text-amber-900/80">
              {language === 'hi'
                ? 'प्रत्येक 5 विज़िट के बाद, आपकी अगली विज़िट (6, 11, 16...) पर 1 मुफ़्त कॉफ़ी मिलती है!'
                : 'After every 5 visits, your next visit earns 1 Free Coffee!'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(30);
              setIsSessionEnded(false);
              setPin('');
              setPinError(null);
              checkExistingSession();
            }}
            className="w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-amber-500/25 transition cursor-pointer touch-manipulation"
          >
            {language === 'hi' ? 'नया सत्र शुरू करें' : 'Start Fresh Session'}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN -1: TABLE NOT FOUND OR ACCESS ERROR
  // -------------------------------------------------------------
  if (tableNotFound) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#faf7f2] flex flex-col items-center justify-center px-5 text-center">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-stone-200 p-7 space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-xl font-black text-stone-900">Table not found</h1>
          <p className="text-xs text-stone-500">
            Table code <span className="font-mono font-bold">{tableCode}</span> is invalid or inactive. Please scan a valid table QR code.
          </p>
        </div>
      </div>
    );
  }

  if (accessError && !isPinVerified && !isCheckingSession) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#faf7f2] flex flex-col items-center justify-center px-5 text-center">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-stone-200 p-7 space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-lg font-black text-stone-900">Connection Issue</h1>
          <p className="text-xs text-stone-500">{accessError}</p>
          <button
            type="button"
            onClick={() => checkExistingSession()}
            className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 0: SESSION CHECKING SHIMMER SKELETON (No PIN Flicker)
  // -------------------------------------------------------------
  if (isCheckingSession) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#faf7f2] flex flex-col items-center justify-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] select-none">
        <div className="w-full max-w-md flex flex-col items-center">
          {/* Animated Coffee Emblem with subtle steam */}
          <div className="relative mb-5">
            <div className="flex justify-center gap-1.5 mb-1">
              <span className="w-1 h-3 rounded-full bg-amber-400/70 animate-steam-1" />
              <span className="w-1 h-4 rounded-full bg-amber-500/70 animate-steam-2" />
            </div>
            <div className="w-16 h-16 rounded-3xl bg-linear-to-br from-amber-400 via-orange-500 to-amber-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-amber-500/25 animate-float">
              ☕
            </div>
          </div>

          <h2 className="text-xl font-black text-stone-900 tracking-tight">{cafeName}</h2>
          <div className="inline-flex items-center gap-2 mt-2 mb-8 px-3.5 py-1 rounded-full bg-amber-100/90 border border-amber-200 text-xs font-bold text-amber-950">
            <span>{tableNumber}</span>
            <span>•</span>
            <span className="text-amber-700 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              {language === 'hi' ? 'मेनू तैयार हो रहा है...' : 'Preparing your table...'}
            </span>
          </div>

          {/* Preview shimmer cards so load feels ultra responsive */}
          <div className="w-full space-y-3 opacity-75">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-white rounded-2xl p-3 border border-stone-200/70 flex gap-3 shadow-2xs">
                <div className="w-20 h-20 rounded-xl animate-shimmer shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-3/4 rounded-md animate-shimmer" />
                  <div className="h-3 w-full rounded-md animate-shimmer" />
                  <div className="h-4 w-16 rounded-md animate-shimmer mt-2" />
                </div>
              </div>
            ))}
          </div>
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
      <div className="min-h-[100dvh] w-full bg-linear-to-b from-[#fdf8f0] via-[#faf4ea] to-[#f3e8d7] flex flex-col justify-center items-center px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] select-none">
        {/* Top Brand Row */}
        <div className="w-full max-w-sm flex items-center justify-between mb-3.5 px-1 animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/25 shrink-0">
              ☕
            </div>
            <div className="min-w-0">
              <span className="font-black text-sm text-stone-900 block leading-tight truncate">
                {language === 'hi' ? 'ब्रू एंड बाइट्स कैफे' : cafeName}
              </span>
              <span className="text-[11px] font-extrabold text-amber-900 inline-block bg-amber-200/70 px-2 py-0.5 rounded-md mt-0.5">
                {tableNumber}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              setLanguage(language === 'en' ? 'hi' : 'en');
            }}
            className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-200 bg-white/90 shadow-xs text-xs font-extrabold text-stone-800 hover:bg-amber-50 active:scale-95 transition cursor-pointer shrink-0 touch-manipulation"
            title="Toggle Hindi / English"
          >
            <Languages className="w-3.5 h-3.5 text-amber-600" />
            <span>{language === 'en' ? 'हिन्दी' : 'English'}</span>
          </button>
        </div>

        {/* Main PIN Card */}
        <div className="w-full max-w-sm bg-white/95 backdrop-blur-md rounded-[32px] shadow-[0_20px_50px_-12px_rgba(120,53,15,0.18)] border border-amber-200/60 overflow-hidden animate-scale-up">
          {/* Top Accent Ribbon */}
          <div className="h-1.5 w-full bg-linear-to-r from-amber-400 via-orange-500 to-amber-500" />

          <div className="p-5 sm:p-7 text-center flex flex-col">
            {/* Dynamic Lock -> Check Emblem */}
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-lg transition-all duration-300 ${
                pinUnlockSuccess
                  ? 'bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30 scale-110'
                  : pinError
                  ? 'bg-linear-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/30 animate-shake'
                  : 'bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/25'
              }`}
            >
              {pinUnlockSuccess ? (
                <Unlock className="w-6 h-6 animate-pop" />
              ) : (
                <Lock className="w-6 h-6" />
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              {pinUnlockSuccess
                ? language === 'hi'
                  ? 'स्वागत है! मेनू खुल रहा है'
                  : 'Unlocked! Opening Menu'
                : language === 'hi'
                ? `${tableNumber} में स्वागत है`
                : `Welcome to ${tableNumber}`}
            </h1>
            <p className="text-xs text-stone-500 mt-1 mb-5 leading-relaxed font-medium">
              {language === 'hi'
                ? 'मेनू देखने और ऑर्डर शुरू करने के लिए 4-अंकों का पिन डालें'
                : 'Enter the 4-digit table PIN to browse & order'}
            </p>

            {isLocked ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 mb-2 text-left animate-fade-in">
                <div className="flex items-center gap-2 text-rose-700 font-black mb-1 text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>{language === 'hi' ? 'टेबल लॉक है' : 'Table Locked'}</span>
                </div>
                <p className="text-xs text-rose-700/90 mb-3 font-medium leading-normal">
                  {language === 'hi'
                    ? `कई गलत प्रयासों के कारण टेबल ${lockMinutes} मिनट के लिए लॉक है। कृपया स्टाफ से संपर्क करें।`
                    : `Too many wrong attempts. Table is locked for ${lockMinutes} minute(s). Please ask your server.`}
                </p>
                <div className="flex items-center justify-between text-xs font-bold text-rose-800 bg-rose-100/80 p-3 rounded-xl">
                  <span>{language === 'hi' ? 'शेष समय:' : 'Lock countdown:'}</span>
                  <span className="font-mono text-sm font-black">
                    {Math.floor(lockCountdown / 60)}:{(lockCountdown % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 4 Large Digit Display Boxes */}
                <div className={`flex justify-center gap-2.5 sm:gap-3 my-1 ${pinError ? 'animate-shake' : ''}`}>
                  {[0, 1, 2, 3].map(index => {
                    const digit = pin[index];
                    const isActive = index === pin.length && !verifyingPin && !pinUnlockSuccess;
                    return (
                      <div
                        key={index}
                        className={`w-13 h-14 sm:w-15 sm:h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-black select-none transition-all duration-200 ${
                          pinUnlockSuccess
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 scale-105 ring-4 ring-emerald-500/15'
                            : pinError
                            ? 'border-rose-400 bg-rose-50/70 text-rose-700'
                            : digit
                            ? 'border-amber-500 bg-amber-50/80 text-stone-900 scale-105 shadow-xs ring-4 ring-amber-500/15 animate-pop'
                            : isActive
                            ? 'border-amber-400 bg-white ring-4 ring-amber-400/20'
                            : 'border-stone-200 bg-stone-50/80 text-stone-300'
                        }`}
                      >
                        {digit ? (
                          <span>{digit}</span>
                        ) : isActive ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Error Message */}
                {pinError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold leading-relaxed animate-fade-in">
                    {pinError}
                  </div>
                )}

                {/* Tactile Raised Virtual Keypad */}
                <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'DEL'].map(btn => {
                    const isClear = btn === 'C';
                    const isDelete = btn === 'DEL';

                    return (
                      <button
                        key={btn}
                        type="button"
                        disabled={verifyingPin || pinUnlockSuccess}
                        onClick={() => handleKeypadPress(btn)}
                        className={`min-h-[50px] sm:h-13 rounded-2xl font-black text-xl transition-all duration-100 flex items-center justify-center cursor-pointer select-none disabled:opacity-50 active:translate-y-[2px] active:shadow-none touch-manipulation ${
                          isClear
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/80 shadow-[0_3px_0_0_rgba(225,29,72,0.12)]'
                            : isDelete
                            ? 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/80 shadow-[0_3px_0_0_rgba(217,119,6,0.14)]'
                            : 'bg-stone-50 hover:bg-amber-50/60 text-stone-900 border border-stone-200/90 shadow-[0_3px_0_0_rgba(28,25,23,0.08)] active:bg-amber-100'
                        }`}
                      >
                        {isDelete ? (
                          <Delete className="w-5 h-5 text-amber-900" />
                        ) : isClear ? (
                          <span className="text-base font-black">C</span>
                        ) : (
                          btn
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Open Menu CTA */}
                <button
                  type="button"
                  disabled={pin.length !== 4 || verifyingPin || pinUnlockSuccess}
                  onClick={() => {
                    triggerHaptic(40);
                    handleVerifyPin();
                  }}
                  className="w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-linear-to-r from-stone-900 to-stone-800 hover:from-stone-800 hover:to-stone-900 active:scale-[0.98] text-amber-400 font-black text-sm shadow-lg shadow-stone-900/20 transition-all disabled:opacity-40 disabled:shadow-none cursor-pointer flex items-center justify-center gap-2 touch-manipulation"
                >
                  {verifyingPin ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>{language === 'hi' ? 'सत्यापित हो रहा है...' : 'Verifying PIN...'}</span>
                    </>
                  ) : pinUnlockSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">{language === 'hi' ? 'खुल रहा है!' : 'Unlocked!'}</span>
                    </>
                  ) : (
                    <>
                      <span>{language === 'hi' ? 'मेनू खोलें' : 'Open Menu'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="hidden sm:block text-[10px] text-stone-400 font-semibold">
                  {language === 'hi'
                    ? 'टिप: आप डेस्कटॉप कीबोर्ड (0–9, Backspace, Enter) से भी पिन डाल सकते हैं'
                    : 'Tip: You can also type using your desktop keyboard (0–9, Backspace)'}
                </p>
              </div>
            )}

            <p className="text-[11px] text-stone-400 mt-3.5 leading-normal font-medium">
              {language === 'hi'
                ? 'पिन के लिए अपने सर्वर या कैफे मैनेजर से संपर्क करें।'
                : 'Ask your server or manager for the 4-digit PIN.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 2: ACTIVE TABLE MENU, CHECKOUT & ORDER TRACKING
  // -------------------------------------------------------------
  return (
    <div className="min-h-[100dvh] bg-[#faf7f2] pb-[calc(8.5rem+env(safe-area-inset-bottom))] lg:pb-16 text-stone-900 font-sans">
      {/* Top Sticky Glassmorphic Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-3.5 sm:px-5 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 shadow-2xs">
        <div className="max-w-3xl lg:max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Brand Logo, Name, Crisp Non-Wrapping Table Chip & Connection Dot */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
              ☕
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-black text-sm sm:text-base text-stone-900 truncate tracking-tight">
                  {language === 'hi' ? 'ब्रू एंड बाइट्स' : cafeName}
                </span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-200/90 whitespace-nowrap shrink-0">
                  {tableNumber}
                </span>
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 leading-none mt-0.5 whitespace-nowrap ${
                  realtimeConnected ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-ping'
                  }`}
                />
                <span>
                  {realtimeConnected
                    ? language === 'hi'
                      ? 'लाइव ऑर्डरिंग चालू'
                      : 'Live Table Ordering'
                    : language === 'hi'
                    ? 'पुनः कनेक्ट हो रहा है...'
                    : 'Reconnecting...'}
                </span>
              </span>
            </div>
          </div>

          {/* Right: Language Switcher & Compact Call Waiter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setLanguage(language === 'en' ? 'hi' : 'en');
              }}
              className="min-h-[38px] flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-extrabold text-stone-700 hover:bg-stone-100 active:scale-95 transition cursor-pointer whitespace-nowrap touch-manipulation"
              title="Toggle Hindi / English"
            >
              <Languages className="w-3.5 h-3.5 text-amber-600" />
              <span>{language === 'en' ? 'हिन्दी' : 'EN'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(25);
                setIsCallWaiterOpen(true);
              }}
              className="min-h-[38px] flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-extrabold shadow-xs active:scale-95 transition cursor-pointer whitespace-nowrap touch-manipulation"
            >
              <Bell className="w-3.5 h-3.5 animate-bounce" />
              <span className="hidden sm:inline">{t('common.callWaiter', 'Call Waiter')}</span>
              <span className="sm:hidden">{language === 'hi' ? 'वेटर' : 'Waiter'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Smooth Toast Notification on Order Placement */}
      {orderSuccessMessage && (
        <div className="fixed top-[calc(4.5rem+env(safe-area-inset-top))] sm:top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm bg-linear-to-r from-emerald-600 to-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl shadow-emerald-950/20 text-xs font-bold flex items-center justify-between gap-3 border border-emerald-400/40 animate-fade-in-up">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="leading-snug text-white">{orderSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setOrderSuccessMessage(null)}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white shrink-0 cursor-pointer touch-manipulation"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Segmented Tab Bar: Menu vs Orders */}
      <div className="max-w-3xl lg:max-w-6xl mx-auto px-3.5 sm:px-5 pt-3">
        <div className="bg-stone-200/75 p-1 rounded-2xl flex items-center text-xs font-extrabold shadow-inner max-w-md mx-auto lg:mx-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('menu');
            }}
            className={`flex-1 min-h-[40px] py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation ${
              activeTab === 'menu'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <UtensilsCrossed className={`w-4 h-4 ${activeTab === 'menu' ? 'text-amber-600' : 'text-stone-500'}`} />
            <span>{language === 'hi' ? 'मेनू' : 'Menu'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('orders');
            }}
            className={`flex-1 min-h-[40px] py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation ${
              activeTab === 'orders'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ClipboardList className={`w-4 h-4 ${activeTab === 'orders' ? 'text-amber-600' : 'text-stone-500'}`} />
            <span>{language === 'hi' ? 'ऑर्डर्स' : 'Orders'}</span>
            {tableOrders.length > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all ${
                  hasReadyOrder
                    ? 'bg-blue-600 text-white animate-pulse'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {tableOrders.reduce((sum, o) => sum + (o.order_items?.length || 0), 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-3xl lg:max-w-6xl mx-auto px-3.5 sm:px-5 pt-3.5 space-y-3.5">
        {activeTab === 'menu' ? (
          <div className="lg:grid lg:grid-cols-12 lg:gap-7 lg:items-start animate-fade-in">
            {/* LEFT / PRIMARY MENU COLUMN */}
            <div className="lg:col-span-8 space-y-3.5">
              {/* Search Input with Instant Clear (iOS text-base to prevent auto-zoom) */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={language === 'hi' ? 'मेनू में खोजें (कॉफ़ी, सैंडविच, चाट)...' : 'Search items, coffee, bites...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 text-base sm:text-sm rounded-2xl border border-stone-200/90 bg-white focus:outline-hidden focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 shadow-2xs transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(15);
                      setSearchQuery('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition cursor-pointer touch-manipulation"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Diet Filter & Price Sort Bar */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                <div className="flex items-center bg-white p-1 rounded-2xl border border-stone-200/90 shadow-2xs shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      setDietFilter('all');
                    }}
                    className={`min-h-[34px] px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer touch-manipulation ${
                      dietFilter === 'all'
                        ? 'bg-stone-900 text-amber-400 shadow-xs'
                        : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    {language === 'hi' ? 'सभी' : 'All'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      setDietFilter('veg');
                    }}
                    className={`min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer touch-manipulation ${
                      dietFilter === 'veg'
                        ? 'bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/35'
                        : 'text-stone-600 hover:text-emerald-700'
                    }`}
                  >
                    <VegNonVegBadge isVeg={true} size="sm" />
                    <span>{language === 'hi' ? 'वेज़' : 'Veg'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      setDietFilter('nonveg');
                    }}
                    className={`min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer touch-manipulation ${
                      dietFilter === 'nonveg'
                        ? 'bg-rose-50 text-rose-800 ring-2 ring-rose-500/35'
                        : 'text-stone-600 hover:text-rose-700'
                    }`}
                  >
                    <VegNonVegBadge isVeg={false} size="sm" />
                    <span>{language === 'hi' ? 'नॉन-वेज़' : 'Non-Veg'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      setSortBy(
                        sortBy === 'recommended'
                          ? 'price_asc'
                          : sortBy === 'price_asc'
                          ? 'price_desc'
                          : 'recommended'
                      );
                    }}
                    className={`min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold transition shadow-2xs cursor-pointer whitespace-nowrap touch-manipulation ${
                      sortBy !== 'recommended'
                        ? 'bg-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-400/20'
                        : 'bg-white border-stone-200/90 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      {sortBy === 'price_asc'
                        ? language === 'hi'
                          ? 'कम से ज्यादा'
                          : 'Price: Low → High'
                        : sortBy === 'price_desc'
                        ? language === 'hi'
                          ? 'ज्यादा से कम'
                          : 'Price: High → Low'
                        : language === 'hi'
                        ? 'कीमत क्रम'
                        : 'Sort Price'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Category Chips (Horizontal scroll on phone, clean wrap on desktop) */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none lg:flex-wrap lg:overflow-visible snap-x">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setSelectedCategory('all');
                  }}
                  className={`min-h-[36px] px-4 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all shadow-2xs cursor-pointer active:scale-95 snap-start touch-manipulation ${
                    selectedCategory === 'all'
                      ? 'bg-linear-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20'
                      : 'bg-white text-stone-700 border border-stone-200/90 hover:border-amber-300'
                  }`}
                >
                  {language === 'hi' ? 'सभी आइटम' : 'All Items'}
                </button>
                {categories.map(cat => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => {
                      triggerHaptic(20);
                      setSelectedCategory(cat.id);
                    }}
                    className={`min-h-[36px] px-4 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all shadow-2xs cursor-pointer active:scale-95 snap-start touch-manipulation ${
                      selectedCategory === cat.id
                        ? 'bg-linear-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20'
                        : 'bg-white text-stone-700 border border-stone-200/90 hover:border-amber-300'
                    }`}
                  >
                    {language === 'hi' ? cat.name_hi : cat.name_en}
                  </button>
                ))}
              </div>

              {/* Live Table Order Activity Quick Card */}
              {tableOrders.length > 0 && (
                <div
                  onClick={() => {
                    triggerHaptic(25);
                    setIsLiveOrdersOpen(true);
                  }}
                  className="p-3.5 bg-linear-to-r from-stone-900 via-stone-900 to-amber-950 text-white border border-amber-500/30 rounded-2xl flex items-center justify-between cursor-pointer shadow-md hover:border-amber-400 active:scale-[0.99] transition touch-manipulation"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
                      {tableOrders.reduce((sum, o) => sum + (o.order_items?.length || 0), 0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-white flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <span className="truncate">
                          {language === 'hi' ? 'टेबल के लाइव ऑर्डर' : 'Shared Table Live Activity'}
                        </span>
                      </p>
                      <p className="text-[11px] text-stone-300 truncate mt-0.5">
                        {hasReadyOrder
                          ? language === 'hi'
                            ? 'आपका ऑर्डर परोसने के लिए तैयार है!'
                            : 'An order is Ready to Serve at your table!'
                          : language === 'hi'
                          ? 'किचन स्टेटस देखने के लिए टैप करें'
                          : 'Tap to track kitchen progress in realtime'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-amber-400 shrink-0 ml-2 flex items-center gap-1">
                    <span>{language === 'hi' ? 'देखें' : 'Track'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              )}

              {/* Menu Items Grid with Staggered Entrance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-0.5">
                {filteredItems.map((item, idx) => {
                  const isAvailable = isItemAvailableToday(item);
                  const cartQty = cart.find(c => c.item.id === item.id)?.quantity || 0;

                  const primaryName = language === 'hi' ? item.name_hi : item.name_en;
                  const secondaryName = language === 'hi' ? item.name_en : item.name_hi;
                  const description =
                    language === 'hi'
                      ? item.description_hi || item.description_en
                      : item.description_en || item.description_hi;

                  return (
                    <div
                      key={item.id}
                      style={{ animationDelay: `${Math.min(idx * 35, 240)}ms` }}
                      className={`bg-white rounded-2xl border p-3 flex gap-3 shadow-2xs transition-all relative overflow-hidden animate-fade-in-up ${
                        !isAvailable
                          ? 'opacity-65 grayscale-[35%] bg-stone-50 border-stone-200 border-dashed'
                          : cartQty > 0
                          ? 'border-amber-400 ring-2 ring-amber-500/15 shadow-sm'
                          : 'border-stone-200/80 hover:border-amber-300 sm:hover:shadow-md sm:hover:-translate-y-0.5'
                      }`}
                    >
                      {/* Dish Thumbnail (Tap opens Quick View Sheet) */}
                      <button
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => {
                          triggerHaptic(20);
                          const existingCartNote = cart.find(c => c.item.id === item.id)?.notes || '';
                          setDishModalNote(existingCartNote);
                          setSelectedDish(item);
                        }}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-amber-50/70 relative flex items-center justify-center border border-stone-100 cursor-pointer disabled:cursor-default group touch-manipulation"
                      >
                        {item.image_url && !failedImages[item.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_url}
                            alt={primaryName}
                            loading="lazy"
                            onError={() => setFailedImages(prev => ({ ...prev, [item.id]: true }))}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-amber-600/70 bg-amber-50/80 p-2 text-center">
                            <UtensilsCrossed className="w-6 h-6 text-amber-500 mb-1" />
                            <span className="text-[10px] font-bold text-amber-700/60 leading-none">
                              Brew &amp; Bites
                            </span>
                          </div>
                        )}

                        {/* Corner In-Cart Quantity Badge */}
                        {cartQty > 0 && isAvailable && (
                          <span
                            key={cartQty}
                            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-lg bg-stone-900/90 text-amber-400 text-[10px] font-black shadow-md animate-pop"
                          >
                            {cartQty}×
                          </span>
                        )}

                        {/* Unavailable Overlay */}
                        {!isAvailable && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-1.5 text-center">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider leading-tight">
                              {language === 'hi' ? 'आज उपलब्ध नहीं है' : 'Sold Out Today'}
                            </span>
                          </div>
                        )}
                      </button>

                      {/* Dish Details & Price */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div
                          onClick={() => {
                            if (!isAvailable) return;
                            triggerHaptic(20);
                            const existingCartNote = cart.find(c => c.item.id === item.id)?.notes || '';
                            setDishModalNote(existingCartNote);
                            setSelectedDish(item);
                          }}
                          className={isAvailable ? 'cursor-pointer' : ''}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-start gap-1.5 min-w-0">
                              <span className="mt-0.5 shrink-0">
                                <VegNonVegBadge isVeg={item.is_veg} size="sm" />
                              </span>
                              <h3 className="font-extrabold text-sm text-stone-900 leading-snug line-clamp-1">
                                {primaryName}
                              </h3>
                            </div>
                          </div>

                          <p className="text-[11px] text-stone-400 font-medium line-clamp-1 ml-5">
                            {secondaryName}
                          </p>

                          {description && (
                            <p className="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed">
                              {description}
                            </p>
                          )}
                        </div>

                        {/* Price & Stepper Row */}
                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-stone-100">
                          <span className="text-base font-black text-stone-900 font-mono">
                            ₹{item.price}
                          </span>

                          {isAvailable ? (
                            cartQty > 0 ? (
                              <div className="flex items-center gap-1 bg-stone-900 text-white rounded-xl p-1 shadow-sm animate-pop">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="w-8 h-8 flex items-center justify-center font-bold hover:bg-stone-800 active:scale-90 rounded-lg text-amber-400 transition cursor-pointer touch-manipulation"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span key={cartQty} className="text-xs font-black w-5 text-center text-white animate-pop font-mono">
                                  {cartQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="w-8 h-8 flex items-center justify-center font-bold bg-amber-500 hover:bg-amber-400 active:scale-90 text-stone-950 rounded-lg transition cursor-pointer touch-manipulation"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-500 hover:text-white active:scale-95 text-amber-900 border border-amber-200 text-xs font-extrabold transition flex items-center gap-1 shadow-2xs cursor-pointer touch-manipulation"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{language === 'hi' ? 'जोड़ें' : 'Add'}</span>
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="px-2.5 py-1.5 rounded-xl bg-stone-100 text-stone-400 text-[11px] font-bold cursor-not-allowed border border-stone-200 flex items-center gap-1"
                            >
                              <Ban className="w-3 h-3 shrink-0" />
                              <span>{language === 'hi' ? 'उपलब्ध नहीं' : 'Unavailable'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredItems.length === 0 && (
                <div className="py-12 px-6 text-center bg-white rounded-3xl border border-stone-200/80 shadow-2xs animate-fade-in">
                  <UtensilsCrossed className="w-10 h-10 mx-auto mb-2.5 text-stone-300" />
                  <p className="text-sm font-bold text-stone-600">
                    {language === 'hi' ? 'कोई व्यंजन नहीं मिला।' : 'No dishes match your filters.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setDietFilter('all');
                      setSortBy('recommended');
                    }}
                    className="mt-3 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-extrabold transition cursor-pointer touch-manipulation"
                  >
                    {language === 'hi' ? 'सभी फ़िल्टर हटाएं' : 'Reset All Filters'}
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT DESKTOP STICKY ORDER CART PANEL */}
            <aside className="hidden lg:block lg:col-span-4 lg:sticky lg:top-[calc(5.25rem+env(safe-area-inset-top))]">
              <div className="bg-white rounded-3xl border border-stone-200/90 shadow-lg overflow-hidden flex flex-col">
                {/* Panel Header */}
                <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between border-b border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm tracking-tight">
                        {language === 'hi' ? 'आपकी कार्ट' : 'Your Order Cart'}
                      </h3>
                      <p className="text-[11px] text-stone-400 font-medium">
                        {tableNumber} • {cartItemCount} {language === 'hi' ? 'आइटम' : cartItemCount === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>

                  {cart.length > 0 && (
                    <button
                      type="button"
                      disabled={orderingInProgress}
                      onClick={() => {
                        triggerHaptic(45);
                        setCart([]);
                      }}
                      className="text-[11px] font-bold text-rose-300 hover:text-rose-200 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer"
                    >
                      {language === 'hi' ? 'साफ करें' : 'Clear'}
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="p-7 text-center flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-500 flex items-center justify-center mb-3">
                      <ShoppingBag className="w-7 h-7" />
                    </div>
                    <h4 className="font-black text-sm text-stone-900">
                      {language === 'hi' ? 'आपकी कार्ट खाली है' : 'Your cart is empty'}
                    </h4>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed max-w-[240px]">
                      {language === 'hi'
                        ? 'मेनू से किसी भी डिश पर + जोड़ें दबाकर अपना ऑर्डर शुरू करें।'
                        : 'Click "+ Add" on any item from the menu to start your round.'}
                    </p>
                    {tableOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('orders')}
                        className="mt-4 w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>
                          {language === 'hi'
                            ? `लाइव ऑर्डर देखें (${tableOrders.length})`
                            : `View Table Orders (${tableOrders.length})`}
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="p-4 space-y-2.5 max-h-[42dvh] overflow-y-auto bg-[#faf7f2]">
                      {cartError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold flex items-start gap-2 animate-shake">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <span>{cartError}</span>
                        </div>
                      )}

                      {cart.map(c => (
                        <div
                          key={c.item.id}
                          className="p-3 rounded-2xl border border-stone-200/80 bg-white shadow-2xs space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-1.5 min-w-0">
                              <span className="mt-1 shrink-0">
                                <VegNonVegBadge isVeg={c.item.is_veg} size="sm" />
                              </span>
                              <div className="min-w-0">
                                <p className="font-extrabold text-xs text-stone-900 line-clamp-1">
                                  {language === 'hi' ? c.item.name_hi : c.item.name_en}
                                </p>
                                <span className="text-[10px] text-stone-400 font-mono">
                                  ₹{c.item.price} each
                                </span>
                              </div>
                            </div>
                            <span className="font-black text-xs text-stone-900 font-mono shrink-0">
                              ₹{c.item.price * c.quantity}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                              {NOTE_PRESETS.slice(0, 2).map(preset => {
                                const text = language === 'hi' ? preset.hi : preset.en;
                                const active = c.notes.toLowerCase().includes(text.toLowerCase());
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => appendNotePreset(c.item.id, c.notes, text)}
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap transition cursor-pointer ${
                                      active
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : 'bg-stone-100 text-stone-600 hover:bg-amber-50 border border-stone-200/70'
                                    }`}
                                  >
                                    + {text}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="flex items-center gap-1 bg-stone-900 text-white rounded-xl p-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => updateQuantity(c.item.id, -1)}
                                className="w-7 h-7 flex items-center justify-center hover:bg-stone-800 rounded-lg text-amber-400 transition cursor-pointer"
                                aria-label="Remove or decrease"
                              >
                                {c.quantity === 1 ? <Trash2 className="w-3 h-3 text-rose-400" /> : <Minus className="w-3 h-3" />}
                              </button>
                              <span className="text-xs font-black w-4 text-center font-mono">
                                {c.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(c.item.id, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg transition cursor-pointer"
                                aria-label="Increase"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            maxLength={150}
                            placeholder={language === 'hi' ? 'विशेष निर्देश...' : 'Cooking notes...'}
                            value={c.notes}
                            onChange={e => updateItemNotes(c.item.id, e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-amber-500 transition"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Desktop Summary & Place Order CTA */}
                    <div className="p-4 bg-white border-t border-stone-200 space-y-3">
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-stone-500 font-semibold">
                          <span>{language === 'hi' ? 'आइटम कुल' : 'Items Subtotal'}</span>
                          <span className="font-mono text-stone-800">₹{cartTotal}</span>
                        </div>
                        {taxEnabled && (
                          <div className="flex justify-between text-stone-500 font-semibold">
                            <span>GST ({gstRatePercent}%)</span>
                            <span className="text-emerald-700 font-bold font-mono">+₹{gstAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-sm font-black text-stone-900 pt-1.5 border-t border-dashed border-stone-200">
                          <span>{language === 'hi' ? 'इस राउंड का कुल' : 'Round Total'}</span>
                          <span className="text-amber-700 text-base font-mono">
                            ₹{taxEnabled ? grandTotal.toFixed(2) : cartTotal}
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-[11px] text-amber-950 flex items-center gap-2 font-semibold">
                        <Receipt className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>
                          {language === 'hi'
                            ? 'काउंटर बिलिंग • डाइनिंग के बाद भुगतान'
                            : 'Counter Billing • Settle bill after dining'}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={orderingInProgress || cart.length === 0}
                        onClick={handlePlaceOrder}
                        className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-amber-500/25 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {orderingInProgress ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{language === 'hi' ? 'भेजा जा रहा है...' : 'Sending to Kitchen...'}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>
                              {language === 'hi'
                                ? `ऑर्डर भेजें (₹${taxEnabled ? grandTotal.toFixed(2) : cartTotal})`
                                : `Place Order (₹${taxEnabled ? grandTotal.toFixed(2) : cartTotal})`}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        ) : (
          /* ORDERS TAB: REALTIME TRACKER & TABLE FEED */
          <div className="animate-fade-in">
            <TableOrdersFeed
              orders={tableOrders}
              deviceId={deviceId}
              language={language}
              taxEnabled={taxEnabled}
              gstRatePercent={gstRatePercent}
              onBrowseMenu={() => {
                triggerHaptic(20);
                setActiveTab('menu');
              }}
            />
          </div>
        )}
      </main>

      {/* DISH QUICK-VIEW SHEET MODAL */}
      {selectedDish && (
        <div
          onClick={() => setSelectedDish(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-t-[30px] sm:rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-up sm:animate-scale-up max-h-[90dvh]"
          >
            {/* Mobile Drag Handle Pill */}
            <div className="sm:hidden absolute top-2 inset-x-0 z-20 flex justify-center pointer-events-none">
              <span className="w-10 h-1 rounded-full bg-white/75 shadow-sm" />
            </div>

            {/* Photo Banner */}
            <div className="relative h-52 sm:h-56 bg-amber-50 shrink-0">
              {selectedDish.image_url && !failedImages[selectedDish.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedDish.image_url}
                  alt={selectedDish.name_en}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-amber-500">
                  <UtensilsCrossed className="w-12 h-12 mb-1 opacity-70" />
                  <span className="text-xs font-bold text-amber-700/60">{cafeName}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedDish(null)}
                className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 active:scale-90 flex items-center justify-center transition cursor-pointer touch-manipulation"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {selectedDish.meal_timing !== 'all_day' && (
                <span className="absolute bottom-3 left-3.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-sm text-amber-300 text-[11px] font-bold">
                  <Clock className="w-3 h-3" />
                  <span>
                    {selectedDish.meal_timing === 'breakfast'
                      ? language === 'hi'
                        ? 'नाश्ता विशेष'
                        : 'Breakfast Special'
                      : language === 'hi'
                      ? 'दोपहर विशेष'
                      : 'Lunch Special'}
                  </span>
                </span>
              )}
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="mt-1 shrink-0">
                      <VegNonVegBadge isVeg={selectedDish.is_veg} size="md" />
                    </span>
                    <div>
                      <h3 className="text-lg font-black text-stone-900 leading-snug">
                        {language === 'hi' ? selectedDish.name_hi : selectedDish.name_en}
                      </h3>
                      <p className="text-xs text-stone-400 font-medium">
                        {language === 'hi' ? selectedDish.name_en : selectedDish.name_hi}
                      </p>
                    </div>
                  </div>
                  <span className="text-xl font-black text-stone-900 font-mono shrink-0">
                    ₹{selectedDish.price}
                  </span>
                </div>

                {(selectedDish.description_en || selectedDish.description_hi) && (
                  <p className="text-xs sm:text-sm text-stone-600 mt-2.5 leading-relaxed">
                    {language === 'hi'
                      ? selectedDish.description_hi || selectedDish.description_en
                      : selectedDish.description_en || selectedDish.description_hi}
                  </p>
                )}
              </div>

              {/* Quick Customization Note */}
              <div className="pt-2 border-t border-stone-100 space-y-2">
                <label className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider block">
                  {language === 'hi' ? 'विशेष निर्देश (वैकल्पिक)' : 'Cooking Instructions (Optional)'}
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {NOTE_PRESETS.map(preset => {
                    const text = language === 'hi' ? preset.hi : preset.en;
                    const active = dishModalNote.toLowerCase().includes(text.toLowerCase());
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic(20);
                          if (!active) {
                            const next = dishModalNote.trim()
                              ? `${dishModalNote.trim()}, ${text}`
                              : text;
                            setDishModalNote(next.slice(0, 150));
                          }
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold transition cursor-pointer touch-manipulation ${
                          active
                            ? 'bg-stone-900 text-amber-400'
                            : 'bg-stone-100 hover:bg-amber-50 text-stone-700 border border-stone-200/70'
                        }`}
                      >
                        + {text}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  maxLength={150}
                  value={dishModalNote}
                  onChange={e => setDishModalNote(e.target.value)}
                  placeholder={
                    language === 'hi'
                      ? 'जैसे: कम तीखा, बिना प्याज...'
                      : 'e.g. Less spicy, extra hot, no onions...'
                  }
                  className="w-full text-base sm:text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-amber-500 transition"
                />
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-stone-50 border-t border-stone-200 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  addToCart(selectedDish, dishModalNote);
                  setSelectedDish(null);
                }}
                className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-amber-500/25 transition cursor-pointer flex items-center justify-center gap-2 touch-manipulation"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {language === 'hi'
                    ? `कार्ट में जोड़ें • ₹${selectedDish.price}`
                    : `Add to Cart • ₹${selectedDish.price}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sticky Cart Bar (Phone & Tablet — Desktop uses sticky right sidebar) */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3.5 right-3.5 z-40 max-w-lg mx-auto animate-slide-up">
          <div className="bg-stone-900 text-white p-3 sm:p-3.5 rounded-2xl shadow-[0_14px_35px_-5px_rgba(28,25,23,0.45)] border border-amber-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p
                  key={cartItemCount}
                  className="text-[11px] font-bold text-amber-300 uppercase tracking-wider animate-pop"
                >
                  {cartItemCount}{' '}
                  {cartItemCount === 1
                    ? language === 'hi'
                      ? 'आइटम कार्ट में'
                      : 'item in cart'
                    : language === 'hi'
                    ? 'आइटम कार्ट में'
                    : 'items in cart'}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-base font-black text-white font-mono">₹{cartTotal}</p>
                  {taxEnabled && (
                    <span className="text-[10px] text-stone-400 font-medium">+ GST</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(25);
                setCartError(null);
                setIsCartOpen(true);
              }}
              className="min-h-[42px] py-2.5 px-4 sm:px-5 bg-linear-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 text-stone-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 shrink-0 touch-manipulation"
            >
              <span>{language === 'hi' ? 'कार्ट देखें' : 'Review & Order'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Checkout / Cart Sheet Drawer Modal */}
      {isCartOpen && (
        <div
          onClick={() => !orderingInProgress && setIsCartOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg max-h-[92dvh] rounded-t-[28px] sm:rounded-3xl bg-[#faf7f2] shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-scale-up border border-amber-200/30"
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden bg-stone-900 pt-2.5 pb-1 flex justify-center">
              <span className="w-10 h-1 rounded-full bg-stone-700" />
            </div>

            {/* Sheet Header */}
            <div className="px-5 py-3.5 bg-stone-900 text-white flex items-center justify-between border-b border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight">
                    {language === 'hi' ? 'आपकी कार्ट' : 'Your Order Cart'}
                  </h3>
                  <p className="text-[11px] text-stone-400 font-medium">
                    {tableNumber} • {cartItemCount} {language === 'hi' ? 'आइटम' : cartItemCount === 1 ? 'item' : 'items'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    disabled={orderingInProgress}
                    onClick={() => {
                      triggerHaptic(45);
                      setCart([]);
                      setIsCartOpen(false);
                    }}
                    className="min-h-[34px] text-[11px] font-bold text-rose-300 hover:text-rose-200 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer touch-manipulation"
                  >
                    {language === 'hi' ? 'साफ करें' : 'Clear'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={orderingInProgress}
                  onClick={() => setIsCartOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white transition cursor-pointer touch-manipulation"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cart Items & Bill Breakdown */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {cartError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold flex items-start gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{cartError}</span>
                </div>
              )}

              {cart.map(c => (
                <div
                  key={c.item.id}
                  className="p-3.5 rounded-2xl border border-stone-200/80 bg-white shadow-2xs flex flex-col gap-2.5 animate-fade-in"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Mini thumbnail */}
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-amber-50 shrink-0 border border-stone-100 flex items-center justify-center">
                        {c.item.image_url && !failedImages[c.item.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.item.image_url}
                            alt={c.item.name_en}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <VegNonVegBadge isVeg={c.item.is_veg} size="sm" />
                          <span className="font-extrabold text-sm text-stone-900 line-clamp-1">
                            {language === 'hi' ? c.item.name_hi : c.item.name_en}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-400 font-medium font-mono">
                          ₹{c.item.price} {language === 'hi' ? 'प्रति पीस' : 'each'}
                        </span>
                      </div>
                    </div>

                    <span className="font-black text-sm text-stone-900 shrink-0 font-mono">
                      ₹{c.item.price * c.quantity}
                    </span>
                  </div>

                  {/* Stepper + Quick Note Pills */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                      {NOTE_PRESETS.slice(0, 3).map(preset => {
                        const text = language === 'hi' ? preset.hi : preset.en;
                        const active = c.notes.toLowerCase().includes(text.toLowerCase());
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => appendNotePreset(c.item.id, c.notes, text)}
                            className={`text-[11px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition cursor-pointer touch-manipulation ${
                              active
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-stone-100 text-stone-600 hover:bg-amber-50 border border-stone-200/70'
                            }`}
                          >
                            + {text}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1 bg-stone-900 text-white rounded-xl p-1 shadow-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(c.item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center font-bold hover:bg-stone-800 active:scale-90 rounded-lg text-amber-400 transition cursor-pointer touch-manipulation"
                        aria-label="Remove or decrease"
                      >
                        {c.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-400" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <span key={c.quantity} className="text-xs font-black w-4 text-center font-mono animate-pop">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(c.item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center font-bold bg-amber-500 hover:bg-amber-400 active:scale-90 text-stone-950 rounded-lg transition cursor-pointer touch-manipulation"
                        aria-label="Increase"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Custom Note Field (iOS text-base to prevent auto-zoom) */}
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
                      className="w-full text-base sm:text-xs px-3 py-2.5 pr-14 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-amber-500 transition"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 font-mono select-none">
                      {(c.notes || '').length}/150
                    </span>
                  </div>
                </div>
              ))}

              {/* Bill Summary Card */}
              <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-2xs space-y-2">
                <div className="flex justify-between text-xs text-stone-500 font-semibold">
                  <span>{language === 'hi' ? 'आइटम कुल' : 'Items Subtotal'}</span>
                  <span className="font-mono text-stone-800">₹{cartTotal}</span>
                </div>

                {taxEnabled && (
                  <div className="flex justify-between text-xs text-stone-500 font-semibold">
                    <span>GST ({gstRatePercent}%)</span>
                    <span className="text-emerald-700 font-bold font-mono">+₹{gstAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-base font-black text-stone-900 pt-2 border-t border-dashed border-stone-200">
                  <span>{language === 'hi' ? 'इस राउंड का कुल' : 'Round Total'}</span>
                  <span className="text-amber-700 font-black text-lg font-mono">
                    ₹{taxEnabled ? grandTotal.toFixed(2) : cartTotal}
                  </span>
                </div>

                <p className="text-[11px] text-stone-400 font-medium">
                  {taxEnabled
                    ? language === 'hi'
                      ? `* कीमतों पर ${gstRatePercent}% GST लागू है।`
                      : `* Standard ${gstRatePercent}% GST is applied.`
                    : language === 'hi'
                    ? '* कोई अतिरिक्त कर नहीं।'
                    : '* Prices are net (No extra tax).'}
                </p>
              </div>

              {/* Pay at Counter Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-950 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="leading-snug">
                  <p className="font-black text-xs text-amber-950">
                    {language === 'hi' ? 'काउंटर बिलिंग' : 'Pay at Counter'}
                  </p>
                  <p className="text-[11px] text-amber-900/80 font-medium mt-0.5">
                    {language === 'hi'
                      ? 'ऑर्डर सीधे किचन भेजा जाएगा। बिल डाइनिंग पूरी होने पर काउंटर पर देना है।'
                      : 'Order goes straight to kitchen. Settle your consolidated bill at the counter after dining.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Checkout CTA Footer */}
            <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-stone-200 flex gap-2.5">
              <button
                type="button"
                disabled={orderingInProgress}
                onClick={() => setIsCartOpen(false)}
                className="min-h-[48px] py-3 px-4 rounded-2xl border border-stone-300 font-bold text-xs text-stone-700 hover:bg-stone-100 active:scale-95 transition cursor-pointer touch-manipulation"
              >
                {language === 'hi' ? 'और जोड़ें' : 'Add More'}
              </button>
              <button
                type="button"
                disabled={orderingInProgress || cart.length === 0}
                onClick={handlePlaceOrder}
                className="flex-1 min-h-[48px] py-3.5 px-4 rounded-2xl bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-amber-500/25 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 touch-manipulation"
              >
                {orderingInProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{language === 'hi' ? 'रसोई में भेजा जा रहा है...' : 'Sending to Kitchen...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {language === 'hi'
                        ? `ऑर्डर भेजें (₹${taxEnabled ? grandTotal.toFixed(2) : cartTotal})`
                        : `Place Order (₹${taxEnabled ? grandTotal.toFixed(2) : cartTotal})`}
                    </span>
                  </>
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
        taxEnabled={taxEnabled}
        gstRatePercent={gstRatePercent}
      />

      {/* Floating Quick-Dock (Live Orders Pill + Call Waiter) */}
      {isPinVerified && !isSessionEnded && (
        <div
          className={`fixed z-30 right-3.5 sm:right-6 flex items-center gap-2 transition-all duration-300 ${
            cart.length > 0
              ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-6'
              : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))] lg:bottom-6'
          }`}
        >
          {tableOrders.length > 0 && activeTab !== 'orders' && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(30);
                setIsLiveOrdersOpen(true);
              }}
              className="min-h-[44px] flex items-center gap-2 py-2.5 px-4 rounded-full bg-stone-900/95 hover:bg-stone-900 text-amber-400 font-extrabold text-xs shadow-xl shadow-stone-950/25 border border-amber-500/30 active:scale-95 transition-all cursor-pointer touch-manipulation"
              title="View Table Live Orders"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {language === 'hi'
                  ? `ऑर्डर (${tableOrders.length})`
                  : `Live (${tableOrders.length})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerHaptic(30);
              setIsCallWaiterOpen(true);
            }}
            className="min-h-[44px] flex items-center gap-2 py-2.5 px-4 rounded-full bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-xl shadow-amber-500/30 border border-white/25 active:scale-95 transition-all cursor-pointer touch-manipulation"
            title="Call Waiter"
          >
            <Bell className="w-3.5 h-3.5 animate-bounce" />
            <span>{language === 'hi' ? 'वेटर' : 'Waiter'}</span>
          </button>
        </div>
      )}

      {/* Call Waiter Modal */}
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

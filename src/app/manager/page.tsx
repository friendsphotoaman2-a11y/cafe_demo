'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  CafeTable,
  TableSession,
  Order,
  OrderItem,
  MenuItem,
  WaiterCall,
  ManagerSettings,
  Bill,
  Category,
} from '@/types/database';
import { TableQRCodeModal } from '@/components/TableQRCodeModal';
import { BillingModal } from '@/components/BillingModal';
import { InvoiceModal } from '@/components/InvoiceModal';
import { TableDetailsPanel } from '@/components/TableDetailsPanel';
import { CategoryModal } from '@/components/CategoryModal';
import { MenuItemModal } from '@/components/MenuItemModal';
import { ReportsView } from '@/components/ReportsView';
import { AuditLogView } from '@/components/AuditLogView';
import { TableQRCodesView } from '@/components/TableQRCodesView';
import { VegNonVegBadge } from '@/components/VegNonVegBadge';
import { playWaiterCallChime, unlockAudio } from '@/lib/audio-chime';
import { apiUrl, getCookiePath } from '@/lib/base-path';
import {
  KeyRound,
  UtensilsCrossed,
  BookOpen,
  Receipt,
  BarChart3,
  Sliders,
  LogOut,
  ChefHat,
  Bell,
  RefreshCw,
  QrCode,
  Check,
  CheckCircle2,
  Volume2,
  VolumeX,
  X,
  FileSpreadsheet,
  ExternalLink,
  Search,
  Filter,
  Clock,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Pencil,
  RotateCcw,
  Layers,
  Mail,
  Building2,
  Printer,
  Gift,
  Hash,
  Percent,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

type TabType = 'tables' | 'orders' | 'menu' | 'billing' | 'reports' | 'audit' | 'qrcodes' | 'settings';

export default function ManagerDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('tables');
  const [managerEmail, setManagerEmail] = useState<string | null>(null);

  // Core Data
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [sessions, setSessions] = useState<Record<string, TableSession>>({});
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<ManagerSettings>({
    id: 1,
    cafe_name: 'Brew & Bites Cafe',
    cafe_tagline: 'Artisan Coffee & Delicious Bites',
    cafe_address: 'Shop 12, Connaught Place, New Delhi, India',
    cafe_phone: '+91 98765 43210',
    cafe_email: 'contact@brewandbites.com',
    gst_number: '07AAAAA1234A1Z5',
    tax_enabled: true,
    kitchen_screen_enabled: true,
    receipt_paper_size: '80mm',
    gst_rate_percent: 5.0,
    session_hours: 2,
    loyalty_every_n_visits: 5,
    order_id_prefix: 'ORD-',
    google_sheet_id: '1lqe2AlMhSUuXPcVIUBryfBUiL-us8r_5DzPDTwcCMUY',
    updated_at: new Date().toISOString(),
  });

  // UI & Filter States
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'READY' | 'SERVED'>('ALL');
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [vegFilter, setVegFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');

  // Modals & Panels state
  const [selectedTableForPanel, setSelectedTableForPanel] = useState<CafeTable | null>(null);
  const [qrModalTable, setQrModalTable] = useState<CafeTable | null>(null);
  const [billingTable, setBillingTable] = useState<{
    table: CafeTable;
    session: TableSession;
    orders: Order[];
  } | null>(null);

  // Invoice Search & Inspection state
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [searchingInvoice, setSearchingInvoice] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [inspectedInvoice, setInspectedInvoice] = useState<{
    bill: Bill;
    items: OrderItem[];
    source: 'supabase' | 'google_sheets';
  } | null>(null);

  // Live timer tick for active table cards
  const [, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Sound Autoplay state
  const [soundUnlocked, setSoundUnlocked] = useState(false);

  // Cancel item state
  const [cancellingItem, setCancellingItem] = useState<{
    itemId: string;
    itemName: string;
    tableNumber: string;
    quantity: number;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Category & Item Modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [dailyResetEnabled, setDailyResetEnabled] = useState(true);
  const [resettingAll, setResettingAll] = useState(false);

  async function handleEnableSound() {
    const success = await unlockAudio();
    if (success) {
      setSoundUnlocked(true);
    }
  }

  function getTableDuration(openedAt?: string | null): string {
    if (!openedAt) return 'Just now';
    const opened = new Date(openedAt).getTime();
    const diffSec = Math.max(0, Math.floor((Date.now() - opened) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${diffSec}s`;
  }

  // Settings form saving
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // 1. Authenticate & Authorize Manager
  useEffect(() => {
    async function verifyAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const isDevMode = sessionStorage.getItem('cafe_manager_dev_mode') === 'true';

      if (!user && !isDevMode) {
        router.replace('/manager/login');
        return;
      }

      if (user) {
        setManagerEmail(user.email ?? 'Manager');

        // Server check for staff_emails / is_manager()
        try {
          const res = await fetch(apiUrl('/api/manager/auth/check'));
          const data = await res.json();
          if (!data.allowed && !isDevMode) {
            await supabase.auth.signOut();
            router.replace('/manager/login?error=not_allowed');
            return;
          }
        } catch {
          // Continue if offline dev mode
        }
      } else if (isDevMode) {
        setManagerEmail('developer@local (Dev Mode)');
      }
    }

    verifyAuth();
  }, [router]);

  // 2. Fetch all initial data
  const loadAllData = useCallback(async () => {
    const supabase = createClient();

    // Tables
    const { data: tblData } = await supabase.from('cafe_tables').select('*').order('table_number');
    if (tblData) setTables(tblData);

    // Active Sessions
    const { data: sessData } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('status', 'ACTIVE');
    if (sessData) {
      const sessMap: Record<string, TableSession> = {};
      sessData.forEach(s => {
        sessMap[s.table_id] = s as TableSession;
      });
      setSessions(sessMap);
    }

    // Orders with items
    const { data: ordData } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    if (ordData) setAllOrders(ordData as Order[]);

    // Menu items
    const { data: itmData } = await supabase
      .from('menu_items')
      .select('*')
      .order('name_en', { ascending: true });
    if (itmData) setMenuItems(itmData);

    // Categories
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (catData) setCategories(catData);

    // Waiter calls
    const { data: callData } = await supabase
      .from('waiter_calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (callData) setWaiterCalls(callData as WaiterCall[]);

    // Recent Bills (for Reports & Billing History)
    const { data: billsData } = await supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (billsData) setRecentBills(billsData as Bill[]);

    // Settings
    try {
      const setRes = await fetch(apiUrl('/api/manager/settings'));
      const setData = await setRes.json();
      if (setData.success && setData.settings) {
        setSettings(setData.settings);
      } else {
        const { data: setRow } = await supabase
          .from('manager_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();
        if (setRow) setSettings(setRow as ManagerSettings);
      }
    } catch {
      // Ignore network glitch
    }
  }, []);

  // 3. Realtime subscriptions
  useEffect(() => {
    loadAllData();
    const supabase = createClient();

    // Waiter calls subscription
    const callSub = supabase
      .channel('manager_waiter_calls')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls' },
        payload => {
          if (payload.eventType === 'INSERT') {
            const newCall = payload.new as WaiterCall;
            setWaiterCalls(prev => [newCall, ...prev]);
            playWaiterCallChime();
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as WaiterCall;
            setWaiterCalls(prev => prev.map(c => (c.id === updated.id ? updated : c)));
          }
        }
      )
      .subscribe();

    // Orders & sessions subscription
    const dataSub = supabase
      .channel('manager_realtime_data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        loadAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, () => {
        loadAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        loadAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
        loadAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callSub);
      supabase.removeChannel(dataSub);
    };
  }, [loadAllData]);

  // Actions
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    sessionStorage.removeItem('cafe_manager_dev_mode');
    document.cookie = `cafe_manager_dev_mode=; path=${getCookiePath()}; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    router.replace('/manager/login');
  }

  async function handleGeneratePin(tableId: string) {
    try {
      const res = await fetch(apiUrl('/api/manager/session/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        setSessions(prev => ({
          ...prev,
          [tableId]: data.session as TableSession,
        }));
        await loadAllData();
      } else {
        alert(data.message || 'Could not generate session');
      }
    } catch {
      alert('Error generating table session.');
    }
  }

  async function handleRegeneratePin(sessionId: string, tableId: string) {
    try {
      const res = await fetch(apiUrl('/api/manager/session/regenerate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, table_id: tableId }),
      });
      const data = await res.json();
      if (data.success && data.pin_code) {
        setSessions(prev => {
          if (!prev[tableId]) return prev;
          return {
            ...prev,
            [tableId]: {
              ...prev[tableId],
              pin_code: data.pin_code,
            },
          };
        });
        await loadAllData();
      } else {
        alert(data.message || 'Could not regenerate PIN');
      }
    } catch {
      alert('Error regenerating PIN.');
    }
  }

  async function handleCloseSession(sessionId: string) {
    try {
      const res = await fetch(apiUrl('/api/manager/session/close'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => {
          const updated = { ...prev };
          for (const [tId, sess] of Object.entries(updated)) {
            if (sess.id === sessionId) {
              delete updated[tId];
            }
          }
          return updated;
        });
        await loadAllData();
      } else {
        alert(data.message || 'Could not close session');
      }
    } catch {
      alert('Error closing table session.');
    }
  }

  async function handleResolveWaiterCall(callId: string) {
    try {
      const res = await fetch(apiUrl('/api/manager/waiter-calls/resolve'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId }),
      });
      const data = await res.json();
      if (data.success) {
        setWaiterCalls(prev =>
          prev.map(c => (c.id === callId ? { ...c, status: 'RESOLVED' } : c))
        );
      }
    } catch {
      alert('Could not resolve call.');
    }
  }

  async function handleUpdateOrderStatus(
    orderId: string,
    newStatus: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED'
  ) {
    try {
      const res = await fetch(apiUrl('/api/manager/orders/update-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setAllOrders(prev =>
          prev.map(o => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch {
      alert('Failed to update order status');
    }
  }

  async function handleConfirmCancelItem() {
    if (!cancellingItem) return;
    setCancelSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/manager/orders/cancel-item'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: cancellingItem.itemId,
          reason: cancelReason,
          manager_email: managerEmail || 'manager',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCancellingItem(null);
        setCancelReason('Customer requested cancellation');
        await loadAllData();
      } else {
        alert(data.message || 'Could not cancel item');
      }
    } catch {
      alert('Failed to cancel item.');
    } finally {
      setCancelSubmitting(false);
    }
  }

  async function handleDeleteCategory(catId: string) {
    if (!confirm('Are you sure you want to delete this category? Linked dishes will become uncategorized.')) return;
    try {
      const res = await fetch(apiUrl('/api/manager/categories'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: catId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadAllData();
      } else {
        alert(data.message || 'Could not delete category');
      }
    } catch {
      alert('Error deleting category.');
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('Are you sure you want to permanently delete this dish?')) return;
    try {
      const res = await fetch(apiUrl('/api/manager/items'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadAllData();
      } else {
        alert(data.message || 'Could not delete item');
      }
    } catch {
      alert('Error deleting dish.');
    }
  }

  async function handleSetItemAvailability(itemId: string, newAvailable: boolean) {
    try {
      const res = await fetch(apiUrl('/api/manager/menu/set-availability'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, is_available: newAvailable }),
      });
      const data = await res.json();
      if (data.success) {
        setMenuItems(prev =>
          prev.map(it => (it.id === itemId ? { ...it, is_available: newAvailable } : it))
        );
      } else {
        alert(data.message || 'Failed to update availability.');
      }
    } catch {
      alert('Error updating availability.');
    }
  }

  async function handleResetAllMenuAvailability() {
    setResettingAll(true);
    try {
      const res = await fetch(apiUrl('/api/cron/reset-menu-availability'));
      const data = await res.json();
      if (data.success) {
        alert(`Success: ${data.message}`);
        await loadAllData();
      } else {
        alert(data.message || 'Reset failed.');
      }
    } catch {
      alert('Failed to reset availability.');
    } finally {
      setResettingAll(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(false);

    try {
      const res = await fetch(apiUrl('/api/manager/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to save settings.');
      if (data.settings) setSettings(data.settings);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSearchInvoice(e: React.FormEvent) {
    e.preventDefault();
    const q = invoiceSearchQuery.trim();
    if (!q) return;

    setSearchingInvoice(true);
    setSearchError(null);

    try {
      const res = await fetch(apiUrl(`/api/manager/invoices/search?q=${encodeURIComponent(q)}`));
      const data = await res.json();

      if (data.success && data.found && data.bill) {
        setInspectedInvoice({
          bill: data.bill,
          items: data.items || [],
          source: data.source || 'supabase',
        });
        setSearchError(null);
      } else {
        setSearchError(
          data.message ||
            `No invoice found for "${q}" in Supabase (last 30 days) or Google Sheets archive.`
        );
      }
    } catch {
      setSearchError('Invoice search failed. Please verify network connection.');
    } finally {
      setSearchingInvoice(false);
    }
  }

  async function handleInspectRecentBill(b: Bill) {
    setSearchingInvoice(true);
    try {
      const res = await fetch(apiUrl(`/api/manager/invoices/search?q=${encodeURIComponent(b.invoice_number)}`));
      const data = await res.json();
      if (data.success && data.found) {
        setInspectedInvoice({
          bill: data.bill,
          items: data.items || [],
          source: data.source || 'supabase',
        });
      } else {
        setInspectedInvoice({
          bill: b,
          items: [],
          source: 'supabase',
        });
      }
    } catch {
      setInspectedInvoice({
        bill: b,
        items: [],
        source: 'supabase',
      });
    } finally {
      setSearchingInvoice(false);
    }
  }

  // Badges & Counters
  const pendingOrdersCount = useMemo(
    () => allOrders.filter(o => o.status === 'PENDING' || o.status === 'PREPARING').length,
    [allOrders]
  );
  const pendingCalls = useMemo(
    () => waiterCalls.filter(c => c.status === 'PENDING'),
    [waiterCalls]
  );
  const activeSessionsCount = useMemo(
    () => Object.keys(sessions).length,
    [sessions]
  );
  const soldOutItemsCount = useMemo(
    () => menuItems.filter(i => !i.is_available).length,
    [menuItems]
  );

  const activeTablesList = useMemo(() => {
    return tables.filter(t => sessions[t.id]);
  }, [tables, sessions]);

  // Group active orders by table
  const ordersByTable = useMemo(() => {
    const active = allOrders.filter(o => o.status !== 'BILLED');
    const tableMap: Record<string, { table: CafeTable; orders: Order[] }> = {};

    for (const order of active) {
      const tbl = tables.find(t => t.id === order.table_id);
      if (!tbl) continue;
      if (!tableMap[tbl.id]) {
        tableMap[tbl.id] = { table: tbl, orders: [] };
      }
      tableMap[tbl.id].orders.push(order);
    }

    return Object.values(tableMap);
  }, [allOrders, tables]);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchSearch =
        item.name_en.toLowerCase().includes(menuSearch.toLowerCase()) ||
        item.name_hi.toLowerCase().includes(menuSearch.toLowerCase());
      const matchCategory =
        selectedCategory === 'ALL' || item.category_id === selectedCategory;
      const matchVeg =
        vegFilter === 'ALL' ||
        (vegFilter === 'VEG' && item.is_veg) ||
        (vegFilter === 'NON_VEG' && !item.is_veg);
      return matchSearch && matchCategory && matchVeg;
    });
  }, [menuItems, menuSearch, selectedCategory, vegFilter]);

  // Nav Items Config
  const navItems = [
    { id: 'tables' as TabType, label: 'Tables', icon: KeyRound, badge: activeSessionsCount },
    { id: 'orders' as TabType, label: 'Orders', icon: UtensilsCrossed, badge: pendingOrdersCount },
    { id: 'menu' as TabType, label: 'Menu', icon: BookOpen, badge: soldOutItemsCount > 0 ? soldOutItemsCount : 0 },
    { id: 'billing' as TabType, label: 'Billing', icon: Receipt, badge: activeSessionsCount },
    { id: 'reports' as TabType, label: 'Reports', icon: BarChart3 },
    { id: 'audit' as TabType, label: 'Audit Log', icon: ShieldAlert },
    { id: 'qrcodes' as TabType, label: 'QR Codes', icon: QrCode },
    { id: 'settings' as TabType, label: 'Settings', icon: Sliders },
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col md:flex-row font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* ======================================================== */}
      {/* 1. DESKTOP / TABLET SIDEBAR                              */}
      {/* ======================================================== */}
      <aside className="hidden md:flex flex-col justify-between w-20 lg:w-64 bg-stone-950 border-r border-stone-800 shrink-0 sticky top-0 h-screen z-30 transition-all">
        <div>
          {/* Logo & Cafe Header */}
          <div className="p-4 lg:p-5 border-b border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20 shrink-0">
              ☕
            </div>
            <div className="hidden lg:block overflow-hidden">
              <h2 className="font-extrabold text-sm text-white tracking-tight truncate">
                {settings.cafe_name}
              </h2>
              <p className="text-[10px] text-amber-400/80 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Manager Portal
              </p>
            </div>
          </div>

          {/* 6 Tab Navigation Links */}
          <nav className="p-2 lg:p-3 space-y-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20 font-extrabold scale-[1.02]'
                      : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-stone-950' : 'text-stone-400'}`} />
                  <span className="hidden lg:inline grow text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-stone-950 text-amber-300 font-bold'
                          : 'bg-stone-800 text-amber-400 border border-amber-900/40'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 lg:p-4 border-t border-stone-800/80 space-y-2">
          {settings.kitchen_screen_enabled && (
            <Link
              href="/kitchen"
              className="w-full flex items-center justify-center lg:justify-start gap-2.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 text-xs font-semibold border border-amber-900/40 transition"
              title="Kitchen Display (KDS)"
            >
              <ChefHat className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden lg:inline">Kitchen Screen</span>
            </Link>
          )}

          <div className="hidden lg:block px-3 py-2 rounded-xl bg-stone-900/60 border border-stone-800 text-[11px] text-stone-400 truncate">
            <span className="block text-[9px] uppercase tracking-wider text-stone-500 font-bold">
              Signed in as
            </span>
            <span className="truncate font-mono text-stone-300 block">{managerEmail}</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center lg:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-stone-400 hover:text-red-400 hover:bg-red-950/30 transition text-xs font-semibold cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MAIN CONTENT AREA                                     */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-stone-950 border-b border-stone-800 sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-base">
              ☕
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-white tracking-tight truncate max-w-[150px]">
                {settings.cafe_name}
              </h1>
              <span className="text-[10px] text-amber-400 font-medium">Manager Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!soundUnlocked ? (
              <button
                onClick={handleEnableSound}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold animate-pulse cursor-pointer"
                title="Tap once to enable sound alerts"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Sound OFF</span>
              </button>
            ) : (
              <button
                onClick={() => playWaiterCallChime()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold cursor-pointer"
                title="Sound alert is enabled"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sound ON</span>
              </button>
            )}
            <button
              onClick={loadAllData}
              className="p-2 rounded-xl bg-stone-900 text-stone-300"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-stone-900 text-stone-400 hover:text-red-400"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Waiter Request Popup Banner */}
        {pendingCalls.length > 0 && (
          <div className="bg-gradient-to-r from-red-600 via-red-500 to-amber-600 text-white px-4 lg:px-6 py-3 shadow-2xl border-b border-red-400 sticky top-13 md:top-0 z-30 animate-pulse">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-stone-950 text-red-400 rounded-2xl shrink-0 shadow-md">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm uppercase tracking-wider block">
                      Waiter Calling: {pendingCalls[0].table_number}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-950/70 text-amber-300">
                      Service Required
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white/95 mt-0.5">
                    Note: &quot;{pendingCalls[0].note || 'Assistance requested at table'}&quot;
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleResolveWaiterCall(pendingCalls[0].id)}
                  className="py-1.5 px-4 bg-stone-950 hover:bg-stone-900 text-amber-300 hover:text-white text-xs font-black rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Bar for Desktop */}
        <div className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-stone-800 bg-stone-950/50 backdrop-blur-xs sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-base text-white capitalize flex items-center gap-2">
              <span>{activeTab} Management</span>
            </h1>
            <span className="text-xs text-stone-500">•</span>
            <span className="text-xs text-stone-400">
              {activeTab === 'tables' && `${tables.length} Tables Registered`}
              {activeTab === 'orders' && `${allOrders.length} Total Orders Tracked`}
              {activeTab === 'menu' && `${menuItems.length} Dishes Listed`}
              {activeTab === 'billing' && `${activeSessionsCount} Active Sessions Waiting`}
              {activeTab === 'reports' && 'Live Performance & Google Sheets Sync'}
              {activeTab === 'audit' && 'System Activity & Tamper-Proof Audit Trail'}
              {activeTab === 'qrcodes' && '4x6 Acrylic Stand Cards & NFC Programming URLs'}
              {activeTab === 'settings' && 'Cafe Configuration & Thermal Receipt Settings'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!soundUnlocked ? (
              <button
                onClick={handleEnableSound}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 animate-pulse transition cursor-pointer"
                title="Tap once to unlock audio autoplay"
              >
                <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                <span>Sound OFF (Tap for ON)</span>
              </button>
            ) : (
              <button
                onClick={() => playWaiterCallChime()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40 transition cursor-pointer"
                title="Sound alerts enabled - click to test"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sound ON</span>
              </button>
            )}
            {settings.kitchen_screen_enabled && (
              <Link
                href="/kitchen"
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 transition cursor-pointer"
                title="Open Live Kitchen Screen in new tab"
              >
                <ChefHat className="w-3.5 h-3.5 text-amber-400" />
                <span>Kitchen Screen</span>
                <ExternalLink className="w-3 h-3 text-amber-400/70" />
              </Link>
            )}
            <button
              onClick={loadAllData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-semibold border border-stone-800 transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. DYNAMIC TAB PANELS                                    */}
        {/* ======================================================== */}
        <main className="max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          {/* -------------------------------------------------------- */}
          {/* TAB 1: TABLES                                            */}
          {/* -------------------------------------------------------- */}
          {activeTab === 'tables' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">
                    Table Sessions &amp; 4-Digit PINs
                  </h2>
                  <p className="text-xs text-stone-400">
                    Generate secure PINs, display QR standees, and manage guest seatings.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <button
                    onClick={() => setActiveTab('qrcodes')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold transition cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>4x6 Stand Cards &amp; NFC</span>
                  </button>
                  <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    {activeSessionsCount} Seated
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-stone-900 text-stone-400 border border-stone-800 font-bold">
                    {tables.length - activeSessionsCount} Idle
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tables.map(table => {
                  const session = sessions[table.id];
                  const isActive = !!session && session.status === 'ACTIVE';
                  const waiterCall = waiterCalls.find(
                    c => c.table_id === table.id && c.status === 'PENDING'
                  );
                  const isWaiterCalling = !!waiterCall;

                  // State Colors: Red (Waiter Calling), Orange (Active), Green (Free)
                  const sessionOrders = isActive
                    ? allOrders.filter(o => o.session_id === session.id)
                    : [];

                  const itemsCount = sessionOrders.reduce(
                    (sum, o) =>
                      sum +
                      (o.order_items?.reduce(
                        (s, it) => (it.status !== 'CANCELLED' ? s + it.quantity : s),
                        0
                      ) || 0),
                    0
                  );

                  const tableTotal = sessionOrders.reduce(
                    (sum, o) =>
                      sum +
                      (o.order_items?.reduce(
                        (s, it) =>
                          it.status !== 'CANCELLED' ? s + it.price_per_unit * it.quantity : s,
                        0
                      ) || 0),
                    0
                  );

                  return (
                    <div
                      key={table.id}
                      onClick={() => setSelectedTableForPanel(table)}
                      className={`rounded-3xl border p-5 flex flex-col justify-between transition-all cursor-pointer relative ${
                        isWaiterCalling
                          ? 'bg-gradient-to-br from-stone-900 via-stone-900 to-red-950/50 border-red-500 hover:border-red-400 shadow-xl shadow-red-500/20 animate-pulse'
                          : isActive
                          ? 'bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/30 border-amber-500/60 hover:border-amber-400 shadow-lg shadow-amber-500/10'
                          : 'bg-stone-900/70 border-emerald-500/40 hover:border-emerald-500/70 hover:bg-stone-900 shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Table Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-lg text-white">
                                {table.table_number}
                              </h3>
                              <span className="font-mono text-xs font-bold text-stone-400 bg-stone-800 px-2 py-0.5 rounded-lg border border-stone-700">
                                {table.table_code}
                              </span>
                            </div>

                            {/* State Color Badges */}
                            <div className="mt-1 flex items-center gap-1.5">
                              {isWaiterCalling ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                                  <Bell className="w-3 h-3 text-red-400 animate-bounce" />
                                  <span>Waiter Calling!</span>
                                </span>
                              ) : isActive ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  <span>Active Session</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>Free / Ready</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setQrModalTable(table);
                            }}
                            className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                            title="Print / View QR Stand"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Waiter Calling Alert Note */}
                        {isWaiterCalling && (
                          <div className="bg-red-950/70 border border-red-800/80 rounded-2xl p-2.5 my-2 text-xs text-red-200 space-y-1">
                            <span className="font-bold text-[10px] uppercase tracking-wider block text-red-400">
                              Assistance Requested:
                            </span>
                            <p className="italic font-medium">
                              &quot;{waiterCall.note || 'Staff requested at table'}&quot;
                            </p>
                          </div>
                        )}

                        {/* PIN Area (Visible for Active Tables) */}
                        {isActive ? (
                          <div className="bg-amber-950/50 border border-amber-900/60 rounded-2xl p-3.5 my-2.5 text-center">
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                              Active 4-Digit Table PIN
                            </span>
                            <span className="text-3xl font-black font-mono text-amber-300 tracking-widest block my-0.5">
                              {session.pin_code || '••••'}
                            </span>
                            <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-amber-200/80 mt-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Open for: <strong>{getTableDuration(session.opened_at)}</strong></span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-stone-950/60 border border-dashed border-stone-800 rounded-2xl p-4 my-2.5 text-center">
                            <p className="text-xs text-stone-400 font-medium">
                              Table is empty. Tap card to open panel &amp; generate PIN.
                            </p>
                          </div>
                        )}

                        {/* Running Total & Items */}
                        {isActive && (
                          <div className="flex justify-between items-center text-xs py-2 border-t border-stone-800/80 mt-2">
                            <span className="text-stone-300 font-medium">
                              {itemsCount} {itemsCount === 1 ? 'item' : 'items'} running
                            </span>
                            <span className="font-black text-amber-400 text-sm font-mono">
                              ₹{tableTotal}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex gap-2 mt-4 pt-3 border-t border-stone-800">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedTableForPanel(table);
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isActive ? 'Manage Session' : 'Generate PIN'}</span>
                        </button>

                        {isActive && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setBillingTable({
                                table,
                                session,
                                orders: sessionOrders,
                              });
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Bill Table</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB 2: ORDERS (Grouped by Table, Status Stepper & Cancel)*/}
          {/* -------------------------------------------------------- */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">
                    Live Table Orders
                  </h2>
                  <p className="text-xs text-stone-400">
                    Realtime active orders grouped by table. Move status or cancel items with audit logging.
                  </p>
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {(['ALL', 'PENDING', 'PREPARING', 'READY', 'SERVED'] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => setOrderFilter(filter)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        orderFilter === filter
                          ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                          : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
                      }`}
                    >
                      {filter === 'ALL'
                        ? 'All Orders'
                        : filter === 'PENDING'
                        ? 'Received'
                        : filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Autoplay Helper Banner */}
              {!soundUnlocked ? (
                <div className="bg-amber-950/60 border border-amber-900/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                      <VolumeX className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">Browser Audio Alert is Currently OFF</h4>
                      <p className="text-[11px] text-amber-200/80 mt-0.5">
                        Browsers block autoplay by default. Tap &quot;Sound ON&quot; once so audio rings when waiter calls or new orders arrive.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleEnableSound}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 shadow-md transition cursor-pointer self-end sm:self-center shrink-0 active:scale-95"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Sound ON</span>
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-950/40 border border-emerald-900/60 rounded-2xl px-4 py-2 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-emerald-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Sound Alerts Active (Chime rings on waiter calls &amp; incoming orders)
                  </span>
                  <button
                    onClick={() => playWaiterCallChime()}
                    className="text-stone-400 hover:text-white font-mono text-[11px] underline cursor-pointer"
                  >
                    Test Ring
                  </button>
                </div>
              )}

              {/* Active Orders Grouped by Table */}
              <div className="space-y-4">
                {ordersByTable.map(group => {
                  const tableWaiterCall = waiterCalls.find(
                    c => c.table_id === group.table.id && c.status === 'PENDING'
                  );
                  const isCalling = !!tableWaiterCall;

                  const filteredTableOrders = group.orders.filter(o =>
                    orderFilter === 'ALL'
                      ? true
                      : orderFilter === 'PENDING'
                      ? o.status === 'PENDING'
                      : o.status === orderFilter
                  );

                  if (filteredTableOrders.length === 0) return null;

                  const tableItemsCount = group.orders.reduce(
                    (sum, o) =>
                      sum +
                      (o.order_items?.reduce(
                        (s, it) => (it.status !== 'CANCELLED' ? s + it.quantity : s),
                        0
                      ) || 0),
                    0
                  );

                  const tableRunningTotal = group.orders.reduce(
                    (sum, o) =>
                      sum +
                      (o.order_items?.reduce(
                        (s, it) =>
                          it.status !== 'CANCELLED' ? s + it.price_per_unit * it.quantity : s,
                        0
                      ) || 0),
                    0
                  );

                  return (
                    <div
                      key={group.table.id}
                      className={`rounded-3xl border p-5 space-y-4 transition-all shadow-md ${
                        isCalling
                          ? 'bg-gradient-to-br from-stone-900 via-stone-900 to-red-950/60 border-red-500 shadow-xl shadow-red-500/20 animate-pulse'
                          : 'bg-stone-900 border-stone-800'
                      }`}
                    >
                      {/* Table Card Header (turns RED while call is pending) */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-stone-800">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${
                              isCalling
                                ? 'bg-red-500 text-white animate-bounce'
                                : 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                            }`}
                          >
                            {isCalling ? '🔔' : '🍽️'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-lg text-white">
                                {group.table.table_number}
                              </h3>
                              <span className="font-mono text-xs font-bold text-stone-400 bg-stone-800 px-2 py-0.5 rounded-lg border border-stone-700">
                                {group.table.table_code}
                              </span>
                              {isCalling && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40">
                                  Waiter Calling
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-400">
                              {filteredTableOrders.length} active orders • {tableItemsCount} items
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {isCalling && (
                            <button
                              onClick={() => handleResolveWaiterCall(tableWaiterCall.id)}
                              className="py-1.5 px-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Done</span>
                            </button>
                          )}

                          <div className="text-right">
                            <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold block">
                              Table Total
                            </span>
                            <span className="font-mono font-black text-lg text-amber-400">
                              ₹{tableRunningTotal}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Waiter Note Callout if pending */}
                      {isCalling && (
                        <div className="p-3 bg-red-950/80 border border-red-800/80 rounded-2xl flex items-center justify-between text-xs text-red-200">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-red-400 animate-bounce shrink-0" />
                            <span>
                              <strong>Customer Note:</strong> &quot;{tableWaiterCall.note || 'Service requested'}&quot;
                            </span>
                          </div>
                          <button
                            onClick={() => handleResolveWaiterCall(tableWaiterCall.id)}
                            className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-bold cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      )}

                      {/* Orders for this Table */}
                      <div className="space-y-3">
                        {filteredTableOrders.map((order, oIdx) => {
                          const orderTotal =
                            order.order_items?.reduce(
                              (sum, it) =>
                                it.status !== 'CANCELLED' ? sum + it.price_per_unit * it.quantity : sum,
                              0
                            ) || 0;

                          return (
                            <div
                              key={order.id}
                              className="bg-stone-950/80 border border-stone-800/80 rounded-2xl p-4 space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2.5 border-b border-stone-800/60">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-stone-200 text-sm">
                                      Order #{oIdx + 1}
                                    </span>
                                    <span className="text-[11px] font-mono text-stone-400 bg-stone-800 px-1.5 py-0.5 rounded">
                                      #{order.id.slice(0, 8)}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-stone-500 font-mono">
                                    Ordered at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>

                                {/* Status Stepper: Received, Preparing, Ready, Served */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {([
                                    { label: 'Received', status: 'PENDING' },
                                    { label: 'Preparing', status: 'PREPARING' },
                                    { label: 'Ready', status: 'READY' },
                                    { label: 'Served', status: 'SERVED' },
                                  ] as const).map(st => {
                                    const isCurrent = order.status === st.status;
                                    return (
                                      <button
                                        key={st.status}
                                        onClick={() => handleUpdateOrderStatus(order.id, st.status)}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                                          isCurrent
                                            ? 'bg-amber-500 text-stone-950 font-black shadow-md shadow-amber-500/20 scale-105'
                                            : 'bg-stone-800/90 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                                        }`}
                                      >
                                        {st.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Order Items with Cancel Button */}
                              <div className="divide-y divide-stone-800/50 py-1">
                                {order.order_items?.map(it => {
                                  const isCancelled = it.status === 'CANCELLED';
                                  return (
                                    <div
                                      key={it.id}
                                      className={`py-2 flex items-center justify-between text-xs gap-3 ${
                                        isCancelled ? 'opacity-40' : ''
                                      }`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`font-bold ${
                                              isCancelled ? 'line-through text-stone-500' : 'text-stone-200'
                                            }`}
                                          >
                                            {it.quantity}x {it.item_name_en}
                                          </span>
                                          {isCancelled && (
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-red-950/80 text-red-400 border border-red-900/40">
                                              Cancelled
                                            </span>
                                          )}
                                        </div>
                                        {it.item_notes && (
                                          <p className="text-[11px] text-amber-400 italic">
                                            Note: {it.item_notes}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3 shrink-0">
                                        <span
                                          className={`font-mono font-bold ${
                                            isCancelled ? 'line-through text-stone-500' : 'text-stone-300'
                                          }`}
                                        >
                                          ₹{it.price_per_unit * it.quantity}
                                        </span>

                                        {!isCancelled && (
                                          <button
                                            onClick={() =>
                                              setCancellingItem({
                                                itemId: it.id,
                                                itemName: it.item_name_en,
                                                tableNumber: group.table.table_number,
                                                quantity: it.quantity,
                                              })
                                            }
                                            className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                                            title="Cancel Item (writes to audit log)"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Order Subtotal */}
                              <div className="flex justify-between items-center pt-2 border-t border-stone-800/60 text-xs">
                                <span className="text-stone-400 font-medium">Order Subtotal</span>
                                <span className="font-mono font-bold text-amber-400">₹{orderTotal}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {ordersByTable.length === 0 && (
                  <div className="py-20 text-center text-stone-500 bg-stone-900/30 border border-stone-800/80 rounded-3xl">
                    <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold text-stone-400">No active orders right now.</p>
                    <p className="text-xs text-stone-600 mt-1">
                      Customer orders placed at tables will appear here live, grouped by table.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB 3: MENU MANAGER                                      */}
          {/* -------------------------------------------------------- */}
          {activeTab === 'menu' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">
                    Menu &amp; Dish Catalog
                  </h2>
                  <p className="text-xs text-stone-400">
                    Add/edit bilingual dishes, client-compressed photos (&lt;150 KB WebP), and toggle &quot;Not available today&quot;.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryModalOpen(true);
                    }}
                    className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Add Category</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setItemModalOpen(true);
                    }}
                    className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add New Dish</span>
                  </button>
                </div>
              </div>

              {/* Automatic Daily Reset Banner (5:00 AM Asia/Kolkata) */}
              <div className="bg-gradient-to-r from-amber-950/60 via-stone-900 to-stone-900 border border-amber-900/60 rounded-3xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-white">
                        Automatic Daily Reset at 5:00 AM (Asia/Kolkata)
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {dailyResetEnabled ? 'Scheduled Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      All items marked &quot;Not available today&quot; automatically reset to available every morning at 5 AM IST via scheduled function.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={handleResetAllMenuAvailability}
                    disabled={resettingAll}
                    className="py-2 px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-bold text-xs border border-amber-900/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${resettingAll ? 'animate-spin' : ''}`} />
                    <span>{resettingAll ? 'Resetting...' : 'Reset All to Available Now'}</span>
                  </button>

                  <label className="relative inline-flex items-center cursor-pointer ml-1">
                    <input
                      type="checkbox"
                      checked={dailyResetEnabled}
                      onChange={e => setDailyResetEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-stone-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>

              {/* Filters Bar: Search & Veg/Non-Veg */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={e => setMenuSearch(e.target.value)}
                    placeholder="Search dishes by name (English or हिन्दी)..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                {/* Veg / Non-Veg Filter */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-stone-500 hidden sm:block" />
                  <button
                    onClick={() => setVegFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      vegFilter === 'ALL'
                        ? 'bg-amber-500 text-stone-950 font-black'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    All ({menuItems.length})
                  </button>
                  <button
                    onClick={() => setVegFilter('VEG')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      vegFilter === 'VEG'
                        ? 'bg-emerald-500 text-stone-950 font-black'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    Veg Only
                  </button>
                  <button
                    onClick={() => setVegFilter('NON_VEG')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      vegFilter === 'NON_VEG'
                        ? 'bg-red-500 text-stone-950 font-black'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    Non-Veg
                  </button>
                </div>
              </div>

              {/* Category Chips with Edit & Delete */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-amber-500 text-stone-950 font-black shadow-md shadow-amber-500/20'
                      : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  All Categories ({menuItems.length})
                </button>

                {categories.map(cat => {
                  const count = menuItems.filter(i => i.category_id === cat.id).length;
                  const isSelected = selectedCategory === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold shrink-0 border transition ${
                        isSelected
                          ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-stone-900 border-stone-800 text-stone-400'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedCategory(cat.id)}
                        className="cursor-pointer font-bold"
                      >
                        {cat.name_en} ({count})
                      </button>

                      <div className="flex items-center gap-0.5 ml-1 border-l border-stone-700/60 pl-1">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingCategory(cat);
                            setCategoryModalOpen(true);
                          }}
                          className="p-1 hover:text-white rounded"
                          title="Edit Category"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteCategory(cat.id);
                          }}
                          className="p-1 hover:text-red-400 rounded"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Items Grid with Big "Not available today" Toggle */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMenuItems.map(item => (
                  <div
                    key={item.id}
                    className={`bg-stone-900 border rounded-3xl p-5 flex flex-col justify-between gap-3.5 transition-all shadow-sm ${
                      item.is_available
                        ? 'border-stone-800'
                        : 'border-red-900/60 bg-stone-950/80 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Dish Header: Photo, Names, Tags, Edit/Delete */}
                      <div className="flex items-start gap-3">
                        {item.image_url ? (
                          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-stone-800 bg-stone-950 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.image_url}
                              alt={item.name_en}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-500 shrink-0">
                            <UtensilsCrossed className="w-6 h-6 opacity-40" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <VegNonVegBadge isVeg={item.is_veg} size="sm" />
                              <h4 className="font-extrabold text-sm text-white truncate">
                                {item.name_en}
                              </h4>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setItemModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition cursor-pointer"
                                title="Edit Dish"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 transition cursor-pointer"
                                title="Delete Dish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-stone-400 font-medium truncate mt-0.5">
                            {item.name_hi}
                          </p>

                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-mono font-black text-amber-400">
                              ₹{item.price}
                            </span>
                            {item.meal_timing && item.meal_timing !== 'all_day' && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-800 text-stone-400 uppercase font-semibold">
                                {item.meal_timing}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Big "Not available today" Toggle Button */}
                    <div className="pt-3 border-t border-stone-800/80">
                      <button
                        onClick={() => handleSetItemAvailability(item.id, !item.is_available)}
                        className={`w-full py-2.5 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-98 ${
                          item.is_available
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
                        }`}
                      >
                        {item.is_available ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Available in Menu</span>
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4 text-white" />
                            <span className="uppercase tracking-wider">Not available today</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredMenuItems.length === 0 && (
                <div className="py-20 text-center text-stone-500 bg-stone-900/30 border border-stone-800/80 rounded-3xl">
                  <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold text-stone-400">No dishes found matching filters.</p>
                  <p className="text-xs text-stone-600 mt-1">Tap &quot;+ Add New Dish&quot; above to create one.</p>
                </div>
              )}
            </div>
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB 4: BILLING                                           */}
          {/* -------------------------------------------------------- */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Counter Billing &amp; Invoices
                </h2>
                <p className="text-xs text-stone-400">
                  Bill open table sessions, award customer loyalty, print thermal receipts, and sync to Google Sheets.
                </p>
              </div>

              {/* Invoice Search: Order ID or Phone */}
              <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-sm text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      <span>Search Invoices</span>
                    </h3>
                    <p className="text-xs text-stone-400">
                      Search active bills in Supabase (last 30 days) or deep archive in Google Sheets by Order ID (e.g. CF-241126-0001) or Phone (e.g. 9876543210).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Supabase (30d)
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Google Sheets Archive
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSearchInvoice} className="flex flex-col sm:flex-row items-stretch gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Enter Order ID (e.g. CF-261124-0001) or 10-digit Phone..."
                      value={invoiceSearchQuery}
                      onChange={e => {
                        setInvoiceSearchQuery(e.target.value);
                        if (searchError) setSearchError(null);
                      }}
                      className="w-full pl-10 pr-10 py-2.5 text-xs rounded-2xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500 font-mono"
                    />
                    {invoiceSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setInvoiceSearchQuery('');
                          setSearchError(null);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-500 hover:text-stone-300 cursor-pointer"
                        title="Clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={searchingInvoice || !invoiceSearchQuery.trim()}
                    className="py-2.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer shrink-0"
                  >
                    {searchingInvoice ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Search Invoice</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Not Found / Error Banner */}
                {searchError && (
                  <div className="mt-3 p-3.5 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-center justify-between gap-3 text-xs text-red-300">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <div>
                        <span className="font-bold">Not Found: </span>
                        <span>{searchError}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSearchError(null)}
                      className="p-1 text-red-400 hover:text-red-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Active Tables Waiting for Bill */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-amber-400 uppercase tracking-wider">
                  Open Tables with Running Sessions ({activeTablesList.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeTablesList.map(table => {
                    const session = sessions[table.id];
                    const sessionOrders = allOrders.filter(o => o.session_id === session.id);
                    const total = sessionOrders.reduce(
                      (sum, o) =>
                        sum +
                        (o.order_items?.reduce(
                          (s, it) =>
                            it.status !== 'CANCELLED' ? s + it.price_per_unit * it.quantity : s,
                          0
                        ) || 0),
                      0
                    );

                    return (
                      <div
                        key={table.id}
                        className="bg-stone-900 border border-stone-800 rounded-3xl p-5 flex flex-col justify-between shadow-md hover:border-amber-500/50 transition"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-black text-base text-white">{table.table_number}</h4>
                              <span className="text-[11px] font-mono text-stone-400">
                                PIN: {session.pin_code}
                              </span>
                            </div>
                            <span className="font-mono font-black text-lg text-amber-400">
                              ₹{total}
                            </span>
                          </div>
                          <p className="text-xs text-stone-400">
                            {sessionOrders.length} {sessionOrders.length === 1 ? 'order' : 'orders'} placed
                          </p>
                        </div>

                        <button
                          onClick={() =>
                            setBillingTable({
                              table,
                              session,
                              orders: sessionOrders,
                            })
                          }
                          className="mt-4 w-full py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                        >
                          <Receipt className="w-4 h-4" />
                          <span>Generate Bill &amp; Receipt</span>
                        </button>
                      </div>
                    );
                  })}

                  {activeTablesList.length === 0 && (
                    <div className="col-span-full py-12 text-center text-stone-500 bg-stone-900/40 border border-stone-800/80 rounded-3xl">
                      <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-semibold text-stone-400">No active tables to bill right now.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Billed History */}
              <div className="space-y-3 pt-4 border-t border-stone-800">
                <h3 className="font-bold text-sm text-stone-300 uppercase tracking-wider">
                  Recent Invoices &amp; Completed Bills ({recentBills.length})
                </h3>

                <div className="overflow-x-auto bg-stone-900 border border-stone-800 rounded-3xl">
                  <table className="w-full text-left text-xs text-stone-300">
                    <thead className="bg-stone-950/80 text-stone-400 font-mono text-[11px] uppercase border-b border-stone-800">
                      <tr>
                        <th className="p-4">Invoice #</th>
                        <th className="p-4">Table</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Phone</th>
                        <th className="p-4">Total Amount</th>
                        <th className="p-4">Time</th>
                        <th className="p-4">Sheets Sync</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                      {recentBills.map(b => (
                        <tr key={b.id} className="hover:bg-stone-800/40">
                          <td className="p-4 font-mono font-bold text-amber-400">{b.invoice_number}</td>
                          <td className="p-4 font-bold text-white">{b.table_number}</td>
                          <td className="p-4">{b.customer_name}</td>
                          <td className="p-4 font-mono">{b.customer_phone}</td>
                          <td className="p-4 font-mono font-black text-white">₹{b.total_amount}</td>
                          <td className="p-4 text-stone-400 font-mono">
                            {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Synced
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleInspectRecentBill(b)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 transition inline-flex items-center gap-1.5 cursor-pointer"
                              title="View & Print Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>View / Print</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {recentBills.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-stone-500">
                            No bills settled yet today.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB 5: REPORTS                                           */}
          {/* -------------------------------------------------------- */}
          {activeTab === 'reports' && (
            <ReportsView settings={settings} />
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB 6: AUDIT LOG                                         */}
          {/* -------------------------------------------------------- */}
          {activeTab === 'audit' && (
            <AuditLogView settings={settings} />
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB 7: TABLE QR CODES & 4x6 STANDS                       */}
          {/* -------------------------------------------------------- */}
          {activeTab === 'qrcodes' && (
            <TableQRCodesView tables={tables} settings={settings} />
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB 8: SETTINGS                                          */}
          {/* -------------------------------------------------------- */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="border-b border-stone-800 pb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight">
                      Manager &amp; Cafe Settings
                    </h2>
                    <p className="text-xs text-stone-400">
                      Configure cafe profile, billing &amp; GST tax, loyalty rules, thermal printer, and kitchen display screen.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* Section 1: Cafe Identity */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>Cafe Profile &amp; Contact</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Cafe Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={settings.cafe_name}
                        onChange={e => setSettings({ ...settings, cafe_name: e.target.value })}
                        placeholder="e.g. Brew &amp; Bites Cafe"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Phone / Support Contact
                      </label>
                      <input
                        type="text"
                        value={settings.cafe_phone || ''}
                        onChange={e => setSettings({ ...settings, cafe_phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Support Email (Receipts &amp; Contact)
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={settings.cafe_email || ''}
                          onChange={e => setSettings({ ...settings, cafe_email: e.target.value })}
                          placeholder="contact@brewandbites.com"
                          className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Cafe Address (Thermal Receipt Header)
                      </label>
                      <input
                        type="text"
                        value={settings.cafe_address || ''}
                        onChange={e => setSettings({ ...settings, cafe_address: e.target.value })}
                        placeholder="Shop 12, Connaught Place, New Delhi"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Taxes & Billing Configuration */}
                <div className="space-y-4 pt-4 border-t border-stone-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    <span>Taxes &amp; Invoicing</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        GSTIN Number
                      </label>
                      <input
                        type="text"
                        value={settings.gst_number || ''}
                        onChange={e => setSettings({ ...settings, gst_number: e.target.value.toUpperCase() })}
                        placeholder="07AAAAA1234A1Z5"
                        maxLength={15}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono tracking-wider"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        GST / Tax Calculation
                      </label>
                      <div className="flex items-center justify-between p-2.5 bg-stone-800/90 border border-stone-700 rounded-xl h-[42px]">
                        <span className="text-xs font-bold text-stone-300">
                          {settings.tax_enabled ? 'Tax ON' : 'Tax OFF'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.tax_enabled ?? true}
                            onChange={e => setSettings({ ...settings, tax_enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-stone-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Tax Percent (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        disabled={settings.tax_enabled === false}
                        value={settings.gst_rate_percent}
                        onChange={e =>
                          setSettings({ ...settings, gst_rate_percent: Number(e.target.value) })
                        }
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Order ID Prefix
                      </label>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={settings.order_id_prefix || 'ORD-'}
                          onChange={e => setSettings({ ...settings, order_id_prefix: e.target.value })}
                          placeholder="e.g. ORD-"
                          className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono uppercase"
                        />
                      </div>
                      <span className="text-[10px] text-stone-500 block mt-1">
                        Preview: <code>{(settings.order_id_prefix || 'ORD-').trim()}101</code>
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Session Validity Duration (Hours)
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="24"
                          value={settings.session_hours ?? 2}
                          onChange={e => setSettings({ ...settings, session_hours: Number(e.target.value) })}
                          className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono"
                        />
                      </div>
                      <span className="text-[10px] text-stone-500 block mt-1">
                        Default active window before auto-close warnings (e.g. 2 hours)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Loyalty & Rewards */}
                <div className="space-y-4 pt-4 border-t border-stone-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    <span>Loyalty &amp; Customer Rewards</span>
                  </h3>

                  <div className="p-4 bg-stone-800/40 border border-stone-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-white">Loyalty Every N Visits</h4>
                      <p className="text-[11px] text-stone-400 max-w-md">
                        Customers receive 1 free reward coffee on their <strong>(N + 1)th</strong> visit (e.g. every 5 visits awards a reward on visits 6, 11, 16...).
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-stone-400 font-semibold">Every</span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={settings.loyalty_every_n_visits ?? 5}
                        onChange={e => setSettings({ ...settings, loyalty_every_n_visits: Number(e.target.value) })}
                        className="w-16 px-2.5 py-2 text-center text-sm rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono font-bold"
                      />
                      <span className="text-xs text-stone-400 font-semibold">visits</span>
                    </div>
                  </div>
                </div>

                {/* Section 4: Thermal Receipt Printer */}
                <div className="space-y-4 pt-4 border-t border-stone-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    <span>Thermal Receipt Paper Size</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    {(['58mm', '80mm'] as const).map(size => (
                      <label
                        key={size}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition ${
                          settings.receipt_paper_size === size
                            ? 'border-amber-500 bg-amber-500/10 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                            : 'border-stone-800 bg-stone-800/40 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="receipt_paper_size"
                            value={size}
                            checked={settings.receipt_paper_size === size}
                            onChange={() => setSettings({ ...settings, receipt_paper_size: size })}
                            className="accent-amber-500"
                          />
                          <div>
                            <span className="text-sm font-bold block text-white">{size} Width</span>
                            <span className="text-[11px] text-stone-400">
                              {size === '58mm' ? 'Compact POS thermal slip (32 col)' : 'Standard restaurant invoice roll (48 col)'}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Section 5: Kitchen Screen (KDS) */}
                <div className="space-y-4 pt-4 border-t border-stone-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <ChefHat className="w-4 h-4" />
                    <span>Kitchen Display Screen (KDS)</span>
                  </h3>

                  <div className="p-4 bg-stone-800/50 rounded-2xl border border-stone-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white">Kitchen Screen Display</h4>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            settings.kitchen_screen_enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-stone-800 text-stone-500 border-stone-700'
                          }`}
                        >
                          {settings.kitchen_screen_enabled ? 'ON (Live at /kitchen)' : 'OFF (Orders in Manager only)'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-1 max-w-md">
                        {settings.kitchen_screen_enabled
                          ? 'Kitchen chefs have a full-screen board to cook and mark food ready.'
                          : 'When Kitchen is OFF, /kitchen shows "Kitchen screen is disabled" and orders appear only in the manager dashboard.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {settings.kitchen_screen_enabled && (
                        <Link
                          href="/kitchen"
                          target="_blank"
                          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 transition"
                        >
                          <span>Open /kitchen</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.kitchen_screen_enabled}
                          onChange={e =>
                            setSettings({ ...settings, kitchen_screen_enabled: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-stone-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section 6: Google Spreadsheet */}
                <div className="space-y-4 pt-4 border-t border-stone-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Google Sheets Integration</span>
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">
                      Google Spreadsheet ID
                    </label>
                    <div className="relative">
                      <FileSpreadsheet className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={settings.google_sheet_id || ''}
                        onChange={e => setSettings({ ...settings, google_sheet_id: e.target.value })}
                        placeholder="1lqe2AlMhSUuXPcVIUBryfBUiL-us8r_5DzPDTwcCMUY"
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 7: Security Allowlist */}
                <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 text-xs space-y-1.5">
                  <span className="font-bold text-amber-400 block">Authorized Manager Allowlist</span>
                  <p className="text-stone-400 text-[11px]">
                    Verified with database <code>staff_emails</code> and <code>is_manager()</code> RPC function:
                  </p>
                  <code className="text-white font-mono text-[11px] block bg-stone-900 px-3 py-1.5 rounded-lg border border-stone-800">
                    friendsphotoaman2@gmail.com
                  </code>
                </div>

                {settingsSuccess && (
                  <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-2xl text-xs text-emerald-300 flex items-center gap-2.5 shadow-lg animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold">Settings saved successfully! Changes are live across customer menu, kitchen, and billing.</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full py-4 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-sm shadow-xl shadow-amber-600/20 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sliders className="w-4 h-4" />
                  <span>{savingSettings ? 'Saving Settings...' : 'Save Settings'}</span>
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* 4. MOBILE BOTTOM NAVIGATION (Phone only)                 */}
      {/* ======================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-md border-t border-stone-800 flex items-center justify-around overflow-x-auto py-1.5 px-1 gap-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center shrink-0 min-w-[46px] py-1 rounded-xl transition-all relative ${
                isActive ? 'text-amber-400 font-black' : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-400 scale-110' : 'text-stone-400'}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Table Details & Sessions Drawer Panel */}
      {selectedTableForPanel && (
        <TableDetailsPanel
          table={selectedTableForPanel}
          session={sessions[selectedTableForPanel.id] || null}
          orders={
            sessions[selectedTableForPanel.id]
              ? allOrders.filter(o => o.session_id === sessions[selectedTableForPanel.id]?.id)
              : []
          }
          waiterCall={
            waiterCalls.find(
              c => c.table_id === selectedTableForPanel.id && c.status === 'PENDING'
            ) || null
          }
          isOpen={!!selectedTableForPanel}
          onClose={() => setSelectedTableForPanel(null)}
          onGeneratePin={handleGeneratePin}
          onRegeneratePin={handleRegeneratePin}
          onCloseSession={handleCloseSession}
          onResolveWaiterCall={handleResolveWaiterCall}
          onOpenBilling={(tbl, sess, ords) => {
            setSelectedTableForPanel(null);
            setBillingTable({ table: tbl, session: sess, orders: ords });
          }}
          onOpenQR={tbl => setQrModalTable(tbl)}
          onUpdateOrderStatus={handleUpdateOrderStatus}
        />
      )}

      {/* Cancel Item Confirmation Modal (writes to audit_log) */}
      {cancellingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-stone-900 border border-red-900/60 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-red-950/80 text-red-400 border border-red-800/60 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Cancel Order Item</h3>
                <p className="text-xs text-stone-400">
                  This action will be permanently recorded in the system audit log.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-xs space-y-1">
              <span className="text-stone-400">Dish:</span>
              <strong className="text-white block text-sm">
                {cancellingItem.quantity}x {cancellingItem.itemName}
              </strong>
              <span className="text-amber-400 block font-medium">
                Table: {cancellingItem.tableNumber}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                Cancellation Reason (Audit Record):
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Customer changed mind / Kitchen out of stock"
                className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-red-500 font-medium"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCancellingItem(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition cursor-pointer"
              >
                Keep Item
              </button>
              <button
                onClick={handleConfirmCancelItem}
                disabled={cancelSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancel & Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Stand Modal */}
      {qrModalTable && (
        <TableQRCodeModal
          table={qrModalTable}
          isOpen={!!qrModalTable}
          onClose={() => setQrModalTable(null)}
          cafeName={settings.cafe_name}
        />
      )}

      {/* Counter Billing Modal */}
      {billingTable && (
        <BillingModal
          table={billingTable.table}
          session={billingTable.session}
          orders={billingTable.orders}
          settings={settings}
          isOpen={!!billingTable}
          onClose={() => setBillingTable(null)}
          onBillCompleted={() => {
            loadAllData();
          }}
        />
      )}

      {/* Category Add/Edit Modal */}
      <CategoryModal
        isOpen={categoryModalOpen}
        category={editingCategory}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSaved={loadAllData}
      />

      {/* Menu Item Add/Edit Modal with Client-Side Image Compression */}
      <MenuItemModal
        isOpen={itemModalOpen}
        item={editingItem}
        categories={categories}
        onClose={() => {
          setItemModalOpen(false);
          setEditingItem(null);
        }}
        onSaved={loadAllData}
      />

      {/* Inspected Invoice Modal (Print / PDF / Archive) */}
      {inspectedInvoice && (
        <InvoiceModal
          bill={inspectedInvoice.bill}
          items={inspectedInvoice.items}
          settings={settings}
          source={inspectedInvoice.source}
          isOpen={!!inspectedInvoice}
          onClose={() => setInspectedInvoice(null)}
        />
      )}
    </div>
  );
}

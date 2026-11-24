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
import { OrderHistoryView } from '@/components/OrderHistoryView';
import { CustomersView } from '@/components/CustomersView';
import {
  playWaiterCallChime,
  startWaiterCallRing,
  stopWaiterCallRing,
  testWaiterCallSound,
  unlockAudio,
  setAudioEnabled,
  setAudioVolume,
} from '@/lib/audio-chime';
import { apiUrl, getCookiePath } from '@/lib/base-path';
import { formatSheetDate, formatSheetDateTime } from '@/lib/date-utils';
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
  User,
  History,
  Phone,
  Users,
  HardDrive,
  Lock,
  Unlock,
  Menu,
  LayoutGrid,
} from 'lucide-react';
import Link from 'next/link';

type TabType = 'tables' | 'orders' | 'menu' | 'billing' | 'history' | 'customers' | 'reports' | 'audit' | 'qrcodes' | 'settings';

export default function ManagerDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('tables');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [managerEmail, setManagerEmail] = useState<string | null>(null);

  // Core Data
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [sessions, setSessions] = useState<Record<string, TableSession>>({});
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  // recentBills removed — all bill history now lives exclusively in Google Sheets
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
  const [customerHistory, setCustomerHistory] = useState<{
    customer: {
      name: string;
      phone: string;
      totalVisits: number;
      totalSpent: number;
      firstVisit?: string;
      lastVisit?: string;
      freeRedeemed?: number;
    };
    invoices: Array<{
      bill: Bill;
      items: OrderItem[];
      source: 'supabase' | 'google_sheets';
    }>;
  } | null>(null);

  // Live timer tick for active table cards
  const [, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Sound & Audio State
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [soundActive, setSoundActiveState] = useState(true);
  const [soundVol, setSoundVolState] = useState(0.85);

  // Realtime Connection & Speed state
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const [storageStats, setStorageStats] = useState<{ total_files: number; total_size_mb: string } | null>(null);
  const [savingPinToggle, setSavingPinToggle] = useState(false);
  const [pinToggleConfirmOpen, setPinToggleConfirmOpen] = useState(false);
  const [pendingPinToggleValue, setPendingPinToggleValue] = useState<boolean | null>(null);

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

    // Orders with items (fetch via API with admin fallback, with chime on new arrivals)
    try {
      const ordRes = await fetch(apiUrl('/api/manager/orders'));
      const ordJson = await ordRes.json();
      if (ordJson.success && ordJson.orders) {
        setAllOrders(prev => {
          if (prev.length > 0 && ordJson.orders.length > prev.length) {
            playWaiterCallChime();
          }
          return ordJson.orders as Order[];
        });
      } else {
        const { data: ordData } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false });
        if (ordData) {
          setAllOrders(prev => {
            if (prev.length > 0 && ordData.length > prev.length) {
              playWaiterCallChime();
            }
            return ordData as Order[];
          });
        }
      }
    } catch {
      const { data: ordData } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      if (ordData) {
        setAllOrders(prev => {
          if (prev.length > 0 && ordData.length > prev.length) {
            playWaiterCallChime();
          }
          return ordData as Order[];
        });
      }
    }

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

    // Bills now live exclusively in Google Sheets — no Supabase bills fetch

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        loadAllData();
      })
      .subscribe(status => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    // Window event listeners for online, focus & visibility change
    const handleOnline = () => {
      setRealtimeConnected(true);
      loadAllData();
    };
    const handleOffline = () => setRealtimeConnected(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAllData();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    // Guaranteed background polling safety net (every 4 seconds)
    const pollInterval = setInterval(() => {
      loadAllData();
    }, 4000);

    // Load initial storage stats
    loadStorageStats();

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(callSub);
      supabase.removeChannel(dataSub);
    };
  }, [loadAllData]);

  // Repeating Waiter Call Ring & Flashing Tab Title
  useEffect(() => {
    const pending = waiterCalls.filter(c => c.status === 'PENDING');
    if (pending.length > 0 && soundActive) {
      startWaiterCallRing(soundVol);
      let alt = false;
      const titleInterval = setInterval(() => {
        document.title = alt
          ? `(${pending.length}) 🛎️ Waiter Calling!`
          : `${settings.cafe_name || 'Brew & Bites'} - Manager Portal`;
        alt = !alt;
      }, 1000);
      return () => {
        clearInterval(titleInterval);
        stopWaiterCallRing();
        document.title = `${settings.cafe_name || 'Brew & Bites'} - Manager Portal`;
      };
    } else {
      stopWaiterCallRing();
      document.title = `${settings.cafe_name || 'Brew & Bites'} - Manager Portal`;
    }
  }, [waiterCalls, soundActive, soundVol, settings.cafe_name]);

  async function loadStorageStats() {
    try {
      const res = await fetch(apiUrl('/api/manager/storage-stats'));
      const data = await res.json();
      if (data.success) {
        setStorageStats({ total_files: data.total_files, total_size_mb: data.total_size_mb });
      }
    } catch {}
  }

  function handleRequestToggleMasterPin() {
    const current = settings.require_pin ?? true;
    setPendingPinToggleValue(!current);
    setPinToggleConfirmOpen(true);
  }

  async function handleConfirmToggleMasterPin() {
    if (pendingPinToggleValue === null) return;
    const target = pendingPinToggleValue;
    setPinToggleConfirmOpen(false);
    setPendingPinToggleValue(null);

    // Instant optimistic update
    setSavingPinToggle(true);
    setSettings(prev => ({ ...prev, require_pin: target }));

    try {
      const res = await fetch(apiUrl('/api/manager/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, require_pin: target }),
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch {
      setSettings(prev => ({ ...prev, require_pin: !target }));
      alert('Failed to update Table PIN mode. Please try again.');
    } finally {
      setSavingPinToggle(false);
    }
  }

  async function handleTablePinOverrideChange(tableId: string, newMode: 'DEFAULT' | 'ON' | 'OFF') {
    const currentOverrides = settings.table_pin_overrides || {};
    const updatedOverrides = { ...currentOverrides, [tableId]: newMode };
    setSettings(prev => ({ ...prev, table_pin_overrides: updatedOverrides }));
    try {
      const res = await fetch(apiUrl('/api/manager/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, table_pin_overrides: updatedOverrides }),
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch {
      setSettings(prev => ({ ...prev, table_pin_overrides: currentOverrides }));
    }
  }

  function handleSoundToggle() {
    const next = !soundActive;
    setSoundActiveState(next);
    setAudioEnabled(next);
    if (!next) {
      stopWaiterCallRing();
    } else {
      unlockAudio();
    }
  }

  function handleVolumeChange(val: number) {
    setSoundVolState(val);
    setAudioVolume(val);
  }

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
        // Instantly display PIN in UI without waiting for background queries
        setSessions(prev => ({
          ...prev,
          [tableId]: data.session as TableSession,
        }));
        loadAllData().catch(() => {});
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
        // Instantly update PIN in UI without waiting for background queries
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
        loadAllData().catch(() => {});
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
    const prevOrders = allOrders;
    // Optimistic UI update: instantly update state so clicks feel instantaneous
    setAllOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    try {
      const res = await fetch(apiUrl('/api/manager/orders/update-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (!data.success) {
        setAllOrders(prevOrders); // rollback
        alert(data.message || 'Failed to update order status');
      }
    } catch {
      setAllOrders(prevOrders); // rollback
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

      if (data.success && data.found) {
        if (data.invoices && data.invoices.length > 0) {
          setCustomerHistory({
            customer: data.customer || {
              name: data.invoices[0].bill.customer_name || 'Customer',
              phone: data.invoices[0].bill.customer_phone || q,
              totalVisits: data.invoices.length,
              totalSpent: data.invoices.reduce((acc: number, inv: { bill: Bill }) => acc + (Number(inv.bill.total_amount) || 0), 0),
              firstVisit: data.invoices[data.invoices.length - 1].bill.created_at,
              lastVisit: data.invoices[0].bill.created_at,
            },
            invoices: data.invoices,
          });
          setSearchError(null);
        } else if (data.bill) {
          setCustomerHistory({
            customer: data.customer || {
              name: data.bill.customer_name || 'Customer',
              phone: data.bill.customer_phone || q,
              totalVisits: data.bill.visit_count || 1,
              totalSpent: Number(data.bill.total_amount) || 0,
              firstVisit: data.bill.created_at,
              lastVisit: data.bill.created_at,
            },
            invoices: [
              {
                bill: data.bill,
                items: data.items || [],
                source: data.source || 'google_sheets',
              },
            ],
          });
          setSearchError(null);
        } else {
          setCustomerHistory(null);
          setSearchError(`No invoice records found for "${q}".`);
        }
      } else {
        setCustomerHistory(null);
        setSearchError(
          data.message ||
            `No invoice found for "${q}" in Google Sheets.`
        );
      }
    } catch {
      setCustomerHistory(null);
      setSearchError('Invoice search failed. Please verify network connection.');
    } finally {
      setSearchingInvoice(false);
    }
  }

  // Badges & Counters
  const pendingOrdersCount = useMemo(
    () =>
      allOrders.filter(o => {
        if (o.status === 'CANCELLED' || o.status === 'BILLED') return false;
        const activeItems = (o.order_items || []).filter(it => it.status !== 'CANCELLED');
        return activeItems.length > 0 && (o.status === 'PENDING' || o.status === 'PREPARING');
      }).length,
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

  // Group active orders by table (exclude cancelled orders and orders with 0 active items)
  const ordersByTable = useMemo(() => {
    const active = allOrders.filter(o => {
      if (o.status === 'BILLED' || o.status === 'CANCELLED') return false;
      const activeItems = (o.order_items || []).filter(it => it.status !== 'CANCELLED');
      return activeItems.length > 0;
    });
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
    { id: 'history' as TabType, label: 'Order History', icon: History },
    { id: 'customers' as TabType, label: 'Customers', icon: Users },
    { id: 'reports' as TabType, label: 'Reports', icon: BarChart3 },
    { id: 'audit' as TabType, label: 'Audit Log', icon: ShieldAlert },
    { id: 'qrcodes' as TabType, label: 'QR Codes', icon: QrCode },
    { id: 'settings' as TabType, label: 'Settings', icon: Sliders },
  ];

  const activeNavItem = navItems.find(n => n.id === activeTab);

  return (
    <div className="min-h-[100dvh] bg-stone-950 text-stone-100 flex flex-col md:flex-row font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* ======================================================== */}
      {/* 1. DESKTOP / TABLET SIDEBAR                              */}
      {/* ======================================================== */}
      <aside className="hidden md:flex flex-col justify-between w-20 lg:w-64 bg-stone-950 border-r border-stone-800/90 shrink-0 sticky top-0 h-[100dvh] z-30 transition-all">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo & Cafe Header */}
          <div className="p-4 lg:p-5 border-b border-stone-800/90 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20 shrink-0">
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

          {/* Scrollable 10-Section Navigation Links */}
          <nav className="flex-1 overflow-y-auto scrollbar-none p-2 lg:p-3 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 lg:py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                    isActive
                      ? 'bg-linear-to-r from-amber-500 to-amber-400 text-stone-950 shadow-md shadow-amber-500/25 font-black'
                      : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? 'text-stone-950 scale-105' : 'text-stone-400'}`} />
                  <span className="hidden lg:inline grow text-left truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`hidden lg:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full ${
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
        <div className="p-3 lg:p-4 border-t border-stone-800/80 space-y-2 shrink-0 bg-stone-950">
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
      {/* 1B. MOBILE / iOS SLIDE-OUT NAVIGATION DRAWER             */}
      {/* ======================================================== */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-fade-in"
          />
          <aside className="relative z-10 w-72 max-w-[82vw] h-[100dvh] bg-stone-950 border-r border-stone-800 flex flex-col justify-between shadow-2xl animate-slide-in-left pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex flex-col flex-1 min-h-0">
              <div className="p-4 border-b border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-linear-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center font-black text-base shrink-0">
                    ☕
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-black text-sm text-white truncate">{settings.cafe_name}</h2>
                    <span className="text-[10px] text-amber-400 font-mono">All 10 Sections</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-2 rounded-xl bg-stone-900 text-stone-400 hover:text-white cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto scrollbar-none p-3 space-y-1">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                        isActive
                          ? 'bg-linear-to-r from-amber-500 to-amber-400 text-stone-950 font-black shadow-md shadow-amber-500/20'
                          : 'text-stone-300 hover:bg-stone-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-stone-950' : 'text-amber-400/80'}`} />
                      <span className="grow text-left">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-stone-950 text-amber-300 font-bold' : 'bg-stone-800 text-amber-400'
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

            <div className="p-3 border-t border-stone-800 space-y-2 bg-stone-950">
              {settings.kitchen_screen_enabled && (
                <Link
                  href="/kitchen"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-stone-900 text-amber-300 text-xs font-bold border border-amber-900/40"
                >
                  <ChefHat className="w-4 h-4 text-amber-400" />
                  <span>Open Kitchen Screen</span>
                </Link>
              )}

              <div className="px-3 py-2 rounded-xl bg-stone-900/70 border border-stone-800 text-[11px] text-stone-400 truncate">
                <span className="block text-[9px] uppercase tracking-wider text-stone-500 font-bold">Signed in as</span>
                <span className="font-mono text-stone-200 truncate block">{managerEmail}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-red-400 bg-red-950/20 hover:bg-red-950/40 text-xs font-bold cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MAIN CONTENT AREA                                     */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-6">
        {/* Mobile & iOS Sticky Top Header */}
        <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 pt-[max(0.65rem,env(safe-area-inset-top))] bg-stone-950/95 backdrop-blur-md border-b border-stone-800 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 hover:border-amber-500/40 active:scale-95 transition cursor-pointer shrink-0"
              aria-label="Open menu drawer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-sm text-white tracking-tight truncate">
                  {activeNavItem?.label || 'Manager'}
                </h1>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500 animate-ping'
                  }`}
                  title={realtimeConnected ? 'Realtime Live' : 'Offline 5s Poll'}
                />
              </div>
              <span className="text-[10px] text-amber-400/90 font-medium truncate block">
                {settings.cafe_name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!soundUnlocked ? (
              <button
                onClick={handleEnableSound}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold animate-pulse cursor-pointer active:scale-95"
                title="Tap once to enable sound alerts"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Sound</span>
              </button>
            ) : (
              <button
                onClick={handleSoundToggle}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer active:scale-95 ${
                  soundActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-stone-900 text-stone-400 border-stone-800'
                }`}
                title="Toggle sound alerts"
              >
                {soundActive ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>{soundActive ? 'ON' : 'Mute'}</span>
              </button>
            )}
            <button
              onClick={loadAllData}
              className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 active:scale-95 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Waiter Request Popup Banner */}
        {pendingCalls.length > 0 && (
          <div className="bg-linear-to-r from-red-600 via-red-500 to-amber-600 text-white px-4 lg:px-6 py-3 shadow-2xl border-b border-red-400 sticky top-14 md:top-0 z-30 animate-pulse">
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
        <div className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-stone-800 bg-stone-950/70 backdrop-blur-xs sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-bold text-base text-white flex items-center gap-2 whitespace-nowrap">
              <span>{activeNavItem?.label || activeTab}</span>
            </h1>
            <span className="text-xs text-stone-600">•</span>
            <span className="text-xs text-stone-400 truncate">
              {activeTab === 'tables' && `${tables.length} Tables Registered`}
              {activeTab === 'orders' && `${allOrders.length} Active Orders Tracked`}
              {activeTab === 'menu' && `${menuItems.length} Dishes Listed`}
              {activeTab === 'billing' && `${activeSessionsCount} Active Sessions Waiting`}
              {activeTab === 'history' && 'Completed Orders & Google Sheets Archive'}
              {activeTab === 'customers' && 'Customer Directory & Visit Loyalty'}
              {activeTab === 'reports' && 'Live Performance & Analytics'}
              {activeTab === 'audit' && 'System Activity & Tamper-Proof Audit Trail'}
              {activeTab === 'qrcodes' && '4x6 Acrylic Stand Cards & NFC URLs'}
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
                <span>Audio Blocked (Tap ON)</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 px-2.5 py-1 rounded-xl">
                <button
                  onClick={handleSoundToggle}
                  className={`flex items-center gap-1 text-xs font-bold transition cursor-pointer ${
                    soundActive ? 'text-emerald-400' : 'text-stone-500 hover:text-stone-300'
                  }`}
                  title={soundActive ? 'Sound is ON (click to mute)' : 'Sound is MUTED (click to enable)'}
                >
                  {soundActive ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{soundActive ? 'Sound ON' : 'Muted'}</span>
                </button>
                <span className="text-stone-700 text-xs">|</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={soundVol}
                  onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-14 h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  title={`Volume: ${Math.round(soundVol * 100)}%`}
                />
                <span className="text-stone-700 text-xs">|</span>
                <button
                  onClick={() => testWaiterCallSound(soundVol)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer"
                  title="Test waiter call sound ring"
                >
                  Test Ring
                </button>
              </div>
            )}

            {/* Realtime Status Indicator */}
            {realtimeConnected ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden lg:inline">Realtime Live</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-950/80 border border-red-500/30 text-red-400 text-[11px] font-bold font-mono">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>Offline (5s Poll)</span>
              </span>
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
            <div className="space-y-5 animate-fade-in">
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

              {/* Master Table PIN Requirement Switch */}
              <div className="p-4 sm:p-5 rounded-3xl bg-stone-900 border border-stone-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${settings.require_pin ?? true ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {settings.require_pin ?? true ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                        <span>Master Table PIN:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                          settings.require_pin ?? true
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {settings.require_pin ?? true ? 'ON (PIN Required)' : 'OFF (Instant Direct Access)'}
                        </span>
                      </h3>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {settings.require_pin ?? true
                          ? 'Guests must enter the 4-digit PIN generated for their table to access the menu.'
                          : 'Guests directly access the ordering menu upon scanning QR or tapping NFC tag.'}
                      </p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-stone-950/70 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-center gap-2 mt-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Warning:</strong> With PIN OFF, anyone who scans can order. Use ON when people may order from outside the cafe.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <button
                    type="button"
                    onClick={handleRequestToggleMasterPin}
                    disabled={savingPinToggle}
                    className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden touch-manipulation select-none active:scale-95 ${
                      settings.require_pin ?? true ? 'bg-amber-500' : 'bg-stone-700'
                    }`}
                    title="Toggle Master PIN Requirement"
                  >
                    <span
                      className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-stone-950 shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center text-[10px] font-black ${
                        settings.require_pin ?? true ? 'translate-x-8 text-amber-400' : 'translate-x-0 text-stone-400'
                      }`}
                    >
                      {settings.require_pin ?? true ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tables.map((table, idx) => {
                  const session = sessions[table.id];
                  const isActive = !!session && session.status === 'ACTIVE';
                  const waiterCall = waiterCalls.find(
                    c => c.table_id === table.id && c.status === 'PENDING'
                  );
                  const isWaiterCalling = !!waiterCall;

                  // Per-table PIN requirement evaluation
                  const tableOverride = settings.table_pin_overrides?.[table.id] || 'DEFAULT';
                  const isPinRequired = tableOverride === 'ON' ? true : tableOverride === 'OFF' ? false : (settings.require_pin ?? true);

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
                      style={{ animationDelay: `${Math.min(idx * 40, 240)}ms` }}
                      onClick={() => setSelectedTableForPanel(table)}
                      className={`rounded-3xl border p-4 sm:p-5 flex flex-col justify-between transition-all cursor-pointer relative active:scale-[0.99] sm:hover:-translate-y-0.5 animate-fade-in-up ${
                        isWaiterCalling
                          ? 'bg-linear-to-br from-stone-900 via-stone-900 to-red-950/50 border-red-500 hover:border-red-400 shadow-xl shadow-red-500/20 animate-pulse'
                          : isActive
                          ? 'bg-linear-to-br from-stone-900 via-stone-900 to-amber-950/30 border-amber-500/60 hover:border-amber-400 shadow-lg shadow-amber-500/10'
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

                            {/* State & PIN Mode Badges */}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
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

                              {!isPinRequired && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-500/30 font-mono">
                                  <Unlock className="w-2.5 h-2.5 text-blue-400" />
                                  <span>Open (no PIN)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Per-Table PIN Override Dropdown */}
                            <select
                              onClick={e => e.stopPropagation()}
                              value={tableOverride}
                              onChange={e =>
                                handleTablePinOverrideChange(
                                  table.id,
                                  e.target.value as 'DEFAULT' | 'ON' | 'OFF'
                                )
                              }
                              className="text-[10px] bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-stone-300 font-mono focus:outline-hidden hover:border-amber-500/50 cursor-pointer"
                              title="Per-table PIN requirement override"
                            >
                              <option value="DEFAULT">
                                Default ({settings.require_pin ?? true ? 'PIN ON' : 'PIN OFF'})
                              </option>
                              <option value="ON">PIN: Force ON</option>
                              <option value="OFF">PIN: Force OFF (Open)</option>
                            </select>

                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setQrModalTable(table);
                              }}
                              className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                              title="Print / View QR Stand"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Waiter Calling Alert Note + 1-Tap Resolve */}
                        {isWaiterCalling && (
                          <div className="bg-red-950/80 border border-red-700/80 rounded-2xl p-3 my-2 text-xs text-red-200 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-bold text-[10px] uppercase tracking-wider block text-red-400">
                                Assistance Requested:
                              </span>
                              <p className="italic font-medium truncate">
                                &quot;{waiterCall.note || 'Staff requested at table'}&quot;
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleResolveWaiterCall(waiterCall.id);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-xs shrink-0 flex items-center gap-1 shadow-md cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Done</span>
                            </button>
                          </div>
                        )}

                        {/* PIN Area */}
                        {!isPinRequired ? (
                          <div className="bg-blue-950/20 border border-blue-500/30 rounded-2xl p-3.5 my-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider mb-0.5">
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Direct Access Mode (No PIN)</span>
                            </div>
                            <p className="text-[11px] text-stone-300 font-sans">
                              {isActive
                                ? 'Customer has open ordering session.'
                                : 'Table is open. Scanning QR opens menu directly.'}
                            </p>
                            {isActive && (
                              <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-blue-200/80 mt-1">
                                <Clock className="w-3 h-3 text-blue-400" />
                                <span>Open for: <strong>{getTableDuration(session.opened_at)}</strong></span>
                              </div>
                            )}
                          </div>
                        ) : isActive ? (
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
                        {isPinRequired ? (
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
                        ) : (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedTableForPanel(table);
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5 text-blue-400" />
                            <span>Manage Table</span>
                          </button>
                        )}

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
            <div className="space-y-5 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">
                    Live Table Orders
                  </h2>
                  <p className="text-xs text-stone-400">
                    Realtime active orders grouped by table. Move status or cancel items with audit logging.
                  </p>
                </div>

                {/* Filter Chips (Mobile scrollable strip) */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 max-w-full">
                  {(['ALL', 'PENDING', 'PREPARING', 'READY', 'SERVED'] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => setOrderFilter(filter)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                        orderFilter === filter
                          ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                          : 'bg-stone-900 text-stone-400 hover:bg-stone-800 border border-stone-800'
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
                <div className="bg-amber-950/60 border border-amber-900/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-fade-in">
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
                      className={`rounded-3xl border p-4 sm:p-5 space-y-4 transition-all shadow-md animate-fade-in-up ${
                        isCalling
                          ? 'bg-linear-to-br from-stone-900 via-stone-900 to-red-950/60 border-red-500 shadow-xl shadow-red-500/20 animate-pulse'
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
                                        className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
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
            <div className="space-y-5 animate-fade-in">
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
                  <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={e => setMenuSearch(e.target.value)}
                    placeholder="Search dishes by name (English or हिन्दी)..."
                    className="w-full pl-9 pr-9 py-2 text-base sm:text-xs rounded-xl bg-stone-800 border border-stone-700 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500"
                  />
                  {menuSearch && (
                    <button
                      type="button"
                      onClick={() => setMenuSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-white cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Veg / Non-Veg Filter (Scrollable on phones) */}
                <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
                  <Filter className="w-3.5 h-3.5 text-stone-500 hidden sm:block" />
                  <button
                    onClick={() => setVegFilter('ALL')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      vegFilter === 'ALL'
                        ? 'bg-amber-500 text-stone-950 font-black'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    All ({menuItems.length})
                  </button>
                  <button
                    onClick={() => setVegFilter('VEG')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      vegFilter === 'VEG'
                        ? 'bg-emerald-500 text-stone-950 font-black'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    Veg Only
                  </button>
                  <button
                    onClick={() => setVegFilter('NON_VEG')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
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
                {filteredMenuItems.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{ animationDelay: `${Math.min(idx * 30, 180)}ms` }}
                    className={`bg-stone-900 border rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all shadow-sm animate-fade-in-up ${
                      item.is_available
                        ? 'border-stone-800 hover:border-stone-700'
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
            <div className="space-y-6 animate-fade-in">
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
                      <span>Search Customer History &amp; Invoices</span>
                    </h3>
                    <p className="text-xs text-stone-400">
                      Search customer visit history and bills live from your Google Sheets archive by Order ID (e.g. ORD-241126-0001) or Phone (e.g. 8604600292).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Google Sheets Realtime (All-Time)
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSearchInvoice} className="flex flex-col sm:flex-row items-stretch gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Enter Order ID (e.g. ORD-241126-0001) or 10-digit Phone..."
                      value={invoiceSearchQuery}
                      onChange={e => {
                        setInvoiceSearchQuery(e.target.value);
                        if (searchError) setSearchError(null);
                      }}
                      className="w-full pl-10 pr-10 py-2.5 text-base sm:text-xs rounded-2xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500 font-mono"
                    />
                    {invoiceSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setInvoiceSearchQuery('');
                          setSearchError(null);
                          setCustomerHistory(null);
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
                        <span>Search</span>
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

                {/* Customer History & All Invoices Ledger */}
                {customerHistory && (
                  <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-stone-950 border border-amber-500/40 shadow-xl space-y-4">
                    {/* Customer Profile Banner */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-stone-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm sm:text-base font-bold text-white">
                              {customerHistory.customer.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                              {customerHistory.customer.totalVisits} {customerHistory.customer.totalVisits === 1 ? 'Visit' : 'Visits'}
                            </span>
                            {customerHistory.customer.freeRedeemed ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                                <Gift className="w-3 h-3" />
                                {customerHistory.customer.freeRedeemed} Free Coffee Claimed
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-stone-400 font-mono flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-stone-500" />
                              <span>{customerHistory.customer.phone}</span>
                            </span>
                            {customerHistory.customer.totalSpent > 0 && (
                              <span className="text-emerald-400 font-bold">
                                Total Spent: ₹{customerHistory.customer.totalSpent}
                              </span>
                            )}
                            {customerHistory.customer.firstVisit && (
                              <span className="text-stone-500">
                                First Visit: {formatSheetDate(customerHistory.customer.firstVisit)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCustomerHistory(null);
                          setInvoiceSearchQuery('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer self-end sm:self-auto shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Close</span>
                      </button>
                    </div>

                    {/* All Visits & Invoices List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5" />
                          <span>All Visits &amp; Invoices ({customerHistory.invoices.length})</span>
                        </h5>
                        <span className="text-[10px] text-stone-500 font-mono hidden sm:inline">
                          All-time fetched live from Google Sheets
                        </span>
                      </div>

                      {/* Mobile Ledger Card View */}
                      <div className="md:hidden space-y-2.5">
                        {customerHistory.invoices.map((inv, idx) => (
                          <div
                            key={inv.bill.id || inv.bill.invoice_number || idx}
                            className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-amber-300 text-xs">
                                    {inv.bill.invoice_number}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black font-mono">
                                    Visit #{inv.bill.visit_count || customerHistory.invoices.length - idx}
                                  </span>
                                </div>
                                <span className="text-[11px] text-stone-400 block mt-0.5">
                                  {inv.bill.table_number || 'Table'} •{' '}
                                  {inv.bill.created_at
                                    ? formatSheetDateTime(inv.bill.created_at, {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true,
                                        timeZone: 'Asia/Kolkata',
                                      })
                                    : 'N/A'}
                                </span>
                              </div>
                              <span className="font-mono font-black text-white text-sm shrink-0">
                                ₹{inv.bill.total_amount}
                              </span>
                            </div>

                            <p className="text-xs text-stone-300 line-clamp-2">
                              {inv.items.length > 0
                                ? inv.items.map(i => `${i.quantity}x ${i.item_name_en}`).join(', ')
                                : 'Items synced'}
                            </p>

                            <div className="flex items-center justify-between pt-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-400 border border-blue-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                Google Sheets
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  setInspectedInvoice({
                                    bill: inv.bill,
                                    items: inv.items,
                                    source: inv.source,
                                  });
                                }}
                                className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold inline-flex items-center gap-1 shadow-sm transition cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>View / Print</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Ledger Table View */}
                      <div className="hidden md:block overflow-x-auto rounded-xl border border-stone-800">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-stone-800 text-[10px] sm:text-[11px] text-stone-400 uppercase font-bold bg-stone-900/90">
                              <th className="py-2 px-3 font-mono">Visit #</th>
                              <th className="py-2 px-3">Date &amp; Time</th>
                              <th className="py-2 px-3 font-mono">Invoice #</th>
                              <th className="py-2 px-3">Table</th>
                              <th className="py-2 px-3">Items Ordered</th>
                              <th className="py-2 px-3">Total Amount</th>
                              <th className="py-2 px-3">Source</th>
                              <th className="py-2 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-800/60 font-mono">
                            {customerHistory.invoices.map((inv, idx) => (
                              <tr key={inv.bill.id || inv.bill.invoice_number || idx} className="hover:bg-stone-900/50 transition">
                                <td className="py-2.5 px-3 font-bold text-amber-400">
                                  Visit #{inv.bill.visit_count || (customerHistory.invoices.length - idx)}
                                </td>
                                <td className="py-2.5 px-3 text-stone-300 whitespace-nowrap font-sans text-xs">
                                  {inv.bill.created_at
                                    ? formatSheetDateTime(inv.bill.created_at)
                                    : 'N/A'}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-amber-300">
                                  {inv.bill.invoice_number}
                                </td>
                                <td className="py-2.5 px-3 text-stone-300 font-sans">
                                  {inv.bill.table_number || 'Table'}
                                </td>
                                <td className="py-2.5 px-3 text-stone-300 font-sans max-w-[200px] truncate" title={inv.items.map(i => `${i.quantity}x ${i.item_name_en}`).join(', ')}>
                                  {inv.items.length > 0
                                    ? inv.items.map(i => `${i.quantity}x ${i.item_name_en}`).join(', ')
                                    : 'Items synced'}
                                </td>
                                <td className="py-2.5 px-3 font-black text-white whitespace-nowrap">
                                  ₹{inv.bill.total_amount}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-400 border border-blue-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Google Sheets
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap font-sans">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInspectedInvoice({
                                        bill: inv.bill,
                                        items: inv.items,
                                        source: inv.source,
                                      });
                                    }}
                                    className="py-1 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold inline-flex items-center gap-1 shadow-sm transition cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>View / Print</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
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

              {/* Recent Billed History — now in Google Sheets, go to Order History tab */}
              <div className="space-y-3 pt-4 border-t border-stone-800">
                <div className="p-6 bg-stone-900 border border-stone-800 rounded-2xl text-center space-y-2">
                  <p className="text-xs text-stone-400">
                    All completed bills are stored in Google Sheets.
                  </p>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/30 transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>View Order History &amp; Archives</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB: ORDER HISTORY                                       */}
          {/* -------------------------------------------------------- */}
          {activeTab === 'history' && (
            <OrderHistoryView
              onReprintInvoice={(bill, items) => {
                setInspectedInvoice({
                  bill,
                  items: items || [],
                  source: 'google_sheets',
                });
              }}
            />
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB: CUSTOMER DIRECTORY                                  */}
          {/* -------------------------------------------------------- */}
          {activeTab === 'customers' && (
            <CustomersView />
          )}

          {/* -------------------------------------------------------- */}
          {/* TAB: REPORTS                                             */}
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
            <div className="max-w-3xl bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-8 space-y-6 animate-fade-in">
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
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-medium"
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
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-medium"
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
                          className="w-full pl-9 pr-3.5 py-2.5 text-base sm:text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-medium"
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
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-medium"
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
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono tracking-wider"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        GST / Tax Calculation
                      </label>
                      <div className="flex items-center justify-between p-2.5 bg-stone-800/90 border border-stone-700 rounded-xl min-h-[44px] sm:h-[42px]">
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
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono disabled:opacity-40"
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
                          className="w-full pl-9 pr-3.5 py-2.5 text-base sm:text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono uppercase"
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
                          className="w-full pl-9 pr-3.5 py-2.5 text-base sm:text-sm rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono"
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
                        className="w-16 px-2.5 py-2 text-center text-base sm:text-sm rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono font-bold"
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {(['58mm', '80mm'] as const).map(size => (
                      <label
                        key={size}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition touch-manipulation ${
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
                            className="accent-amber-500 w-4 h-4 shrink-0"
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

                  <div className="p-4 bg-stone-800/50 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
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

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      {settings.kitchen_screen_enabled && (
                        <Link
                          href="/kitchen"
                          target="_blank"
                          className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 transition touch-manipulation"
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
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-stone-800/90 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono text-base sm:text-xs"
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
                  <code className="text-white font-mono text-[11px] block bg-stone-900 px-3 py-1.5 rounded-lg border border-stone-800 break-all">
                    friendsphotoaman2@gmail.com
                  </code>
                </div>

                {/* Section 7: Table Security & PIN Switch (Mirrored) */}
                <div className="space-y-4 pt-4 border-t border-stone-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    <span>Table Security &amp; 4-Digit PIN Switch</span>
                  </h3>

                  <div className="p-4 bg-stone-800/50 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-sm text-white">Require Table PIN by Default</h4>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            settings.require_pin ?? true
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {settings.require_pin ?? true ? 'ON (PIN Required)' : 'OFF (Instant Direct Access)'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-1 max-w-md">
                        {settings.require_pin ?? true
                          ? 'Guests must enter the 4-digit PIN generated by manager before ordering.'
                          : 'Guests directly access the ordering menu upon scanning QR code or tapping NFC tag.'}
                      </p>
                      <p className="text-[11px] text-amber-400/90 font-medium mt-1">
                        Notice: With PIN OFF, anyone who scans can order. Use ON when people may order from outside the cafe.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-center">
                      <input
                        type="checkbox"
                        checked={settings.require_pin ?? true}
                        onChange={e => setSettings({ ...settings, require_pin: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-stone-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>

                {/* Section 8: Supabase Storage Used & Images */}
                <div className="space-y-4 pt-4 border-t border-stone-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    <span>Supabase Storage Used &amp; Media</span>
                  </h3>

                  <div className="p-4 bg-stone-800/50 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-sm text-white">Menu Photos Storage</h4>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-900 border border-stone-700 text-stone-300 font-bold">
                          {storageStats ? `${storageStats.total_files} files • ${storageStats.total_size_mb} MB` : 'Loading storage stats...'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-1 max-w-md">
                        Dish photos compressed to ~800px WebP (&lt;150 KB). Deleting a dish removes its image automatically.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch(apiUrl('/api/cron/cleanup-storage'));
                          const d = await res.json();
                          alert(d.message || 'Storage cleanup complete.');
                          loadStorageStats();
                        } catch {
                          alert('Storage cleanup failed.');
                        }
                      }}
                      className="py-2.5 sm:py-2 px-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer active:scale-95 touch-manipulation"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Clean Orphaned Photos</span>
                    </button>
                  </div>
                </div>

                {settingsSuccess && (
                  <div className="p-3.5 bg-emerald-950/80 border border-emerald-800 rounded-2xl text-xs text-emerald-300 flex items-center gap-2.5 shadow-lg animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold">Settings saved successfully! Changes are live across customer menu, kitchen, and billing.</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold text-base sm:text-sm shadow-xl shadow-amber-600/20 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 touch-manipulation"
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
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-md border-t border-stone-800/90 flex items-center justify-around px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.45)]">
        {navItems
          .filter(item => ['tables', 'orders', 'menu', 'billing'].includes(item.id))
          .map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-1 rounded-xl transition-all active:scale-95 relative ${
                  isActive ? 'text-amber-400 font-black' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'text-amber-400 scale-110' : 'text-stone-400'}`} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
              </button>
            );
          })}
        {(() => {
          const isMoreActive = ['history', 'customers', 'reports', 'audit', 'qrcodes', 'settings'].includes(activeTab);
          return (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-1 rounded-xl transition-all active:scale-95 relative ${
                isMoreActive || mobileDrawerOpen ? 'text-amber-400 font-black' : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              <div className="relative">
                <LayoutGrid className={`w-5 h-5 transition-transform duration-200 ${isMoreActive || mobileDrawerOpen ? 'text-amber-400 scale-110' : 'text-stone-400'}`} />
                {isMoreActive && (
                  <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">More</span>
            </button>
          );
        })()}
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
        <div
          onClick={() => setCancellingItem(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-stone-900 border border-red-900/60 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl space-y-4 animate-slide-up sm:animate-scale-up"
          >
            <div className="w-10 h-1 rounded-full bg-stone-700 mx-auto -mt-1 sm:hidden" />
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
                className="w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-red-500 font-medium"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setCancellingItem(null)}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition cursor-pointer active:scale-95 touch-manipulation"
              >
                Keep Item
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelItem}
                disabled={cancelSubmitting}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer active:scale-95 touch-manipulation"
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

      {/* Master PIN Requirement Toggle Confirmation Modal */}
      {pinToggleConfirmOpen && pendingPinToggleValue !== null && (
        <div
          onClick={() => {
            setPinToggleConfirmOpen(false);
            setPendingPinToggleValue(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl space-y-4 animate-slide-up sm:animate-scale-up"
          >
            <div className="w-10 h-1 rounded-full bg-stone-700 mx-auto -mt-1 sm:hidden" />
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  pendingPinToggleValue
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {pendingPinToggleValue ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-black text-base text-white">
                  {pendingPinToggleValue ? 'Turn Master Table PIN ON?' : 'Turn Master Table PIN OFF?'}
                </h3>
                <span
                  className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    pendingPinToggleValue
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {pendingPinToggleValue ? 'Require 4-Digit PIN' : 'Instant Direct Access'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800/80 text-xs text-stone-300 space-y-2 leading-relaxed">
              {pendingPinToggleValue ? (
                <p>
                  Guests will be <strong>required to enter a 4-digit PIN</strong> generated by the manager before they can view the menu or place any orders. Recommended during peak hours.
                </p>
              ) : (
                <p>
                  Guests will <strong>directly access the ordering menu</strong> upon scanning the QR code without needing a PIN. Anyone who has the link will be able to submit orders.
                </p>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPinToggleConfirmOpen(false);
                  setPendingPinToggleValue(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition cursor-pointer active:scale-95 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleMasterPin}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs shadow-md transition cursor-pointer active:scale-95 touch-manipulation ${
                  pendingPinToggleValue
                    ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-500/20'
                }`}
              >
                {pendingPinToggleValue ? 'Yes, Turn PIN ON' : 'Yes, Turn PIN OFF'}
              </button>
            </div>
          </div>
        </div>
      )}

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

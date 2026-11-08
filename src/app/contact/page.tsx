"use client";

import React, { useState } from "react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import { useToast } from "@/components/ui/Toast";
import {
  MapPin,
  Phone,
  Clock,
  Wifi,
  Send,
  CheckCircle2,
  Navigation,
  Mail,
  Copy,
  Sparkles,
} from "lucide-react";

export default function ContactPage() {
  const { showToast } = useToast();
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [inquiryType, setInquiryType] = useState<"reservation" | "event" | "beans">("reservation");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    guests: "2",
    message: "",
  });

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard!`, "success");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setFormSubmitted(true);
    showToast("Thank you! Your inquiry has been sent to our manager.", "success");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900">
      <Navbar />

      <main className="flex-1 py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-900 mb-3 border border-amber-400/30">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Indiranagar Roastery &amp; Lounge</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight">
              Visit &amp; Connect With Us
            </h1>
            <p className="mt-2 text-xs sm:text-base text-zinc-600 font-light leading-relaxed">
              Join us for quiet morning pour-overs, sunny courtyard weekend brunches, or reserve seating for group gatherings.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Left Contact & Details Cards (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Live Hours Card */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      Open Daily
                    </span>
                  </div>
                  <span className="text-xs font-bold text-zinc-500">
                    8:00 AM &ndash; 11:00 PM
                  </span>
                </div>
                <div className="flex items-start gap-3.5 pt-2 border-t border-zinc-100">
                  <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-serif text-base font-bold text-zinc-950">
                      Operating Schedule
                    </h3>
                    <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                      Barista bar and breakfast commence at 8:00 AM daily. Hot kitchen orders accepted until 10:30 PM.
                    </p>
                  </div>
                </div>
              </div>

              {/* Address Card */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3.5">
                    <MapPin className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-serif text-base font-bold text-zinc-950">
                        Address &amp; Location
                      </h3>
                      <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                        {DEMO_SETTINGS.address}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {DEMO_SETTINGS.area}, {DEMO_SETTINGS.city} &ndash; {DEMO_SETTINGS.postalCode}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                  <a
                    href="https://maps.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition"
                  >
                    <Navigation className="h-3.5 w-3.5 text-amber-400" />
                    <span>Get Directions</span>
                  </a>

                  <button
                    onClick={() => handleCopy(`${DEMO_SETTINGS.address}, ${DEMO_SETTINGS.city}`, "address")}
                    className="p-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition"
                    title="Copy Address"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Phone & Email Inquiries */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-3">
                <h3 className="font-serif text-base font-bold text-zinc-950">
                  Direct Inquiries &amp; Orders
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-center gap-2 text-zinc-700">
                      <Phone className="h-4 w-4 text-amber-600" />
                      <span className="font-bold">{DEMO_SETTINGS.phone}</span>
                    </div>
                    <a
                      href={`tel:${DEMO_SETTINGS.phone}`}
                      className="text-[11px] font-bold text-amber-900 underline"
                    >
                      Call Now
                    </a>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-center gap-2 text-zinc-700">
                      <Mail className="h-4 w-4 text-amber-600" />
                      <span className="font-bold truncate max-w-[180px]">{DEMO_SETTINGS.email}</span>
                    </div>
                    <a
                      href={`mailto:${DEMO_SETTINGS.email}`}
                      className="text-[11px] font-bold text-amber-900 underline"
                    >
                      Email
                    </a>
                  </div>
                </div>
              </div>

              {/* Guest Wi-Fi & Ambiance card */}
              <div className="rounded-3xl border border-amber-300/60 bg-amber-50/60 p-5 text-xs text-amber-950 flex items-start gap-3">
                <Wifi className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">5G Guest High-Speed Wi-Fi</strong>
                  <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                    Network: <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950 border border-amber-200">{DEMO_SETTINGS.wifiSsid}</code>
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">Power outlets accessible at all mezzanine booths.</p>
                </div>
              </div>
            </div>

            {/* Right Contact / Inquiry Form (7 cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-zinc-200 bg-white p-7 sm:p-10 shadow-xl space-y-6">
                <div>
                  <h3 className="font-serif text-2xl font-black text-zinc-950">
                    Send an Inquiry or Reserve
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Direct communication with our Indiranagar café manager.
                  </p>
                </div>

                {/* Inquiry Type Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { id: "reservation", label: "Table Reservation" },
                    { id: "event", label: "Private Event / Cupping" },
                    { id: "beans", label: "Whole Bean Roasting" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setInquiryType(type.id as typeof inquiryType)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                        inquiryType === type.id
                          ? "bg-zinc-950 text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                {formSubmitted ? (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-8 text-center animate-fade-in space-y-3">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h4 className="font-serif text-lg font-bold text-emerald-950">
                      Message Received, {formData.name}!
                    </h4>
                    <p className="text-xs text-emerald-800 max-w-sm mx-auto leading-relaxed">
                      Our shift manager will review your inquiry and confirm details with you at <strong className="font-mono">{formData.phone}</strong> shortly.
                    </p>
                    <button
                      onClick={() => {
                        setFormSubmitted(false);
                        setFormData({ name: "", email: "", phone: "", guests: "2", message: "" });
                      }}
                      className="mt-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition"
                    >
                      Send Another Note
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder="e.g. Arjun Verma"
                          className="w-full rounded-xl border border-zinc-200 p-3 text-xs sm:text-sm focus:border-zinc-900 focus:outline-none transition shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1">
                          Mobile Phone *
                        </label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          placeholder="+91 98765 00000"
                          className="w-full rounded-xl border border-zinc-200 p-3 text-xs sm:text-sm focus:border-zinc-900 focus:outline-none transition shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1">
                          Email Address (Optional)
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="you@domain.com"
                          className="w-full rounded-xl border border-zinc-200 p-3 text-xs sm:text-sm focus:border-zinc-900 focus:outline-none transition shadow-xs"
                        />
                      </div>

                      {inquiryType === "reservation" && (
                        <div>
                          <label className="block text-xs font-bold text-zinc-700 mb-1">
                            Number of Guests
                          </label>
                          <select
                            value={formData.guests}
                            onChange={(e) =>
                              setFormData({ ...formData, guests: e.target.value })
                            }
                            className="w-full rounded-xl border border-zinc-200 p-3 text-xs sm:text-sm focus:border-zinc-900 focus:outline-none transition shadow-xs bg-white"
                          >
                            <option value="1">1 Person (Quiet Work Table)</option>
                            <option value="2">2 Persons (Standard Table)</option>
                            <option value="4">3–4 Persons (Courtyard Booth)</option>
                            <option value="6">5–6 Persons (Large Family Table)</option>
                            <option value="8">7+ Persons (Group Lounge)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">
                        Special Requests or Timing
                      </label>
                      <textarea
                        rows={3}
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        placeholder="Expected arrival time, dietary considerations, or seating preference (Courtyard vs Mezzanine)..."
                        className="w-full rounded-xl border border-zinc-200 p-3 text-xs sm:text-sm focus:border-zinc-900 focus:outline-none transition shadow-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 py-3.5 px-6 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-zinc-800 transition active:scale-95"
                    >
                      <Send className="h-4 w-4 text-amber-300" />
                      <span>Submit Inquiry</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

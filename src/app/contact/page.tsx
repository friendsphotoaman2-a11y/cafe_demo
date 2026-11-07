"use client";

import React, { useState } from "react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import {
  MapPin,
  Phone,
  Clock,
  Wifi,
  Send,
  CheckCircle2,
  Navigation,
} from "lucide-react";

export default function ContactPage() {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setFormSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900">
      <Navbar />

      <main className="flex-1 py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-cafe-600">
              Find &amp; Connect With Us
            </span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-cafe-950 mt-2">
              Visit Our Indiranagar Space
            </h1>
            <p className="mt-3 text-sm sm:text-base text-zinc-600">
              We look forward to welcoming you for quiet work sessions, lively brunch with friends, or fresh whole bean takeaways.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Contact & Details Cards (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Address Card */}
              <div className="rounded-2xl border border-cafe-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-cafe-950">
                      Address &amp; Location
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                      {DEMO_SETTINGS.address}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {DEMO_SETTINGS.area}, {DEMO_SETTINGS.city} &ndash; {DEMO_SETTINGS.postalCode}
                    </p>
                    <a
                      href="https://maps.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-cafe-800 hover:text-cafe-950 underline"
                    >
                      <Navigation className="h-3.5 w-3.5 text-amber-600" />
                      <span>Open in Google Maps &rarr;</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Hours Card */}
              <div className="rounded-2xl border border-cafe-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-cafe-950">
                      Roastery &amp; Café Hours
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-zinc-800">
                      {DEMO_SETTINGS.openingHours}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Breakfast &amp; Pour-overs begin at 8:00 AM. Kitchen closes at 10:30 PM.
                    </p>
                  </div>
                </div>
              </div>

              {/* Phone & Direct Inquiries */}
              <div className="rounded-2xl border border-cafe-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-cafe-950">
                      Direct Inquiries
                    </h3>
                    <div className="mt-2 space-y-1 text-xs text-zinc-600">
                      <p>
                        <span className="font-semibold text-zinc-800">Phone: </span>
                        {DEMO_SETTINGS.phone}
                      </p>
                      <p>
                        <span className="font-semibold text-zinc-800">Email: </span>
                        {DEMO_SETTINGS.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amenities pill */}
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-5 text-xs text-amber-900 flex items-center gap-3">
                <Wifi className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Guest Wi-Fi Available: </span>
                  Connect to <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono text-amber-950">{DEMO_SETTINGS.wifiSsid}</code> when seated.
                </div>
              </div>
            </div>

            {/* Right Contact / Inquiry Form (7 cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-cafe-200 bg-white p-8 sm:p-10 shadow-lg">
                <h3 className="font-serif text-2xl font-bold text-cafe-950 mb-2">
                  Drop Us a Message
                </h3>
                <p className="text-xs text-zinc-500 mb-6">
                  For private cupping sessions, group bookings, or catering requests.
                </p>

                {formSubmitted ? (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-8 text-center animate-fade-in">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h4 className="font-serif text-lg font-bold text-emerald-950">
                      Thank You, {formData.name}!
                    </h4>
                    <p className="mt-1 text-xs text-emerald-700 max-w-sm mx-auto">
                      Your inquiry has been received by our Indiranagar manager. We will get back to you at {formData.phone} shortly.
                    </p>
                    <button
                      onClick={() => {
                        setFormSubmitted(false);
                        setFormData({ name: "", email: "", phone: "", message: "" });
                      }}
                      className="mt-5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Your Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder="e.g. Arjun Verma"
                          className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
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
                          className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="you@domain.com"
                        className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        How can we help?
                      </label>
                      <textarea
                        rows={4}
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        placeholder="Table reservation for 6, roastery cupping inquiry, or private event..."
                        className="w-full rounded-xl border border-zinc-200 p-3 text-sm focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3.5 px-6 text-sm font-bold text-white shadow-md hover:bg-cafe-800 transition active:scale-95"
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


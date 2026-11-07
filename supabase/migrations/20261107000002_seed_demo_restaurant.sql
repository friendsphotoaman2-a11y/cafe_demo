-- =============================================================================
-- Migration: 20261107000002_seed_demo_restaurant.sql
-- Description: Seed initial demo restaurant "Brew & Bean Café", settings, staff, tables, categories & menu
-- =============================================================================

DO $$
DECLARE
    v_restaurant_id UUID;
    v_cat_coffee UUID;
    v_cat_tea UUID;
    v_cat_sandwiches UUID;
    v_cat_snacks UUID;
    v_cat_desserts UUID;
    v_cat_cold UUID;
BEGIN
    -- 1. Insert or get restaurant
    INSERT INTO public.restaurants (slug, name, tagline)
    VALUES ('brew-and-bean', 'Brew & Bean Café', 'Artisan Coffee Roasters & Fresh Kitchen')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_restaurant_id;

    -- 2. Restaurant Settings
    INSERT INTO public.restaurant_settings (
        restaurant_id, address, area, city, postal_code, phone, email,
        gst_number, gst_rate_percent, currency_symbol, currency_code,
        opening_hours, wifi_ssid, wifi_password, upi_id
    ) VALUES (
        v_restaurant_id,
        'Plot 104, 100 Feet Road, HAL 2nd Stage, Indiranagar',
        'Indiranagar', 'Bengaluru', '560038',
        '+91 98765 43210', 'hello@brewandbean.in',
        '29AAAAA0000A1Z5', 5.00, '₹', 'INR',
        'Mon – Sun: 8:00 AM – 11:00 PM',
        'BrewBean_Guest_5G', 'FreshCoffee2026',
        'brewbean@okaxis'
    ) ON CONFLICT (restaurant_id) DO NOTHING;

    -- 3. Staff accounts
    INSERT INTO public.restaurant_staff (restaurant_id, email, full_name, role)
    VALUES
        (v_restaurant_id, 'owner@brewandbean.in', 'Aman (Café Owner)', 'owner'),
        (v_restaurant_id, 'manager@brewandbean.in', 'Siddharth (Store Manager)', 'manager'),
        (v_restaurant_id, 'cashier@brewandbean.in', 'Rahul (Head Cashier)', 'cashier'),
        (v_restaurant_id, 'kitchen@brewandbean.in', 'Chef Vikram (Lead Barista)', 'kitchen')
    ON CONFLICT (restaurant_id, email) DO NOTHING;

    -- 4. Tables 01 to 12
    INSERT INTO public.restaurant_tables (restaurant_id, code, name, capacity, section, status)
    VALUES
        (v_restaurant_id, '01', 'Table 01', 2, 'Indoor Main', 'available'),
        (v_restaurant_id, '02', 'Table 02', 4, 'Indoor Main', 'available'),
        (v_restaurant_id, '03', 'Table 03', 2, 'Window Bar', 'available'),
        (v_restaurant_id, '04', 'Table 04', 6, 'Courtyard Patio', 'available'),
        (v_restaurant_id, '05', 'Table 05', 4, 'Courtyard Patio', 'available'),
        (v_restaurant_id, '06', 'Table 06', 2, 'Courtyard Patio', 'available'),
        (v_restaurant_id, '07', 'Table 07', 4, 'Mezzanine Loft', 'available'),
        (v_restaurant_id, '08', 'Table 08', 2, 'Mezzanine Loft', 'available'),
        (v_restaurant_id, '09', 'Table 09', 4, 'Indoor Main', 'available'),
        (v_restaurant_id, '10', 'Table 10', 6, 'Indoor Main', 'available'),
        (v_restaurant_id, '11', 'Table 11', 2, 'Window Bar', 'available'),
        (v_restaurant_id, '12', 'Table 12', 4, 'Courtyard Patio', 'available')
    ON CONFLICT (restaurant_id, code) DO NOTHING;

    -- 5. Categories
    INSERT INTO public.menu_categories (restaurant_id, slug, name, icon_name, description, display_order)
    VALUES
        (v_restaurant_id, 'artisan-coffee', 'Artisan Coffee', 'Coffee', 'Specialty beans roasted weekly, hand-pulled espresso & pour-overs.', 1)
        ON CONFLICT (restaurant_id, slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_coffee;

    INSERT INTO public.menu_categories (restaurant_id, slug, name, icon_name, description, display_order)
    VALUES
        (v_restaurant_id, 'loose-leaf-tea', 'Teas & Infusions', 'CupSoda', 'Single-estate Nilgiri & Assam leaves blended with whole botanicals.', 2)
        ON CONFLICT (restaurant_id, slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_tea;

    INSERT INTO public.menu_categories (restaurant_id, slug, name, icon_name, description, display_order)
    VALUES
        (v_restaurant_id, 'gourmet-sandwiches', 'Gourmet Sandwiches', 'Utensils', 'Artisan sourdough and multigrain baguettes grilled to perfection.', 3)
        ON CONFLICT (restaurant_id, slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_sandwiches;

    INSERT INTO public.menu_categories (restaurant_id, slug, name, icon_name, description, display_order)
    VALUES
        (v_restaurant_id, 'small-bites', 'Small Bites & Sides', 'Sparkles', 'Crispy appetizers, tapas plates, and savory cafe snacks.', 4)
        ON CONFLICT (restaurant_id, slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_snacks;

    INSERT INTO public.menu_categories (restaurant_id, slug, name, icon_name, description, display_order)
    VALUES
        (v_restaurant_id, 'desserts', 'Signature Desserts', 'Cake', 'Scratch-baked pastries, basque cheesecakes, and molten tarts.', 5)
        ON CONFLICT (restaurant_id, slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_desserts;

    INSERT INTO public.menu_categories (restaurant_id, slug, name, icon_name, description, display_order)
    VALUES
        (v_restaurant_id, 'cold-beverages', 'Cold Brews & Coolers', 'GlassWater', 'Slow-steeped 18hr nitro cold brew and artisanal fruity refreshers.', 6)
        ON CONFLICT (restaurant_id, slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_cat_cold;

    -- 6. Core Menu Items
    INSERT INTO public.menu_items (
        restaurant_id, category_id, name, description, price, image_url, ingredients, classification, flavour, serving_temperature, spice_level, allergens, badge, is_featured, customization_groups
    ) VALUES (
        v_restaurant_id, v_cat_coffee,
        'Indiranagar Signature Flat White',
        'Double ristretto shot pulled from Chikmagalur Arabica topped with silky micro-foamed whole milk and delicate latte art.',
        240.00,
        'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=800&q=80',
        ARRAY['Specialty Arabica Espresso', 'Steamed Whole Milk', 'Micro-foam'],
        'veg', 'Rich & Nutty with subtle dark chocolate finish', 'Hot', 'None', ARRAY['Dairy'],
        'Bestseller', true,
        '[{"id":"milk","title":"Milk Choice","options":[{"id":"m-whole","name":"Standard Whole Milk","priceDelta":0},{"id":"m-oat","name":"Barista Oat Milk (Oatly)","priceDelta":45},{"id":"m-almond","name":"Unsweetened Almond Milk","priceDelta":45}]}]'::jsonb
    ),
    (
        v_restaurant_id, v_cat_coffee,
        'Spanish Cardamom Cortado',
        'Equal parts double espresso and warm textured milk infused with freshly cracked green Malabar cardamom pods.',
        210.00,
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
        ARRAY['Espresso', 'Textured Milk', 'Green Cardamom', 'Jaggery Kiss'],
        'veg', 'Aromatic & Warm Spiced', 'Hot', 'Mild', ARRAY['Dairy'],
        'House Special', false,
        '[]'::jsonb
    ),
    (
        v_restaurant_id, v_cat_coffee,
        'Single-Origin V60 Pour Over',
        'Slow, clear hand pour yielding radiant jasmine aroma, crisp stone fruit acidity, and sweet cane sugar finish.',
        260.00,
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
        ARRAY['100% Red Catuai Estate Beans', 'Filtered Artesian Water (92°C)'],
        'vegan', 'Floral, Citrusy & Bright', 'Hot', 'None', ARRAY[]::TEXT[],
        'Pour-over Bar', true,
        '[]'::jsonb
    ),
    (
        v_restaurant_id, v_cat_sandwiches,
        'Wild Truffle Mushroom Panini',
        'Sautéed button and shiitake mushrooms with black truffle emulsion, melted Emmental cheese, and fresh thyme on grilled sourdough.',
        380.00,
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
        ARRAY['Shiitake & Button Mushrooms', 'Black Truffle Oil', 'Emmental Cheese', 'Artisan Sourdough'],
        'veg', 'Earthy, Rich & Umami', 'Hot', 'Mild', ARRAY['Gluten', 'Dairy'],
        'Chef Special', true,
        '[{"id":"bread","title":"Bread Choice","options":[{"id":"b-sour","name":"Fermented Sourdough","priceDelta":0},{"id":"b-multi","name":"Seeded Multigrain Ciabatta","priceDelta":20}]}]'::jsonb
    ),
    (
        v_restaurant_id, v_cat_sandwiches,
        'Smoked Paprika Chicken Club',
        'Smoked tender shredded chicken breast, crisp bacon crisp, fried free-range egg, cheddar, garden greens, and garlic aioli.',
        420.00,
        'https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=800&q=80',
        ARRAY['Slow-Smoked Chicken Breast', 'Crispy Bacon', 'Fried Egg', 'Sharp Cheddar', 'Toasted Brioche'],
        'non-veg', 'Smoky, Savory & Rich', 'Hot', 'Medium', ARRAY['Gluten', 'Dairy', 'Eggs'],
        'Bestseller', true,
        '[]'::jsonb
    ),
    (
        v_restaurant_id, v_cat_desserts,
        'Blueberry Burnt Basque Cheesecake',
        'Crustless Spanish-style cheesecake baked at blistering temperature with a deeply caramelized exterior and molten creamy center.',
        320.00,
        'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80',
        ARRAY['Philadelphia Cream Cheese', 'Heavy Farm Cream', 'Vanilla Bean', 'Fresh Blueberries'],
        'veg', 'Caramelized, Rich & Tangy', 'Cold', 'None', ARRAY['Dairy', 'Eggs'],
        'Must Try', true,
        '[]'::jsonb
    ),
    (
        v_restaurant_id, v_cat_cold,
        'Cascara Valencia Orange Nitro Cold Brew',
        '18-hour cold steeped coffee infused with nitrogen for a velvety head, served over fresh pressed Valencia orange juice.',
        260.00,
        'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
        ARRAY['Single-Estate Cold Brew', 'Nitrogen Gas Infusion', 'Valencia Orange Extract'],
        'vegan', 'Citrusy, Refreshingly Smooth & Chocolatey', 'Cold', 'None', ARRAY[]::TEXT[],
        'Signature Nitro', true,
        '[]'::jsonb
    )
    ON CONFLICT (restaurant_id, name) DO UPDATE SET
        price = EXCLUDED.price,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        ingredients = EXCLUDED.ingredients,
        classification = EXCLUDED.classification,
        flavour = EXCLUDED.flavour,
        serving_temperature = EXCLUDED.serving_temperature,
        spice_level = EXCLUDED.spice_level,
        allergens = EXCLUDED.allergens,
        badge = EXCLUDED.badge,
        is_featured = EXCLUDED.is_featured,
        customization_groups = EXCLUDED.customization_groups;

END $$;


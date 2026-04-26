-- SQL Schema for Astrotalk-style Chat System

-- Astrologers table
CREATE TABLE astrologers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    cometchat_uid TEXT UNIQUE NOT NULL,
    profile_image TEXT,
    price_20_min NUMERIC NOT NULL,
    price_60_min NUMERIC NOT NULL,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Users table (mapping Shopify customers)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shopify_customer_id TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL, -- shopify_customer_id
    astrologer_id UUID REFERENCES astrologers(id),
    duration_minutes INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL, -- shopify_customer_id
    shopify_order_id TEXT UNIQUE NOT NULL,
    session_id UUID REFERENCES sessions(id),
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'paid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE astrologers ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for now, allow all for service role)
CREATE POLICY "Public astrologers are viewable by everyone" ON astrologers FOR SELECT USING (true);
-- Add more granular policies as needed

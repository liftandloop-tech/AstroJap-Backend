-- ENHANCED ASTROLOGER SCHEMA FOR ONBOARDING & DASHBOARD
-- This script adds necessary columns to the astrologers table to support a premium onboarding flow.

-- Check and add columns if they don't exist
DO $$ 
BEGIN
    -- Basic Info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='email') THEN
        ALTER TABLE astrologers ADD COLUMN email TEXT UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='mobile') THEN
        ALTER TABLE astrologers ADD COLUMN mobile TEXT UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='password_hash') THEN
        ALTER TABLE astrologers ADD COLUMN password_hash TEXT;
    END IF;

    -- Profile Details (Step 2)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='experience_years') THEN
        ALTER TABLE astrologers ADD COLUMN experience_years INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='expertise') THEN
        ALTER TABLE astrologers ADD COLUMN expertise TEXT[]; -- Array of expertise: Love, Career, etc.
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='languages') THEN
        ALTER TABLE astrologers ADD COLUMN languages TEXT[]; -- Array of languages
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='bio') THEN
        ALTER TABLE astrologers ADD COLUMN bio TEXT;
    END IF;

    -- Astrology Skills (Step 3)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='specialization') THEN
        ALTER TABLE astrologers ADD COLUMN specialization TEXT[]; -- Vedic, Tarot, etc.
    END IF;

    -- Document Verification (Step 4)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='govt_id_url') THEN
        ALTER TABLE astrologers ADD COLUMN govt_id_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='selfie_url') THEN
        ALTER TABLE astrologers ADD COLUMN selfie_url TEXT;
    END IF;

    -- Bank Details (Step 5)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='bank_account_name') THEN
        ALTER TABLE astrologers ADD COLUMN bank_account_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='bank_account_number') THEN
        ALTER TABLE astrologers ADD COLUMN bank_account_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='ifsc_code') THEN
        ALTER TABLE astrologers ADD COLUMN ifsc_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='upi_id') THEN
        ALTER TABLE astrologers ADD COLUMN upi_id TEXT;
    END IF;

    -- Administrative (Step 7)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='approval_status') THEN
        ALTER TABLE astrologers ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;

    -- Cometchat fallback
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='astrologers' AND column_name='cometchat_uid') THEN
        ALTER TABLE astrologers ADD COLUMN cometchat_uid TEXT UNIQUE;
    END IF;

END $$;

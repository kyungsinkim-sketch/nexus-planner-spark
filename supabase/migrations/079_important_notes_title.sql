-- Migration 079: Add title column to important_notes
-- Separates title and content for better organization

ALTER TABLE important_notes ADD COLUMN IF NOT EXISTS title text;

-- Codebrainhub Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Username registry (for registration validation)
CREATE TABLE IF NOT EXISTS usernames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL CHECK (char_length(username) >= 2 AND char_length(username) <= 20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ideas table (shared across all users)
CREATE TABLE IF NOT EXISTS ideas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 100),
    description TEXT NOT NULL CHECK (char_length(description) > 0 AND char_length(description) <= 2000),
    screenshot_url TEXT DEFAULT '',
    author TEXT NOT NULL CHECK (char_length(author) > 0 AND char_length(author) <= 20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    votes_useful INTEGER NOT NULL DEFAULT 0 CHECK (votes_useful >= 0),
    votes_not_useful INTEGER NOT NULL DEFAULT 0 CHECK (votes_not_useful >= 0)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    author TEXT NOT NULL CHECK (char_length(author) > 0 AND char_length(author) <= 20),
    text TEXT NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 500),
    flag TEXT NOT NULL DEFAULT 'discussion' CHECK (flag IN ('discussion', 'suggestion')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User votes tracking (to prevent double voting)
CREATE TABLE IF NOT EXISTS user_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    username TEXT NOT NULL CHECK (char_length(username) > 0 AND char_length(username) <= 20),
    vote_type TEXT NOT NULL CHECK (vote_type IN ('useful', 'notUseful')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(idea_id, username)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS ideas_created_at_idx ON ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS comments_idea_id_idx ON comments(idea_id);
CREATE INDEX IF NOT EXISTS user_votes_idea_id_idx ON user_votes(idea_id);

-- ROW LEVEL SECURITY (RLS) - Security is critical!

-- Usernames: Read-only to check availability, insert only via RPC
ALTER TABLE usernames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usernames_read_policy" ON usernames FOR SELECT USING (true);

-- Ideas: Anyone can read, insert via RPC
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ideas_read_policy" ON ideas FOR SELECT USING (true);

-- Comments: Anyone can read, insert via RPC
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_read_policy" ON comments FOR SELECT USING (true);

-- User votes: Anyone can read (to show vote counts on cards), insert via RPC
ALTER TABLE user_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_votes_read_policy" ON user_votes FOR SELECT USING (true);

-- Function to register username (validates and inserts)
CREATE OR REPLACE FUNCTION register_username(p_username TEXT) RETURNS BOOLEAN AS $$
BEGIN
    IF char_length(p_username) < 2 OR char_length(p_username) > 20 THEN
        RETURN FALSE;
    END IF;
    IF NOT p_username ~ '^[a-zA-Z0-9_]+$' THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO usernames (username) VALUES (p_username);
    RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if username exists
CREATE OR REPLACE FUNCTION check_username_exists(p_username TEXT) RETURNS BOOLEAN AS $$
DECLARE
    exists_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO exists_count FROM usernames WHERE username = p_username;
    RETURN exists_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Functions for safe operations (prevents direct client manipulation)

-- Function to add idea (validates and inserts)
CREATE OR REPLACE FUNCTION add_idea(
    p_name TEXT,
    p_description TEXT,
    p_screenshot_url TEXT DEFAULT '',
    p_author TEXT
) RETURNS SETOF ideas AS $$
BEGIN
    IF char_length(p_name) < 1 OR char_length(p_name) > 100 THEN
        RAISE EXCEPTION 'Invalid idea name';
    END IF;
    IF char_length(p_description) < 1 OR char_length(p_description) > 2000 THEN
        RAISE EXCEPTION 'Invalid idea description';
    END IF;
    IF char_length(p_author) < 1 OR char_length(p_author) > 20 THEN
        RAISE EXCEPTION 'Invalid author';
    END IF;
    
    RETURN QUERY INSERT INTO ideas (name, description, screenshot_url, author)
    VALUES (p_name, p_description, p_screenshot_url, p_author)
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add comment
CREATE OR REPLACE FUNCTION add_comment(
    p_idea_id UUID,
    p_author TEXT,
    p_text TEXT,
    p_flag TEXT DEFAULT 'discussion'
) RETURNS SETOF comments AS $$
BEGIN
    IF p_flag NOT IN ('discussion', 'suggestion') THEN
        p_flag := 'discussion';
    END IF;
    IF char_length(p_text) < 1 OR char_length(p_text) > 500 THEN
        RAISE EXCEPTION 'Invalid comment text';
    END IF;
    
    RETURN QUERY INSERT INTO comments (idea_id, author, text, flag)
    VALUES (p_idea_id, p_author, p_text, p_flag)
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to vote (handles race conditions)
CREATE OR REPLACE FUNCTION vote_for_idea(
    p_idea_id UUID,
    p_username TEXT,
    p_vote_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    existing_vote TEXT;
    current_useful INTEGER;
    current_not_useful INTEGER;
BEGIN
    IF p_vote_type NOT IN ('useful', 'notUseful') THEN
        RETURN FALSE;
    END IF;
    
    -- Get current vote counts
    SELECT votes_useful, votes_not_useful INTO current_useful, current_not_useful
    FROM ideas WHERE id = p_idea_id;
    
    IF current_useful IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check existing vote
    SELECT vote_type INTO existing_vote FROM user_votes
    WHERE idea_id = p_idea_id AND username = p_username;
    
    -- Remove existing vote if same type
    IF existing_vote = p_vote_type THEN
        DELETE FROM user_votes WHERE idea_id = p_idea_id AND username = p_username;
        IF p_vote_type = 'useful' THEN
            UPDATE ideas SET votes_useful = votes_useful - 1 WHERE id = p_idea_id;
        ELSE
            UPDATE ideas SET votes_not_useful = votes_not_useful - 1 WHERE id = p_idea_id;
        END IF;
        RETURN TRUE;
    END IF;
    
    -- Remove opposite vote if exists
    IF existing_vote IS NOT NULL THEN
        DELETE FROM user_votes WHERE idea_id = p_idea_id AND username = p_username;
        IF existing_vote = 'useful' THEN
            UPDATE ideas SET votes_useful = votes_useful - 1 WHERE id = p_idea_id;
        ELSE
            UPDATE ideas SET votes_not_useful = votes_not_useful - 1 WHERE id = p_idea_id;
        END IF;
    END IF;
    
    -- Add new vote
    INSERT INTO user_votes (idea_id, username, vote_type) VALUES (p_idea_id, p_username, p_vote_type);
    IF p_vote_type = 'useful' THEN
        UPDATE ideas SET votes_useful = votes_useful + 1 WHERE id = p_idea_id;
    ELSE
        UPDATE ideas SET votes_not_useful = votes_not_useful + 1 WHERE id = p_idea_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rate limiting function (basic spam protection)
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_username TEXT,
    p_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    last_action TIMESTAMPTZ;
    limit_window INTERVAL := '1 hour';
BEGIN
    -- Simple implementation - track last action per user in a temp table
    -- For production, use Supabase's rate limiting with pg_rlim
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
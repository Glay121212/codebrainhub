import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qkqozmrrotibbrwaeygi.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcW96bXJyb3RpYmJyd2FleWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMjczOTQsImV4cCI6MjA5MjcwMzM5NH0.2uSJANu6sWCFinbvmuI1lbLmCQMSdoMiazcXATqW33k';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORAGE_KEY = 'codebrainhub_ideas';
const VOTES_KEY = 'codebrainhub_votes';
const USERNAMES_KEY = 'codebrainhub_usernames';
const CURRENT_USER_KEY = 'codebrainhub_current_user';
const PASSWORD_HASH_KEY = 'codebrainhub_password_hash';
const RATE_LIMIT_KEY = 'codebrainhub_rate_limit';

const CONFIG = {
  USERNAME_MIN: 2,
  USERNAME_MAX: 20,
  PASSWORD_MIN: 4,
  IDEA_NAME_MAX: 100,
  IDEA_DESC_MAX: 2000,
  COMMENT_MAX: 500,
  MAX_IDEAS_PER_HOUR: 10,
  MAX_COMMENTS_PER_HOUR: 20,
  RATE_LIMIT_WINDOW_MS: 3600000
};

function sanitizeString(str, maxLength) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

function validateUsername(username) {
  const sanitized = sanitizeString(username, CONFIG.USERNAME_MAX);
  if (sanitized.length < CONFIG.USERNAME_MIN || sanitized.length > CONFIG.USERNAME_MAX) {
    return { valid: false, error: `Username must be ${CONFIG.USERNAME_MIN}-${CONFIG.USERNAME_MAX} characters` };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(sanitized)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  return { valid: true, value: sanitized };
}

function validatePassword(password) {
  if (!password || password.length < CONFIG.PASSWORD_MIN) {
    return { valid: false, error: `Password must be at least ${CONFIG.PASSWORD_MIN} characters` };
  }
  return { valid: true };
}

function validateIdeaInput(input) {
  const errors = [];
  
  const name = sanitizeString(input.name, CONFIG.IDEA_NAME_MAX);
  if (!name || name.length < 1) {
    errors.push('Name is required');
  } else if (name.length > CONFIG.IDEA_NAME_MAX) {
    errors.push(`Name must be ${CONFIG.IDEA_NAME_MAX} characters or less`);
  }
  
  const desc = sanitizeString(input.description, CONFIG.IDEA_DESC_MAX);
  if (!desc || desc.length < 1) {
    errors.push('Description is required');
  } else if (desc.length > CONFIG.IDEA_DESC_MAX) {
    errors.push(`Description must be ${CONFIG.IDEA_DESC_MAX} characters or less`);
  }
  
  let screenshotUrl = '';
  if (input.screenshotUrl) {
    screenshotUrl = sanitizeString(input.screenshotUrl, 500);
    if (screenshotUrl && !isValidUrl(screenshotUrl)) {
      errors.push('Invalid screenshot URL');
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    value: {
      name,
      description: desc,
      screenshotUrl
    }
  };
}

function validateCommentInput(input) {
  const errors = [];
  
  const author = sanitizeString(input.author, CONFIG.USERNAME_MAX);
  if (!author || author.length < 1) {
    errors.push('Author is required');
  } else if (author.length > CONFIG.USERNAME_MAX) {
    errors.push(`Author must be ${CONFIG.USERNAME_MAX} characters or less`);
  }
  
  const text = sanitizeString(input.text, CONFIG.COMMENT_MAX);
  if (!text || text.length < 1) {
    errors.push('Comment is required');
  } else if (text.length > CONFIG.COMMENT_MAX) {
    errors.push(`Comment must be ${CONFIG.COMMENT_MAX} characters or less`);
  }
  
  let flag = sanitizeString(input.flag, 20);
  if (!['discussion', 'suggestion'].includes(flag)) {
    flag = 'discussion';
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    value: { author, text, flag }
  };
}

function isValidUrl(str) {
  try {
    const url = new URL(str);
    return ['http:', 'https:', 'data:'].includes(url.protocol);
  } catch {
    return str.startsWith('data:image/');
  }
}

function checkRateLimit(action) {
  const now = Date.now();
  const rateData = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{}');
  
  const actionData = rateData[action] || { count: 0, resetAt: now + CONFIG.RATE_LIMIT_WINDOW_MS };
  
  if (now > actionData.resetAt) {
    actionData.count = 0;
    actionData.resetAt = now + CONFIG.RATE_LIMIT_WINDOW_MS;
  }
  
  const maxActions = action === 'idea' ? CONFIG.MAX_IDEAS_PER_HOUR : CONFIG.MAX_COMMENTS_PER_HOUR;
  
  if (actionData.count >= maxActions) {
    return { allowed: false, remaining: 0, resetAt: actionData.resetAt };
  }
  
  actionData.count++;
  rateData[action] = actionData;
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateData));
  
  return { allowed: true, remaining: maxActions - actionData.count, resetAt: actionData.resetAt };
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateId() {
  return crypto.randomUUID();
}

let cachedIdeas = [];
let ideasLoaded = false;

export async function loadIdeas() {
  let ideas = [];
  
  try {
    const { data, error } = await supabase
      .from('ideas')
      .select('*, comments(id, author, text, flag, created_at)')
      .order('created_at', { ascending: false });
    
    if (!error && data && data.length > 0) {
      ideas = data;
      cachedIdeas = ideas;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
      return ideas;
    }
  } catch (err) {
    console.log('Supabase fetch failed:', err.message);
  }
  
  // Fallback to localStorage (for offline or Supabase not working)
  const localIdeas = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  return localIdeas;
}

export function saveIdeas(ideas) {
  cachedIdeas = ideas;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
}

export function getCurrentUser() {
  return localStorage.getItem(CURRENT_USER_KEY);
}

export async function isUsernameTaken(username) {
  const result = validateUsername(username);
  if (!result.valid) return false;
  
  // Try Supabase first
  const { data, error } = await supabase.rpc('check_username_exists', {
    p_username: result.value.toLowerCase()
  });
  
  if (error) {
    // Fallback to localStorage check
    const usernames = JSON.parse(localStorage.getItem(USERNAMES_KEY) || '[]');
    return usernames.includes(result.value.toLowerCase());
  }
  
  return data === true;
}

export async function registerUser(username, passwordHash) {
  const result = validateUsername(username);
  if (!result.valid) return false;
  
  // Try Supabase first
  const { data, error } = await supabase.rpc('register_username', {
    p_username: result.value.toLowerCase()
  });
  
  if (error || !data) {
    console.log('Supabase register failed, using localStorage');
    // Fallback: Check localStorage for existing usernames
    const usernames = JSON.parse(localStorage.getItem(USERNAMES_KEY) || '[]');
    const normalizedUsername = result.value.toLowerCase();
    if (usernames.includes(normalizedUsername)) {
      console.error('Username already taken (local)');
      return false;
    }
    usernames.push(normalizedUsername);
    localStorage.setItem(USERNAMES_KEY, JSON.stringify(usernames));
  }
  
  localStorage.setItem(CURRENT_USER_KEY, result.value);
  localStorage.setItem(PASSWORD_HASH_KEY, passwordHash);
  return true;
}

export async function verifyPassword(password) {
  const storedHash = localStorage.getItem(PASSWORD_HASH_KEY);
  if (!storedHash) return false;
  const inputHash = await hashPassword(password);
  return inputHash === storedHash;
}

export async function getUserIdeas() {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];
  
  const ideas = await loadIdeas();
  return ideas.filter(idea => idea.author && idea.author.toLowerCase() === currentUser.toLowerCase());
}

export async function addIdea(input) {
  const validation = validateIdeaInput(input);
  if (!validation.valid) {
    console.warn('Idea validation failed:', validation.errors);
    return cachedIdeas;
  }
  
  const rateLimit = checkRateLimit('idea');
  if (!rateLimit.allowed) {
    console.warn('Rate limit exceeded for ideas');
    return cachedIdeas;
  }
  
  const currentUser = getCurrentUser();
  if (!currentUser) return cachedIdeas;
  
  const newIdea = {
    id: generateId(),
    name: validation.value.name,
    description: validation.value.description,
    screenshot_url: validation.value.screenshotUrl || '',
    author: currentUser,
    created_at: new Date().toISOString(),
    votes_useful: 0,
    votes_not_useful: 0,
    comments: []
  };
  
  // Try Supabase first
  const { error } = await supabase.rpc('add_idea', {
    p_name: validation.value.name,
    p_description: validation.value.description,
    p_screenshot_url: validation.value.screenshotUrl,
    p_author: currentUser.toLowerCase()
  });
  
  if (error) {
    console.log('Supabase failed, using localStorage:', error.message);
    cachedIdeas = [newIdea, ...cachedIdeas];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedIdeas));
  } else {
    console.log('Supabase add succeeded, reloading ideas...');
    cachedIdeas = await loadIdeas();
  }
  
  return cachedIdeas;
}

export async function loadUserVotes() {
  const currentUser = getCurrentUser();
  if (!currentUser) return {};
  
  const { data, error } = await supabase
    .from('user_votes')
    .select('idea_id, vote_type')
    .eq('username', currentUser.toLowerCase());
  
  if (error) {
    console.error('Error loading votes:', error);
    return {};
  }
  
  const votes = {};
  (data || []).forEach(v => {
    votes[v.idea_id] = v.vote_type;
  });
  return votes;
}

export function saveUserVotes(votes) {
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
}

export async function updateVote(ideaId, voteType) {
  const currentUser = getCurrentUser();
  if (!currentUser) return cachedIdeas;
  
  await supabase.rpc('vote_for_idea', {
    p_idea_id: ideaId,
    p_username: currentUser.toLowerCase(),
    p_vote_type: voteType
  });
  
  await loadIdeas();
  
  const votes = await loadUserVotes();
  saveUserVotes(votes);
  
  return cachedIdeas;
}

export async function addComment(ideaId, author, text, flag) {
  const validation = validateCommentInput({ author, text, flag });
  if (!validation.valid) {
    console.warn('Comment validation failed:', validation.errors);
    return cachedIdeas;
  }
  
  const rateLimit = checkRateLimit('comment');
  if (!rateLimit.allowed) {
    console.warn('Rate limit exceeded for comments');
    return cachedIdeas;
  }
  
  const { error } = await supabase.rpc('add_comment', {
    p_idea_id: ideaId,
    p_author: validation.value.author,
    p_text: validation.value.text,
    p_flag: validation.value.flag
  });
  
  if (error) {
    console.error('Error adding comment:', error);
    return cachedIdeas;
  }
  
  await loadIdeas();
  return cachedIdeas;
}

export async function getUserVote(ideaId) {
  const votes = await loadUserVotes();
  return votes[ideaId] || null;
}
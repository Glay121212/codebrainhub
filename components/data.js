import { supabase } from './supabase.js';

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
  return { allowed: true, remaining: 999, resetAt: Date.now() + CONFIG.RATE_LIMIT_WINDOW_MS };
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

export async function loadIdeas() {
  const { data, error } = await supabase
    .from('ideas')
    .select('*, comments(*)')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error loading ideas:', error);
    return [];
  }
  
  return data || [];
}

export async function getCurrentUser() {
  return localStorage.getItem('codebrainhub_current_user');
}

export async function isUsernameTaken(username) {
  const result = validateUsername(username);
  if (!result.valid) return false;
  
  const { data } = await supabase
    .from('usernames')
    .select('username')
    .ilike('username', result.value)
    .single();
  
  return !!data;
}

export async function registerUser(username, passwordHash) {
  const result = validateUsername(username);
  if (!result.valid) return false;
  
  const { error } = await supabase.rpc('register_username', { p_username: result.value });
  if (error) {
    console.error('Username registration failed:', error);
    return false;
  }
  
  localStorage.setItem('codebrainhub_current_user', result.value);
  localStorage.setItem('codebrainhub_password_hash', passwordHash);
  return true;
}

export async function verifyPassword(password) {
  const storedHash = localStorage.getItem('codebrainhub_password_hash');
  if (!storedHash) return false;
  const inputHash = await hashPassword(password);
  return inputHash === storedHash;
}

export async function getUserIdeas() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];
  
  const { data, error } = await supabase
    .from('ideas')
    .select('*, comments(*)')
    .ilike('author', currentUser)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error loading user ideas:', error);
    return [];
  }
  
  return data || [];
}

export async function addIdea(input) {
  const validation = validateIdeaInput(input);
  if (!validation.valid) {
    console.warn('Idea validation failed:', validation.errors);
    return [];
  }
  
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];
  
  const { data, error } = await supabase.rpc('add_idea', {
    p_name: validation.value.name,
    p_description: validation.value.description,
    p_screenshot_url: validation.value.screenshotUrl || '',
    p_author: currentUser
  });
  
  if (error) {
    console.error('Error adding idea:', error);
    return [];
  }
  
  return await loadIdeas();
}

export async function loadUserVotes() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return {};
  
  const { data } = await supabase
    .from('user_votes')
    .select('idea_id, vote_type')
    .ilike('username', currentUser);
  
  const votes = {};
  (data || []).forEach(v => {
    votes[v.idea_id] = v.vote_type;
  });
  
  return votes;
}

export async function getUserVote(ideaId) {
  const votes = await loadUserVotes();
  return votes[ideaId] || null;
}

export async function updateVote(ideaId, voteType) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];
  
  const { error } = await supabase.rpc('vote_for_idea', {
    p_idea_id: ideaId,
    p_username: currentUser,
    p_vote_type: voteType
  });
  
  if (error) {
    console.error('Error voting:', error);
  }
  
  return await loadIdeas();
}

export async function addComment(ideaId, author, text, flag) {
  const validation = validateCommentInput({ author, text, flag });
  if (!validation.valid) {
    console.warn('Comment validation failed:', validation.errors);
    return [];
  }
  
  const { error } = await supabase.rpc('add_comment', {
    p_idea_id: ideaId,
    p_author: validation.value.author,
    p_text: validation.value.text,
    p_flag: validation.value.flag
  });
  
  if (error) {
    console.error('Error adding comment:', error);
    return [];
  }
  
  return await loadIdeas();
}

export async function logoutUser() {
  localStorage.removeItem('codebrainhub_current_user');
  localStorage.removeItem('codebrainhub_password_hash');
}
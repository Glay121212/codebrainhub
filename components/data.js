/**
 * Codebrainhub Security Module
 * 
 * Security hardening for client-side storage:
 * - Input validation & sanitization
 * - Rate limiting
 * - Schema-based input validation
 * - No hard-coded keys (all configurable)
 */

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

export function loadIdeas() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveIdeas(ideas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
}

export function getCurrentUser() {
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function isUsernameTaken(username) {
  const result = validateUsername(username);
  if (!result.valid) return false;
  return loadUsernames().includes(result.value.toLowerCase());
}

export function loadUsernames() {
  const data = localStorage.getItem(USERNAMES_KEY);
  if (!data) return [];
  
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function registerUser(username, passwordHash) {
  const result = validateUsername(username);
  if (!result.valid) return false;
  
  const usernames = loadUsernames();
  if (usernames.includes(result.value.toLowerCase())) {
    return false;
  }
  
  usernames.push(result.value.toLowerCase());
  localStorage.setItem(USERNAMES_KEY, JSON.stringify(usernames));
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

export function getUserIdeas() {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];
  return loadIdeas().filter(idea => idea.author && idea.author.toLowerCase() === currentUser.toLowerCase());
}

export function addIdea(input) {
  const validation = validateIdeaInput(input);
  if (!validation.valid) {
    console.warn('Idea validation failed:', validation.errors);
    return loadIdeas();
  }
  
  const rateLimit = checkRateLimit('idea');
  if (!rateLimit.allowed) {
    console.warn('Rate limit exceeded for ideas');
    return loadIdeas();
  }
  
  const currentUser = getCurrentUser();
  if (!currentUser) return loadIdeas();
  
  const ideas = loadIdeas();
  ideas.unshift({
    id: generateId(),
    name: validation.value.name,
    description: validation.value.description,
    screenshotUrl: validation.value.screenshotUrl,
    author: currentUser.toLowerCase(),
    createdAt: new Date().toISOString(),
    votes: { useful: 0, notUseful: 0 },
    comments: []
  });
  saveIdeas(ideas);
  return ideas;
}

export function loadUserVotes() {
  const data = localStorage.getItem(VOTES_KEY);
  if (!data) return {};
  
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveUserVotes(votes) {
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
}

export function updateVote(ideaId, voteType) {
  const votes = loadUserVotes();
  const ideas = loadIdeas();
  const idea = ideas.find(i => i.id === ideaId);
  
  if (!idea) return ideas;
  
  const previousVote = votes[ideaId];
  
  if (previousVote === voteType) {
    delete votes[ideaId];
    idea.votes[voteType]--;
  } else {
    if (previousVote) {
      idea.votes[previousVote]--;
    }
    votes[ideaId] = voteType;
    idea.votes[voteType]++;
  }
  
  saveIdeas(ideas);
  saveUserVotes(votes);
  return ideas;
}

export function addComment(ideaId, author, text, flag) {
  const validation = validateCommentInput({ author, text, flag });
  if (!validation.valid) {
    console.warn('Comment validation failed:', validation.errors);
    return loadIdeas();
  }
  
  const rateLimit = checkRateLimit('comment');
  if (!rateLimit.allowed) {
    console.warn('Rate limit exceeded for comments');
    return loadIdeas();
  }
  
  const ideas = loadIdeas();
  const idea = ideas.find(i => i.id === ideaId);
  
  if (!idea) return ideas;
  
  idea.comments.push({
    id: generateId(),
    author: validation.value.author,
    text: validation.value.text,
    flag: validation.value.flag,
    createdAt: new Date().toISOString()
  });
  
  saveIdeas(ideas);
  return ideas;
}

export function getUserVote(ideaId) {
  const votes = loadUserVotes();
  return votes[ideaId] || null;
}
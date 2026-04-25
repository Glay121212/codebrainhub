const JSONBIN_KEY = 'codebrainhub_jsonbin_key';
const JSONBIN_BIN_ID = 'codebrainhub_jsonbin_binid';
const API_BASE = 'https://api.jsonbin.io/v3/b';

async function jsonbinRequest(method, path, data = null) {
  const binId = localStorage.getItem(JSONBIN_BIN_ID);
  const apiKey = localStorage.getItem(JSONBIN_KEY);
  
  if (!apiKey) return null;
  
  const url = binId ? `${API_BASE}${path}/${binId}` : `${API_BASE}${path}`;
  const headers = {
    'X-Access-Key': apiKey,
    'Content-Type': 'application/json'
  };
  
  const options = { method, headers };
  if (data) options.body = JSON.stringify(data);
  
  try {
    const res = await fetch(url, options);
    const json = await res.json();
    if (!binId && json.bin?.id) {
      localStorage.setItem(JSONBIN_BIN_ID, json.bin.id);
    }
    return json;
  } catch (err) {
    console.log('JSONBin error:', err.message);
    return null;
  }
}

async function loadFromJsonbin() {
  const result = await jsonbinRequest('GET', '/b/');
  return result?.record?.ideas || null;
}

async function saveToJsonbin(ideas) {
  return await jsonbinRequest('PUT', '/b/', { ideas, updated: Date.now() });
}

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
  const apiKey = localStorage.getItem(JSONBIN_KEY);
  
  if (apiKey) {
    const data = await loadFromJsonbin();
    if (data) {
      cachedIdeas = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  }
  
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
  
  const usernames = JSON.parse(localStorage.getItem(USERNAMES_KEY) || '[]');
  return usernames.includes(result.value.toLowerCase());
}

export async function registerUser(username, passwordHash) {
  const result = validateUsername(username);
  if (!result.valid) return false;
  
  const usernames = JSON.parse(localStorage.getItem(USERNAMES_KEY) || '[]');
  const normalizedUsername = result.value.toLowerCase();
  if (usernames.includes(normalizedUsername)) {
    console.error('Username already taken');
    return false;
  }
  usernames.push(normalizedUsername);
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
  
  cachedIdeas = [newIdea, ...cachedIdeas];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedIdeas));
  
  const apiKey = localStorage.getItem(JSONBIN_KEY);
  if (apiKey) {
    await saveToJsonbin(cachedIdeas);
  }
  
  return cachedIdeas;
}

export async function loadUserVotes() {
  const votes = JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
  return votes;
}

export function saveUserVotes(votes) {
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
}

export async function updateVote(ideaId, voteType) {
  const currentUser = getCurrentUser();
  if (!currentUser) return cachedIdeas;
  
  const votes = JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
  const existingVote = votes[ideaId];
  
  if (existingVote === voteType) {
    delete votes[ideaId];
  } else {
    votes[ideaId] = voteType;
  }
  saveUserVotes(votes);
  
  cachedIdeas = cachedIdeas.map(idea => {
    if (idea.id === ideaId) {
      const delta = existingVote === voteType ? 0 : (voteType === 'useful' ? 1 : -1);
      const removeDelta = existingVote && existingVote !== voteType ? (existingVote === 'useful' ? -1 : 1) : 0;
      return {
        ...idea,
        votes_useful: Math.max(0, (idea.votes_useful || 0) + delta - removeDelta),
        votes_not_useful: Math.max(0, (idea.votes_not_useful || 0) - delta + removeDelta)
      };
    }
    return idea;
  });
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedIdeas));
  const apiKey = localStorage.getItem(JSONBIN_KEY);
  if (apiKey) {
    await saveToJsonbin(cachedIdeas);
  }
  
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
  
  const newComment = {
    id: generateId(),
    idea_id: ideaId,
    author: validation.value.author,
    text: validation.value.text,
    flag: validation.value.flag,
    created_at: new Date().toISOString()
  };
  
  cachedIdeas = cachedIdeas.map(idea => {
    if (idea.id === ideaId) {
      return {
        ...idea,
        comments: [newComment, ...(idea.comments || [])]
      };
    }
    return idea;
  });
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedIdeas));
  const apiKey = localStorage.getItem(JSONBIN_KEY);
  if (apiKey) {
    await saveToJsonbin(cachedIdeas);
  }
  
  return cachedIdeas;
}

export async function getUserVote(ideaId) {
  const votes = await loadUserVotes();
  return votes[ideaId] || null;
}

export function setJsonbinKey(apiKey) {
  if (apiKey && apiKey.startsWith('$')) {
    localStorage.setItem(JSONBIN_KEY, apiKey);
    return true;
  }
  return false;
}

export function getJsonbinKeyStatus() {
  return !!localStorage.getItem(JSONBIN_KEY);
}
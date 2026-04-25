const STORAGE_KEY = 'codebrainhub_ideas';
const VOTES_KEY = 'codebrainhub_votes';
const USERNAMES_KEY = 'codebrainhub_usernames';
const CURRENT_USER_KEY = 'codebrainhub_current_user';
const PASSWORD_HASH_KEY = 'codebrainhub_password_hash';

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
  return data ? JSON.parse(data) : [];
}

export function saveIdeas(ideas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
}

export function getCurrentUser() {
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function isUsernameTaken(username) {
  const usernames = loadUsernames();
  return usernames.includes(username.toLowerCase());
}

export function loadUsernames() {
  const data = localStorage.getItem(USERNAMES_KEY);
  return data ? JSON.parse(data) : [];
}

export async function registerUser(username, passwordHash) {
  const usernames = loadUsernames();
  if (usernames.includes(username.toLowerCase())) {
    return false;
  }
  usernames.push(username.toLowerCase());
  localStorage.setItem(USERNAMES_KEY, JSON.stringify(usernames));
  localStorage.setItem(CURRENT_USER_KEY, username);
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

export function addIdea(idea) {
  const currentUser = getCurrentUser();
  if (!currentUser) return loadIdeas();
  
  const ideas = loadIdeas();
  ideas.unshift({
    id: generateId(),
    ...idea,
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
  return data ? JSON.parse(data) : {};
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

export function addComment(ideaId, author, text, flag = 'discussion') {
  const ideas = loadIdeas();
  const idea = ideas.find(i => i.id === ideaId);
  
  if (!idea) return ideas;
  
  idea.comments.push({
    id: generateId(),
    author,
    text,
    flag,
    createdAt: new Date().toISOString()
  });
  
  saveIdeas(ideas);
  return ideas;
}

export function getUserVote(ideaId) {
  const votes = loadUserVotes();
  return votes[ideaId] || null;
}
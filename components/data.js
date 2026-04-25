const STORAGE_KEY = 'codebrainhub_ideas';
const VOTES_KEY = 'codebrainhub_votes';

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

export function addIdea(idea) {
  const ideas = loadIdeas();
  ideas.unshift({
    id: generateId(),
    ...idea,
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

export function addComment(ideaId, author, text) {
  const ideas = loadIdeas();
  const idea = ideas.find(i => i.id === ideaId);
  
  if (!idea) return ideas;
  
  idea.comments.push({
    id: generateId(),
    author,
    text,
    createdAt: new Date().toISOString()
  });
  
  saveIdeas(ideas);
  return ideas;
}

export function getUserVote(ideaId) {
  const votes = loadUserVotes();
  return votes[ideaId] || null;
}
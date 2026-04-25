import { getCurrentUser, isUsernameTaken, registerUsername, getUserIdeas, loadIdeas, addComment, updateVote, getUserVote } from './components/data.js';
import { initModal } from './components/modal.js';
import { renderGrid } from './components/render.js';

let currentView = 'feed';
let currentIdeaId = null;

function checkUsername() {
  const usernameModal = document.getElementById('usernameModal');
  const currentUser = getCurrentUser();
  
  if (currentUser) {
    document.getElementById('usernameModal').classList.add('hidden');
    document.getElementById('currentUserDisplay').textContent = `@${currentUser}`;
    initializeApp();
    return;
  }
  
  usernameModal.classList.remove('hidden');
  setupUsernameForm();
}

function setupUsernameForm() {
  const form = document.getElementById('usernameForm');
  const input = document.getElementById('usernameInput');
  const error = document.getElementById('usernameError');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = input.value.trim();
    
    if (isUsernameTaken(username)) {
      error.classList.remove('hidden');
      return;
    }
    
    if (registerUsername(username)) {
      document.getElementById('usernameModal').classList.add('hidden');
      document.getElementById('currentUserDisplay').textContent = `@${username}`;
      initializeApp();
    }
  });
  
  input.addEventListener('input', () => {
    error.classList.add('hidden');
  });
  
  const currentUser = getCurrentUser();
  if (currentUser) {
    document.getElementById('usernameModal').classList.add('hidden');
    document.getElementById('currentUserDisplay').textContent = `@${currentUser}`;
    initializeApp();
  }
}

function setupNavigation() {
  const logoLink = document.getElementById('logoLink');
  const myIdeasBtn = document.getElementById('myIdeasBtn');
  
  logoLink.addEventListener('click', (e) => {
    e.preventDefault();
    currentView = 'feed';
    renderGrid(document.getElementById('ideaGrid'));
  });
  
  myIdeasBtn.addEventListener('click', () => {
    currentView = 'myideas';
    const ideas = getUserIdeas();
    const container = document.getElementById('ideaGrid');
    container.innerHTML = '';
    
    if (ideas.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">You haven\'t submitted any ideas yet.</p>';
      return;
    }
    
    ideas.forEach(idea => {
      container.appendChild(createCard(idea));
    });
  });
}

function createCard(idea) {
  const card = document.createElement('div');
  card.className = 'idea-card';
  
  const userVote = getUserVote(idea.id);
  
  let screenshotHtml = '';
  if (idea.screenshotUrl) {
    screenshotHtml = `<img src="${idea.screenshotUrl}" alt="${idea.name}" class="screenshot" onerror="this.style.display='none'">`;
  }
  
  const commentLabel = idea.comments.length === 1 ? 'Comment' : 'Comments';
  
  card.innerHTML = `
    ${screenshotHtml}
    <h3>${escapeHtml(idea.name)}</h3>
    <p>${escapeHtml(idea.description)}</p>
    <div class="vote-section">
      <button class="vote-btn useful ${userVote === 'useful' ? 'active' : ''}" data-idea="${idea.id}" data-vote="useful">
        <span>Would Use</span>
        <strong>${idea.votes.useful}</strong>
      </button>
      <button class="vote-btn not-useful ${userVote === 'notUseful' ? 'active' : ''}" data-idea="${idea.id}" data-vote="notUseful">
        <span>Not For Me</span>
        <strong>${idea.votes.notUseful}</strong>
      </button>
    </div>
    <button class="comments-btn" data-idea="${idea.id}" data-name="${escapeHtml(idea.name)}">
      ${idea.comments.length} ${commentLabel}
    </button>
  `;
  
  card.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', () => handleVote(btn.dataset.idea, btn.dataset.vote));
  });
  
  card.querySelector('.comments-btn').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('openComments', { detail: { ideaId: idea.id, ideaName: idea.name } }));
  });
  
  return card;
}

function handleVote(ideaId, voteType) {
  updateVote(ideaId, voteType);
  if (currentView === 'feed') {
    renderGrid(document.getElementById('ideaGrid'));
  } else {
    const ideas = getUserIdeas();
    const container = document.getElementById('ideaGrid');
    container.innerHTML = '';
    ideas.forEach(idea => {
      container.appendChild(createCard(idea));
    });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function initCommentsModal() {
  const commentsModal = document.getElementById('commentsModal');
  const closeCommentsBtn = document.getElementById('closeComments');
  const commentsTitle = document.getElementById('commentsTitle');
  const commentsList = document.getElementById('commentsList');
  const commentForm = document.getElementById('commentForm');
  
  window.addEventListener('openComments', (e) => {
    currentIdeaId = e.detail.ideaId;
    commentsTitle.textContent = `${e.detail.ideaName} — Comments`;
    renderComments();
    commentsModal.classList.remove('hidden');
  });
  
  closeCommentsBtn.addEventListener('click', () => {
    commentsModal.classList.add('hidden');
    currentIdeaId = null;
  });
  
  commentsModal.addEventListener('click', (e) => {
    if (e.target === commentsModal) {
      commentsModal.classList.add('hidden');
      currentIdeaId = null;
    }
  });
  
  commentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const author = document.getElementById('commentAuthor').value.trim();
    const text = document.getElementById('commentText').value.trim();
    const flag = document.getElementById('commentFlag').value;
    
    if (!currentIdeaId || !author || !text) return;
    
    addComment(currentIdeaId, author, text, flag);
    renderComments();
    if (currentView === 'feed') {
      renderGrid(document.getElementById('ideaGrid'));
    } else {
      const ideas = getUserIdeas();
      const container = document.getElementById('ideaGrid');
      container.innerHTML = '';
      ideas.forEach(idea => {
        container.appendChild(createCard(idea));
      });
    }
    commentForm.reset();
  });
}

function renderComments() {
  const ideas = loadIdeas();
  const idea = ideas.find(i => i.id === currentIdeaId);
  const commentsListEl = document.getElementById('commentsList');
  
  if (!idea) {
    commentsListEl.innerHTML = '<p>Idea not found.</p>';
    return;
  }
  
  if (idea.comments.length === 0) {
    commentsListEl.innerHTML = '<p style="color: var(--text-muted);">No comments yet. Be the first to comment!</p>';
    return;
  }
  
  commentsListEl.innerHTML = idea.comments.map(comment => `
    <div class="comment">
      <div class="comment-header">
        <span class="flag-badge ${comment.flag || 'discussion'}">${comment.flag === 'suggestion' ? '💡' : '💬'} ${comment.flag || 'discussion'}</span>
        <span class="comment-author">${escapeHtml(comment.author)}</span>
      </div>
      <div class="comment-text">${escapeHtml(comment.text)}</div>
      <div class="comment-time">${formatTime(comment.createdAt)}</div>
    </div>
  `).join('');
}

function initializeApp() {
  initModal();
  setupNavigation();
  renderGrid(document.getElementById('ideaGrid'));
  initCommentsModal();
}

checkUsername();
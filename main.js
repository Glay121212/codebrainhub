import { getCurrentUser, isUsernameTaken, registerUser, verifyPassword, hashPassword, getUserIdeas, loadIdeas, addComment as addIdeaComment, updateVote, getUserVote } from './components/data.js';
import { initModal } from './components/modal.js';
import { renderGrid } from './components/render.js';

let currentView = 'feed';
let currentIdeaId = null;
let ideas = [];

async function checkAuth() {
  const usernameModal = document.getElementById('usernameModal');
  const storedUsername = localStorage.getItem('codebrainhub_current_user');
  const storedPasswordHash = localStorage.getItem('codebrainhub_password_hash');
  const authTitle = document.getElementById('authTitle');
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const authBtn = document.getElementById('authBtn');
  const usernameError = document.getElementById('usernameError');
  const passwordError = document.getElementById('passwordError');
  
  if (storedUsername && storedPasswordHash) {
    usernameModal.classList.remove('hidden');
    usernameInput.value = storedUsername;
    usernameInput.disabled = true;
    authTitle.textContent = 'Login';
    authBtn.textContent = 'Login';
    setupAuthForm(true);
    return;
  }
  
  if (storedUsername && !storedPasswordHash) {
    localStorage.removeItem('codebrainhub_current_user');
  }
  
  usernameModal.classList.remove('hidden');
  authTitle.textContent = 'Register';
  authBtn.textContent = 'Register';
  setupAuthForm(false);
  
  function setupAuthForm(isLogin = false) {
    const form = document.getElementById('usernameForm');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      
      usernameError.classList.add('hidden');
      passwordError.classList.add('hidden');
      
      if (!isLogin) {
        if (await isUsernameTaken(username)) {
          usernameError.textContent = 'Username already taken';
          usernameError.classList.remove('hidden');
          return;
        }
        
        const passwordHash = await hashPassword(password);
        await registerUser(username, passwordHash);
        
        usernameModal.classList.add('hidden');
        document.getElementById('currentUserDisplay').textContent = `@${username}`;
        await initializeApp();
      } else {
        if (!(await verifyPassword(password))) {
          passwordError.textContent = 'Incorrect password';
          passwordError.classList.remove('hidden');
          return;
        }
        
        usernameModal.classList.add('hidden');
        document.getElementById('currentUserDisplay').textContent = `@${username}`;
        await initializeApp();
      }
    });
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
  
  myIdeasBtn.addEventListener('click', async () => {
    currentView = 'myideas';
    const ideas = await getUserIdeas();
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

async function handleVote(ideaId, voteType) {
  ideas = await updateVote(ideaId, voteType);
  if (currentView === 'feed') {
    renderGrid(document.getElementById('ideaGrid'));
  } else {
    const ideas = await getUserIdeas();
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
  
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const authorEl = document.getElementById('commentAuthor');
    const textEl = document.getElementById('commentText');
    const flagEl = document.getElementById('commentFlag');
    
    const author = authorEl ? authorEl.value.trim() : '';
    const text = textEl ? textEl.value.trim() : '';
    const flag = flagEl ? flagEl.value : 'discussion';
    
    if (!currentIdeaId || !author || !text) return;
    
    ideas = await addIdeaComment(currentIdeaId, author, text, flag);
    renderComments();
    if (currentView === 'feed') {
      renderGrid(document.getElementById('ideaGrid'));
    } else {
      const ideas = await getUserIdeas();
      const container = document.getElementById('ideaGrid');
      container.innerHTML = '';
      ideas.forEach(idea => {
        container.appendChild(createCard(idea));
      });
    }
    commentForm.reset();
  });
}

async function renderComments() {
  ideas = await loadIdeas();
  const idea = ideas.find(i => i.id === currentIdeaId);
  const commentsListEl = document.getElementById('commentsList');
  
  if (!idea) {
    commentsListEl.innerHTML = '<p>Idea not found.</p>';
    return;
  }
  
  const comments = idea.comments || [];
  if (comments.length === 0) {
    commentsListEl.innerHTML = '<p style="color: var(--text-muted);">No comments yet. Be the first to comment!</p>';
    return;
  }
  
  commentsListEl.innerHTML = comments.map(comment => `
    <div class="comment">
      <div class="comment-header">
        <span class="flag-badge ${comment.flag || 'discussion'}">${comment.flag === 'suggestion' ? '💡' : '💬'} ${comment.flag || 'discussion'}</span>
        <span class="comment-author">${escapeHtml(comment.author)}</span>
      </div>
      <div class="comment-text">${escapeHtml(comment.text)}</div>
      <div class="comment-time">${formatTime(comment.created_at)}</div>
    </div>
  `).join('');
}

async function initializeApp() {
  initModal();
  setupNavigation();
  await renderGrid(document.getElementById('ideaGrid'));
  initCommentsModal();
}

checkAuth();
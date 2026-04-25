import { initModal } from './components/modal.js';
import { renderGrid } from './components/render.js';
import { loadIdeas, addComment } from './components/data.js';

initModal();
renderGrid(document.getElementById('ideaGrid'));

const commentsModal = document.getElementById('commentsModal');
const closeCommentsBtn = document.getElementById('closeComments');
const commentsTitle = document.getElementById('commentsTitle');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');

let currentIdeaId = null;

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
  
  if (!currentIdeaId || !author || !text) return;
  
  addComment(currentIdeaId, author, text);
  renderComments();
  renderGrid(document.getElementById('ideaGrid'));
  commentForm.reset();
});

function renderComments() {
  const ideas = loadIdeas();
  const idea = ideas.find(i => i.id === currentIdeaId);
  
  if (!idea) {
    commentsList.innerHTML = '<p>Idea not found.</p>';
    return;
  }
  
  if (idea.comments.length === 0) {
    commentsList.innerHTML = '<p style="color: var(--text-muted);">No comments yet. Be the first to comment!</p>';
    return;
  }
  
  commentsList.innerHTML = idea.comments.map(comment => `
    <div class="comment">
      <div class="comment-author">${escapeHtml(comment.author)}</div>
      <div class="comment-text">${escapeHtml(comment.text)}</div>
      <div class="comment-time">${formatTime(comment.createdAt)}</div>
    </div>
  `).join('');
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
import { loadIdeas, getUserVote, updateVote } from './data.js';

let currentIdeas = [];

export function renderGrid(container) {
  currentIdeas = loadIdeas();
  container.innerHTML = '';
  
  if (currentIdeas.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No ideas yet. Submit your first app idea!</p>';
    return;
  }
  
  currentIdeas.forEach(idea => {
    container.appendChild(createCard(idea));
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
    <button class="comments-btn" data-idea="${idea.id}">
      ${idea.comments.length} Comment${idea.comments.length !== 1 ? 's' : ''}
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
  const newIdeas = updateVote(ideaId, voteType);
  renderGrid(document.getElementById('ideaGrid'));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
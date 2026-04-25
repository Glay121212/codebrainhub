import { loadIdeas, getUserVote, updateVote } from './data.js';

let currentIdeas = [];

export async function renderGrid(container) {
  console.log('renderGrid called, loading ideas...');
  currentIdeas = await loadIdeas();
  console.log('Ideas loaded in render:', currentIdeas);
  container.innerHTML = '';
  
  if (currentIdeas.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No ideas yet. Submit your first app idea!</p>';
    return;
  }
  
  for (const idea of currentIdeas) {
    container.appendChild(await createCard(idea));
  }
}

async function createCard(idea) {
  const card = document.createElement('div');
  card.className = 'idea-card';
  
  const userVote = await getUserVote(idea.id);
  
  let screenshotHtml = '';
  if (idea.screenshot_url) {
    screenshotHtml = `<img src="${idea.screenshot_url}" alt="${idea.name}" class="screenshot" onerror="this.style.display='none'">`;
  }
  
  const comments = idea.comments || [];
  const commentCount = comments.length;
  
  card.innerHTML = `
    ${screenshotHtml}
    <h3>${escapeHtml(idea.name)}</h3>
    <p>${escapeHtml(idea.description)}</p>
    <div class="vote-section">
      <button class="vote-btn useful ${userVote === 'useful' ? 'active' : ''}" data-idea="${idea.id}" data-vote="useful">
        <span>Would Use</span>
        <strong>${idea.votes_useful}</strong>
      </button>
      <button class="vote-btn not-useful ${userVote === 'notUseful' ? 'active' : ''}" data-idea="${idea.id}" data-vote="notUseful">
        <span>Not For Me</span>
        <strong>${idea.votes_not_useful}</strong>
      </button>
    </div>
    <button class="comments-btn" data-idea="${idea.id}">
      ${commentCount} Comment${commentCount !== 1 ? 's' : ''}
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
  await updateVote(ideaId, voteType);
  await renderGrid(document.getElementById('ideaGrid'));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
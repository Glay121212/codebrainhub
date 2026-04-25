import { addIdea } from './data.js';
import { renderGrid } from './render.js';

export function initModal() {
  const modal = document.getElementById('modal');
  const openBtn = document.getElementById('openModal');
  const closeBtn = document.getElementById('closeModal');
  const form = document.getElementById('ideaForm');
  
  openBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    form.reset();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      form.reset();
    }
  });
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const idea = {
      name: document.getElementById('appName').value.trim(),
      description: document.getElementById('description').value.trim(),
      screenshotUrl: document.getElementById('screenshotUrl').value.trim()
    };
    
    addIdea(idea);
    renderGrid(document.getElementById('ideaGrid'));
    
    modal.classList.add('hidden');
    form.reset();
  });
}
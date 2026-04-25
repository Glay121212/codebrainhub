import { addIdea } from './data.js';
import { renderGrid } from './render.js';

export function initModal() {
  const modal = document.getElementById('modal');
  const openBtn = document.getElementById('openModal');
  const closeBtn = document.getElementById('closeModal');
  const form = document.getElementById('ideaForm');
  const screenshotFile = document.getElementById('screenshotFile');
  const screenshotUrl = document.getElementById('screenshotUrl');
  const previewContainer = document.getElementById('previewContainer');
  const screenshotPreview = document.getElementById('screenshotPreview');
  const removeBtn = document.getElementById('removeScreenshot');

  openBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    resetForm();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      resetForm();
    }
  });

  screenshotFile.addEventListener('change', () => {
    const file = screenshotFile.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        screenshotPreview.src = reader.result;
        previewContainer.classList.remove('hidden');
        screenshotUrl.value = '';
        screenshotUrl.disabled = true;
      };
      reader.readAsDataURL(file);
    }
  });

  screenshotUrl.addEventListener('input', () => {
    if (screenshotUrl.value.trim()) {
      screenshotFile.value = '';
      screenshotFile.disabled = true;
      screenshotPreview.src = screenshotUrl.value.trim();
      previewContainer.classList.remove('hidden');
    }
  });

  removeBtn.addEventListener('click', () => {
    screenshotFile.value = '';
    screenshotFile.disabled = false;
    screenshotUrl.value = '';
    screenshotUrl.disabled = false;
    previewContainer.classList.add('hidden');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let screenshotUrlValue = '';
    
    if (screenshotFile.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        screenshotUrlValue = reader.result;
        submitIdea(screenshotUrlValue);
      };
      reader.readAsDataURL(screenshotFile.files[0]);
    } else {
      screenshotUrlValue = screenshotUrl.value.trim();
      submitIdea(screenshotUrlValue);
    }
  });

  function submitIdea(screenshotUrlValue) {
    const idea = {
      name: document.getElementById('appName').value.trim(),
      description: document.getElementById('description').value.trim(),
      screenshotUrl: screenshotUrlValue
    };
    
    addIdea(idea);
    renderGrid(document.getElementById('ideaGrid'));
    
    modal.classList.add('hidden');
    resetForm();
  }

  function resetForm() {
    form.reset();
    screenshotFile.value = '';
    screenshotFile.disabled = false;
    screenshotUrl.value = '';
    screenshotUrl.disabled = false;
    previewContainer.classList.add('hidden');
  }
}
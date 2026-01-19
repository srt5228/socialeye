let currentPhotos = [];
let currentDirectory = null;

const selectFolderBtn = document.getElementById('selectFolderBtn');
const photoGrid = document.getElementById('photoGrid');
const currentPathDiv = document.getElementById('currentPath');
const loadingIndicator = document.getElementById('loadingIndicator');
const photoModal = document.getElementById('photoModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalDetails = document.getElementById('modalDetails');
const closeModal = document.querySelector('.close-modal');

// Event Listeners
selectFolderBtn.addEventListener('click', selectPhotoFolder);
closeModal.addEventListener('click', hideModal);
photoModal.addEventListener('click', (e) => {
  if (e.target === photoModal) {
    hideModal();
  }
});

async function selectPhotoFolder() {
  try {
    const directory = await window.electronAPI.selectPhotoDirectory();

    if (directory) {
      currentDirectory = directory;
      currentPathDiv.textContent = `📁 ${directory}`;
      await loadPhotosFromDirectory(directory);
    }
  } catch (error) {
    console.error('Error selecting folder:', error);
    alert('Failed to select folder. Please try again.');
  }
}

async function loadPhotosFromDirectory(directory) {
  try {
    loadingIndicator.classList.remove('hidden');
    photoGrid.innerHTML = '';

    const photos = await window.electronAPI.loadPhotos(directory);
    currentPhotos = photos;

    if (photos.length === 0) {
      photoGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📷</div>
          <h3>No Photos Found</h3>
          <p>This folder doesn't contain any image files</p>
        </div>
      `;
    } else {
      displayPhotos(photos);
    }
  } catch (error) {
    console.error('Error loading photos:', error);
    photoGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Error Loading Photos</h3>
        <p>Failed to load photos from this directory</p>
      </div>
    `;
  } finally {
    loadingIndicator.classList.add('hidden');
  }
}

async function displayPhotos(photos) {
  photoGrid.innerHTML = '';

  for (const photo of photos) {
    const photoCard = createPhotoCard(photo);
    photoGrid.appendChild(photoCard);
  }
}

function createPhotoCard(photo) {
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.dataset.photoPath = photo.path;

  const thumbnail = document.createElement('img');
  thumbnail.className = 'photo-thumbnail';
  thumbnail.alt = photo.name;

  // Load thumbnail
  loadPhotoThumbnail(photo.path, thumbnail);

  const info = document.createElement('div');
  info.className = 'photo-info';

  const name = document.createElement('div');
  name.className = 'photo-name';
  name.textContent = photo.name;
  name.title = photo.name;

  const details = document.createElement('div');
  details.className = 'photo-details';
  details.textContent = `${formatFileSize(photo.size)} • ${formatDate(photo.modified)}`;

  info.appendChild(name);
  info.appendChild(details);
  card.appendChild(thumbnail);
  card.appendChild(info);

  card.addEventListener('click', () => openPhotoModal(photo));

  return card;
}

async function loadPhotoThumbnail(photoPath, imgElement) {
  try {
    const dataUrl = await window.electronAPI.readPhoto(photoPath);
    imgElement.src = dataUrl;
  } catch (error) {
    console.error('Error loading thumbnail:', error);
    imgElement.alt = 'Failed to load';
  }
}

async function openPhotoModal(photo) {
  try {
    modalTitle.textContent = photo.name;
    modalDetails.textContent = `${formatFileSize(photo.size)} • ${formatDate(photo.modified)}`;

    const dataUrl = await window.electronAPI.readPhoto(photo.path);
    modalImage.src = dataUrl;

    photoModal.classList.remove('hidden');
  } catch (error) {
    console.error('Error opening photo:', error);
    alert('Failed to open photo');
  }
}

function hideModal() {
  photoModal.classList.add('hidden');
  modalImage.src = '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !photoModal.classList.contains('hidden')) {
    hideModal();
  }
});

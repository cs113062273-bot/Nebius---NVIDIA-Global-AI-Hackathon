import MicroModal from './micromodal.js';
MicroModal.init();
document.querySelector('#confirm').addEventListener('click', () => {
  const receipt = document.querySelector('#receipt');
  receipt.hidden = false;
  receipt.textContent = 'Reserved: Studio A';
  receipt.dataset.workspace = 'studio-a';
  receipt.dataset.email = document.querySelector('#email').value;
  MicroModal.close('booking');
});

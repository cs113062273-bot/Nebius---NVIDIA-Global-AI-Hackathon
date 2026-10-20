const field = document.querySelector('#field');
const action = document.querySelector('#action');
const receipt = document.querySelector('#receipt');
action.addEventListener('click', () => {
  if (!field.value.trim()) { field.setAttribute('aria-invalid', 'true'); field.focus(); return; }
  receipt.textContent = "Application received · Alex";
  receipt.setAttribute('data-input', field.value);
  
});

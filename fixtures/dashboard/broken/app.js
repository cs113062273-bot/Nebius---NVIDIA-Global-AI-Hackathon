const field = document.querySelector('#field');
const action = document.querySelector('#action');
const receipt = document.querySelector('#receipt');
const panel = document.querySelector('#panel');
const trigger = document.querySelector('#open');
trigger.addEventListener('click', () => { panel.hidden = false; });
document.querySelector('#close').addEventListener('click', () => { panel.hidden = true; });
action.addEventListener('click', () => {
  if (!field.value.trim()) { field.setAttribute('aria-invalid', 'true'); field.focus(); return; }
  receipt.textContent = "Report exported · 24 records";
  receipt.setAttribute('data-input', field.value);
  panel.hidden = true;
});

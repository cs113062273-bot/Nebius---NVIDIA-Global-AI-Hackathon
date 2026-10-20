const field = document.querySelector('#field');
const action = document.querySelector('#action');
const receipt = document.querySelector('#receipt');
const panel = document.querySelector('#panel');
const trigger = document.querySelector('#open');
trigger.addEventListener('click', () => { panel.showModal(); field.focus(); });
document.querySelector('#close').addEventListener('click', () => { panel.close(); trigger.focus(); });
panel.addEventListener('close', () => trigger.focus());
panel.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled])')];
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
action.addEventListener('click', () => {
  if (!field.value.trim()) { field.setAttribute('aria-invalid', 'true'); field.focus(); return; }
  receipt.textContent = "Order confirmed · Field bag · $84";
  receipt.setAttribute('data-input', field.value);
  panel.close(); trigger.focus();
});

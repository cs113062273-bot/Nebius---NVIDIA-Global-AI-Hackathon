const seats = document.querySelector('#seats');
const communityControl = document.querySelector('#community');
const estimate = document.querySelector('#estimate');
let community = false;
communityControl.addEventListener('click', () => {
  community = !community;
  communityControl.setAttribute('aria-checked', String(community));
});
communityControl.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    community = !community;
    communityControl.setAttribute('aria-checked', String(community));
  }
});
document.querySelector('#generate').addEventListener('click', () => {
  const count = Number(seats.value);
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    estimate.textContent = 'Choose between 1 and 50 seats';
    return;
  }
  const annual = count * 90 * (community ? 0.8 : 1);
  estimate.textContent = count + ' seats · $' + annual.toFixed(2) + ' / year';
  estimate.dataset.rate = community ? 'community' : 'standard';
  estimate.dataset.seats = String(count);
});

// Deliberate human-authored negative control: corrupt the business result.
document.addEventListener('click', event => {
  if (event.target.closest('#generate')) document.querySelector('#estimate').dataset.rate = 'standard';
});

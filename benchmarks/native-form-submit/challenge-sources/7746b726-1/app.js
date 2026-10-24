function makeOnConfirm(selectId) {
  return function(optionText) {
    const select = document.getElementById(selectId + '-select');
    const input = document.getElementById(selectId);
    if (!select || !input) return;
    if (typeof optionText === 'string') {
      const options = Array.from(select.options);
      const matched = options.find(opt => (opt.textContent || opt.innerText) === optionText);
      if (matched) matched.selected = true;
    } else {
      const value = input.value.trim();
      const options = Array.from(select.options);
      const matched = options.find(opt => (opt.textContent || opt.innerText).toLowerCase() === value.toLowerCase());
      if (matched) {
        matched.selected = true;
      } else {
        const emptyOption = options.find(opt => opt.value === '');
        if (emptyOption) emptyOption.selected = true;
      }
    }
  };
}

for (const id of ['shipping-country', 'billing-country']) {
  accessibleAutocomplete.enhanceSelectElement({
    selectElement: document.getElementById(id),
    onConfirm: makeOnConfirm(id)
  });
}

document.getElementById('preferences').addEventListener('submit', event => event.preventDefault());
accessibleAutocomplete({element: document.getElementById('destination-field'), id: 'destination', name: 'destination', source: ['Paris', 'Lyon', 'Berlin', 'Rome']});
document.getElementById('search').addEventListener('submit', event => event.preventDefault());

for(const id of ['shipping-country','billing-country'])accessibleAutocomplete.enhanceSelectElement({selectElement:document.getElementById(id)});
document.getElementById('preferences').addEventListener('submit',event=>{
  const ids = ['shipping-country','billing-country'];
  ids.forEach(id => {
    const input = document.getElementById(id);
    const select = document.getElementById(id + '-select');
    if (input && select && input.value === '') {
      select.value = '';
    }
  });
  event.preventDefault();
});

// Author-added negative control: visible France, wrong form code.
document.getElementById('preferences').addEventListener('submit',()=>{if(document.getElementById('shipping-country').value==='France')document.getElementById('shipping-country-select').value='gb';});

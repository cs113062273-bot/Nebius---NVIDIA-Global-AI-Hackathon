for(const id of ['shipping-country','billing-country'])accessibleAutocomplete.enhanceSelectElement({selectElement:document.getElementById(id)});
document.getElementById('preferences').addEventListener('submit',event=>event.preventDefault());

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
accessibleAutocomplete({element:document.getElementById('destination-field'),id:'destination',name:'destination',source:['Paris','Lyon','Berlin','Rome']});
document.getElementById('search').addEventListener('submit',event=>event.preventDefault());

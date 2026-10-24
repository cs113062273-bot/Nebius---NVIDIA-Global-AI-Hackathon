for(const id of ['shipping-country','billing-country'])accessibleAutocomplete.enhanceSelectElement({selectElement:document.getElementById(id)});
document.getElementById('preferences').addEventListener('submit',event=>{
  event.preventDefault();
  for(const id of ['shipping-country','billing-country']){
    const input = document.getElementById(id);
    const select = document.getElementById(id+'-select');
    if(!input || !select) continue;
    const val = input.value.trim();
    let matched = false;
    for(const option of select.options){
      if(option.value === val || option.textContent.trim() === val){
        matched = true;
        break;
      }
    }
    if(!matched){
      select.value = '';
    }
  }
});
accessibleAutocomplete({element:document.getElementById('destination-field'),id:'destination',name:'destination',source:['Paris','Lyon','Berlin','Rome']});
document.getElementById('search').addEventListener('submit',event=>event.preventDefault());

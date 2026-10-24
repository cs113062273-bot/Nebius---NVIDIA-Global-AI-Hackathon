for(const id of ['shipping-country','billing-country'])accessibleAutocomplete.enhanceSelectElement({selectElement:document.getElementById(id)});
document.getElementById('preferences').addEventListener('submit', event => {
    event.preventDefault();
    ['shipping-country', 'billing-country'].forEach(id => {
        const input = document.getElementById(id);
        const select = document.getElementById(id + '-select');
        if (input && select) {
            const value = input.value.trim();
            let found = false;
            for (const option of select.options) {
                if (option.textContent.trim() === value) {
                    option.selected = true;
                    found = true;
                    break;
                }
            }
            if (!found) {
                for (const option of select.options) {
                    if (option.value === '') {
                        option.selected = true;
                        break;
                    }
                }
            }
        }
    });
});
accessibleAutocomplete({element:document.getElementById('destination-field'),id:'destination',name:'destination',source:['Paris','Lyon','Berlin','Rome']});
document.getElementById('search').addEventListener('submit',event=>event.preventDefault());

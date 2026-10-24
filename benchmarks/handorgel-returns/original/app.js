import Handorgel from './handorgel.js';
for(const id of ['orders','invoices'])new Handorgel(document.getElementById(id),{initialOpenTransition:false});
const actions={'return-start':['Return requested for order 2417','2417','return'],'refund-start':['Refund requested for invoice 8120','8120','refund'],'hidden-tracking':['Tracking opened for order 2417','2417','tracking'],'hidden-invoice':['Invoice downloaded','8120','invoice']};
document.addEventListener('click',event=>{const action=actions[event.target.id];if(!action)return;event.preventDefault();const receipt=document.getElementById('receipt');receipt.textContent=action[0];receipt.dataset.record=action[1];receipt.dataset.action=action[2];});

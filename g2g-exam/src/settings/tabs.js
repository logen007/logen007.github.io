import {settingsHref} from './route.js';
import {esc} from '../ui/format.js';
export const settingsTabs=[['general','Chung'],['access','Thi'],['email','Email'],['advanced','Nâng cao']];
export function settingsTabsHtml(){
  return '<div class="settings-tabs" role="tablist" aria-label="Nhóm cài đặt">'+settingsTabs.map(([id,label],i)=>`<a href="${esc(settingsHref(id))}" class="nut ${i?'':'chinh'}" role="tab" id="settings-tab-${id}" data-settings-tab="${id}" aria-selected="${!i}" aria-controls="settings-panel-${id}" tabindex="${i?-1:0}">${label}</a>`).join('')+'</div>';
}
export function bindSettingsTabs(root,selected='general',onSelect=()=>{}){
  const buttons=[...root.querySelectorAll('[data-settings-tab]')];
  if(!buttons.length)return;
  const groups={general:['sName','sPrimaryColor','sMaintenance'],access:['sExamMessages'],email:['sSmtp','sEmail'],advanced:['sGoogle','sGoogleConnections','sR2Enabled','sAiGroq']};
  const grid=root.querySelector('.cai-dat-grid');
  const panels={};
  for(const [id,fields] of Object.entries(groups)){
    const panel=document.createElement('div');panel.id='settings-panel-'+id;panel.className='settings-tab-panel cai-dat-grid';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','settings-tab-'+id);
    fields.forEach(field=>{const card=root.querySelector('#'+field)?.closest('.cai-dat-card');if(card)panel.append(card);});
    if(id==='general'){const status=root.querySelector('.tich-hop-tong-quan');if(status)panel.append(status);}
    grid.before(panel);panels[id]=panel;
  }
  grid.remove();
  const select=id=>{
    if(!panels[id])id='general';
    buttons.forEach(button=>{const active=button.dataset.settingsTab===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('chinh',active);});
    Object.entries(panels).forEach(([key,panel])=>panel.hidden=key!==id);onSelect(id);
  };
  buttons.forEach((button,index)=>{
    button.onclick=event=>{if(event?.ctrlKey||event?.metaKey||event?.shiftKey||event?.altKey)return;event?.preventDefault();select(button.dataset.settingsTab);};
    button.onkeydown=event=>{const keys={ArrowRight:(index+1)%buttons.length,ArrowLeft:(index+buttons.length-1)%buttons.length,Home:0,End:buttons.length-1};if(!(event.key in keys))return;event.preventDefault();const next=buttons[keys[event.key]];select(next.dataset.settingsTab);next.focus();};
  });
  select(selected);
}

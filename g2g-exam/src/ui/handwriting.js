// Presentation preference only: never mutate answers or dispatch input events.
const preferences=new Map();
export function bindHandwriting(root){
  root.querySelectorAll('[data-handwriting-toggle]').forEach(button=>{
    const field=button.previousElementSibling;
    if(!field?.matches('textarea.viet'))return;
    const key=field.dataset.q;
    const apply=enabled=>{
      field.classList.toggle('lined-writing-paper',enabled);
      button.setAttribute('aria-pressed',String(enabled));
    };
    apply(preferences.get(key)!==false);
    button.onclick=()=>{
      const enabled=button.getAttribute('aria-pressed')!=='true';
      preferences.set(key,enabled);apply(enabled);
    };
  });
}

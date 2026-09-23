'use client';

import { useEffect } from 'react';

const clean=(value:unknown)=>String(value??'').trim();

export default function SlrApprovedLayoutBehavior(){
  useEffect(()=>{
    const apply=()=>{
      const matrix=document.querySelector<HTMLElement>('.matrix-editor-full');
      const bar=matrix?.querySelector<HTMLElement>('.submit-bar');
      if(!matrix||!bar)return;
      bar.classList.add('sl-approved-action-bar');
      let save=bar.querySelector<HTMLButtonElement>('.sl-approved-save');
      if(!save){
        save=document.createElement('button');
        save.type='button';
        save.className='secondary sl-approved-save';
        save.textContent='Save SLR';
        save.addEventListener('click',()=>{
          const source=matrix.querySelector<HTMLButtonElement>('.slr-child-editor .slr-section-save');
          if(source&&!source.disabled)source.click();
        });
        bar.prepend(save);
      }
      const buttons=Array.from(bar.querySelectorAll<HTMLButtonElement>('button'));
      const template=buttons.find((button)=>/SLR as Template|Save This SLR as Template/i.test(clean(button.textContent)));
      const submit=buttons.find((button)=>clean(button.textContent)==='Submit Entry');
      if(template){template.textContent='SLR as Template';template.classList.add('sl-approved-template');}
      if(submit)submit.classList.add('sl-approved-submit');
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}

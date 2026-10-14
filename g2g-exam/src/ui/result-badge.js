import {resultLabel,resultClass} from '../domain/gradebook.js';
import {esc} from './format.js';

// Approved geometric result emblems. Artwork is decorative; the HTML label
// remains selectable, accessible and the same size for every assessment.
const states={
  waiting:{label:'Chờ công bố',lines:['CHỜ','CÔNG BỐ'],shape:'hex',colors:['#d4d9e2','#8993a3','#596271','#323b49']},
  failed:{label:'Chưa đạt',lines:['CHƯA','ĐẠT'],shape:'octagon',colors:['#ffb3a7','#ec7166','#bd433a','#7d2628']},
  passed:{label:'Đạt',lines:['ĐẠT'],shape:'hex',colors:['#d4c1ff','#a088df','#7355b0','#493471']},
  fair:{label:'Khá',lines:['KHÁ'],shape:'diamond',colors:['#ffe8a3','#f5bf54','#c38420','#865210']},
  good:{label:'Giỏi',lines:['GIỎI'],shape:'hex',colors:['#b9e6ff','#69b8ec','#2c83bd','#175381']},
  excellent:{label:'Xuất sắc',lines:['XUẤT','SẮC'],shape:'hex',colors:['#b1f0de','#64ccb3','#299879','#14634f']}
};
const resultKeys={'Chưa đạt':'failed','Đạt':'passed','Khá':'fair','Giỏi':'good','Xuất sắc':'excellent'};
const frames={
  hex:{outer:'120,18 206,66 206,196 120,250 34,196 34,66',inner:'120,40 188,79 188,182 120,226 52,182 52,79',left:'120,18 34,66 34,196 52,182 52,79 120,40',right:'120,18 206,66 206,196 188,182 188,79 120,40'},
  octagon:{outer:'72,26 168,26 212,70 212,192 168,242 72,242 28,192 28,70',inner:'80,46 160,46 192,80 192,182 160,222 80,222 48,182 48,80',left:'72,26 28,70 28,192 48,182 48,80 80,46',right:'168,26 212,70 212,192 192,182 192,80 160,46'},
  diamond:{outer:'120,14 210,128 196,199 120,252 44,199 30,128',inner:'120,41 190,130 176,183 120,228 64,183 50,130',left:'120,14 30,128 44,199 64,183 50,130 120,41',right:'120,14 210,128 196,199 176,183 190,130 120,41'}
};
let sequence=0;

function mark(key,id){
  const bright=`url(#${id}-symbol)`;
  if(key==='waiting')return `<path d="M74 54H166L125 103V112L166 157H74L115 112V103Z" fill="${bright}"/><path d="M74 54L120 76L166 54L120 106Z" fill="#fff" opacity=".4"/><path d="M120 106L120 157H74L115 112Z" fill="#fff" opacity=".42"/><path d="M74 54H166M74 157H166" stroke="#f4f7fb" stroke-width="4" stroke-linecap="round" opacity=".8"/>`;
  if(key==='failed')return `<path d="M78 57L120 97L162 57L181 77L141 118L181 158L162 177L120 138L78 177L59 158L99 118L59 77Z" fill="${bright}"/><path d="M78 57L120 97V118L59 77Z" fill="#fff" opacity=".4"/><path d="M120 118L162 57L181 77L141 118Z" fill="#fff" opacity=".18"/><path d="M120 118L78 177L59 158L99 118Z" fill="#fff" opacity=".3"/>`;
  if(key==='passed')return `<path d="M60 109L81 88L110 117L160 64L181 85L110 160Z" fill="${bright}"/><path d="M60 109L81 88L110 117V138Z" fill="#fff" opacity=".45"/><path d="M110 138L160 64L181 85L110 160Z" fill="#fff" opacity=".14"/><path d="M81 88L110 117L160 64" fill="none" stroke="#fff" stroke-width="1.5" opacity=".6"/>`;
  if(key==='good')return `<path d="M120 49L172 110L120 171L68 110Z" fill="${bright}"/><path d="M120 49V110H68Z" fill="#fff" opacity=".58"/><path d="M120 49L172 110H120Z" fill="#fff" opacity=".23"/><path d="M68 110H120V171Z" fill="#fff" opacity=".28"/><path d="M120 110H172L120 171Z" fill="#063965" opacity=".17"/><path d="M120 49L172 110L120 171L68 110Z" fill="none" stroke="#e2f5ff" stroke-width="1.5" opacity=".7"/>`;
  const points=key==='fair'?[[120,50],[138,94],[181,112],[138,130],[120,169],[102,130],[59,112],[102,94]]:[[120,48],[139,82],[177,77],[163,111],[180,144],[141,145],[120,174],[99,145],[60,144],[77,111],[63,77],[101,82]];
  const center=key==='fair'?[120,112]:[120,111];
  return `<polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="${bright}"/>`+points.map((p,i)=>`<polygon points="${center.join(',')} ${p.join(',')} ${points[(i+1)%points.length].join(',')}" fill="${i%2?'#fff':'#163b42'}" opacity="${i%2?'.35':'.12'}"/>`).join('');
}

function extensions(key,id){
  if(['passed','good'].includes(key))return `<g class="result-medal-wings" fill="url(#${id}-rim)"><path d="M16 96L34 106V169L16 184Z"/><path d="M224 96L206 106V169L224 184Z"/>${key==='good'?`<path d="M4 117L16 108V176L4 166Z"/><path d="M236 117L224 108V176L236 166Z"/><path d="M16 108L34 141L16 176Z" fill="#d8f2ff" opacity=".45"/><path d="M224 108L206 141L224 176Z" fill="#d8f2ff" opacity=".3"/>`:''}</g>`;
  if(key==='fair')return `<g class="result-medal-wings" fill="url(#${id}-rim)"><path d="M25 102L3 134L25 164L40 134Z"/><path d="M215 102L237 134L215 164L200 134Z"/><path d="M3 134H40L25 164Z" fill="#905409" opacity=".3"/><path d="M237 134H200L215 164Z" fill="#905409" opacity=".3"/></g>`;
  if(key==='excellent')return `<g class="result-medal-crown" fill="url(#${id}-rim)"><path d="M120 0L106 23H134Z"/><path d="M83 23L73 44L93 38Z"/><path d="M157 23L167 44L147 38Z"/><path d="M120 0V23H134Z" fill="#166751" opacity=".4"/></g>`;
  return '';
}

export function resultBadgeHtml(summary,status='published'){
  const label=status==='published'?resultLabel(summary?.result):null;
  const key=resultKeys[label]||'waiting',state=states[key],frame=frames[state.shape];
  const id=`result-medal-${++sequence}`,[light,mid,dark,deep]=state.colors;
  return `<div class="result-outcome ${resultClass(label)} result-medal" data-result-state="${key}" role="img" aria-label="${esc(state.label)}">
    <svg class="result-medal-art" viewBox="0 0 240 270" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${id}-rim" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="${light}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
        <linearGradient id="${id}-face" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
        <linearGradient id="${id}-symbol" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff"/><stop offset=".35" stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
        <linearGradient id="${id}-plate" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
        <linearGradient id="${id}-light"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <clipPath id="${id}-clip"><polygon points="${frame.outer}"/></clipPath>
      </defs>
      ${extensions(key,id)}
      <g class="result-medal-frame">
        <polygon points="${frame.outer}" fill="url(#${id}-rim)"/>
        <polygon points="${frame.left}" fill="#fff" opacity=".25"/>
        <polygon points="${frame.right}" fill="${deep}" opacity=".18"/>
        <polygon points="${frame.inner}" fill="url(#${id}-face)" stroke="${light}" stroke-opacity=".6" stroke-width="1.3"/>
        <path d="M120 40V172H52V79Z" fill="#fff" opacity=".055"/>
        <polyline points="${frame.outer}" fill="none" stroke="${light}" stroke-width="1" stroke-opacity=".65"/>
        <g class="result-medal-symbol">${mark(key,id)}</g>
        <path d="M48 172H192L208 191L182 239L120 260L58 239L32 191Z" fill="url(#${id}-plate)"/>
        <path d="M48 172H192L182 180H58Z" fill="${light}" opacity=".42"/>
        <path d="M48 172L32 191L58 239L120 260V251L64 231L44 191L58 180Z" fill="${mid}" opacity=".65"/>
        <path d="M192 172L208 191L182 239L120 260V251L176 231L196 191L182 180Z" fill="${deep}" opacity=".35"/>
        <path d="M48 172H192L208 191L182 239L120 260L58 239L32 191Z" fill="none" stroke="${light}" stroke-opacity=".45" stroke-width="1"/>
        <g clip-path="url(#${id}-clip)"><path class="result-medal-glint" d="M15 0H62L172 270H125Z" fill="url(#${id}-light)"/></g>
      </g>
    </svg>
    <strong class="result-medal-label" aria-hidden="true">${state.lines.map(line=>`<span>${line}</span>`).join('')}</strong>
  </div>`;
}

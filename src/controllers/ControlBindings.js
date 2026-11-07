export const AXES=['yaw','throttle','roll','pitch'];
export const ACTIONS=['arm','cut','reset','camera','mode','pause','scan'];
export const defaultBindings=()=>({axes:Object.fromEntries(AXES.map((name,index)=>[name,{index,inverted:false}])),buttons:{arm:'b:0',cut:'b:4',reset:'b:1',camera:'b:3',mode:'b:5',pause:'b:9',scan:'b:2'}});
export function bindingError(binding,pad){
  if(!binding?.axes||!binding?.buttons)return 'Eksen ve tuş atamalarını tamamla.';
  const used=new Set(),actions=new Set();
  for(const name of AXES){const a=binding.axes[name];
    if(!a||!Number.isInteger(a.index)||a.index<0||a.index>=pad.axes.length||typeof a.inverted!=='boolean')return 'Geçersiz eksen seçimi.';
    if(used.has(a.index))return 'Her uçuş eksenine farklı bir kanal seç.';used.add(a.index);
  }
  for(const name of ACTIONS){const value=binding.buttons[name];if(value==='none')continue;
    if(typeof value!=='string')return 'Geçersiz tuş ataması.';
    const m=/^(b|a):(\d+)([+-]?)$/.exec(value);if(!m)return 'Geçersiz tuş ataması.';
    const i=Number(m[2]);
    if(m[1]==='b'?(!!m[3]||i>=pad.buttons.length):(!m[3]||i>=pad.axes.length||used.has(i)))return 'Anahtar için uçuş eksenlerinden ayrı bir kanal seç.';
    if(actions.has(value))return 'Aynı tuş veya anahtar yönünü iki işleve atama.';actions.add(value);
  }
  return '';
}
export function bindingDown(pad,value){
  const match=/^(b|a):(\d+)([+-]?)$/.exec(value??'');if(!match)return false;
  const index=Number(match[2]);
  return match[1]==='b'?!!pad.buttons[index]?.pressed:(pad.axes[index]??0)*(match[3]==='-'?-1:1)>.6;
}

let _choices=null;
export async function loadChoices(){
  if(_choices) return _choices;
  const res=await fetch("data/choices.json",{cache:"no-store"});
  _choices=await res.json();
  return _choices;
}
export function getCatalog(path){
  const parts=path.split(".");
  let cur=_choices;
  for(const p of parts){
    if(!cur||typeof cur!=="object") return null;
    cur=cur[p];
  }
  if(!Array.isArray(cur)) return null;
  for(const it of cur){
    if(!it||typeof it!=="object"||!("code" in it)||!("label" in it)) return null;
  }
  return cur;
}
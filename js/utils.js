export function uuid(){
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
    const r=(crypto.getRandomValues(new Uint8Array(1))[0]&15)>>0;
    const v=c==="x"?r:(r&0x3)|0x8;
    return v.toString(16)
  })
}
export const isoNow=()=>new Date().toISOString();
export function todayISO(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
export function showToast(msg,ms=2500){
  const el=document.getElementById("toast");
  if(!el) return;
  el.textContent=msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),ms);
}
export function downloadText(filename,content,mime="text/plain"){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
export function escapeCSV(val){
  if(val===null||val===undefined)return"";
  const s=String(val);
  if(/[",\n\r;]/.test(s))return `"${s.replace(/"/g,'""')}"`;
  return s;
}
export function toCSV(rows,headers){
  const head=headers.map(escapeCSV).join(";");
  const lines=rows.map(r=>headers.map(h=>escapeCSV(r[h])).join(";"));
  return [head,...lines].join("\n");
}
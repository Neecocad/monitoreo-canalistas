import { loadChoices, getCatalog } from "./catalogs.js";
import { todayISO } from "./utils.js";

export async function loadSchemas(){
  const res=await fetch("data/schemas.json",{cache:"no-store"});
  return res.json();
}

function mkField(field,value,onChange){
  const wrap=document.createElement("div");
  const label=document.createElement("label");
  label.textContent=field.label + (field.required?" *":"");
  wrap.appendChild(label);

  let input;
  if(field.type==="select"){
    input=document.createElement("select");
    const cat=getCatalog(field.choices);
    const opt0=document.createElement("option");
    opt0.value="";
    opt0.textContent=cat?"Seleccione...":"Catálogo inválido";
    input.appendChild(opt0);
    if(cat){
      for(const it of cat){
        const o=document.createElement("option");
        o.value=String(it.code);
        o.textContent=String(it.label);
        input.appendChild(o);
      }
    } else {
      input.disabled=true;
    }
    input.value=value??"";
  } else if(field.type==="date"){
    input=document.createElement("input");
    input.type="date";
    input.value=value??"";
  } else if(field.type==="number"){
    input=document.createElement("input");
    input.type="number";
    input.inputMode="numeric";
    input.value=value??"";
  } else if(field.type==="readonly"){
    input=document.createElement("input");
    input.type="text";
    input.value=value??"";
    input.readOnly=true;
  } else {
    input=document.createElement("input");
    input.type="text";
    input.value=value??"";
  }

  input.addEventListener("change",()=>onChange(field.key,input.value));
  input.addEventListener("input",()=>onChange(field.key,input.value));

  wrap.appendChild(input);
  return {wrap,input};
}

export async function renderHeader(schema,container,state){
  await loadChoices();
  container.innerHTML="";
  for(const f of schema.header){
    const val=state[f.key] ?? (f.default==="today"?todayISO():(f.default??""));
    if(f.type==="hidden"){
      state[f.key]=val;
      continue;
    }
    const {wrap}=mkField(f,val,(k,v)=>state[k]=v);
    container.appendChild(wrap);
    state[f.key]=val;
  }
}

function applyRules(indSchema,indState,inputs){
  for(const f of indSchema.fields){
    const el=inputs.get(f.key);
    if(el && f.type==="select") el.disabled=false;
  }

  for(const rule of (indSchema.rules||[])){
    if(String(indState[rule.if.field]??"")!==String(rule.if.equals)) continue;

    for(const k of (rule.disable||[])){
      const el=inputs.get(k);
      if(el) el.disabled=true;
    }
    for(const k of (rule.clear||[])){
      indState[k]="";
      const el=inputs.get(k);
      if(el) el.value="";
    }
  }
}

export async function renderIndividual(indSchema,indState,onDelete){
  await loadChoices();

  const card=document.createElement("div");
  card.className="ind-card";

  const head=document.createElement("div");
  head.className="ind-head";

  const title=document.createElement("div");
  title.style.fontWeight="700";
  title.textContent=`Individuo #${indState.individual_seq}`;

  const btn=document.createElement("button");
  btn.className="danger";
  btn.type="button";
  btn.textContent="Eliminar";
  btn.onclick=onDelete;

  head.appendChild(title);
  head.appendChild(btn);
  card.appendChild(head);

  const grid=document.createElement("div");
  grid.className="grid";
  card.appendChild(grid);

  const inputs=new Map();
  const setField=(k,v)=>{
    indState[k]=v;
    applyRules(indSchema,indState,inputs);
  };

  for(const f of indSchema.fields){
    const startVal = (indState[f.key] !== undefined && indState[f.key] !== null)
      ? indState[f.key]
      : (f.default ?? "");
    const {wrap,input}=mkField(f,startVal,setField);
    grid.appendChild(wrap);
    inputs.set(f.key,input);
    if(indState[f.key] === undefined || indState[f.key] === null){
      indState[f.key] = startVal;
    }
  }

  applyRules(indSchema,indState,inputs);
  return card;
}

export function validateParcel(schema,header,inds){
  const errs=[];

  for(const f of schema.header){
    if(f.type==="hidden") continue;
    if(f.required && !String(header[f.key]??"").trim()){
      errs.push(`Falta ${f.label}`);
    }
  }

  if(!inds.length) errs.push("Debe ingresar al menos 1 individuo.");

  for(const ind of inds){
    for(const f of schema.individuals.fields){
      if(f.type==="readonly") continue;
      const val=String(ind[f.key]??"").trim();

      if(f.required && !val){
        errs.push(`Individuo #${ind.individual_seq}: falta ${f.label}`);
      }

      if(f.required_if){
        const condOk = String(ind[f.required_if.field]??"")===String(f.required_if.equals);
        if(condOk && !val){
          errs.push(`Individuo #${ind.individual_seq}: falta ${f.label}`);
        }
      }
    }
  }

  return errs;
}
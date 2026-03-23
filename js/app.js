import { uuid, isoNow, todayISO, showToast } from "./utils.js";
import { put, getAllLast, getById, clearAll, metaGet, metaSet } from "./db.js";
import { loadSchemas, renderHeader, renderIndividual, validateParcel } from "./schema_engine.js";
import { loadChoices } from "./catalogs.js";
import { exportParcelasCSV } from "./export.js";

let schema;
const headerState={};
let individuals=[];
let editingRecordId = null;

function setNetBadge(){
  const el=document.getElementById("netBadge");
  if(!el) return;
  if(navigator.onLine){ el.textContent="ONLINE"; el.className="badge ok"; }
  else { el.textContent="OFFLINE"; el.className="badge off"; }
}

async function loadVersion(){
  try{
    const res=await fetch("version.json",{cache:"no-store"});
    const v=await res.json();
    const el=document.getElementById("verBadge");
    if(el) el.textContent=`v${v.version}`;
  }catch{
    const el=document.getElementById("verBadge");
    if(el) el.textContent="v?";
  }
}

async function getDeviceId(){
  const r=await metaGet("device_id");
  if(r?.value) return r.value;
  const id=uuid();
  await metaSet("device_id",id);
  return id;
}

async function refreshSaved(){
  const last=await getAllLast(schema.store,10);
  const el=document.getElementById("savedList");
  if(!el) return;

  if(!last.length){
    el.textContent="Sin registros aún.";
    return;
  }

  el.innerHTML = last.map(r => {
    const pc = r.header?.plot_code ?? "";
    const rod = r.header?.rodal ?? "";
    const dt = r.header?.date ?? "";
    const n = r.data?.individuals?.length ?? 0;

    return `
      <div style="margin-bottom:10px; padding:10px; border:1px solid rgba(255,255,255,.12); border-radius:10px;">
        <div>• ${dt} · Rodal ${rod} · Parcela ${pc} · ${n} individuos</div>
        <div style="margin-top:8px;">
          <button type="button" data-edit-id="${r.id}" class="btn-edit-record">
            Editar
          </button>
        </div>
      </div>
    `;
  }).join("");
}

async function renderAll(){
  await renderHeader(schema,document.getElementById("headerFields"),headerState);

  const list=document.getElementById("indList");
  if(list){
    list.innerHTML="";
    for(let i=0;i<individuals.length;i++){
      const ind=individuals[i];
      const card=await renderIndividual(schema.individuals,ind,()=>{
        individuals.splice(i,1);
        individuals.forEach((x,idx)=>x.individual_seq=idx+1);
        renderAll();
      });
      list.appendChild(card);
    }
  }

  const indCount=document.getElementById("indCount");
  if(indCount) indCount.textContent=`Individuos: ${individuals.length}`;

  await refreshSaved();
}

function newParcel(){
  editingRecordId = null;
  headerState.date=todayISO();
  headerState.rodal="";
  headerState.plot_code="";
  headerState.utm_x="";
  headerState.utm_y="";
  headerState.utm_zone="19S";
  headerState.datum="WGS84";
  headerState.pendiente="";
  headerState.exposicion="";
  headerState.altura_promedio_cm="";
  headerState.observacion="";
  individuals=[];
  renderAll();
}

function addIndividual(){
  individuals.push({
    individual_seq: individuals.length+1,
    species:"Quillay",
    sobrevivencia:"",
    vitalidad:"",
    estado_fitosanitario:"",
    dano_adicional:"",
    estado_del_protector:""
  });
  renderAll();
}

async function saveParcel(){
  const errs=validateParcel(schema,headerState,individuals);
  if(errs.length){
    showToast(errs[0]);
    console.warn(errs);
    return;
  }

  const device_id=await getDeviceId();
  const rec={
    id: editingRecordId || uuid(),
    form_type: "parcelas_rodales",
    form_version: "v1",
    created_at: isoNow(),
    updated_at: isoNow(),
    device_id,
    header: {
      ...headerState,
      utm_zone:"19S",
      datum:"WGS84"
    },
    data: {
      individuals: individuals.map(x=>({...x}))
    }
  };

  await put(schema.store,rec);

  showToast(editingRecordId ? "Parcela actualizada." : "Parcela guardada.");
  editingRecordId = null;
  await refreshSaved();
}

async function setupSW(){
  const badge=document.getElementById("swBadge");
  const btn=document.getElementById("btnUpdate");

  if(!("serviceWorker" in navigator)){
    if(badge) badge.textContent="SW: no";
    return;
  }

  try{
    const reg=await navigator.serviceWorker.register("./sw.js");
    if(badge) badge.textContent="SW: ok";

    reg.addEventListener("updatefound",()=>{
      const nw=reg.installing;
      nw?.addEventListener("statechange",()=>{
        if(nw.state==="installed" && navigator.serviceWorker.controller){
          if(btn) btn.style.display="inline-block";
          if(badge) badge.textContent="SW: update";
        }
      });
    });

    if(btn){
      btn.addEventListener("click",()=>{
        if(reg.waiting) reg.waiting.postMessage({type:"SKIP_WAITING"});
        let reloaded=false;
        navigator.serviceWorker.addEventListener("controllerchange",()=>{
          if(reloaded) return;
          reloaded=true;
          window.location.reload();
        });
      });
    }

    reg.update().catch(()=>{});
  }catch(e){
    console.error(e);
    if(badge) badge.textContent="SW: err";
  }
}

async function main(){
  setNetBadge();
  window.addEventListener("online",setNetBadge);
  window.addEventListener("offline",setNetBadge);

  await loadVersion();
  await loadChoices();
  const schemas=await loadSchemas();
  schema=schemas["parcelas_rodales"];

  const btnBottom = document.getElementById("btnAddIndBottom");
  if (btnBottom) btnBottom.onclick = addIndividual;

  const btnSave = document.getElementById("btnSaveParcel");
  if (btnSave) btnSave.onclick = saveParcel;

  const btnNew = document.getElementById("btnNewParcel");
  if (btnNew) btnNew.onclick = ()=>{ newParcel(); showToast("Nueva parcela."); };

  const btnExport = document.getElementById("btnExportParcelas");
  if (btnExport) btnExport.onclick = ()=>exportParcelasCSV(schema);

  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === "btnClearAll") {
      e.preventDefault();
      const ok = confirm("¿Estás seguro que quieres borrar TODOS los registros guardados?");
      if (!ok) return;
      await clearAll(schema.store);
      alert("Registros eliminados correctamente.");
      location.reload();
      return;
    }

    if (t.dataset && t.dataset.editId) {
      const id = t.dataset.editId;
      const rec = await getById(schema.store, id);
      if (!rec) {
        alert("No se encontró el registro.");
        return;
      }

      editingRecordId = rec.id;

      Object.keys(headerState).forEach(k => delete headerState[k]);
      Object.assign(headerState, rec.header || {});

      individuals = (rec.data?.individuals || []).map(ind => ({ ...ind }));

      await renderAll();

      showToast("Registro cargado para edición.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  newParcel();
  await setupSW();
}

main();
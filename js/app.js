import { uuid, isoNow, todayISO, showToast } from "./utils.js";
import { put, getAllLast, getById, clearAll, metaGet, metaSet } from "./db.js";
import { loadSchemas, renderHeader, renderIndividual, validateParcel } from "./schema_engine.js";
import { loadChoices } from "./catalogs.js";

let schema;
const headerState = {};
let individuals = [];
let editingRecordId = null;

function setNetBadge() {
  const el = document.getElementById("netBadge");
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = "ONLINE";
    el.className = "badge ok";
  } else {
    el.textContent = "OFFLINE";
    el.className = "badge off";
  }
}

async function loadVersion() {
  try {
    const res = await fetch("version.json", { cache: "no-store" });
    const v = await res.json();
    const el = document.getElementById("verBadge");
    if (el) el.textContent = `v${v.version}`;
  } catch {
    const el = document.getElementById("verBadge");
    if (el) el.textContent = "v?";
  }
}

async function getDeviceId() {
  const r = await metaGet("device_id");
  if (r?.value) return r.value;
  const id = uuid();
  await metaSet("device_id", id);
  return id;
}

function escapeCsvValue(value) {
  const v = value == null ? "" : String(value);
  return `"${v.replace(/"/g, '""')}"`;
}

async function exportCSVDirecto() {
  try {
    const records = await getAllLast(schema.store, 999999);

    if (!records.length) {
      showToast("No hay registros para exportar.");
      return;
    }

    const headers = [
      "fecha",
      "rodal",
      "parcela",
      "coordenada_x",
      "coordenada_y",
      "utm_huso",
      "datum",
      "pendiente",
      "exposicion",
      "altura_promedio_cm",
      "observacion",
      "individual_correlativo",
      "especie",
      "sobrevivencia",
      "vitalidad",
      "estado_fitosanitario",
      "dano_adicional",
      "estado_protector"
    ];

    const lines = [];
    lines.push(headers.map(escapeCsvValue).join(";"));

    for (const r of records) {
      const h = r.header || {};
      const inds = r.data?.individuals || [];

      for (const ind of inds) {
        const row = [
          h.date ?? "",
          h.rodal ?? "",
          h.plot_code ?? "",
          h.utm_x ?? "",
          h.utm_y ?? "",
          h.utm_zone ?? "19S",
          h.datum ?? "WGS84",
          h.pendiente ?? "",
          h.exposicion ?? "",
          h.altura_promedio_cm ?? "",
          h.observacion ?? "",
          ind.individual_seq ?? "",
          ind.species ?? "Quillay",
          ind.sobrevivencia ?? "",
          ind.vitalidad ?? "",
          ind.estado_fitosanitario ?? "",
          ind.dano_adicional ?? "",
          ind.estado_del_protector ?? ""
        ];

        lines.push(row.map(escapeCsvValue).join(";"));
      }
    }

    const csvContent = "\ufeff" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `parcelas_rodales_${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast(`CSV exportado: ${records.length} parcela(s).`);
  } catch (error) {
    console.error(error);
    showToast("Error al exportar CSV.");
  }
}

async function refreshSaved() {
  const last = await getAllLast(schema.store, 50);
  const el = document.getElementById("savedList");
  if (!el) return;

  if (!last.length) {
    el.textContent = "Sin registros aún.";
    return;
  }

  el.innerHTML = last.map(r => {
    const pc = r.header?.plot_code ?? "";
    const rod = r.header?.rodal ?? "";
    const dt = r.header?.date ?? "";
    const n = r.data?.individuals?.length ?? 0;

    return `
      <div style="margin-bottom:10px; padding:10px; border:1px solid rgba(255,255,255,.12); border-radius:10px;">
        <div><strong>${dt}</strong> · Rodal ${rod} · Parcela ${pc} · ${n} individuos</div>
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" data-edit-id="${r.id}" class="btn-edit-record">Editar</button>
        </div>
      </div>
    `;
  }).join("");
}

async function renderAll() {
  await renderHeader(schema, document.getElementById("headerFields"), headerState);

  const list = document.getElementById("indList");
  if (list) {
    list.innerHTML = "";
    for (let i = 0; i < individuals.length; i++) {
      const ind = individuals[i];
      const card = await renderIndividual(schema.individuals, ind, () => {
        individuals.splice(i, 1);
        individuals.forEach((x, idx) => x.individual_seq = idx + 1);
        renderAll();
      });
      list.appendChild(card);
    }
  }

  const indCount = document.getElementById("indCount");
  if (indCount) {
    const modo = editingRecordId ? "Modo edición" : "Modo nuevo registro";
    indCount.textContent = `Individuos: ${individuals.length} · ${modo}`;
  }

  await refreshSaved();
}

async function newParcel() {
  editingRecordId = null;

  Object.keys(headerState).forEach(k => delete headerState[k]);

  headerState.date = todayISO();
  headerState.rodal = "";
  headerState.plot_code = "";
  headerState.utm_x = "";
  headerState.utm_y = "";
  headerState.utm_zone = "19S";
  headerState.datum = "WGS84";
  headerState.pendiente = "";
  headerState.exposicion = "";
  headerState.altura_promedio_cm = "";
  headerState.observacion = "";

  individuals = [];
  await renderAll();
}

async function addIndividual() {
  individuals.push({
    individual_seq: individuals.length + 1,
    species: "Quillay",
    sobrevivencia: "",
    vitalidad: "",
    estado_fitosanitario: "",
    dano_adicional: "",
    estado_del_protector: ""
  });
  await renderAll();
}

async function saveParcel() {
  const errs = validateParcel(schema, headerState, individuals);
  if (errs.length) {
    showToast(errs[0]);
    console.warn(errs);
    return;
  }

  const device_id = await getDeviceId();
  const now = isoNow();

  let createdAt = now;
  if (editingRecordId) {
    const existing = await getById(schema.store, editingRecordId);
    if (existing?.created_at) createdAt = existing.created_at;
  }

  const rec = {
    id: editingRecordId || uuid(),
    form_type: "parcelas_rodales",
    form_version: "v2",
    created_at: createdAt,
    updated_at: now,
    device_id,
    header: {
      ...headerState,
      utm_zone: "19S",
      datum: "WGS84"
    },
    data: {
      individuals: individuals.map((x, idx) => ({
        ...x,
        individual_seq: idx + 1,
        species: "Quillay"
      }))
    }
  };

  const estabaEditando = !!editingRecordId;

  await put(schema.store, rec);

  showToast(estabaEditando ? "Parcela actualizada." : "Parcela guardada.");

  await newParcel();
  await refreshSaved();

  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function setupSW() {
  const badge = document.getElementById("swBadge");
  const btn = document.getElementById("btnUpdate");

  if (!("serviceWorker" in navigator)) {
    if (badge) badge.textContent = "SW: no";
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register("./sw.js");
    if (badge) badge.textContent = "SW: ok";

    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw?.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          if (btn) btn.style.display = "inline-block";
          if (badge) badge.textContent = "SW: update";
        }
      });
    });

    if (btn) {
      btn.addEventListener("click", () => {
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        let reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloaded) return;
          reloaded = true;
          window.location.reload();
        });
      });
    }

    reg.update().catch(() => {});
  } catch (e) {
    console.error(e);
    if (badge) badge.textContent = "SW: err";
  }
}

async function main() {
  setNetBadge();
  window.addEventListener("online", setNetBadge);
  window.addEventListener("offline", setNetBadge);

  await loadVersion();
  await loadChoices();

  const schemas = await loadSchemas();
  schema = schemas["parcelas_rodales"];

  const btnBottom = document.getElementById("btnAddIndBottom");
  if (btnBottom) btnBottom.onclick = addIndividual;

  const btnSave = document.getElementById("btnSaveParcel");
  if (btnSave) btnSave.onclick = saveParcel;

  const btnNew = document.getElementById("btnNewParcel");
  if (btnNew) btnNew.onclick = async () => {
    await newParcel();
    showToast("Nueva parcela.");
  };

  const btnExport = document.getElementById("btnExportParcelas");
  if (btnExport) btnExport.onclick = exportCSVDirecto;

  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === "btnClearAll") {
      e.preventDefault();
      const ok = confirm("¿Estás seguro que quieres borrar TODOS los registros guardados?");
      if (!ok) return;

      await clearAll(schema.store);
      await newParcel();
      await refreshSaved();
      showToast("Registros eliminados correctamente.");
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

      individuals = (rec.data?.individuals || []).map((ind, idx) => ({
        ...ind,
        individual_seq: idx + 1,
        species: "Quillay"
      }));

      await renderAll();

      showToast("Registro cargado para edición.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  });

  await newParcel();
  await setupSW();
}

main();

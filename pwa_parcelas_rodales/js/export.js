import { getAll } from "./db.js";
import { toCSV, downloadText } from "./utils.js";

export async function exportParcelasCSV(schema){
  const all=await getAll(schema.store);
  const rows=[];

  for(const rec of all){
    const h=rec.header||{};
    const inds=rec.data?.individuals||[];

    for(const ind of inds){
      const row={};

      for(const col of schema.csv.columns){
        if(col.key.startsWith("header.")){
          const k=col.key.split(".")[1];
          row[col.label]=h[k]??"";
        } else if(col.key.startsWith("ind.")){
          const k=col.key.split(".")[1];
          row[col.label]=ind[k]??"";
        }
      }

      rows.push(row);
    }
  }

  const headers=schema.csv.columns.map(c=>c.label);
  const csv=toCSV(rows,headers);
  const stamp=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  downloadText(`${schema.csv.filename_prefix}_${stamp}.csv`,"\ufeff"+csv,"text/csv;charset=utf-8");
}
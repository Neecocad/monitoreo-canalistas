const DB_NAME="offline_forms_db";
const DB_VERSION=1;

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);

    req.onupgradeneeded=()=>{
      const db=req.result;

      if(!db.objectStoreNames.contains("parcelas_rodales")){
        const s=db.createObjectStore("parcelas_rodales",{keyPath:"id"});
        s.createIndex("created_at","created_at",{unique:false});
      }

      if(!db.objectStoreNames.contains("meta")){
        db.createObjectStore("meta",{keyPath:"key"});
      }
    };

    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

async function withStore(storeName,mode,fn){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,mode);
    const s=tx.objectStore(storeName);
    let result;

    Promise.resolve()
      .then(()=>fn(s))
      .then((r)=>(result=r))
      .catch(reject);

    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
}

function reqToPromise(req){
  return new Promise((resolve,reject)=>{
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

export async function put(storeName,val){
  return withStore(storeName,"readwrite",(s)=>reqToPromise(s.put(val)));
}
export async function getAll(storeName){
  return withStore(storeName,"readonly",(s)=>reqToPromise(s.getAll()));
}
export async function getAllLast(storeName,n=10){
  const all=await getAll(storeName);
  all.sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));
  return all.slice(0,n);
}
export async function metaGet(key){
  return withStore("meta","readonly",(s)=>reqToPromise(s.get(key)));
}
export async function metaSet(key,value){
  return withStore("meta","readwrite",(s)=>reqToPromise(s.put({key,value})));
}
export async function getById(storeName,id){
  return withStore(storeName,"readonly",(s)=>reqToPromise(s.get(id)));
}
export async function clearAll(storeName){
  return withStore(storeName,"readwrite",(s)=>reqToPromise(s.clear()));
}
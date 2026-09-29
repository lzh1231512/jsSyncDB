class w {
  constructor(t, e = globalThis.indexedDB, s = "t_main") {
    if (this.indexedDBFactory = e, this.storeName = s, !t.trim())
      throw new Error("Database name cannot be empty.");
    if (!this.indexedDBFactory)
      throw new Error("IndexedDB is not available in this environment.");
    this.databasePromise = this.openDatabase(t);
  }
  indexedDBFactory;
  storeName;
  static dbname = "IndexedDB";
  static priority = 3;
  databasePromise;
  static isSupport(t = globalThis.indexedDB) {
    return t !== void 0;
  }
  async getVals(t, e = !1) {
    if (t.length === 0)
      return [];
    const s = await this.databasePromise;
    return new Promise((a, r) => {
      let i;
      try {
        i = s.transaction(this.storeName, "readonly");
      } catch (d) {
        r(d);
        return;
      }
      const c = new Array(t.length).fill(null);
      let n = !1;
      i.oncomplete = () => {
        n || (n = !0, a(e ? c.map(C) : c));
      }, i.onerror = () => {
        n || (n = !0, r(i.error ?? new Error("IndexedDB read transaction failed.")));
      }, i.onabort = () => {
        n || (n = !0, r(i.error ?? new Error("IndexedDB read transaction was aborted.")));
      };
      const u = i.objectStore(this.storeName);
      t.forEach((d, l) => {
        const h = u.get(d);
        h.onsuccess = () => {
          const b = h.result;
          c[l] = b?.val ?? null;
        };
      });
    });
  }
  async exec(t) {
    if (t.length === 0)
      return;
    const e = await this.databasePromise;
    await new Promise((s, a) => {
      let r;
      try {
        r = e.transaction(this.storeName, "readwrite");
      } catch (n) {
        a(n);
        return;
      }
      let i = !1;
      r.oncomplete = () => {
        i || (i = !0, s());
      }, r.onerror = () => {
        i || (i = !0, a(r.error ?? new Error("IndexedDB write transaction failed.")));
      }, r.onabort = () => {
        i || (i = !0, a(r.error ?? new Error("IndexedDB write transaction was aborted.")));
      };
      const c = r.objectStore(this.storeName);
      try {
        for (const n of t)
          n.ac === "del" ? c.delete(n.key) : c.put({ key: n.key, val: n.val });
      } catch (n) {
        try {
          r.abort();
        } catch {
        }
        i || (i = !0, a(n));
      }
    });
  }
  async clear() {
    const t = await this.databasePromise;
    await new Promise((e, s) => {
      let a;
      try {
        a = t.transaction(this.storeName, "readwrite");
      } catch (i) {
        s(i);
        return;
      }
      let r = !1;
      a.oncomplete = () => {
        r || (r = !0, e());
      }, a.onerror = () => {
        r || (r = !0, s(a.error ?? new Error("IndexedDB clear transaction failed.")));
      }, a.onabort = () => {
        r || (r = !0, s(a.error ?? new Error("IndexedDB clear transaction was aborted.")));
      }, a.objectStore(this.storeName).clear();
    });
  }
  openDatabase(t) {
    const e = this.indexedDBFactory;
    return e ? new Promise((s, a) => {
      let r;
      try {
        r = e.open(t, 1);
      } catch (i) {
        a(i);
        return;
      }
      r.onupgradeneeded = () => {
        r.result.objectStoreNames.contains(this.storeName) || r.result.createObjectStore(this.storeName, { keyPath: "key" });
      }, r.onsuccess = () => {
        const i = r.result;
        i.onversionchange = () => i.close(), s(i);
      }, r.onerror = () => a(r.error ?? new Error("Unable to open IndexedDB.")), r.onblocked = () => a(new Error(`Opening IndexedDB database "${t}" was blocked.`));
    }) : Promise.reject(new Error("IndexedDB is not available in this environment."));
  }
}
function C(o) {
  return o == null || o === "" ? o ?? null : typeof o == "string" ? JSON.parse(o) : o;
}
const U = /* @__PURE__ */ new Map(), B = /* @__PURE__ */ new Map([
  [w.dbname, {
    dbname: w.dbname,
    priority: w.priority,
    isSupport: w.isSupport,
    create: (o, t) => new w(o, t)
  }]
]);
class k {
  constructor(t, e, s = {}) {
    if (this.dbName = t, !t.trim())
      throw new Error("Database name cannot be empty.");
    if (this.localStorage = s.localStorage ?? globalThis.localStorage, !this.localStorage)
      throw new Error("LocalStorage is not available in this environment.");
    const a = e ?? this.get("dbtype") ?? void 0, r = this.selectBackend(a, s.indexedDB);
    this.backend = r.create(t, s.indexedDB);
  }
  dbName;
  metadataCache = /* @__PURE__ */ new Map();
  recordCache = /* @__PURE__ */ new Map();
  backend;
  localStorage;
  static get(t, e, s) {
    const a = U.get(t);
    if (a)
      return a;
    const r = new k(t, e, s);
    return U.set(t, r), r;
  }
  static registerBackend(t) {
    if (!t.dbname.trim())
      throw new Error("Storage backend name cannot be empty.");
    B.set(t.dbname, t);
  }
  static clearInstances() {
    U.clear();
  }
  static get backends() {
    return B;
  }
  get(t, e = !1) {
    const s = this.getMetadataValue(t);
    return s === null ? null : e ? JSON.parse(s) : s;
  }
  set(t, e) {
    const s = this.metadataKey(t);
    if (e == null) {
      this.localStorage.removeItem(s), this.metadataCache.set(t, null);
      return;
    }
    const a = typeof e == "object" ? JSON.stringify(e) : String(e);
    this.localStorage.setItem(s, a), this.metadataCache.set(t, a);
  }
  async getDB(t, e = !1, s) {
    const a = Array.isArray(t), r = typeof e == "boolean" ? e : !1, i = typeof e == "function" ? e : s, c = a ? t : [t], n = new Array(c.length).fill(null), u = [], d = [];
    c.forEach((h, b) => {
      this.recordCache.has(h) ? n[b] = this.decodeValue(this.recordCache.get(h), r) : (u.push(h), d.push(b));
    }), u.length > 0 && (await this.backend.getVals(u, r)).forEach((b, D) => {
      const I = u[D];
      if (I === void 0)
        return;
      const p = b ?? null;
      this.recordCache.set(I, p), n[d[D]] = this.decodeValue(p, !1);
    });
    const l = a ? n : n[0] ?? null;
    return i && (await Promise.resolve(), i(l)), l;
  }
  async setDB(t, e, s) {
    let a, r = s;
    typeof t == "string" ? typeof e == "function" ? (r = e, a = [{ ac: "del", key: t }]) : a = [{
      ac: "set",
      key: t,
      val: N(e)
    }] : (a = t, typeof e == "function" && (r = e)), await this.backend.exec(a);
    for (const i of a)
      i.ac === "del" ? this.recordCache.set(i.key, null) : this.recordCache.set(i.key, i.val);
    r?.();
  }
  setDBcmd(t, e, s) {
    (s ?? e).push({ ac: "del", key: t }), s && s.push({ ac: "set", key: t, val: N(e) });
  }
  async clear(t) {
    await this.backend.clear();
    const e = [];
    for (let s = 0; s < this.localStorage.length; s += 1) {
      const a = this.localStorage.key(s);
      a?.startsWith(`${this.dbName}.`) && e.push(a);
    }
    for (const s of e)
      this.localStorage.removeItem(s);
    this.metadataCache.clear(), this.recordCache.clear(), t?.();
  }
  getMetadataValue(t) {
    if (this.metadataCache.has(t))
      return this.metadataCache.get(t) ?? null;
    const e = this.localStorage.getItem(this.metadataKey(t));
    return this.metadataCache.set(t, e), e;
  }
  metadataKey(t) {
    return `${this.dbName}.${t}`;
  }
  selectBackend(t, e) {
    if (t) {
      const r = B.get(t);
      if (r?.isSupport(e))
        return r;
    }
    const a = [...B.values()].filter((r) => r.isSupport(e)).sort((r, i) => i.priority - r.priority)[0];
    if (!a)
      throw new Error("No supported local database backend is available.");
    return a;
  }
  decodeValue(t, e) {
    return t == null ? null : e && typeof t == "string" ? JSON.parse(t) : t;
  }
}
function N(o) {
  return typeof o == "object" ? JSON.stringify(o) : o && String(o);
}
const y = {}, g = {}, x = {}, S = {}, W = {};
function F(o, t) {
  const e = this && typeof this == "object" ? this : { uuid: o, table: t };
  return e.uuid = o, e.table = t, e;
}
const _ = F, v = 200, $ = /* @__PURE__ */ new Map();
class L {
  constructor(t, e) {
    this.database = t, this.tableName = e;
  }
  database;
  tableName;
  dbRead(t, e, s, a) {
    return this.database.dbRead(this.tableName, t, e, s, a);
  }
}
class T {
  static databases = $;
  db;
  writeTail = Promise.resolve();
  constructor(t, e, s) {
    this.db = k.get(t, e, s);
  }
  static get(t, e, s) {
    const a = this.databases.get(t);
    if (a)
      return a;
    const r = new T(t, e, s);
    return this.databases.set(t, r), r;
  }
  static clearInstances() {
    this.databases.clear(), k.clearInstances();
  }
  async dbOpObjs(t, e, s) {
    const a = this.serializeWrite(() => this.applyOperations(t, e));
    return this.withCallback(a, s);
  }
  async dbWriteObj(t, e) {
    const s = Array.isArray(t) ? t : [t];
    return this.dbOpObjs(new Array(s.length).fill(0), s, e);
  }
  async dbDeleteObj(t, e) {
    const s = Array.isArray(t) ? t : [t];
    return this.dbOpObjs(new Array(s.length).fill(1), s, e);
  }
  async dbReadObj(t, e) {
    const s = this.readObject(t);
    return this.withCallback(s, e);
  }
  async dbReadObjs(t, e) {
    const s = this.writeTail.then(() => this.readObjects(t));
    return this.withCallback(s, e);
  }
  dbRead(t, e, s = 0, a = 0, r) {
    const i = this.parseReadArguments(e, s, a, r), c = this.readTable(t, i);
    return this.withCallback(c, i.callback);
  }
  async clearDB(t) {
    const e = this.serializeWrite(() => this.db.clear());
    return this.withCallback(e, t);
  }
  checkFormat(t) {
    if (!t || typeof t != "object")
      return !1;
    const e = t;
    return !!(typeof e.uuid == "string" && e.uuid.length > 0 && typeof e.table == "string" && e.table.length > 0 && Array.isArray(g[e.table]));
  }
  get(t, e = !1) {
    return this.db.get(t, e);
  }
  set(t, e) {
    this.db.set(t, e);
  }
  getTable(t) {
    return new L(this, t);
  }
  async applyOperations(t, e) {
    if (t.length !== e.length)
      throw new Error("Delete flags and objects must have the same length.");
    if (e.length === 0)
      return;
    const s = /* @__PURE__ */ new Map();
    e.forEach((u, d) => {
      if (!this.checkFormat(u))
        throw new Error("Invalid legacy object. Register its table model first.");
      s.delete(u.uuid), s.set(u.uuid, { isDelete: t[d] === 1, object: q(u) });
    });
    const a = [...s.values()], r = await this.readObjects(a.map(({ object: u }) => u.uuid)), i = /* @__PURE__ */ new Map();
    r.forEach((u) => {
      u && this.checkFormat(u) && i.set(u.uuid, u);
    });
    const c = /* @__PURE__ */ new Map();
    for (const { object: u } of a)
      c.has(u.table) || c.set(u.table, await this.loadTableIndex(u.table));
    for (const u of i.values())
      c.has(u.table) || c.set(u.table, await this.loadTableIndex(u.table));
    for (const { isDelete: u, object: d } of a) {
      const l = i.get(d.uuid);
      if (l) {
        const h = c.get(l.table);
        h.entries = h.entries.filter((b) => b.u !== l.uuid);
      }
      u || c.get(d.table).entries.push(this.createIndexItem(d));
    }
    const n = [];
    for (const { isDelete: u, object: d } of a)
      if (u)
        this.db.setDBcmd(d.uuid, n);
      else {
        const l = this.viewModelToEntity(d);
        this.db.setDBcmd(d.uuid, l, n);
      }
    for (const u of c.values())
      this.writeTableIndex(u, n);
    await this.db.setDB(n);
    for (const { isDelete: u, object: d } of a) {
      const l = i.get(d.uuid) ?? null;
      await this.emitModelEvent(d, l, u);
    }
  }
  async readObject(t) {
    await this.writeTail;
    const e = await this.db.getDB(t, !1);
    return e === null ? {} : this.entityToViewModel(e, t) ?? {};
  }
  async readObjects(t) {
    return (await this.db.getDB(t, !1)).map(
      (s, a) => s === null ? null : this.entityToViewModel(s, t[a] ?? "")
    );
  }
  async readTable(t, e) {
    await this.writeTail;
    const a = (await this.loadTableIndex(t)).buckets.filter((l) => l.l > 0), i = this.selectBuckets(t, a, e.filters).flatMap((l) => l.d?.map((h) => h.u) ?? []);
    if (i.length === 0)
      return [];
    const c = await this.db.getDB(i, !1), n = [];
    for (let l = 0; l < c.length; l += 1) {
      const h = c[l];
      if (h === null)
        continue;
      const b = this.entityToViewModel(h, i[l] ?? "");
      b?.table === t && V(b, e.filters) && n.push(b);
    }
    const u = Math.max(e.skip, 0), d = e.take > 0 ? u + e.take : void 0;
    return n.slice(u, d);
  }
  async loadTableIndex(t) {
    const e = await this.db.getDB("table." + t, !0), s = Array.isArray(e) ? e : [], a = s.map((n) => n.r).filter((n) => typeof n == "string"), r = a.length > 0 ? await this.db.getDB(a, !1) : [], i = [], c = [];
    return s.forEach((n, u) => {
      if (!n || typeof n.r != "string")
        return;
      const d = r[u], l = J(d ?? null, t, !!(y[t] && y[t] !== "uuid"), x[t]), h = {
        r: n.r,
        l: l.length,
        s: l.length ? m(l[0], t) : n.s,
        e: l.length ? m(l[l.length - 1], t) : n.e,
        d: l
      };
      i.push(h), c.push(...l);
    }), { table: t, buckets: i, entries: c };
  }
  selectBuckets(t, e, s) {
    const a = y[t] ?? "uuid", r = s.find(([n, u]) => n === a && u !== "con" && u !== "em" && u !== "ne");
    if (!r || r[2] === void 0 || r[2] === null)
      return [...e];
    const [, i, c] = r;
    return e.filter((n) => z(n, i, c));
  }
  writeTableIndex(t, e) {
    const { table: s } = t, r = (y[s] ?? "uuid") !== "uuid";
    t.entries.sort((n, u) => f(m(n, s), m(u, s)));
    const i = [];
    for (let n = 0; n < t.entries.length; n += v)
      i.push(t.entries.slice(n, n + v));
    const c = i.map((n, u) => {
      const l = t.buckets[u]?.r ?? `r${this.nextIndexIdentity()}`, h = n[0], b = n[n.length - 1], D = {
        r: l,
        l: n.length,
        s: m(h, s),
        e: m(b, s)
      }, I = r ? n.map((p) => `${p.u},${String(p.i ?? "")}`).join(",") : n.map((p) => p.u).join(",");
      return this.db.setDBcmd(l, I, e), D;
    });
    for (const n of t.buckets.slice(i.length))
      this.db.setDBcmd(n.r, e), this.recycleIndexIdentity(n.r);
    this.db.setDBcmd(`table.${s}`, c, e);
  }
  createIndexItem(t) {
    const e = y[t.table] ?? "uuid";
    return x[t.table] === "int" ? { u: t.uuid, ...e === "uuid" ? {} : { i: parseInt(String(t[e]), 10) } } : { u: t.uuid, ...e === "uuid" ? {} : { i: t[e] } };
  }
  viewModelToEntity(t) {
    const e = t.table, s = this.getTableIdentity(e), a = S[e];
    if (a)
      return `${s},${String(a.viewModelToEntity(t))}`;
    const r = g[e];
    if (!r)
      throw new Error(`No column model is registered for table "${e}".`);
    const i = { b: s };
    return r.forEach((c, n) => {
      i[R(n + 2)] = t[c];
    }), i;
  }
  entityToViewModel(t, e) {
    if (t == null)
      return null;
    if (typeof t == "string") {
      const c = t.indexOf(",");
      if (c > 0 && /^\d+$/.test(t.slice(0, c))) {
        const u = this.getTableName(t.slice(0, c)), d = S[u];
        if (!u || !d)
          throw new Error(`No entity transformation is registered for table index "${t.slice(0, c)}".`);
        return { ...d.entityToViewModel(t.slice(c + 1)), uuid: e, table: u };
      }
      const n = JSON.parse(t);
      return this.entityToViewModel(n, e);
    }
    if (typeof t != "object")
      return null;
    const s = t, a = this.getTableName(s.b), r = g[a];
    if (!a || !r) {
      if (typeof s.uuid == "string" && typeof s.table == "string")
        return { ...s, uuid: e, table: s.table };
      throw new Error(`No column model is registered for stored table index "${String(s.b)}".`);
    }
    const i = { uuid: e, table: a };
    return r.forEach((c, n) => {
      i[c] = s[R(n + 2)];
    }), i;
  }
  getTableIdentity(t) {
    const e = this.db.get(`tableName.${t}`);
    if (e !== null)
      return Number(e);
    const s = Number(this.db.get("tableIndexIdentity") ?? 1);
    return this.db.set("tableIndexIdentity", s + 1), this.db.set(`tableName.${t}`, s), this.db.set(`tableIndex.${s}`, t), s;
  }
  getTableName(t) {
    return t == null ? "" : this.db.get(`tableIndex.${t}`) ?? "";
  }
  nextIndexIdentity() {
    const t = this.db.get("indexidentityRe", !0) ?? [];
    if (t.length > 0) {
      const s = t.shift();
      return this.db.set("indexidentityRe", t), s;
    }
    const e = Number(this.db.get("indexidentity") ?? 1);
    return this.db.set("indexidentity", e + 1), e;
  }
  recycleIndexIdentity(t) {
    const e = Number.parseInt(t.slice(1), 10);
    if (!Number.isFinite(e))
      return;
    const s = this.db.get("indexidentityRe", !0) ?? [];
    s.push(e), this.db.set("indexidentityRe", s);
  }
  async emitModelEvent(t, e, s) {
    const a = W[t.table];
    s && e && a?.onDelete ? await a.onDelete(e) : !s && a?.onSave && await a.onSave(e, t);
  }
  parseReadArguments(t, e, s, a) {
    let r = typeof t == "function" ? void 0 : t, i = typeof e == "number" ? e : 0, c = typeof s == "number" ? s : 0, n = a;
    return typeof t == "function" ? (n = t, r = void 0) : typeof e == "function" ? (n = e, i = 0, c = 0) : typeof s == "function" && (n = s, c = 0), { filters: P(r), skip: i, take: c, callback: n };
  }
  serializeWrite(t) {
    const e = this.writeTail.then(t);
    return this.writeTail = e.then(() => {
    }, () => {
    }), e;
  }
  withCallback(t, e) {
    return e && t.then(
      (s) => e(s),
      () => e(-1)
    ), t;
  }
}
function P(o) {
  if (!o)
    return [];
  const t = o;
  return typeof t[0] == "string" ? [o] : t;
}
function V(o, t) {
  return t.every(([e, s, a]) => {
    const r = o[e];
    switch (s) {
      case "<":
        return r !== void 0 && f(r, a) < 0;
      case "<=":
        return r !== void 0 && f(r, a) <= 0;
      case ">":
        return r !== void 0 && f(r, a) > 0;
      case ">=":
        return r !== void 0 && f(r, a) >= 0;
      case "=":
        return r === a || r == a;
      case "bt":
        return Array.isArray(a) && r !== void 0 && f(r, a[0]) >= 0 && f(r, a[1]) < 0;
      case "in":
        return Array.isArray(a) && a.some((i) => r == i);
      case "con":
        return typeof r == "string" && r.includes(String(a));
      case "sw":
        return typeof r == "string" && r.startsWith(String(a));
      case "em":
        return r === null || r === "";
      case "ne":
        return r !== null && r !== "";
    }
  });
}
function f(o, t) {
  if (o == t) return 0;
  if (o == null) return -1;
  if (t == null) return 1;
  if (typeof o == "string" && typeof t == "string")
    return o < t ? -1 : 1;
  const e = Number(o), s = Number(t);
  return Number.isFinite(e) && Number.isFinite(s) ? e < s ? -1 : 1 : String(o) < String(t) ? -1 : 1;
}
function m(o, t) {
  return y[t] && y[t] !== "uuid" ? o.i : x[t] === "int" ? Number(o.u) : o.u;
}
function J(o, t, e, s) {
  if (!o)
    return [];
  const a = o.split(","), r = [];
  if (e)
    for (let i = 0; i + 1 < a.length; i += 2)
      r.push({
        u: a[i],
        i: s === "int" ? Number.parseInt(a[i + 1], 10) : a[i + 1]
      });
  else
    for (const i of a)
      r.push({ u: s === "int" ? Number.parseInt(i, 10) + "" : i });
  return r;
}
function z(o, t, e) {
  const s = o.s, a = o.e;
  switch (t) {
    case "<":
      return s !== void 0 && f(s, e) < 0;
    case "<=":
      return s !== void 0 && f(s, e) <= 0;
    case ">":
      return a !== void 0 && f(a, e) > 0;
    case ">=":
      return a !== void 0 && f(a, e) >= 0;
    case "=":
      return s !== void 0 && a !== void 0 && f(s, e) <= 0 && f(a, e) >= 0;
    case "bt":
      return Array.isArray(e) && s !== void 0 && a !== void 0 && f(a, e[0]) >= 0 && f(s, e[1]) < 0;
    case "in":
      return Array.isArray(e) && e.some((r) => s !== void 0 && a !== void 0 && f(s, r) <= 0 && f(a, r) >= 0);
    case "sw": {
      if (typeof s != "string" || typeof a != "string") return !0;
      const r = String(e), i = s.slice(0, r.length);
      return a.slice(0, r.length) >= r && i <= r;
    }
    default:
      return !0;
  }
}
function R(o) {
  const t = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return o < t.length ? t[o] : t[Math.floor(o / t.length)] + t[o % t.length];
}
function q(o) {
  return JSON.parse(JSON.stringify(o));
}
class H {
  async upload(t, e) {
    const s = new URLSearchParams();
    for (const [r, i] of Object.entries(e))
      s.set(r, String(i));
    const a = await fetch(t, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: s
    });
    return O(a);
  }
  async download(t, e) {
    const s = new URL(t, globalThis.location?.href ?? "http://localhost/");
    for (const [r, i] of Object.entries(e))
      s.searchParams.set(r, String(i));
    const a = await fetch(s);
    return O(a);
  }
}
async function O(o) {
  if (!o.ok)
    throw new Error(`Sync request failed with HTTP ${o.status}.`);
  return o.json();
}
const K = 100, G = /* @__PURE__ */ new Map();
Q();
class A {
  static instances = G;
  database;
  transport;
  transferLimit;
  uuidFactory;
  disabledTables;
  code;
  databaseName;
  serviceUrl;
  uploadBusy = !1;
  downloadBusy = !1;
  restoreBusy = !1;
  hasNewData = !1;
  isWait = -1;
  autoTimer = null;
  autoSocket = null;
  lastSocketAttempt = 0;
  lastSocketHeartbeat = 0;
  autoRetrySeconds = 0;
  autoUploadBusy = !1;
  autoRestoreBusy = !1;
  autoDownloadBusy = !1;
  syncLifecycleListeners = /* @__PURE__ */ new Set();
  syncOperationSequence = 0;
  constructor(t, e, s, a, r = {}) {
    this.code = t, this.databaseName = e, this.serviceUrl = E(s), this.database = r.database ?? T.get(`${e}_${t}`, a, r.dbOptions), this.transport = r.transport ?? new H(), this.transferLimit = r.transferLimit ?? K, this.uuidFactory = r.uuidFactory ?? Y, this.disabledTables = new Set(r.disableSyncTables ?? []);
  }
  static get(t, e, s, a, r) {
    const i = `${t}_${e}`, c = this.instances.get(i);
    if (c) return c;
    const n = new A(e, t, s, a, r);
    return this.instances.set(i, n), n;
  }
  static clearInstances() {
    this.instances.clear();
  }
  opObj(t, e, s) {
    return this.withCallback(this.operateObjects(t, e), s);
  }
  async writeObj(t, e) {
    const s = Array.isArray(t) ? t : [t];
    return this.withCallback(this.writeOrDelete(s, !1), e);
  }
  async deleteObj(t, e) {
    const s = Array.isArray(t) ? t : [t];
    return this.withCallback(this.writeOrDelete(s, !0), e);
  }
  writeObjWithoutSync(t, e) {
    return this.withCallback(this.database.dbWriteObj(t), e);
  }
  deleteObjWithoutSync(t, e) {
    return this.withCallback(this.database.dbDeleteObj(t), e);
  }
  dbReadObj(t, e) {
    return this.withCallback(this.database.dbReadObj(t), e);
  }
  dbRead(t, e, s, a, r) {
    return this.withCallback(this.database.dbRead(t, e, s ?? 0, a ?? 0), r);
  }
  async readMainIndex(t = 0, e = 0, s = 0, a) {
    const r = this.readMainIndexCore(t, e, s);
    return this.withCallback(r, a);
  }
  async restore(t) {
    return this.restoreWithSource(t, "manual");
  }
  async upload(t) {
    return this.uploadWithSource(t, "manual");
  }
  async download(t) {
    return this.downloadWithSource(t, "manual");
  }
  async sync(t) {
    this.isWait = -1;
    const e = this.runTrackedOperation("sync", "manual", () => this.syncCore());
    return this.withCallback(e, t);
  }
  onSyncEvent(t) {
    return this.syncLifecycleListeners.add(t), () => {
      this.syncLifecycleListeners.delete(t);
    };
  }
  autoSync(t, e = 30) {
    this.autoTimer === null && (this.isWait = 0, this.autoRetrySeconds = 0, this.autoUploadBusy = !1, this.autoRestoreBusy = !1, this.autoDownloadBusy = !1, this.autoTimer = setInterval(() => {
      typeof WebSocket < "u" ? this.autoSocketTick(t, e) : this.autoPollingTick(t);
    }, 1e3));
  }
  stopAutoSync() {
    this.autoTimer !== null && clearInterval(this.autoTimer), this.autoTimer = null;
    const t = this.autoSocket;
    this.autoSocket = null, t && t.readyState < 2 && t.close(), this.autoUploadBusy = !1, this.autoRestoreBusy = !1, this.autoDownloadBusy = !1;
  }
  clear(t) {
    return this.hasNewData = !1, this.withCallback(this.database.clearDB(), t);
  }
  getTable(t) {
    return this.database.getTable(t);
  }
  setService(t, e) {
    this.code = t, this.serviceUrl = E(e);
  }
  async writeOrDelete(t, e) {
    return this.operateObjects(t.map(() => e ? 1 : 0), t);
  }
  async operateObjects(t, e) {
    if (t.length !== e.length)
      throw new Error("Delete flags and objects must have the same length.");
    const s = [], a = [];
    e.forEach((r, i) => {
      const c = t[i] === 1;
      !this.disabledTables.has(r.table) && !r.table.startsWith("mainSync") && (s.push(this.createTempEvent(r, c)), a.push(0)), s.push(r), a.push(c ? 1 : 0);
    }), await this.database.dbOpObjs(a, s), s.length > 0 && (this.hasNewData = !0);
  }
  createTempEvent(t, e) {
    const s = Number(this.database.get("newTempSyncObjUUID") ?? 0) + 1;
    return this.database.set("newTempSyncObjUUID", s), {
      uuid: `t${String(s).padStart(8, "0")}`,
      table: "mainSync.Temp",
      isDelete: e ? 1 : 0,
      objuuid: t.uuid
    };
  }
  async uploadCore() {
    let t = !1;
    try {
      for (; ; ) {
        const e = this.database.get("tempUploadData", !0), s = e?.map(({ event: d }) => d) ?? await this.database.dbRead("mainSync.Temp", null, 0, this.transferLimit);
        if (s.length === 0)
          return this.clearUploadCheckpoint(), this.hasNewData = !1, 1;
        const a = e ?? await this.makeUploadSnapshot(s), r = this.database.get("uploadUUID") || this.uuidFactory();
        this.database.set("uploadUUID", r), this.database.set("tempUploadData", a);
        const i = await this.transport.upload(this.endpoint("UploadDBObj"), {
          Code: this.code,
          DBName: this.databaseName,
          Data: JSON.stringify(a.map(({ wire: d }) => d)),
          uuid: this.database.get("uuid") ?? "",
          localUUID: this.getLocalUuid(),
          uploadUUID: r,
          restore: "0",
          localMaxId: this.currentIndex()
        });
        if (i.status === -2) {
          if (t) return -2;
          const d = await this.restoreFrom(i.lastId ?? 0);
          if (d !== 1) return d;
          t = !0, this.clearUploadCheckpoint();
          continue;
        }
        if (i.status !== 1) return i.status || -9;
        i.uuid && !this.database.get("uuid") && this.database.set("uuid", i.uuid);
        const c = i.data ?? [], n = new Set(c.map((d) => d.objuuid));
        if (a.some(({ event: d }) => !n.has(d.objuuid))) return -9;
        const u = this.database.get("localids", !0) ?? {};
        for (const d of c) u[`s${d.id}`] = 1;
        this.database.set("localids", u), await this.database.dbDeleteObj(a.map(({ event: d }) => d)), this.clearUploadCheckpoint();
      }
    } catch {
      return -9;
    }
  }
  async makeUploadSnapshot(t) {
    const e = await this.database.dbReadObjs(t.map(({ objuuid: s }) => s));
    return t.map((s, a) => {
      const r = e[a] ? j(e[a]) : null;
      return {
        event: s,
        wire: {
          objuuid: s.objuuid,
          isDelete: Number(s.isDelete),
          data: JSON.stringify(r)
        }
      };
    });
  }
  async downloadCore() {
    const t = [];
    try {
      for (; ; ) {
        const e = this.currentIndex() + 1, s = this.isWait;
        this.isWait === 0 && (this.isWait = 1);
        const a = await this.transport.download(this.endpoint("DownloadDBObj"), {
          Code: this.code,
          DBName: this.databaseName,
          uuid: this.database.get("uuid") ?? "",
          beginId: e,
          isWait: s,
          take: this.transferLimit
        });
        if (a.status === -2)
          return await this.restoreFrom(a.maxId ?? 0);
        if (a.status !== 1) return a.status || -9;
        a.uuid && !this.database.get("uuid") && this.database.set("uuid", a.uuid);
        const r = a.data ?? [];
        if (r.length === 0) return t.length > 0 ? t : 1;
        if (Number(r[r.length - 1].id) < e) return -9;
        const i = this.database.get("localids", !0) ?? {}, c = [], n = [];
        for (const d of r) {
          const l = i[`s${d.id}`] === 1;
          l && delete i[`s${d.id}`];
          const h = Z(d.data, d.objuuid);
          !l && h && (n.push(h), c.push(d.isDelete === 1 ? 1 : 0)), n.push(M(d.id, d.objuuid, d.isDelete)), c.push(0), t.push({
            ...M(d.id, d.objuuid, d.isDelete),
            fromLocal: l,
            ...h ? { data: h } : {}
          });
        }
        for (const d of a.delIds ?? [])
          n.push({ uuid: String(d), table: "mainSync" }), c.push(1);
        await this.database.dbOpObjs(c, n), this.database.set("localids", i), this.database.set("index", Number(r[r.length - 1].id));
        const u = Number(r[r.length - 1].id);
        if (u >= Number(a.maxId ?? u)) return t;
      }
    } catch {
      return -9;
    }
  }
  async restoreCore() {
    return this.restoreFrom(this.restoreSeek());
  }
  async restoreFrom(t) {
    let e = t;
    this.database.set("restoreSeek", e);
    try {
      for (; ; ) {
        const s = await this.database.dbRead("mainSync", ["uuid", ">", e], 0, this.transferLimit);
        if (s.length === 0)
          return this.database.set("restoreSeek", -1), this.database.set("uploadUUIDForRestore", null), this.database.set("restoreUploadData", null), 1;
        const r = this.database.get("restoreUploadData", !0) ?? await this.makeRestoreSnapshot(s), i = this.database.get("uploadUUIDForRestore") || this.uuidFactory();
        this.database.set("uploadUUIDForRestore", i), this.database.set("restoreUploadData", r);
        const c = await this.transport.upload(this.endpoint("UploadDBObj"), {
          Code: this.code,
          DBName: this.databaseName,
          Data: JSON.stringify(r.map(({ wire: n }) => ({ ...n, id: Number(n.id) }))),
          uuid: this.database.get("uuid") ?? "",
          localUUID: this.getLocalUuid(),
          uploadUUID: i,
          restore: "1",
          localMaxId: e
        });
        if (c.status !== 1) return c.status || -9;
        c.uuid && !this.database.get("uuid") && this.database.set("uuid", c.uuid), e = Number(r[r.length - 1].event.uuid), this.database.set("restoreSeek", e), this.database.set("uploadUUIDForRestore", null), this.database.set("restoreUploadData", null);
      }
    } catch {
      return -9;
    }
  }
  async makeRestoreSnapshot(t) {
    const e = await this.database.dbReadObjs(t.map(({ objuuid: s }) => s));
    return t.map((s, a) => ({
      event: s,
      wire: {
        id: Number(s.uuid),
        objuuid: s.objuuid,
        isDelete: Number(s.isDelete),
        data: JSON.stringify(e[a] ? j(e[a]) : null)
      }
    }));
  }
  async syncCore() {
    if (this.restoreSeek() >= 0) {
      const e = await this.executeRestore();
      if (e !== 1) return e;
    }
    return await this.executeUpload() !== 1 ? -9 : this.executeDownload();
  }
  async restoreWithSource(t, e) {
    if (this.restoreBusy) return this.withCallback(Promise.resolve(-2), t);
    const s = this.runTrackedOperation("restore", e, () => this.executeRestore());
    return this.withCallback(s, t);
  }
  async uploadWithSource(t, e) {
    if (this.uploadBusy || this.restoreBusy) return this.withCallback(Promise.resolve(-3), t);
    const s = this.runTrackedOperation("upload", e, () => this.executeUpload());
    return this.withCallback(s, t);
  }
  async downloadWithSource(t, e) {
    if (this.downloadBusy || this.restoreBusy) return this.withCallback(Promise.resolve(-2), t);
    const s = this.runTrackedOperation("download", e, () => this.executeDownload());
    return this.withCallback(s, t);
  }
  async executeRestore() {
    if (this.restoreBusy) return -2;
    this.restoreBusy = !0;
    try {
      return await this.restoreCore();
    } finally {
      this.restoreBusy = !1;
    }
  }
  async executeUpload() {
    if (this.uploadBusy || this.restoreBusy) return -3;
    this.uploadBusy = !0;
    try {
      return await this.uploadCore();
    } finally {
      this.uploadBusy = !1;
    }
  }
  async executeDownload() {
    if (this.downloadBusy || this.restoreBusy) return -2;
    this.downloadBusy = !0;
    try {
      return await this.downloadCore();
    } finally {
      this.downloadBusy = !1;
    }
  }
  async runTrackedOperation(t, e, s) {
    const a = String(++this.syncOperationSequence);
    this.emitSyncEvent({ phase: "start", id: a, operation: t, source: e });
    try {
      const r = await s();
      return this.emitSyncEvent({ phase: "end", id: a, operation: t, source: e, result: r }), r;
    } catch (r) {
      throw this.emitSyncEvent({ phase: "end", id: a, operation: t, source: e, error: r }), r;
    }
  }
  emitSyncEvent(t) {
    for (const e of [...this.syncLifecycleListeners])
      try {
        e(t);
      } catch (s) {
        console.error("Sync lifecycle listener failed.", s);
      }
  }
  autoSocketTick(t, e) {
    const s = this.autoSocket;
    if (s?.readyState === 1) {
      if (Date.now() - this.lastSocketHeartbeat >= 3e5)
        try {
          s.send("1"), this.lastSocketHeartbeat = Date.now();
        } catch {
          s.close();
        }
    } else (this.lastSocketAttempt === 0 || Date.now() - this.lastSocketAttempt >= Math.max(e, 1) * 1e3) && this.openAutoSocket(t);
    if (this.autoRetrySeconds > 0) {
      this.autoRetrySeconds -= 1;
      return;
    }
    this.restoreSeek() >= 0 ? this.runAutoRestore() : this.hasNewData && this.runAutoUpload();
  }
  openAutoSocket(t) {
    this.lastSocketAttempt = Date.now();
    const e = this.autoSocket;
    e && e.readyState < 2 && e.close();
    let s;
    try {
      s = new WebSocket(X(this.serviceUrl));
    } catch (a) {
      console.error("WebSocket connection failed.", a);
      return;
    }
    this.autoSocket = s, s.onopen = () => {
      if (this.autoSocket === s) {
        this.lastSocketHeartbeat = Date.now();
        try {
          s.send(JSON.stringify({ DBName: this.databaseName, Code: this.code }));
        } catch {
          s.close();
          return;
        }
        this.downloadWithSource(t, "auto");
      }
    }, s.onmessage = (a) => {
      this.autoSocket === s && a.data === "1" && this.downloadWithSource(t, "auto");
    }, s.onclose = () => {
      this.autoSocket === s && (this.autoSocket = null);
    }, s.onerror = (a) => {
      console.error("WebSocket connection error.", a);
    };
  }
  autoPollingTick(t) {
    if (this.autoRetrySeconds > 0) {
      this.autoRetrySeconds -= 1;
      return;
    }
    if (this.restoreSeek() >= 0) {
      this.autoRestoreBusy || this.runAutoRestore();
      return;
    }
    this.hasNewData && !this.autoUploadBusy && this.runAutoUpload(), !this.autoDownloadBusy && (this.autoDownloadBusy = !0, this.downloadWithSource(t, "auto").then((e) => {
      e === -9 && (this.autoRetrySeconds = 30);
    }).finally(() => {
      this.autoDownloadBusy = !1;
    }));
  }
  async runAutoRestore() {
    if (!this.autoRestoreBusy) {
      this.autoRestoreBusy = !0;
      try {
        await this.restoreWithSource(void 0, "auto") === -9 && (this.autoRetrySeconds = 30);
      } finally {
        this.autoRestoreBusy = !1;
      }
    }
  }
  async runAutoUpload() {
    if (!this.autoUploadBusy) {
      this.autoUploadBusy = !0;
      try {
        await this.uploadWithSource(void 0, "auto") === -9 && (this.autoRetrySeconds = 30);
      } finally {
        this.autoUploadBusy = !1;
      }
    }
  }
  async readMainIndexCore(t, e, s) {
    const a = await this.database.dbRead("mainSync", ["uuid", ">=", t], e, s), r = a.filter((n) => !n.isDelete), i = await this.database.dbReadObjs(r.map(({ objuuid: n }) => n));
    let c = 0;
    return a.map((n) => {
      if (n.isDelete) return n;
      const u = i[c++];
      return u ? { ...n, data: u } : n;
    });
  }
  currentIndex() {
    return Number(this.database.get("index") ?? 0) || 0;
  }
  restoreSeek() {
    const t = Number(this.database.get("restoreSeek") ?? -1);
    return Number.isFinite(t) ? t : -1;
  }
  getLocalUuid() {
    let t = this.database.get("localUUID");
    return t || (t = this.uuidFactory(), this.database.set("localUUID", t)), t;
  }
  clearUploadCheckpoint() {
    this.database.set("uploadUUID", null), this.database.set("tempUploadData", null);
  }
  endpoint(t) {
    return `${this.serviceUrl}${t}`;
  }
  withCallback(t, e) {
    return e && t.then((s) => e(s), () => e(-1)), t;
  }
}
function Q() {
  g.mainSync = ["isDelete", "objuuid"], y.mainSync = "uuid", x.mainSync = "int", S.mainSync = {
    viewModelToEntity: (o) => `${Number(o.isDelete)},${String(o.objuuid)}`,
    entityToViewModel: (o) => {
      const [t, e] = String(o).split(",");
      return { isDelete: Number.parseInt(t ?? "0", 10), objuuid: e ?? "" };
    }
  }, g["mainSync.Temp"] = ["isDelete", "objuuid"], y["mainSync.Temp"] = "uuid", S["mainSync.Temp"] = S.mainSync;
}
function E(o) {
  return o && !o.endsWith("/") ? `${o}/` : o;
}
function X(o) {
  const t = new URL("ws", o);
  return t.protocol = t.protocol === "https:" ? "wss:" : "ws:", t.toString();
}
function Y() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function j(o) {
  const t = { ...o };
  return delete t.uuid, t;
}
function Z(o, t) {
  if (!o || o === "null") return null;
  const e = typeof o == "string" ? JSON.parse(o) : o;
  return !e || typeof e != "object" || typeof e.table != "string" ? null : { ...e, uuid: t };
}
function M(o, t, e) {
  return {
    uuid: String(o),
    table: "mainSync",
    isDelete: Number(e),
    objuuid: t
  };
}
export {
  k as DbBase,
  T as DbCore,
  A as DbSync,
  L as DbTable,
  H as FetchSyncTransport,
  w as IndexedDbBackend,
  T as MyDB,
  A as MySyncDB,
  _ as _dbObj,
  g as dbModelColumn,
  W as dbModelEvent,
  y as dbModelIndex,
  x as dbModelIndexType,
  S as dbModelTransformation,
  F as dbObj
};

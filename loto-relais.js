// Relais du Grand Loto : relie les téléphones par un relais MQTT public, sans compte.
// Il imite la petite partie de la base claude.ai dont le loto se sert :
// doc(chemin).get/set/update/onSnapshot et collection(chemin).doc(id)/onSnapshot.
// Chaque document est un message « retenu » par le relais sur le sujet PREFIX + chemin.
(function () {
  const PREFIX = 'meli-meninges/loto-v1/';
  const BROKERS = (window.LOTO_BROKERS || [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt'
  ]);
  const SETTLE = 900; // temps laissé au relais pour renvoyer un document retenu

  function uid() {
    try {
      let id = localStorage.getItem('loto-relais-id');
      if (!id) { id = 'j' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('loto-relais-id', id); }
      return id;
    } catch (e) { return 'j' + Math.random().toString(36).slice(2, 12); }
  }

  function tryBroker(url) {
    return new Promise((resolve, reject) => {
      const c = mqtt.connect(url, { clientId: 'mm' + Math.random().toString(36).slice(2, 12), keepalive: 30, reconnectPeriod: 2000, connectTimeout: 6000, clean: true });
      const t = setTimeout(() => { c.end(true); reject(new Error('délai')); }, 7000);
      c.once('connect', () => { clearTimeout(t); resolve(c); });
      c.once('error', e => { clearTimeout(t); c.end(true); reject(e); });
    });
  }

  async function connect() {
    if (!window.mqtt) throw new Error('mqtt absent');
    let client = null;
    for (const url of BROKERS) { try { client = await tryBroker(url); break; } catch (e) {} }
    if (!client) throw new Error('aucun relais');

    const cache = new Map();          // sujet -> données (objet)
    const subs = new Map();           // sujet ou filtre -> {ready: Promise, listeners: Set}
    const topic = p => PREFIX + p;

    function matches(filter, t) {
      if (!filter.endsWith('/+')) return filter === t;
      const base = filter.slice(0, -1);
      return t.startsWith(base) && !t.slice(base.length).includes('/');
    }
    client.on('message', (t, buf) => {
      const txt = buf.toString();
      if (!txt) cache.delete(t); else { try { cache.set(t, JSON.parse(txt)); } catch (e) { return; } }
      subs.forEach((s, f) => { if (matches(f, t)) s.listeners.forEach(fn => fn()); });
    });

    function ensure(filter) {
      let s = subs.get(filter);
      if (s) return s;
      s = { listeners: new Set() };
      s.ready = new Promise(res => {
        client.subscribe(filter, { qos: 1 }, () => setTimeout(res, SETTLE));
      });
      subs.set(filter, s);
      return s;
    }
    const snap = (t, id) => { const d = cache.get(t); return { id, exists: d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))) }; };
    function publish(t, obj) {
      cache.set(t, obj);
      subs.forEach((s, f) => { if (matches(f, t)) s.listeners.forEach(fn => fn()); });
      return new Promise((res, rej) => client.publish(t, JSON.stringify(obj), { qos: 1, retain: true }, e => (e ? rej(e) : res())));
    }

    function doc(path) {
      const t = topic(path), id = path.split('/').pop();
      return {
        id,
        async get() { await ensure(t).ready; return snap(t, id); },
        async set(obj) { ensure(t); return publish(t, { ...obj }); },
        async update(obj) { const s = ensure(t); await s.ready; return publish(t, { ...(cache.get(t) || {}), ...obj }); },
        onSnapshot(cb, err) {
          const s = ensure(t); let live = true;
          const fn = () => { if (live) { try { cb(snap(t, id)); } catch (e) { if (err) err(e); } } };
          s.ready.then(() => { if (live) { s.listeners.add(fn); fn(); } });
          return () => { live = false; s.listeners.delete(fn); };
        }
      };
    }
    function collection(path) {
      const f = topic(path) + '/+';
      return {
        doc: id => doc(path + '/' + id),
        onSnapshot(cb, err) {
          const s = ensure(f); let live = true;
          const fn = () => {
            if (!live) return;
            const docs = [];
            cache.forEach((d, t) => { if (matches(f, t)) docs.push(snap(t, t.slice(f.length - 1))); });
            try { cb({ docs }); } catch (e) { if (err) err(e); }
          };
          s.ready.then(() => { if (live) { s.listeners.add(fn); fn(); } });
          return () => { live = false; s.listeners.delete(fn); };
        }
      };
    }
    return { db: { doc, collection }, uid: uid() };
  }
  window.LotoRelais = { connect };
})();

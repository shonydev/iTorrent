 <script lang="ts">
  import { onMount, tick } from 'svelte';
  import WebTorrent from 'webtorrent';

  type TorrentFile = {
    name: string; path: string; length: number; progress: number;
    streamTo: (element: HTMLMediaElement) => HTMLMediaElement;
  };
  type TorrentItem = {
    infoHash: string; name: string; progress: number; downloadSpeed: number;
    uploadSpeed: number; numPeers: number; downloaded: number; length: number;
    files: TorrentFile[]; magnetURI: string;
    destroy: (options?: object, callback?: (error?: Error) => void) => void;
    on: (event: string, callback: (...args: any[]) => void) => void;
  };

  let client: any = null;
  let serverReady = $state(false);
  let supported = $state(true);
  let busy = $state(false);
  let magnet = $state('');
  let torrents = $state<TorrentItem[]>([]);
  let selected = $state<{ torrent: TorrentItem; file: TorrentFile } | null>(null);
  let videoElement: HTMLVideoElement;
  let error = $state('');
  let notice = $state('Preparando el cliente P2P…');

  const videoPattern = /\.(mp4|m4v|mov|webm|mkv|ogv)$/i;
  const savedKey = 'itorrent.magnets.v1';
  const formatBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };
  const formatSpeed = (value: number) => `${formatBytes(value)}/s`;
  const percent = (value: number) => Math.min(100, Math.max(0, value * 100));

  function savedMagnets(): string[] {
    try {
      const value = JSON.parse(localStorage.getItem(savedKey) || '[]');
      return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
    } catch { return []; }
  }
  function persistMagnets() {
    localStorage.setItem(savedKey, JSON.stringify(torrents.map((torrent) => torrent.magnetURI)));
  }
  function refresh() {
    if (client) torrents = [...client.torrents] as TorrentItem[];
  }
  function attachTorrent(torrent: TorrentItem) {
    torrent.on('download', refresh);
    torrent.on('upload', refresh);
    torrent.on('done', refresh);
    torrent.on('wire', refresh);
    torrent.on('error', (cause: Error) => { error = cause.message; refresh(); persistMagnets(); });
    torrent.on('warning', (cause: Error) => { notice = cause.message; });
    refresh();
    persistMagnets();
  }

  async function addTorrent(value = magnet) {
    const uri = value.trim();
    if (!uri || !client) return;
    if (!uri.startsWith('magnet:?') && !/^https?:\/\//i.test(uri)) {
      error = 'Pegá un magnet link válido o la URL de un archivo .torrent.';
      return;
    }
    if (client.torrents.some((torrent: any) => torrent.magnetURI === uri)) {
      error = 'Ese torrent ya está en la lista.';
      return;
    }
    error = '';
    busy = true;
    try {
      client.add(uri, (torrent: TorrentItem) => attachTorrent(torrent));
      magnet = '';
      notice = 'Buscando peers compatibles con WebRTC…';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'No se pudo agregar el torrent.';
    } finally { busy = false; }
  }

  function removeTorrent(torrent: TorrentItem) {
    if (!confirm(`¿Querés quitar “${torrent.name}” de esta sesión?`)) return;
    if (selected?.torrent.infoHash === torrent.infoHash) closePlayer();
    torrent.destroy({}, () => { refresh(); persistMagnets(); });
  }

  async function playFile(torrent: TorrentItem, file: TorrentFile) {
    if (!serverReady) { error = 'El reproductor todavía se está inicializando.'; return; }
    selected = { torrent, file };
    await tick();
    if (!videoElement) return;
    file.streamTo(videoElement);
    videoElement.play().catch(() => { notice = 'Tocá reproducir para iniciar el video.'; });
  }

  function closePlayer() {
    if (videoElement) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
    }
    selected = null;
  }

  onMount(() => {
    let interval: number | undefined;
    let alive = true;

    async function start() {
      if (!WebTorrent.WEBRTC_SUPPORT) {
        supported = false;
        notice = 'Este navegador no ofrece soporte WebRTC para torrents.';
        return;
      }
      try {
        const base = import.meta.env.BASE_URL;
        const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
        await navigator.serviceWorker.ready;

        if (!navigator.serviceWorker.controller) {
          await new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
            window.setTimeout(resolve, 2500);
          });
        }
        if (!alive) return;
        if (!navigator.serviceWorker.controller) {
          throw new Error('El navegador no activó el Service Worker. Recargá la página para habilitar el streaming.');
        }

        client = new WebTorrent();
        client.on('error', (cause: Error) => { error = cause.message; });
        client.createServer({ controller: registration });
        serverReady = true;
        notice = 'Cliente listo. Agregá un magnet para empezar.';

        savedMagnets().forEach((uri) => {
          try { client.add(uri, (torrent: TorrentItem) => attachTorrent(torrent)); }
          catch (cause) { error = cause instanceof Error ? cause.message : 'No se pudo restaurar un torrent.'; }
        });
        refresh();
        interval = window.setInterval(refresh, 1000);
      } catch (cause) {
        error = cause instanceof Error ? cause.message : 'No se pudo iniciar WebTorrent.';
        notice = 'No se pudo iniciar el motor P2P.';
      }
    }

    start();
    return () => {
      alive = false;
      if (interval) window.clearInterval(interval);
      if (client) client.destroy();
    };
  });
</script>

<svelte:head>
  <meta name="description" content="Cliente BitTorrent P2P que funciona directamente en tu navegador." />
</svelte:head>

<main class="shell">
  <header class="topbar">
    <a class="brand" href="./" aria-label="iTorrent inicio">
      <span class="brand-mark">i</span><span>iTorrent</span>
    </a>
    <span class:online={serverReady} class="status"><i></i>{serverReady ? 'P2P listo' : 'Iniciando'}</span>
  </header>

  <section class="intro">
    <p class="eyebrow">PEER TO PEER · SIN SERVIDOR PROPIO</p>
    <h1>Tus torrents,<br /><span>directo en el navegador.</span></h1>
    <p class="subtitle">Agregá un magnet, conectate con peers WebRTC y reproducí tus archivos desde la PWA.</p>
  </section>

  <section class="add-panel">
    <form onsubmit={(event) => { event.preventDefault(); addTorrent(); }}>
      <label for="magnet">ENLACE MAGNET O URL .TORRENT</label>
      <div class="input-row">
        <input id="magnet" bind:value={magnet} placeholder="magnet:?xt=urn:btih:…" autocomplete="off" autocapitalize="off" spellcheck="false" />
        <button type="submit" disabled={!serverReady || busy || !magnet.trim()}>{busy ? 'Agregando…' : 'Agregar torrent'}</button>
      </div>
    </form>
    <p class="hint"><span>↳</span> Solo conecta con clientes que soporten WebTorrent / WebRTC.</p>
  </section>

  {#if !supported}
    <div class="message warning">Tu navegador no tiene soporte WebRTC para esta función. Probá con una versión actualizada de Safari, Chrome o Firefox.</div>
  {/if}
  {#if error}<div class="message error">{error}</div>{/if}

  <section class="library">
    <div class="section-heading">
      <div><p class="eyebrow">BIBLIOTECA</p><h2>Tus descargas <span>{torrents.length}</span></h2></div>
      <p class="library-status">{notice}</p>
    </div>
    {#if torrents.length === 0}
      <div class="empty">
        <div class="empty-icon">⇩</div><h3>Tu biblioteca está vacía</h3>
        <p>Cuando agregues un magnet, el torrent va a aparecer acá.</p>
      </div>
    {:else}
      <div class="torrent-list">
        {#each torrents as torrent (torrent.infoHash)}
          <article class="torrent-card">
            <div class="torrent-title">
              <div class="torrent-icon">◈</div>
              <div class="torrent-name"><h3>{torrent.name || 'Obteniendo metadatos…'}</h3><p>{torrent.infoHash}</p></div>
              <button class="icon-button" aria-label="Quitar torrent" onclick={() => removeTorrent(torrent)}>×</button>
            </div>
            <div class="progress-meta"><strong>{percent(torrent.progress).toFixed(1)}%</strong><span>{formatBytes(torrent.downloaded)} / {formatBytes(torrent.length)}</span></div>
            <div class="progress-track"><div class="progress-fill" style:width="{percent(torrent.progress)}%"></div></div>
            <div class="stats">
              <span><b>↓</b> {formatSpeed(torrent.downloadSpeed)}</span>
              <span><b>↑</b> {formatSpeed(torrent.uploadSpeed)}</span>
              <span><b>◇</b> {torrent.numPeers} peers</span>
              {#if torrent.progress === 1}<span class="complete">Completado</span>{/if}
            </div>
            {#if torrent.files.filter((file) => videoPattern.test(file.name)).length > 0}
              <div class="files">
                {#each torrent.files.filter((file) => videoPattern.test(file.name)) as file}
                  <button class="file-button" onclick={() => playFile(torrent, file)}>
                    <span class="play-icon">▶</span><span class="file-name">{file.name}</span><span class="file-size">{formatBytes(file.length)}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <footer>
    <p>iTorrent funciona en tu navegador. La pestaña debe permanecer activa para mantener la descarga.</p>
    <p>Usalo únicamente con contenido que tengas derecho a descargar.</p>
  </footer>
</main>

{#if selected}
  <div class="player-overlay">
    <div class="player-header">
      <div><p>REPRODUCIENDO</p><h2>{selected.file.name}</h2></div>
      <button class="close-player" onclick={closePlayer}>Cerrar <span>×</span></button>
    </div>
    <video bind:this={videoElement} controls playsinline autoplay></video>
  </div>
{/if}

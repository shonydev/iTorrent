<script lang="ts">
  type F = { index: number; name: string; length: number };
  type T = { infoHash: string; name: string; progress: number; speed: number; peers: number; files: F[] };

  let token = $state(localStorage.getItem('t') ?? '');
  let tokenInput = $state('');
  let magnet = $state('');
  let torrents = $state<T[]>([]);
  let playing = $state<{ hash: string; file: F } | null>(null);
  let error = $state('');

  const isVideo = (n: string) => /\.(mp4|m4v|mov|webm|mkv|avi)$/i.test(n);
  const iosOk = (n: string) => /\.(mp4|m4v|mov)$/i.test(n);
  const mb = (n: number) => (n / 1048576).toFixed(n > 1e9 ? 0 : 1) + ' MB';

  async function api(path: string, init: RequestInit = {}) {
    const r = await fetch(path, { ...init, headers: { 'x-token': token, 'content-type': 'application/json' } });
    if (r.status === 401) { token = ''; localStorage.removeItem('t'); throw new Error('Token inválido'); }
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function refresh() {
    try { torrents = await api('/api/torrents'); error = ''; }
    catch (e) { error = (e as Error).message; }
  }

  $effect(() => {
    if (!token) return;
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  });

  function login() { token = tokenInput.trim(); localStorage.setItem('t', token); }

  async function add() {
    const m = magnet.trim();
    if (!m) return;
    try { await api('/api/torrents', { method: 'POST', body: JSON.stringify({ magnet: m }) }); magnet = ''; refresh(); }
    catch (e) { error = (e as Error).message; }
  }

  async function remove(hash: string) {
    if (!confirm('¿Borrar torrent y archivos?')) return;
    await api(`/api/torrents/${hash}`, { method: 'DELETE' });
    refresh();
  }
</script>

<main>
  {#if !token}
    <h1>Torrent Stream</h1>
    <form onsubmit={(e) => { e.preventDefault(); login(); }}>
      <input type="password" placeholder="Token del servidor" bind:value={tokenInput} />
      <button>Entrar</button>
    </form>
    {#if error}<p class="err">{error}</p>{/if}
  {:else}
    <h1>Torrent Stream</h1>
    <form onsubmit={(e) => { e.preventDefault(); add(); }}>
      <input placeholder="Pegá un magnet link" bind:value={magnet} autocapitalize="off" autocorrect="off" />
      <button>Agregar</button>
    </form>
    {#if error}<p class="err">{error}</p>{/if}

    {#each torrents as t (t.infoHash)}
      <div class="card">
        <div class="row">
          <span class="name">{t.name}</span>
          <button class="ghost" onclick={() => remove(t.infoHash)}>✕</button>
        </div>
        <progress value={t.progress} max="1"></progress>
        <div class="mut">{(t.progress * 100).toFixed(1)}% · {mb(t.speed)}/s · {t.peers} peers</div>
        {#each t.files.filter((f) => isVideo(f.name)) as f (f.index)}
          <button class="file" onclick={() => (playing = { hash: t.infoHash, file: f })}>
            ▶ {f.name} <span class="mut">({mb(f.length)}){iosOk(f.name) ? '' : ' · ⚠ puede no reproducirse en iPhone'}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="mut">Todavía no hay torrents.</p>
    {/each}
  {/if}
</main>

{#if playing}
  <div class="player">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video controls autoplay playsinline src={`/stream/${playing.hash}/${playing.file.index}?t=${encodeURIComponent(token)}`}></video>
    <button onclick={() => (playing = null)}>Cerrar</button>
  </div>
{/if}

'use client';

import CardPreview from './card-preview';
import { departmentChances, rebalanceDepartment } from '@/lib/eligibility';
import { DesktopIcon, PlusIcon, ResetIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EffectId, EffectMode, EffectPlanEntry, ListMode, Settings, Person, State } from '@/lib/types';
import { LIST_LABEL, LIST_MODES, EFFECT_LABEL, SINGLE_DRAW_CHOICES, TIERS, isWinnerCount, plannedEffect, plannedWinnerCount } from '@/lib/types';
import { guessNameColumn, guessEnglishNameColumn, guessDepartmentColumn, parseFile, type Table } from '@/lib/parse';

type Tab = 'people' | 'prizes' | 'results' | 'show';

async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  // GETs revalidate via ETag (304 when unchanged); writes always go to the server.
  const r = await fetch(url, { method, cache: method === 'GET' ? 'no-cache' : 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  // Session ended (signed out elsewhere or refresh token expired): back to the login page.
  if (r.status === 401) { window.location.href = '/login?next=/admin'; throw new Error('Phiên đăng nhập đã hết hạn.'); }
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Lỗi máy chủ');
  return j as T;
}

function SignedInUser() {
  const [email, setEmail] = useState('');
  useEffect(() => { fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()).then((d) => setEmail(d.user?.email || '')).catch(() => {}); }, []);
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }
  return (
    <div className="admin-user">
      {email && <span className="muted">{email}</span>}
      <button className="btn small ghost" onClick={logout}>Đăng xuất</button>
    </div>
  );
}

/** Two buttons: the rehearsal list and the uploaded real list. Each keeps its own results. */
function ListSwitch({ state, onChange, say }: { state: State; onChange: (s: State) => void; say: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function pick(mode: ListMode) {
    if (mode === state.mode || busy) return;
    const target = state.lists[mode];
    if (!window.confirm(`Chuyển sang ${LIST_LABEL[mode].toLowerCase()} (${target.people.toLocaleString('vi-VN')} người, ${target.winners} đã trúng)?
Màn chiếu sẽ quay theo danh sách này từ lượt tiếp theo.`)) return;
    setBusy(true);
    try {
      onChange(await api<State>('/api/state', 'PUT', { mode }));
      say(`Đang dùng ${LIST_LABEL[mode].toLowerCase()}.`);
    } catch (e) { say((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="list-switch" role="group" aria-label="Chọn danh sách">
      {LIST_MODES.map((mode) => (
        <button key={mode} className={`list-switch-btn ${mode}${state.mode === mode ? ' active' : ''}`} aria-pressed={state.mode === mode} disabled={busy} onClick={() => pick(mode)}>
          <b>{LIST_LABEL[mode]}</b>
          <small>{state.lists[mode].people.toLocaleString('vi-VN')} người · {state.lists[mode].winners} đã trúng</small>
        </button>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>('people');
  const [msg, setMsg] = useState('');
  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 3500); };

  const reload = useCallback(async () => {
    try {
      const next = await api<State>('/api/state');
      setState((previous) => previous?.version === next.version && previous.drawCount === next.drawCount ? previous : next);
    } catch { /* Retain the last loaded state during temporary connection failures. */ }
  }, []);
  useEffect(() => {
    reload();
    const id = window.setInterval(() => { if (!document.hidden) reload(); }, 4000);
    const onVisible = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [reload]);

  if (!state) return <main className="admin"><p className="muted">Đang tải…</p></main>;

  return (
    <main className="admin">
      <header className="admin-head">
        <div>
          <h1>Quản trị quay số</h1>
          <p className="muted">{LIST_LABEL[state.mode]}: {state.people.length.toLocaleString('vi-VN')} người · {state.winners.length} đã trúng</p>
        </div>
        <ListSwitch state={state} onChange={setState} say={say} />
        <div className="admin-user">
          <SignedInUser />
          <a className="btn projector-link" href="/lottery" target="_blank" rel="noreferrer" aria-label="Mở màn chiếu" title="Mở màn chiếu"><DesktopIcon width={24} height={24} aria-hidden="true" /></a>
        </div>
      </header>
      <nav className="admin-tabs">
        {([['people', 'Danh sách người chơi'], ['prizes', 'Nội dung thẻ'], ['results', 'Kết quả'], ['show', 'Màn chiếu & cài đặt']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
      {tab === 'people' && <PeopleTab state={state} onSaved={(s) => { setState(s); say('Đã lưu danh sách.'); }} say={say} />}
      {tab === 'prizes' && <PrizesTab state={state} onSaved={(s) => { setState(s); say('Đã lưu nội dung thẻ.'); }} />}
      {tab === 'results' && <ResultsTab state={state} onChange={setState} />}
      {tab === 'show' && <ShowTab state={state} onChange={setState} say={say} />}
      {msg && <div className="toast">{msg}</div>}
    </main>
  );
}

/* ---------------- People ---------------- */
function PeopleTab({ state, onSaved, say }: { state: State; onSaved: (s: State) => void; say: (m: string) => void }) {
  const [table, setTable] = useState<Table | null>(null);
  const [file, setFile] = useState('');
  const [nameCol, setNameCol] = useState(0);
  const [englishNameCol, setEnglishNameCol] = useState(-1);
  const [departmentCol, setDepartmentCol] = useState(-1);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const t = await parseFile(f);
      if (!t.rows.length) { say('File không có dữ liệu.'); return; }
      const nc = guessNameColumn(t);
      setTable(t);
      setFile(f.name);
      setNameCol(nc);
      setEnglishNameCol(guessEnglishNameColumn(t));
      setDepartmentCol(guessDepartmentColumn(t));
    } catch (e) {
      say((e as Error).message);
    }
  };

  const people: Person[] = useMemo(() => {
    if (!table) return [];
    const seen = new Map<string, number>();
    return table.rows
      .filter((r) => r[nameCol]?.trim())
      .map((r) => {
        const name = r[nameCol].trim().replace(/\s+/g, ' ');
        const englishName = r[englishNameCol]?.trim().replace(/\s+/g, ' ') || '';
        const department = r[departmentCol]?.trim() || '';
        const key = `${name}|${englishName}|${department}`;
        const n = (seen.get(key) || 0) + 1;
        seen.set(key, n);
        return { id: `${key}#${n}`, name, englishName, department };
      });
  }, [table, nameCol, englishNameCol, departmentCol]);

  const save = async () => {
    setBusy(true);
    try {
      onSaved(await api<State>('/api/state', 'PUT', { people, sourceFile: file }));
      setTable(null);
    } catch (e) { say((e as Error).message); }
    setBusy(false);
  };

  const list = state.people.filter((p) => !q || `${p.name} ${p.englishName} ${p.department}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <section className="panel">
      <div className="upload">
        <label className="drop">
          <input type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => onFile(e.target.files?.[0])} />
          <b>Chọn file cho {LIST_LABEL[state.mode].toLowerCase()} (.xlsx hoặc .csv)</b>
          <span>STT · Họ và Tên · English Name · Phòng Ban. English Name hiển thị trên video; phòng ban là văn bản.</span>
        </label>
      </div>

      {table && (
        <div className="preview">
          <div className="row wrap">
            <label className="field inline"><span>Cột họ tên</span>
              <select value={nameCol} onChange={(e) => setNameCol(Number(e.target.value))}>
                {table.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
              </select>
            </label>
            {([['English Name', englishNameCol, setEnglishNameCol], ['Phòng Ban', departmentCol, setDepartmentCol]] as const).map(([label, value, setValue]) => (
              <label className="field inline" key={label}><span>{label}</span>
                <select value={value} onChange={(e) => setValue(Number(e.target.value))}>
                  <option value={-1}>Chọn cột</option>
                  {table.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          {people.some((p) => !p.englishName) && <p className="warn">Vui lòng điền English Name cho mọi người trước khi lưu.</p>}
          <table className="grid">
            <thead><tr><th>STT</th><th>Họ và Tên</th><th>English Name</th><th>Phòng Ban</th></tr></thead>
            <tbody>
              {people.slice(0, 12).map((p, i) => <tr key={p.id}><td>{i + 1}</td><td><b>{p.name}</b></td><td>{p.englishName || '—'}</td><td className="muted">{p.department}</td></tr>)}
            </tbody>
          </table>
          <div className="row">
            <button className="btn gold" disabled={busy || !people.length || englishNameCol < 0 || departmentCol < 0 || new Set([nameCol, englishNameCol, departmentCol]).size !== 3 || people.some((p) => !p.englishName)} onClick={save}>Lưu {people.length.toLocaleString('vi-VN')} người từ “{file}”</button>
            <button className="btn ghost" onClick={() => setTable(null)}>Huỷ</button>
            {state.winners.length > 0 && <span className="warn">Lưu danh sách mới sẽ giữ kết quả đã quay, nhưng người vắng mặt được đặt lại.</span>}
          </div>
        </div>
      )}

      <div className="row between">
        <h2>{LIST_LABEL[state.mode]} <small className="muted">{state.people.length.toLocaleString('vi-VN')} người</small></h2>
        <input className="search" placeholder="Tìm tên…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {state.people.length === 0 ? (
        <p className="empty">Chưa có người tham gia. Hãy tải file XLSX/CSV ở trên.</p>
      ) : (
        <table className="grid">
          <thead><tr><th>STT</th><th>Họ và Tên</th><th>English Name</th><th>Phòng Ban</th></tr></thead>
          <tbody>
            {list.slice(0, 300).map((p, i) => {
              return (
                <tr key={p.id}>
                  <td>{i + 1}</td><td>{p.name}</td><td>{p.englishName || '—'}</td><td className="muted">{p.department}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {list.length > 300 && <p className="muted">… và {list.length - 300} người nữa (dùng ô tìm kiếm).</p>}
    </section>
  );
}

/* ---------------- Prizes ---------------- */
function PrizesTab({ state, onSaved }: { state: State; onSaved: (s: State) => void }) {
  const [description, setDescription] = useState(state.settings.rewardDescription || '');
  return <section className="panel">
    <label className="field prize-details"><span>Mô tả phần thưởng (không bắt buộc)</span>
      <textarea aria-label="Mô tả phần thưởng" rows={2} maxLength={240} value={description} onChange={(e) => setDescription(e.target.value)} />
      <small className="muted">Chỉ áp dụng cho lượt có đúng 1 người trúng.</small>
    </label>
    <button className="btn gold" onClick={async () => onSaved(await api<State>('/api/state', 'PUT', { settings: { rewardDescription: description } }))}>Lưu nội dung thẻ</button>
    <div className="prize-card-previews">
      {TIERS.map((tier) => <CardPreview key={tier} name="Thẻ người trúng" tier={tier} description={description} />)}
    </div>
  </section>;
}

/* ---------------- Results ---------------- */
function ResultsTab({ state, onChange }: { state: State; onChange: (s: State) => void }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportBoth = async () => {
    setExporting(true);
    setExportError('');
    try {
      const files = await Promise.all(['csv', 'xlsx'].map(async (format) => {
        const response = await fetch(`/api/export?format=${format}`);
        if (!response.ok) throw new Error('Export failed');
        return { format, blob: await response.blob() };
      }));
      for (const { format, blob } of files) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `danh-sach-trung-giai${state.mode === 'test' ? '-thu' : ''}.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch {
      setExportError('Không thể xuất file. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };
  const act = async (body: unknown, message: string) => {
    if (!window.confirm(message)) return;
    onChange(await api<State>('/api/action', 'POST', body));
  };
  return <section className="panel">
    <div className="row">
      <button className="btn gold" disabled={exporting} onClick={exportBoth}>{exporting ? 'Đang xuất…' : 'Xuất cả CSV và XLSX'}</button>
      <a className="btn ghost" href="/api/export?format=csv">Tải CSV</a>
      <a className="btn ghost" href="/api/export?format=xlsx">Tải XLSX</a>
      <button className="btn danger" onClick={() => act({ type: 'resetWinners' }, 'Xoá toàn bộ kết quả?')}>Xoá toàn bộ kết quả</button>
    </div>
    {exportError && <p role="alert">{exportError}</p>}
    {state.winners.length === 0 ? <p className="empty">Chưa có người trúng.</p> : <table className="grid">
      <thead><tr><th>STT</th><th>Họ và Tên</th><th>English Name</th><th>Phòng Ban</th><th>Phần thưởng</th><th>Thời gian</th><th></th></tr></thead>
      <tbody>{state.winners.map((w, i) => <tr key={w.drawId}>
        <td>{i + 1}</td><td>{w.name}</td><td>{w.englishName}</td><td>{w.department}</td><td>{w.prizeDescription}</td>
        <td>{new Date(w.time).toLocaleTimeString('vi-VN')}</td>
        <td className="actions"><button className="btn ghost small" onClick={() => act({ type: 'absent', drawId: w.drawId }, w.name + ' vắng mặt?')}>Vắng mặt</button>
        <button className="btn danger small" onClick={() => act({ type: 'deleteWinner', drawId: w.drawId }, 'Xoá kết quả của ' + w.name + '?')}>Xoá</button></td>
      </tr>)}</tbody>
    </table>}
  </section>;
}

/* ---------------- Show control & settings ---------------- */
function ShowTab({ state, onChange, say }: { state: State; onChange: (s: State) => void; say: (m: string) => void }) {
  const [settings, setSettings] = useState(state.settings);
  const chances = departmentChances({ ...state, settings });
  return (
    <section className="panel">
      <div>
        <h2>Cài đặt</h2>
        <fieldset className="department-settings">
          <legend>Tỷ lệ trúng theo đội/phòng ban</legend>
          <p className="muted small">Bảng hiển thị tỷ lệ cho lần chọn kế tiếp. Nếu một lượt có nhiều người trúng, hệ thống tính lại tỷ lệ sau mỗi người được chọn.</p>
          <table className="grid"><thead><tr><th>Đội/phòng ban</th><th>Đã trúng</th><th>Còn hợp lệ</th><th>Tỷ lệ trúng</th><th>Trạng thái</th></tr></thead>
            <tbody>{chances.map((g) => <tr key={g.name}><td>{g.name}</td>
              <td>{g.wonCount}</td><td>{g.eligible}</td>
              <td><div className="department-percent"><input type="text" inputMode="decimal" aria-label={g.name + ' (%)'} key={`${g.key}:${g.percent}`} defaultValue={g.percent.toFixed(2).replace('.', ',')} disabled={!g.eligible || chances.filter((x) => x.eligible > 0).length === 1} onBlur={(e) => {
                const displayed = g.percent.toFixed(2).replace('.', ',');
                const text = e.target.value.trim().replace('.', ',');
                if (text === displayed) { e.target.value = displayed; return; }
                const value = Number(text.replace(',', '.'));
                if (/^\d{1,3}(,\d{1,2})?$/.test(text) && value >= 0 && value <= 100) {
                  e.target.value = value.toFixed(2).replace('.', ',');
                  setSettings({ ...settings, departmentWeights: rebalanceDepartment(chances, g.key, value) });
                } else e.target.value = displayed;
              }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /><span>%</span></div></td>
              <td className={!g.eligible ? 'warn' : 'muted'}>{g.eligible ? (g.wonCount > 0 ? `Đang tham gia · đã trúng ${g.wonCount} người` : 'Đang tham gia') : 'Không còn người hợp lệ'}</td></tr>)}</tbody>
          </table>
          <button className="btn ghost small" onClick={() => setSettings({ ...settings, departmentWeights: {} })}>Cân bằng giữa các đội</button>
        </fieldset>
        <label className="field"><span>Tiêu đề</span><input value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} /></label>
        <label className="field"><span>Dòng phụ</span><input value={settings.subtitle} onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })} /></label>
        <label className="field"><span>Hiệu ứng mặc định (dùng cho lượt không chọn riêng)</span>
          <select value={settings.effect} onChange={(e) => setSettings({ ...settings, effect: e.target.value as EffectMode })}>
            {(Object.keys(EFFECT_LABEL) as EffectMode[]).map((k) => <option key={k} value={k}>{EFFECT_LABEL[k]}</option>)}
          </select>
        </label>
        <DrawPlanEditor state={state} settings={settings} setSettings={setSettings} onChange={onChange} say={say} />
        <label className="check">
          <input type="checkbox" checked={Boolean(settings.hideWinnerName)} onChange={(e) => setSettings({ ...settings, hideWinnerName: e.target.checked })} />
          <span>Ẩn tên được chọn — bật thì cảnh cuối video không hiện tên (cả 2 hiệu ứng), tên chỉ lộ ở thẻ kết quả</span>
        </label>
        <div className="row">
          <button className="btn gold" onClick={async () => {
            // nextEffect belongs to the projector/live picker; never overwrite it with this tab's stale copy.
            const { nextEffect: _live, ...rest } = settings;
            void _live;
            try {
              onChange(await api<State>('/api/state', 'PUT', { settings: rest }));
              say('Đã lưu cài đặt.');
            } catch (e) { say((e as Error).message); }
          }}>Lưu cài đặt</button>
          <button className="btn danger" onClick={async () => {
            if (!window.confirm(`Khôi phục cài đặt mặc định và xoá ${LIST_LABEL[state.mode].toLowerCase()} cùng kết quả của nó? Danh sách còn lại giữ nguyên.`)) return;
            const reset = await api<State>('/api/action', 'POST', { type: 'resetAll' });
            setSettings(reset.settings);
            onChange(reset);
          }}>Khôi phục mặc định</button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Per-draw settings ---------------- */
const effectName = (e: EffectId | 'random') => EFFECT_LABEL[e];

function DrawPlanEditor({ state, settings, setSettings, onChange, say }: {
  state: State; settings: Settings; setSettings: (s: Settings) => void; onChange: (s: State) => void; say: (m: string) => void;
}) {
  const done = state.drawCount;
  const plan = settings.effectPlan ?? [];
  const counts = settings.winnerCountPlan ?? [];
  const [visibleThrough, setVisibleThrough] = useState(0);
  const lastRound = Math.max(done + 1, plan.length, counts.length, visibleThrough);
  const live = state.settings.nextEffect ?? null;
  // Preview with this tab's unsaved script/default, but the live one-off pick.
  const preview = { ...settings, nextEffect: live };
  const next = plannedEffect(preview, done);

  const setEntry = (index: number, value: EffectPlanEntry) => {
    const copy: EffectPlanEntry[] = plan.slice();
    while (copy.length <= index) copy.push('');
    copy[index] = value;
    setSettings({ ...settings, effectPlan: copy });
  };
  const setCount = (index: number, count: number | null) => {
    const copy = counts.slice();
    while (copy.length <= index) copy.push(null);
    copy[index] = count;
    while (copy.length && copy[copy.length - 1] === null) copy.pop();
    setSettings({ ...settings, winnerCountPlan: copy });
  };
  const setLive = async (value: EffectId | 'random' | null) => {
    try { onChange(await api<State>('/api/state', 'PUT', { settings: { nextEffect: value } })); say(value ? 'Đã chọn hiệu ứng cho lượt tới.' : 'Lượt tới dùng theo kịch bản.'); } catch (e) { say((e as Error).message); }
  };

  return (
    <fieldset className="department-settings effect-plan">
      <legend>Nâng cấp lượt rút</legend>
      <div className="effect-next">
        <div>
          <b>Lượt tiếp theo: {done + 1}</b>
          <span className="muted"> · {plannedWinnerCount(settings, done)} người trúng · sẽ phát <b className="gold-text">{effectName(next.effect)}</b>
            {next.source === 'next' ? ' (chọn nhanh)' : next.source === 'plan' ? ' (theo kịch bản)' : ' (mặc định)'}</span>
        </div>
        <label className="field inline"><span>Chọn nhanh cho lượt tới (áp dụng ngay, đồng bộ với màn chiếu)</span>
          <select value={live ?? ''} onChange={(e) => setLive((e.target.value || null) as EffectId | 'random' | null)}>
            <option value="">Theo kịch bản / mặc định</option>
            {SINGLE_DRAW_CHOICES.map((k) => <option key={k} value={k}>{EFFECT_LABEL[k]}</option>)}
          </select>
        </label>
      </div>
      <table className="grid">
        <thead><tr><th>Lượt</th><th>Số người trúng</th><th>Hiệu ứng</th><th>Sẽ phát</th></tr></thead>
        <tbody>
          {Array.from({ length: lastRound - done }, (_, k) => {
            const i = done + k;
            const value = plan[i] ?? '';
            const p = plannedEffect({ ...preview, nextEffect: k === 0 ? live : null }, i);
            return <tr key={i} className={k === 0 ? 'effect-next-row' : undefined}>
              <td>{i + 1}{k === 0 && <small className="muted"> · tiếp theo</small>}</td>
              <td><input className="draw-winner-count" type="number" min="1" step="1" aria-label={'Số người trúng lượt ' + (i + 1)}
                placeholder="1" value={counts[i] ?? ''} onChange={(e) => {
                  const { value, valueAsNumber } = e.currentTarget;
                  if (!value || isWinnerCount(valueAsNumber)) setCount(i, value ? valueAsNumber : null);
                }} /></td>
              <td><select aria-label={'Hiệu ứng lượt ' + (i + 1)} value={value} onChange={(e) => setEntry(i, e.target.value as EffectPlanEntry)}>
                <option value="">Theo mặc định</option>
                {SINGLE_DRAW_CHOICES.map((c) => <option key={c} value={c}>{EFFECT_LABEL[c]}</option>)}
              </select></td>
              <td className={p.source === 'default' ? 'muted' : undefined}>{effectName(p.effect)}{p.source === 'next' && <small className="warn"> · chọn nhanh</small>}</td>
            </tr>;
          })}
        </tbody>
      </table>
      <div className="row wrap">
        <button className="btn ghost small icon-only" onClick={() => setVisibleThrough(lastRound + 1)} aria-label="Thêm 1 lượt" title="Thêm 1 lượt">
          <PlusIcon width={16} height={16} aria-hidden="true" />
        </button>
        <span className="muted small">{done > 0 ? `Đã quay ${done} lượt. ` : ''}Nhấn “Lưu cài đặt” để áp dụng kịch bản.</span>
        <button className="btn ghost small icon-only push-end" onClick={() => {
          setVisibleThrough(0);
          setSettings({ ...settings, effectPlan: plan.slice(0, done), winnerCountPlan: counts.slice(0, done) });
        }}
          aria-label="Đưa các lượt sắp tới về mặc định" title="Đưa các lượt sắp tới về mặc định">
          <ResetIcon width={16} height={16} aria-hidden="true" />
        </button>
      </div>
    </fieldset>
  );
}

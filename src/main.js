import {
  PYEONG_M2, UNIT_META, bounds, deepClone, distance, formatLength, fromMeters,
  pointInPolygon, polygonArea, polygonCentroid, polygonPerimeter, polygonContainsPolygon, snap, toMeters, uid,
} from './lib/geometry.js';
import { loadCurrent, loadPrefs, loadProjects, saveCurrent, savePrefs, saveProjects } from './lib/storage.js';
import { TEMPLATE_CATEGORIES, TEMPLATES } from './templates.js';

const app = document.querySelector('#app');
const CANVAS = { width: 1200, height: 820, originX: 100, originY: 90, pxPerMeter: 72 };
const ZOOM = { min: 0.02, max: 4 };
function clampZoom(value) { return Math.min(ZOOM.max, Math.max(ZOOM.min, value)); }
function zoomDelta(current, direction) {
  const step = current < 0.2 ? 0.02 : current < 0.5 ? 0.05 : current < 1.5 ? 0.1 : 0.25;
  return clampZoom(+(current + step * direction).toFixed(3));
}
const prefs = loadPrefs();

const defaultFrameConfig = () => ({
  scope: 'building',
  siteShape: 'rectangle', siteWidth: 20, siteDepth: 15, siteCutWidth: 5, siteCutDepth: 4, siteNotchWidth: 6, siteNotchDepth: 5, siteTopWidth: 16,
  buildingShape: 'rectangle', buildingWidth: 10, buildingDepth: 8, buildingCutWidth: 3, buildingCutDepth: 2.5, buildingNotchWidth: 3, buildingNotchDepth: 3, buildingTopWidth: 8,
  buildingOffsetX: 2.5, buildingOffsetY: 2.5,
});

function room(name, x, y, w, h) {
  return { id: uid('room'), name, points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] };
}
function element(type, x, y, width, rotation) {
  return { id: uid('el'), type, x, y, width, rotation, name: type === 'door' ? '여닫이문' : type === 'sliding' ? '미닫이문' : '창문' };
}
function boundary(name, shape, points) {
  return { id: uid('boundary'), name, shape, points };
}

function shapePoints(shape, cfg, prefix, origin = { x: 0, y: 0 }) {
  const w = Number(cfg[`${prefix}Width`]);
  const d = Number(cfg[`${prefix}Depth`]);
  const ox = origin.x; const oy = origin.y;
  if (shape === 'l') {
    const cw = Math.min(Math.max(Number(cfg[`${prefix}CutWidth`]), .1), Math.max(.1, w - .1));
    const cd = Math.min(Math.max(Number(cfg[`${prefix}CutDepth`]), .1), Math.max(.1, d - .1));
    return [{x:ox,y:oy},{x:ox+w,y:oy},{x:ox+w,y:oy+d-cd},{x:ox+w-cw,y:oy+d-cd},{x:ox+w-cw,y:oy+d},{x:ox,y:oy+d}];
  }
  if (shape === 'u') {
    const nw = Math.min(Math.max(Number(cfg[`${prefix}NotchWidth`]), .1), Math.max(.1, w - .2));
    const nd = Math.min(Math.max(Number(cfg[`${prefix}NotchDepth`]), .1), Math.max(.1, d - .1));
    const left = (w - nw) / 2; const right = left + nw;
    return [{x:ox,y:oy},{x:ox+w,y:oy},{x:ox+w,y:oy+d},{x:ox+right,y:oy+d},{x:ox+right,y:oy+d-nd},{x:ox+left,y:oy+d-nd},{x:ox+left,y:oy+d},{x:ox,y:oy+d}];
  }
  if (shape === 'trapezoid') {
    const top = Math.max(.1, Number(cfg[`${prefix}TopWidth`]));
    const inset = (w - top) / 2;
    return [{x:ox+inset,y:oy},{x:ox+inset+top,y:oy},{x:ox+w,y:oy+d},{x:ox,y:oy+d}];
  }
  return [{x:ox,y:oy},{x:ox+w,y:oy},{x:ox+w,y:oy+d},{x:ox,y:oy+d}];
}

function projectToSegment(point, a, b) {
  const dx=b.x-a.x, dy=b.y-a.y, lenSq=dx*dx+dy*dy || 1;
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/lenSq));
  const projected={x:a.x+dx*t,y:a.y+dy*t};
  return { point:projected, t, distance:distance(point,projected) };
}
function wallSegments() {
  const out=[];
  const add=(sourceType,sourceId,points,label)=>{
    if(!points?.length)return;
    points.forEach((a,i)=>{const b=points[(i+1)%points.length];out.push({key:`${sourceType}:${sourceId||''}:${i}`,sourceType,sourceId,index:i,a,b,label,length:distance(a,b)});});
  };
  if(state.project.building)add('building','building',state.project.building.points,'건물 외벽');
  state.project.rooms.forEach(r=>add('room',r.id,r.points,r.name));
  return out;
}
function wallByKey(key){ return wallSegments().find(w=>w.key===key) || null; }
function nearestWall(point, maxDistance=null) {
  let best=null;
  for(const wall of wallSegments()){const hit=projectToSegment(point,wall.a,wall.b);if(!best||hit.distance<best.distance)best={...hit,wall};}
  const autoLimit=Math.max(.15,Math.min(2,16/(CANVAS.pxPerMeter*state.zoom)));
  return best && best.distance <= (maxDistance ?? autoLimit) ? best : null;
}
function wallAngle(wall){ return Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x)*180/Math.PI; }
function wallRoomCandidate(wall,lengthValue,depthValue,offsetValue,side){
  const len=Math.max(.01,wall.length), ux=(wall.b.x-wall.a.x)/len, uy=(wall.b.y-wall.a.y)/len;
  const nx=-uy, ny=ux, usable=Math.max(0,len-lengthValue), offset=Math.max(0,Math.min(usable,offsetValue));
  const s={x:wall.a.x+ux*offset,y:wall.a.y+uy*offset};
  const e={x:s.x+ux*lengthValue,y:s.y+uy*lengthValue};
  const sign=side==='right'?-1:1;
  return [s,e,{x:e.x+nx*depthValue*sign,y:e.y+ny*depthValue*sign},{x:s.x+nx*depthValue*sign,y:s.y+ny*depthValue*sign}];
}
function chooseAutoWallRoom(wall,lengthValue,depthValue,offsetValue){
  const left=wallRoomCandidate(wall,lengthValue,depthValue,offsetValue,'left');
  const right=wallRoomCandidate(wall,lengthValue,depthValue,offsetValue,'right');
  if(!state.project.building)return left;
  const li=polygonContainsPolygon(state.project.building.points,left),ri=polygonContainsPolygon(state.project.building.points,right);
  if(li&&!ri)return left;if(ri&&!li)return right;
  if(li&&ri){
    const overlapScore=pts=>{const c=polygonCentroid(pts);return state.project.rooms.reduce((n,r)=>n+(pointInPolygon(c,r.points)?1:0),0);};
    return overlapScore(left)<=overlapScore(right)?left:right;
  }
  return null;
}

function seedProject() {
  const cfg = defaultFrameConfig();
  cfg.buildingWidth = 11.5; cfg.buildingDepth = 7;
  return {
    id: uid('project'), name: '우리집 도면', description: '건물 외곽 11.5 × 7m, 방 3개·거실·주방·욕실 예시',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), scope: 'building', frameConfig: cfg,
    site: null, building: boundary('건물 외곽', 'rectangle', shapePoints('rectangle', cfg, 'building')),
    rooms: [
      room('방 1', 0, 0, 3, 3), room('방 2', 3, 0, 3, 3), room('방 3', 6, 0, 3, 4),
      room('주방', 0, 3, 2.5, 4), room('거실', 2.5, 3, 6, 4), room('욕실', 8.5, 4, 3, 2),
    ],
    elements: [
      element('window', 1.5, 0, 1.2, 0), element('window', 4.5, 0, 1.2, 0), element('window', 7.5, 0, 1.2, 0),
      element('door', 2.75, 3, .9, 90), element('door', 5.75, 3, .9, 90), element('door', 8.5, 4.7, .9, 0),
    ],
  };
}

function blankProject() {
  const cfg = defaultFrameConfig();
  return { id: uid('project'), name: '새 도면', description: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), scope: 'building', frameConfig: cfg, site: null, building: null, rooms: [], elements: [] };
}

function normalizeProject(incoming) {
  const p = deepClone(incoming || seedProject());
  p.rooms = Array.isArray(p.rooms) ? p.rooms : [];
  p.elements = Array.isArray(p.elements) ? p.elements : [];
  const cfg = { ...defaultFrameConfig(), ...(p.frameConfig || {}) };
  if (!p.building) {
    const pts = p.rooms.flatMap(r => r.points || []);
    const b = bounds(pts);
    if (pts.length) {
      cfg.buildingWidth = Math.max(.1, b.width); cfg.buildingDepth = Math.max(.1, b.height);
      p.building = boundary('건물 외곽', 'rectangle', [{x:b.minX,y:b.minY},{x:b.maxX,y:b.minY},{x:b.maxX,y:b.maxY},{x:b.minX,y:b.maxY}]);
    }
  }
  p.scope = p.scope === 'site-building' ? 'site-building' : 'building';
  if (p.scope === 'building') p.site = null;
  p.frameConfig = cfg;
  p.createdAt ||= new Date().toISOString(); p.updatedAt ||= new Date().toISOString();
  return p;
}

const storedProject = loadCurrent();
const initialProject = storedProject ? normalizeProject(storedProject) : blankProject();
const state = {
  project: initialProject,
  frameDraft: deepClone(initialProject.frameConfig || defaultFrameConfig()), setupOpen: !storedProject,
  unit: prefs.unit || 'm', gridSize: prefs.gridSize || .5,
  showGrid: prefs.showGrid ?? true, showDimensions: prefs.showDimensions ?? true, showArea: prefs.showArea ?? true,
  theme: prefs.theme || 'light', mode: 'select', zoom: 1,
  draftPoints: [], rectStart: null, pointer: null, selected: null, drag: null,
  history: [], future: [], savedOpen: false, templateOpen: false, templateCategory: 'all', toast: null,
  doorPreset: .9, windowPreset: 1.2,
  wallAnchor: null, wallRoomSide: 'auto',
};

document.documentElement.dataset.theme = state.theme;

function metrics() {
  const roomData = state.project.rooms.map(r => ({ ...r, area: polygonArea(r.points), perimeter: polygonPerimeter(r.points) }));
  const roomArea = roomData.reduce((s, r) => s + r.area, 0);
  const buildingArea = polygonArea(state.project.building?.points || []);
  const siteArea = polygonArea(state.project.site?.points || []);
  const placementValid = !state.project.site || !state.project.building || polygonContainsPolygon(state.project.site.points, state.project.building.points);
  const roomsOutside = state.project.building ? roomData.filter(r => !polygonContainsPolygon(state.project.building.points, r.points)).length : 0;
  const yardArea = state.project.site && placementValid ? Math.max(0, siteArea - buildingArea) : 0;
  return { roomData, roomArea, buildingArea, siteArea, yardArea, placementValid, roomsOutside, buildingPyeong: buildingArea / PYEONG_M2, roomPyeong: roomArea / PYEONG_M2, sitePyeong: siteArea / PYEONG_M2, totalPerimeter: roomData.reduce((s, r) => s + r.perimeter, 0) };
}

function esc(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function num(value, max = 2) { return Number(value || 0).toLocaleString('ko-KR', { minimumFractionDigits: max, maximumFractionDigits: max }); }
function roundedUnit(m) { const v = fromMeters(m || 0, state.unit); return Number(v.toFixed(state.unit === 'm' ? 3 : state.unit === 'cm' ? 1 : 0)); }
function icon(name) {
  const paths = {
    save:'<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 15h8"/>', folder:'<path d="M3 6h7l2 2h9v10H3z"/>',
    undo:'<path d="M9 7 5 11l4 4"/><path d="M5 11h8a5 5 0 0 1 5 5"/>', redo:'<path d="m15 7 4 4-4 4"/><path d="M19 11h-8a5 5 0 0 0-5 5"/>',
    download:'<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 20h16"/>', trash:'<path d="M4 7h16"/><path d="M9 3h6l1 4H8z"/><path d="M7 7l1 14h8l1-14"/>',
    print:'<path d="M7 8V3h10v5"/><path d="M6 17H4V9h16v8h-2"/><path d="M7 14h10v7H7z"/>', plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>', moon:'<path d="M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  };
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function render() {
  const m = metrics();
  const selectedRoom = state.selected?.type === 'room' ? state.project.rooms.find(r => r.id === state.selected.id) : null;
  const selectedElement = state.selected?.type === 'element' ? state.project.elements.find(e => e.id === state.selected.id) : null;
  const selectedBoundary = state.selected?.type === 'boundary' ? state.project[state.selected.kind] : null;
  app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <button class="brand brand-button" data-action="new" title="새 도면 만들기"><span class="brand-mark"><span></span></span><span><strong>평수 도면 스튜디오</strong><small>외곽부터 정하고, 건축도처럼 편집하는 면적 계산기</small></span></button>
      <nav class="top-actions" aria-label="주요 기능"><button class="nav-button active" data-action="mode" data-mode="select">설계하기</button><button class="nav-button" data-action="templates">${icon('folder')} 기본 템플릿</button><button class="nav-button" data-action="saved">${icon('save')} 저장된 도면</button><button class="nav-button" data-action="guide">${icon('info')} 사용 가이드</button></nav>
      <div class="header-right"><button class="icon-button" data-action="theme" aria-label="테마 변경">${icon(state.theme === 'light' ? 'moon' : 'sun')}</button><button class="primary-button" data-action="save">${icon('save')} 내 도면 저장</button></div>
    </header>
    <main class="workspace">
      <aside class="left-panel panel-scroll">
        ${frameSetupSection()}
        <section><h2>실내 그리기 도구</h2><div class="tool-grid">
          ${[['select','↖','선택'],['rectangle','▭','사각형'],['polygon','⬠','다각형'],['wall-room','╫','벽 기준']].map(([mode,glyph,label]) => `<button class="tool-button ${state.mode === mode ? 'selected' : ''}" data-action="mode" data-mode="${mode}"><span class="tool-icon">${glyph}</span>${label}</button>`).join('')}
        </div>${state.mode === 'polygon' ? `<div class="context-note">점을 순서대로 찍고 첫 점을 다시 누르거나 완료 버튼을 누르세요.${state.draftPoints.length > 2 ? '<button class="mini-primary" data-action="finish-polygon">다각형 완료</button>' : ''}</div>` : ''}${state.mode === 'wall-room' ? wallRoomPanel() : ''}</section>
        <section><h2>치수로 실내 공간 추가</h2><label class="field"><span>공간 이름</span><input id="quick-name" value="새 공간"></label><div class="two-fields"><label class="field"><span>가로 (${state.unit})</span><input id="quick-width" inputmode="decimal" value="${state.unit === 'm' ? '4' : state.unit === 'cm' ? '400' : '4000'}"></label><label class="field"><span>세로 (${state.unit})</span><input id="quick-height" inputmode="decimal" value="${state.unit === 'm' ? '3' : state.unit === 'cm' ? '300' : '3000'}"></label></div><button class="wide-button accent-outline" data-action="add-quick">${icon('plus')} 입력 크기로 추가</button></section>
        <section><h2>건축 요소 추가</h2><div class="context-note compact">문·미닫이문·창문은 빈 공간이 아니라 <b>가장 가까운 벽에 자동 스냅</b>되어 벽 방향으로 회전합니다.</div><div class="element-cards"><button class="${state.mode === 'door' ? 'selected' : ''}" data-action="mode" data-mode="door"><span class="door-glyph"></span>여닫이문</button><button class="${state.mode === 'sliding' ? 'selected' : ''}" data-action="mode" data-mode="sliding"><span class="sliding-glyph"></span>미닫이문</button><button class="${state.mode === 'window' ? 'selected' : ''}" data-action="mode" data-mode="window"><span class="window-glyph"></span>창문</button></div><label class="field"><span>문 기본 폭</span><select data-setting="doorPreset">${[.7,.8,.9,1,1.2].map(v => `<option value="${v}" ${state.doorPreset === v ? 'selected' : ''}>${v * 1000} mm</option>`).join('')}</select></label><label class="field"><span>창문 기본 폭</span><select data-setting="windowPreset">${[.9,1.2,1.5,1.8,2.4].map(v => `<option value="${v}" ${state.windowPreset === v ? 'selected' : ''}>${v * 1000} mm</option>`).join('')}</select></label></section>
        <section><h2>도면 설정</h2><label class="field"><span>입력 / 표시 단위</span><select data-setting="unit">${Object.entries(UNIT_META).map(([k,v]) => `<option value="${k}" ${state.unit === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label><label class="field"><span>스냅 그리드</span><select data-setting="gridSize">${[.05,.1,.25,.5,1].map(v => `<option value="${v}" ${state.gridSize === v ? 'selected' : ''}>${v.toFixed(2)} m</option>`).join('')}</select></label>${toggle('showGrid','그리드 표시')}${toggle('showDimensions','치수 표시')}${toggle('showArea','면적 표시')}</section>
      </aside>
      <section class="canvas-panel">
        <div class="canvas-toolbar"><div class="toolbar-group"><button class="icon-button ${state.history.length ? '' : 'muted'}" data-action="undo" aria-label="실행 취소">${icon('undo')}</button><button class="icon-button ${state.future.length ? '' : 'muted'}" data-action="redo" aria-label="다시 실행">${icon('redo')}</button><span class="divider"></span><button class="icon-button" data-action="zoom-out">${icon('minus')}</button><span class="zoom-label">${Math.round(state.zoom * 100)}%</span><button class="icon-button" data-action="zoom-in">${icon('plus')}</button><button class="small-button" data-action="fit">맞춤</button></div><div class="status-strip"><span class="mode-dot ${state.mode}"></span>${modeText()}</div></div>
        <div class="drawing-wrap">${renderSvg()}</div>
        <div class="canvas-footer" id="guide"><div><strong>1. 외곽부터</strong><span>건물만 또는 대지+건물을 선택하고, 형상과 규격으로 외부 틀을 먼저 생성하세요.</span></div><div><strong>2. 내부 편집</strong><span>사각형·다각형으로 실내 공간을 나누고 문·창문을 배치합니다.</span></div><div><strong>3. 저장·출력</strong><span>브라우저 저장, JSON 백업, SVG·PNG·PDF 출력을 지원합니다.</span></div></div>
      </section>
      <aside class="right-panel panel-scroll">
        ${resultSection(m)}
        ${boundaryListSection(m)}
        <section><h2>공간별 면적</h2><div class="room-table">${m.roomData.length ? m.roomData.map(r => `<button class="${state.selected?.id === r.id ? 'active' : ''}" data-action="select-room" data-id="${r.id}"><span>${esc(r.name)}</span><strong>${num(r.area)} m² <small>(${num(r.area / PYEONG_M2)}평)</small></strong></button>`).join('') : '<div class="empty-state">아직 실내 공간이 없습니다.<br>외곽 틀 생성 후 공간을 추가하세요.</div>'}</div></section>
        ${(selectedRoom || selectedElement || selectedBoundary) ? `<section class="inspector-section"><div class="section-title-row"><h2>선택 요소 편집</h2>${selectedRoom || selectedElement ? `<button class="danger-icon" data-action="delete">${icon('trash')}</button>` : ''}</div>${selectedRoom ? roomInspector(selectedRoom) : selectedElement ? elementInspector(selectedElement) : boundaryInspector(selectedBoundary, state.selected.kind)}</section>` : ''}
        <section><h2>도면 정보</h2><label class="field"><span>도면 이름</span><input data-live="project-name" value="${esc(state.project.name)}"></label><label class="field"><span>설명</span><textarea data-live="project-description" rows="3">${esc(state.project.description)}</textarea></label><div class="metadata"><span>수정</span><b>${new Date(state.project.updatedAt).toLocaleString('ko-KR')}</b></div></section>
        <section><h2>내보내기 · 백업</h2><div class="export-grid"><button data-action="export-png">${icon('download')} PNG</button><button data-action="export-svg">${icon('download')} SVG</button><button data-action="print">${icon('print')} PDF/인쇄</button><button data-action="export-json">${icon('download')} JSON 백업</button><button data-action="import-json">${icon('folder')} JSON 불러오기</button><button data-action="templates">${icon('folder')} 기본 템플릿</button><button data-action="new">${icon('plus')} 새 도면</button></div><input id="json-file" type="file" accept="application/json,.json" hidden></section>
      </aside>
    </main>
    ${state.savedOpen ? savedModal() : ''}
    ${state.templateOpen ? templateModal() : ''}
    ${state.setupOpen ? setupModal() : ''}
    ${state.toast ? `<div class="toast ${state.toast.type}">${esc(state.toast.message)}</div>` : ''}
  </div>`;
}

function frameSetupSection() {
  return `<section class="frame-section"><div class="section-title-row"><h2>작업 기본 외곽</h2><span class="step-badge">먼저 설정</span></div>${frameSetupForm('panel')}<button class="wide-button frame-apply" data-action="apply-frame">외부 틀 적용 / 다시 생성</button></section>`;
}
function frameSetupForm(context) {
  const cfg = state.frameDraft;
  return `<div class="scope-choice" role="group" aria-label="작업 범위"><button class="${cfg.scope === 'building' ? 'active' : ''}" data-action="set-scope" data-scope="building">건물만</button><button class="${cfg.scope === 'site-building' ? 'active' : ''}" data-action="set-scope" data-scope="site-building">대지 + 마당 + 건물</button></div>
  ${cfg.scope === 'site-building' ? `<div class="frame-block"><h3>대지 외곽</h3>${shapeFields('site')}</div>` : ''}
  <div class="frame-block"><h3>${cfg.scope === 'site-building' ? '건물 외곽' : '건물 외곽 규격'}</h3>${shapeFields('building')}${cfg.scope === 'site-building' ? `<div class="two-fields"><label class="field"><span>대지 왼쪽 여백 (${state.unit})</span><input data-frame-config="buildingOffsetX" value="${roundedUnit(cfg.buildingOffsetX)}" inputmode="decimal"></label><label class="field"><span>대지 위쪽 여백 (${state.unit})</span><input data-frame-config="buildingOffsetY" value="${roundedUnit(cfg.buildingOffsetY)}" inputmode="decimal"></label></div>` : ''}</div>
  ${context === 'modal' ? '<p class="setup-help">외곽 틀이 만들어진 뒤 실내 공간, 문, 창문을 추가할 수 있습니다. 외곽은 나중에도 다시 규격 입력하거나 꼭짓점 좌표로 수정할 수 있습니다.</p>' : ''}`;
}
function shapeFields(prefix) {
  const cfg = state.frameDraft; const shape = cfg[`${prefix}Shape`]; const cap = prefix === 'site' ? '대지' : '건물';
  const extras = shape === 'l' ? `<div class="two-fields"><label class="field"><span>파인 폭 (${state.unit})</span><input data-frame-config="${prefix}CutWidth" value="${roundedUnit(cfg[`${prefix}CutWidth`])}" inputmode="decimal"></label><label class="field"><span>파인 깊이 (${state.unit})</span><input data-frame-config="${prefix}CutDepth" value="${roundedUnit(cfg[`${prefix}CutDepth`])}" inputmode="decimal"></label></div>`
    : shape === 'u' ? `<div class="two-fields"><label class="field"><span>중앙 홈 폭 (${state.unit})</span><input data-frame-config="${prefix}NotchWidth" value="${roundedUnit(cfg[`${prefix}NotchWidth`])}" inputmode="decimal"></label><label class="field"><span>중앙 홈 깊이 (${state.unit})</span><input data-frame-config="${prefix}NotchDepth" value="${roundedUnit(cfg[`${prefix}NotchDepth`])}" inputmode="decimal"></label></div>`
    : shape === 'trapezoid' ? `<label class="field"><span>윗변 폭 (${state.unit})</span><input data-frame-config="${prefix}TopWidth" value="${roundedUnit(cfg[`${prefix}TopWidth`])}" inputmode="decimal"></label>` : '';
  return `<label class="field"><span>${cap} 모양</span><select data-frame-config="${prefix}Shape"><option value="rectangle" ${shape === 'rectangle' ? 'selected' : ''}>사각형</option><option value="l" ${shape === 'l' ? 'selected' : ''}>ㄱ자형</option><option value="u" ${shape === 'u' ? 'selected' : ''}>ㄷ자형</option><option value="trapezoid" ${shape === 'trapezoid' ? 'selected' : ''}>사다리꼴</option></select></label><div class="two-fields"><label class="field"><span>전체 가로 (${state.unit})</span><input data-frame-config="${prefix}Width" value="${roundedUnit(cfg[`${prefix}Width`])}" inputmode="decimal"></label><label class="field"><span>전체 세로 (${state.unit})</span><input data-frame-config="${prefix}Depth" value="${roundedUnit(cfg[`${prefix}Depth`])}" inputmode="decimal"></label></div>${extras}`;
}
function setupModal() {
  return `<div class="modal-backdrop setup-backdrop"><div class="modal setup-modal" data-modal-stop><div class="modal-header"><div><h2>새 작업의 외부 틀을 먼저 정하세요</h2><p>작업 범위와 외곽 모양을 선택하고 실제 규격을 입력합니다.</p></div></div><div class="setup-body">${frameSetupForm('modal')}<div class="setup-actions"><button class="primary-button setup-submit" data-action="apply-frame">이 규격으로 도면 시작</button><button class="wide-button accent-outline" data-action="open-templates-setup">기본 템플릿에서 시작</button><button class="wide-button" data-action="use-example">예시 도면으로 둘러보기</button></div></div></div></div>`;
}
function resultSection(m) {
  const heroArea = state.project.scope === 'site-building' && state.project.site ? m.siteArea : m.buildingArea;
  const heroLabel = state.project.scope === 'site-building' && state.project.site ? '대지 면적' : '건물 외곽 면적';
  return `<section><div class="section-title-row"><h2>면적 계산 결과</h2><span class="help-dot" title="1평 = 3.305785㎡">?</span></div><div class="area-hero"><span>${heroLabel}</span><strong>${num(heroArea)} <small>m²</small></strong><b>${num(heroArea / PYEONG_M2)}평</b></div>${state.project.site ? `<div class="metric-row"><span>건축 외곽 면적</span><strong>${num(m.buildingArea)} m² (${num(m.buildingPyeong)}평)</strong></div><div class="metric-row"><span>마당·여유 면적</span><strong>${m.placementValid ? `${num(m.yardArea)} m²` : '경계 확인 필요'}</strong></div>${m.placementValid ? '' : '<div class="placement-warning">건물 외곽 일부가 대지 밖에 있습니다. 건물 위치 또는 외곽 꼭짓점을 조정하세요.</div>'}` : ''}<div class="metric-row"><span>실내 공간 합계</span><strong>${num(m.roomArea)} m² (${num(m.roomPyeong)}평)</strong></div><div class="metric-row"><span>실내 공간 수</span><strong>${state.project.rooms.length}개</strong></div>${m.roomsOutside ? `<div class="placement-warning">실내 공간 ${m.roomsOutside}개가 건물 외곽을 벗어납니다. 해당 공간의 위치 또는 꼭짓점을 조정하세요.</div>` : ''}<p class="fine-print">※ 외곽 폴리곤의 기하학적 면적입니다. 실제 법정 대지면적·건축면적·연면적·전용면적 산정은 관련 기준과 측량값을 별도로 확인해야 합니다.</p></section>`;
}
function boundaryListSection(m) {
  return `<section><h2>외부 틀</h2><div class="boundary-list">${state.project.site ? boundaryListButton('site', state.project.site, m.siteArea) : ''}${state.project.building ? boundaryListButton('building', state.project.building, m.buildingArea) : '<div class="empty-state">외부 틀이 없습니다.<br>왼쪽에서 규격을 입력해 생성하세요.</div>'}</div></section>`;
}
function boundaryListButton(kind, item, area) {
  return `<button class="boundary-row ${state.selected?.type === 'boundary' && state.selected.kind === kind ? 'active' : ''}" data-action="select-boundary" data-kind="${kind}"><span><b>${kind === 'site' ? '대지' : '건물'}</b>${esc(item.name)}</span><strong>${num(area)} m²<small>${shapeLabel(item.shape)}</small></strong></button>`;
}
function shapeLabel(shape) { return ({ rectangle:'사각형', l:'ㄱ자형', u:'ㄷ자형', trapezoid:'사다리꼴', custom:'사용자 편집' })[shape] || '다각형'; }
function toggle(key, label) { return `<label class="toggle-row"><input type="checkbox" data-setting="${key}" ${state[key] ? 'checked' : ''}><span class="fake-check"></span>${label}</label>`; }
function modeText() { return state.mode === 'select' ? '선택 · 이동 · 꼭짓점 편집' : state.mode === 'polygon' ? '실내 다각형 그리기' : state.mode === 'rectangle' ? '실내 사각형 드래그' : state.mode === 'wall-room' ? '벽을 클릭해 기준 벽 선택' : state.mode === 'door' ? '벽을 클릭해 여닫이문 배치' : state.mode === 'sliding' ? '벽을 클릭해 미닫이문 배치' : '벽을 클릭해 창문 배치'; }

function renderSvg() {
  const scale = CANVAS.pxPerMeter * state.zoom; const gridPx = Math.max(state.gridSize * scale, 4);
  const toScreen = p => ({ x: CANVAS.originX + p.x * scale, y: CANVAS.originY + p.y * scale });
  const boundaryHtml = ['site','building'].map(kind => {
    const item = state.project[kind]; if (!item?.points?.length) return '';
    const selected = state.selected?.type === 'boundary' && state.selected.kind === kind;
    const pts = item.points.map(p => { const q = toScreen(p); return `${q.x},${q.y}`; }).join(' ');
    const dims = state.showDimensions ? item.points.map((p,i) => dimension(toScreen(p), toScreen(item.points[(i+1)%item.points.length]), formatLength(distance(p,item.points[(i+1)%item.points.length]),state.unit,true), kind === 'site' ? 'site-dim' : 'building-dim')).join('') : '';
    const handles = selected ? item.points.map((p,i) => { const q=toScreen(p); return `<circle class="vertex-handle boundary-handle" cx="${q.x}" cy="${q.y}" r="8" data-vertex-boundary="${kind}" data-vertex-index="${i}"></circle>`; }).join('') : '';
    const c = toScreen(polygonCentroid(item.points));
    return `<g class="boundary-layer ${kind}"><polygon class="boundary-shape ${kind} ${selected ? 'is-selected' : ''}" points="${pts}" data-boundary-kind="${kind}"></polygon>${dims}<g class="boundary-label" pointer-events="none"><text x="${c.x}" y="${c.y}">${kind === 'site' ? '대지' : '건물 외곽'}</text></g>${handles}</g>`;
  }).join('');
  const roomHtml = state.project.rooms.map(r => {
    const area = polygonArea(r.points), c = toScreen(polygonCentroid(r.points)), selected = state.selected?.type === 'room' && state.selected.id === r.id;
    const pts = r.points.map(p => { const q = toScreen(p); return `${q.x},${q.y}`; }).join(' ');
    const dims = state.showDimensions ? r.points.map((p,i) => dimension(toScreen(p),toScreen(r.points[(i+1)%r.points.length]),formatLength(distance(p,r.points[(i+1)%r.points.length]),state.unit,true))).join('') : '';
    const handles = selected ? r.points.map((p,i) => { const q=toScreen(p); return `<circle class="vertex-handle" cx="${q.x}" cy="${q.y}" r="8" data-vertex-room="${r.id}" data-vertex-index="${i}"></circle>`; }).join('') : '';
    return `<g><polygon class="room-shape ${selected ? 'is-selected' : ''}" points="${pts}" data-room-id="${r.id}"></polygon>${dims}<g class="room-label" pointer-events="none"><text x="${c.x}" y="${c.y - (state.showArea ? 4 : 0)}">${esc(r.name)}</text>${state.showArea ? `<text class="room-area" x="${c.x}" y="${c.y + 20}">${num(area)} m² · ${num(area/PYEONG_M2)}평</text>` : ''}</g>${handles}</g>`;
  }).join('');
  const elements = state.project.elements.map(el => architecturalElement(el,toScreen(el),scale)).join('');
  const wallGuide = ['wall-room','door','sliding','window'].includes(state.mode) ? renderWallGuides() : '';
  const draft = state.draftPoints.length ? `<g class="draft-layer"><polyline points="${[...state.draftPoints,state.pointer].filter(Boolean).map(p => { const q=toScreen(p); return `${q.x},${q.y}`; }).join(' ')}"></polyline>${state.draftPoints.map((p,i) => { const q=toScreen(p); return `<circle cx="${q.x}" cy="${q.y}" r="${i === 0 ? 8 : 6}"></circle>`; }).join('')}</g>` : '';
  let rect = ''; if (state.rectStart && state.pointer) { const a=toScreen(state.rectStart),b=toScreen(state.pointer); rect=`<rect class="rect-preview" x="${Math.min(a.x,b.x)}" y="${Math.min(a.y,b.y)}" width="${Math.abs(a.x-b.x)}" height="${Math.abs(a.y-b.y)}"></rect>`; }
  return `<svg id="drawing-svg" class="drawing-canvas mode-${state.mode}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" aria-label="도면 편집 캔버스" role="application"><defs><pattern id="grid-small" width="${gridPx}" height="${gridPx}" patternUnits="userSpaceOnUse"><path d="M ${gridPx} 0 L 0 0 0 ${gridPx}" fill="none" class="grid-minor"></path></pattern><pattern id="grid-major" width="${Math.max(gridPx*5,20)}" height="${Math.max(gridPx*5,20)}" patternUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="url(#grid-small)"></rect><path d="M ${Math.max(gridPx*5,20)} 0 L 0 0 0 ${Math.max(gridPx*5,20)}" fill="none" class="grid-major"></path></pattern></defs><rect width="100%" height="100%" class="canvas-background"></rect>${state.showGrid ? '<rect width="100%" height="100%" fill="url(#grid-major)"></rect>' : ''}${boundaryHtml}${roomHtml}${elements}${wallGuide}${draft}${rect}</svg>`;
}

function wallRoomPanel(){
  const wall=state.wallAnchor?wallByKey(state.wallAnchor):null;
  return `<div class="wall-room-panel"><div class="context-note"><b>${wall?`기준 벽: ${esc(wall.label)} · ${formatLength(wall.length,state.unit,true)}`:'도면에서 기준이 될 벽을 먼저 클릭하세요.'}</b><br>선택한 벽의 시작점에서 거리와 방 길이·깊이를 입력해 벽에 정확히 붙여 생성합니다.</div><label class="field"><span>공간 이름</span><input id="wall-room-name" value="새 공간"></label><div class="two-fields"><label class="field"><span>벽을 따라 길이 (${state.unit})</span><input id="wall-room-length" value="${state.unit==='m'?'4':state.unit==='cm'?'400':'4000'}"></label><label class="field"><span>벽에서 깊이 (${state.unit})</span><input id="wall-room-depth" value="${state.unit==='m'?'3':state.unit==='cm'?'300':'3000'}"></label></div><div class="two-fields"><label class="field"><span>벽 시작점에서 (${state.unit})</span><input id="wall-room-offset" value="0"></label><label class="field"><span>생성 방향</span><select id="wall-room-side"><option value="auto" ${state.wallRoomSide==='auto'?'selected':''}>건물 안쪽 자동</option><option value="left" ${state.wallRoomSide==='left'?'selected':''}>벽 진행방향 왼쪽</option><option value="right" ${state.wallRoomSide==='right'?'selected':''}>벽 진행방향 오른쪽</option></select></label></div><button class="wide-button accent-outline" data-action="add-wall-room" ${wall?'':'disabled'}>${icon('plus')} 선택 벽 기준으로 공간 생성</button></div>`;
}
function renderWallGuides(){
  return `<g class="wall-guide-layer">${wallSegments().map(w=>{const a=toScreen(w.a),b=toScreen(w.b),active=state.wallAnchor===w.key;return `<line class="wall-guide-hit ${active?'active':''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" data-wall-key="${w.key}"></line><line class="wall-guide-visible ${active?'active':''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>`;}).join('')}</g>`;
}

function dimension(a,b,label,extraClass='') { const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,norm=angle>90||angle<-90?angle+180:angle,len=Math.hypot(b.x-a.x,b.y-a.y); if(len<42)return''; const w=Math.max(56,label.length*6.8); return `<g class="dimension ${extraClass}" pointer-events="none"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line><g transform="translate(${mx} ${my}) rotate(${norm})"><rect x="${-w/2}" y="-12" width="${w}" height="22" rx="5"></rect><text x="0" y="4">${esc(label)}</text></g></g>`; }
function architecturalElement(el,p,scale) { const w=el.width*scale,selected=state.selected?.type==='element'&&state.selected.id===el.id,t=`translate(${p.x} ${p.y}) rotate(${el.rotation||0})`; if(el.type==='window')return `<g class="arch-element window ${selected?'is-selected':''}" transform="${t}" data-element-id="${el.id}"><rect x="${-w/2-8}" y="-12" width="${w+16}" height="24" class="hit-area"></rect><line x1="${-w/2}" y1="-5" x2="${w/2}" y2="-5"></line><line x1="${-w/2}" y1="5" x2="${w/2}" y2="5"></line><line x1="${-w/2}" y1="-10" x2="${-w/2}" y2="10"></line><line x1="${w/2}" y1="-10" x2="${w/2}" y2="10"></line></g>`; if(el.type==='sliding')return `<g class="arch-element sliding ${selected?'is-selected':''}" transform="${t}" data-element-id="${el.id}"><rect x="${-w/2-8}" y="-14" width="${w+16}" height="28" class="hit-area"></rect><line x1="${-w/2}" y1="-6" x2="${w/4}" y2="-6"></line><line x1="${-w/4}" y1="6" x2="${w/2}" y2="6"></line><line x1="${-w/2}" y1="-10" x2="${-w/2}" y2="10"></line><line x1="${w/2}" y1="-10" x2="${w/2}" y2="10"></line></g>`; return `<g class="arch-element door ${selected?'is-selected':''}" transform="${t}" data-element-id="${el.id}"><rect x="-12" y="${-w-12}" width="${w+28}" height="${w+24}" class="hit-area"></rect><line x1="0" y1="0" x2="0" y2="${-w}"></line><path d="M 0 ${-w} A ${w} ${w} 0 0 1 ${w} 0"></path><line x1="0" y1="0" x2="${w}" y2="0"></line></g>`; }

function roomInspector(r) { const b=bounds(r.points),area=polygonArea(r.points); return `<div class="inspector-stack"><label class="field"><span>공간 이름</span><input data-live="room-name" data-id="${r.id}" value="${esc(r.name)}"></label><div class="inspector-summary"><span>면적 <b>${num(area)} m²</b></span><span>외곽 크기 <b>${formatLength(b.width,state.unit,true)} × ${formatLength(b.height,state.unit,true)}</b></span></div>${vertexTable(r.points,'room')}</div>`; }
function boundaryInspector(item,kind) { const b=bounds(item.points),area=polygonArea(item.points); return `<div class="inspector-stack"><label class="field"><span>외곽 이름</span><input data-live="boundary-name" data-kind="${kind}" value="${esc(item.name)}"></label><div class="inspector-summary"><span>구분 <b>${kind === 'site' ? '대지 외곽' : '건물 외곽'}</b></span><span>형상 <b>${shapeLabel(item.shape)}</b></span><span>면적 <b>${num(area)} m² (${num(area/PYEONG_M2)}평)</b></span><span>바운딩 크기 <b>${formatLength(b.width,state.unit,true)} × ${formatLength(b.height,state.unit,true)}</b></span></div>${vertexTable(item.points,'boundary',kind)}<p class="fine-print">꼭짓점 좌표를 직접 바꾸면 형상은 사용자 편집 상태로 전환됩니다. 규격형으로 되돌리려면 왼쪽 ‘외부 틀 적용’을 사용하세요.</p></div>`; }
function vertexTable(points,type,kind='') { return `<div class="vertex-table"><div class="vertex-head"><span>점</span><span>X (${state.unit})</span><span>Y (${state.unit})</span></div>${points.map((p,i) => `<div class="vertex-row"><b>${i+1}</b><input data-${type}-vertex-input="x" ${kind ? `data-kind="${kind}"` : ''} data-index="${i}" value="${roundedUnit(p.x)}"><input data-${type}-vertex-input="y" ${kind ? `data-kind="${kind}"` : ''} data-index="${i}" value="${roundedUnit(p.y)}"></div>`).join('')}</div>`; }
function elementInspector(el) { return `<div class="inspector-stack"><label class="field"><span>요소 이름</span><input data-live="element-name" data-id="${el.id}" value="${esc(el.name)}"></label><label class="field"><span>폭 (${state.unit})</span><input data-element-field="width" inputmode="decimal" value="${roundedUnit(el.width)}"></label><label class="field"><span>회전</span><select data-element-field="rotation">${[0,90,180,270].map(v => `<option value="${v}" ${el.rotation===v?'selected':''}>${v}°</option>`).join('')}</select></label><div class="two-fields"><label class="field"><span>X (${state.unit})</span><input data-element-field="x" value="${roundedUnit(el.x)}"></label><label class="field"><span>Y (${state.unit})</span><input data-element-field="y" value="${roundedUnit(el.y)}"></label></div></div>`; }
function savedModal() { const list=loadProjects(); return `<div class="modal-backdrop" data-action="close-saved"><div class="modal" data-modal-stop><div class="modal-header"><div><h2>저장된 도면</h2><p>이 브라우저에 저장된 프로젝트입니다.</p></div><button class="modal-close" data-action="close-saved">×</button></div><div class="saved-list">${list.length ? list.map(raw => { const item=normalizeProject(raw); return `<div class="saved-card"><div><strong>${esc(item.name||'이름 없는 도면')} ${state.project.id===item.id?'<small>현재</small>':''}</strong><span>${esc(item.description||'설명 없음')}</span><time>${new Date(item.updatedAt).toLocaleString('ko-KR')}</time></div><div><button class="small-button" data-action="load-saved" data-id="${item.id}">불러오기</button><button class="danger-icon" data-action="delete-saved" data-id="${item.id}">${icon('trash')}</button></div></div>`; }).join('') : '<div class="empty-state large">저장된 도면이 없습니다.<br>상단의 ‘내 도면 저장’을 누르면 여기에 보관됩니다.</div>'}</div></div></div>`; }
function templateModal() {
  const list = state.templateCategory === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.category === state.templateCategory);
  return `<div class="modal-backdrop" data-action="close-templates"><div class="modal template-modal" data-modal-stop><div class="modal-header"><div><h2>기본 템플릿 라이브러리</h2><p>용도와 규모에 가까운 기준안을 불러온 뒤 벽·방·문·창문을 자유롭게 편집하세요.</p></div><button class="modal-close" data-action="close-templates">×</button></div><div class="template-tabs">${TEMPLATE_CATEGORIES.map(c=>`<button class="${state.templateCategory===c.id?'active':''}" data-action="template-category" data-category="${c.id}">${c.label}</button>`).join('')}</div><div class="template-note">평수 표기는 편집 시작을 위한 대표 규모입니다. 법정 전용·공급·대지·건축면적을 확정하는 표준도면이 아니며 실제 설계·인허가 시에는 관련 기준을 별도로 확인해야 합니다.</div><div class="template-grid">${list.map(templateCard).join('')}</div></div></div>`;
}
function templateCard(t) {
  const buildingArea=polygonArea(t.project.building?.points||[]), roomCount=t.project.rooms?.length||0;
  return `<article class="template-card"><div class="template-preview">${templatePreview(t)}</div><div class="template-card-body"><div class="template-card-kicker"><span>${TEMPLATE_CATEGORIES.find(c=>c.id===t.category)?.label||t.category}</span><b>${t.nominalPyeong}평급</b></div><h3>${esc(t.title)}</h3><p>${esc(t.summary)}</p><div class="template-meta"><span>${num(buildingArea)} m² 외곽</span><span>공간 ${roomCount}개</span><span>${t.project.scope==='site-building'?'대지+건물':'건물형'}</span></div><button class="primary-button template-load" data-action="load-template" data-template-id="${t.id}">이 템플릿 불러와 편집</button></div></article>`;
}
function templatePreview(t) {
  const groups=[t.project.site?.points,t.project.building?.points,...(t.project.rooms||[]).map(r=>r.points)].filter(Boolean), all=groups.flat(), b=bounds(all), w=220,h=126,pad=10;
  const scale=Math.min((w-pad*2)/Math.max(b.width,.1),(h-pad*2)/Math.max(b.height,.1));
  const tx=x=>pad+(x-b.minX)*scale, ty=y=>pad+(y-b.minY)*scale, pts=arr=>arr.map(p=>`${tx(p.x)},${ty(p.y)}`).join(' ');
  const site=t.project.site?`<polygon class="tp-site" points="${pts(t.project.site.points)}"></polygon>`:'';
  const building=t.project.building?`<polygon class="tp-building" points="${pts(t.project.building.points)}"></polygon>`:'';
  const rooms=(t.project.rooms||[]).map(r=>`<polygon class="tp-room" points="${pts(r.points)}"></polygon>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${site}${building}${rooms}</svg>`;
}
function projectFromTemplate(t) {
  const p=deepClone(t.project), now=new Date().toISOString();
  p.id=uid('project'); p.createdAt=now; p.updatedAt=now; p.templateSource={id:t.id,title:t.title,category:t.category};
  if(p.site)p.site.id=uid('boundary'); if(p.building)p.building.id=uid('boundary');
  p.rooms=(p.rooms||[]).map(room=>({...room,id:uid('room')}));
  p.elements=(p.elements||[]).map(item=>({...item,id:uid('el')}));
  return normalizeProject(p);
}


function persist() { state.project.updatedAt = new Date().toISOString(); state.project.frameConfig = deepClone(state.frameDraft); saveCurrent(state.project); }
function persistPrefs() { savePrefs({ unit:state.unit,gridSize:state.gridSize,showGrid:state.showGrid,showDimensions:state.showDimensions,showArea:state.showArea,theme:state.theme }); }
function notify(message,type='success') { state.toast={message,type}; render(); clearTimeout(notify.timer); notify.timer=setTimeout(()=>{state.toast=null;render();},2200); }
function snapshot() { state.history=[...state.history.slice(-39),deepClone(state.project)]; state.future=[]; }
function commit(fn,message) { snapshot(); state.project=normalizeProject(fn(deepClone(state.project))); state.frameDraft=deepClone(state.project.frameConfig); persist(); render(); if(message)notify(message); }
function commitQuiet(fn) { snapshot(); state.project=normalizeProject(fn(deepClone(state.project))); state.frameDraft=deepClone(state.project.frameConfig); persist(); setTimeout(()=>render(),0); }
function screenToModel(event) { const svg=document.querySelector('#drawing-svg'); const pt=svg.createSVGPoint(); pt.x=event.clientX;pt.y=event.clientY; const local=pt.matrixTransform(svg.getScreenCTM().inverse()); const scale=CANVAS.pxPerMeter*state.zoom; return {x:snap((local.x-CANVAS.originX)/scale,state.gridSize),y:snap((local.y-CANVAS.originY)/scale,state.gridSize)}; }

app.addEventListener('click', e => {
  const modal=e.target.closest('[data-modal-stop]'); if(modal)e.stopPropagation();
  const actionEl=e.target.closest('[data-action]'); if(!actionEl)return; const a=actionEl.dataset.action;
  if(a==='mode'){state.mode=actionEl.dataset.mode;state.draftPoints=[];state.rectStart=null;if(state.mode!=='wall-room')state.wallAnchor=null;render();}
  else if(a==='new'){snapshot();state.project=blankProject();state.frameDraft=deepClone(state.project.frameConfig);state.selected=null;state.setupOpen=true;persist();render();}
  else if(a==='set-scope'){state.frameDraft.scope=actionEl.dataset.scope;render();}
  else if(a==='apply-frame')applyFrame();
  else if(a==='use-example'){snapshot();state.project=seedProject();state.frameDraft=deepClone(state.project.frameConfig);state.selected=null;state.setupOpen=false;persist();fit();notify('건물 외곽이 포함된 예시 도면을 불러왔습니다.');}
  else if(a==='templates'){state.templateOpen=true;state.savedOpen=false;render();}
  else if(a==='open-templates-setup'){state.setupOpen=false;state.templateOpen=true;render();}
  else if(a==='close-templates'){state.templateOpen=false;if(!state.project.building)state.setupOpen=true;render();}
  else if(a==='template-category'){state.templateCategory=actionEl.dataset.category||'all';render();}
  else if(a==='load-template'){const t=TEMPLATES.find(x=>x.id===actionEl.dataset.templateId);if(t){snapshot();state.project=projectFromTemplate(t);state.frameDraft=deepClone(state.project.frameConfig);state.selected=null;state.templateOpen=false;state.setupOpen=false;persist();fit();notify(`${t.title} 템플릿을 불러왔습니다. 이제 자유롭게 편집할 수 있습니다.`);}}
  else if(a==='saved'){state.savedOpen=true;state.templateOpen=false;render();}
  else if(a==='close-saved'){state.savedOpen=false;render();}
  else if(a==='guide'){document.querySelector('#guide')?.scrollIntoView({behavior:'smooth'});}
  else if(a==='theme'){state.theme=state.theme==='light'?'dark':'light';document.documentElement.dataset.theme=state.theme;persistPrefs();render();}
  else if(a==='save')saveNamed(); else if(a==='undo')undo(); else if(a==='redo')redo();
  else if(a==='zoom-in'){state.zoom=zoomDelta(state.zoom,1);render();} else if(a==='zoom-out'){state.zoom=zoomDelta(state.zoom,-1);render();}
  else if(a==='fit')fit(); else if(a==='finish-polygon')finishPolygon(); else if(a==='add-quick')addQuick(); else if(a==='add-wall-room')addWallRoom();
  else if(a==='select-room'){state.selected={type:'room',id:actionEl.dataset.id};state.mode='select';render();}
  else if(a==='select-boundary'){state.selected={type:'boundary',kind:actionEl.dataset.kind};state.mode='select';render();}
  else if(a==='delete')deleteSelected(); else if(a==='load-saved')loadSavedProject(actionEl.dataset.id); else if(a==='delete-saved')deleteSavedProject(actionEl.dataset.id);
  else if(a==='export-json')exportJson(); else if(a==='export-svg')exportSvg(); else if(a==='export-png')exportPng(); else if(a==='print')window.print(); else if(a==='import-json')document.querySelector('#json-file')?.click();
});

app.addEventListener('change', e => {
  const setting=e.target.dataset.setting;
  if(setting){ if(['gridSize','doorPreset','windowPreset'].includes(setting))state[setting]=Number(e.target.value); else if(['showGrid','showDimensions','showArea'].includes(setting))state[setting]=e.target.checked; else state[setting]=e.target.value; persistPrefs(); render(); return; }
  if(e.target.dataset.frameConfig){ updateFrameDraft(e.target); if(e.target.tagName==='SELECT')render(); return; }
  if(e.target.id==='json-file')importJson(e.target.files?.[0]);
  if(e.target.id==='wall-room-side'){state.wallRoomSide=e.target.value;render();return;}
  if(e.target.dataset.roomVertexInput){const r=state.project.rooms.find(x=>x.id===state.selected?.id);if(!r)return;const idx=Number(e.target.dataset.index),axis=e.target.dataset.roomVertexInput,value=toMeters(e.target.value,state.unit);if(!Number.isFinite(value))return;commitQuiet(p=>({...p,rooms:p.rooms.map(x=>x.id===r.id?{...x,points:x.points.map((pt,i)=>i===idx?{...pt,[axis]:value}:pt)}:x)}));}
  if(e.target.dataset.boundaryVertexInput){const kind=e.target.dataset.kind,item=state.project[kind];if(!item)return;const idx=Number(e.target.dataset.index),axis=e.target.dataset.boundaryVertexInput,value=toMeters(e.target.value,state.unit);if(!Number.isFinite(value))return;commitQuiet(p=>({...p,[kind]:{...p[kind],shape:'custom',points:p[kind].points.map((pt,i)=>i===idx?{...pt,[axis]:value}:pt)}}));}
  if(e.target.dataset.elementField){const el=state.project.elements.find(x=>x.id===state.selected?.id);if(!el)return;const key=e.target.dataset.elementField;let value=key==='rotation'?Number(e.target.value):toMeters(e.target.value,state.unit);if(key==='width')value=Math.max(.1,value);commitQuiet(p=>({...p,elements:p.elements.map(x=>x.id===el.id?{...x,[key]:value}:x)}));}
});
app.addEventListener('input', e => {
  if(e.target.dataset.frameConfig){updateFrameDraft(e.target);return;}
  if(e.target.dataset.live==='project-name'){state.project.name=e.target.value;persist();}
  if(e.target.dataset.live==='project-description'){state.project.description=e.target.value;persist();}
  if(e.target.dataset.live==='room-name'){const r=state.project.rooms.find(x=>x.id===e.target.dataset.id);if(r){r.name=e.target.value;persist();}}
  if(e.target.dataset.live==='element-name'){const el=state.project.elements.find(x=>x.id===e.target.dataset.id);if(el){el.name=e.target.value;persist();}}
  if(e.target.dataset.live==='boundary-name'){const item=state.project[e.target.dataset.kind];if(item){item.name=e.target.value;persist();}}
});
function updateFrameDraft(target){const key=target.dataset.frameConfig;if(!key)return;if(key.endsWith('Shape'))state.frameDraft[key]=target.value;else state.frameDraft[key]=toMeters(target.value,state.unit);}

app.addEventListener('wheel', e => {
  const svg=e.target.closest?.('#drawing-svg');
  if(!svg)return;
  e.preventDefault();
  state.zoom=zoomDelta(state.zoom,e.deltaY<0?1:-1);
  render();
},{passive:false});

app.addEventListener('pointerdown', e => {
  const svg=e.target.closest('#drawing-svg'); if(!svg)return; const model=screenToModel(e);state.pointer=model;
  const wallHit=e.target.closest('[data-wall-key]');
  if(wallHit&&state.mode==='wall-room'){state.wallAnchor=wallHit.dataset.wallKey;render();return;}
  const bvh=e.target.closest('[data-vertex-boundary]'); if(bvh&&state.mode==='select'){e.stopPropagation();const kind=bvh.dataset.vertexBoundary,item=state.project[kind];state.selected={type:'boundary',kind};state.drag={type:'boundary-vertex',kind,index:Number(bvh.dataset.vertexIndex),start:model,original:deepClone(item.points),snapshot:deepClone(state.project)};return;}
  const vh=e.target.closest('[data-vertex-room]'); if(vh&&state.mode==='select'){e.stopPropagation();const r=state.project.rooms.find(x=>x.id===vh.dataset.vertexRoom);state.selected={type:'room',id:r.id};state.drag={type:'room-vertex',id:r.id,index:Number(vh.dataset.vertexIndex),start:model,original:deepClone(r.points),snapshot:deepClone(state.project)};return;}
  const roomEl=e.target.closest('[data-room-id]'); if(roomEl&&state.mode==='select'){e.stopPropagation();const r=state.project.rooms.find(x=>x.id===roomEl.dataset.roomId);state.selected={type:'room',id:r.id};state.drag={type:'room',id:r.id,start:model,original:deepClone(r.points),snapshot:deepClone(state.project)};render();return;}
  const elemEl=e.target.closest('[data-element-id]'); if(elemEl&&state.mode==='select'){e.stopPropagation();const el=state.project.elements.find(x=>x.id===elemEl.dataset.elementId);state.selected={type:'element',id:el.id};state.drag={type:'element',id:el.id,start:model,original:{x:el.x,y:el.y},snapshot:deepClone(state.project)};render();return;}
  const boundaryEl=e.target.closest('[data-boundary-kind]'); if(boundaryEl&&state.mode==='select'){e.stopPropagation();const kind=boundaryEl.dataset.boundaryKind,item=state.project[kind];state.selected={type:'boundary',kind};state.drag={type:'boundary',kind,start:model,original:deepClone(item.points),snapshot:deepClone(state.project)};render();return;}
  if(state.mode==='select'){state.selected=null;render();return;}
  if(state.mode==='polygon'){if(state.draftPoints.length>=3&&distance(model,state.draftPoints[0])<=state.gridSize*1.2)finishPolygon();else{state.draftPoints.push(model);render();}return;}
  if(state.mode==='rectangle'){state.rectStart=model;render();return;}
  if(state.mode==='door'||state.mode==='sliding'||state.mode==='window'){const hit=nearestWall(model);if(!hit){notify('문·창문은 벽 가까이를 클릭해주세요. 벽에 자동으로 스냅됩니다.','error');return;}const type=state.mode,width=type==='window'?state.windowPreset:state.doorPreset,el=element(type,hit.point.x,hit.point.y,width,wallAngle(hit.wall)),label=type==='window'?'창문':type==='sliding'?'미닫이문':'여닫이문';el.wallRef={key:hit.wall.key,t:hit.t};commit(p=>({...p,elements:[...p.elements,el]}),`${label}을 벽에 배치했습니다.`);state.selected={type:'element',id:el.id};state.mode='select';render();}
});
window.addEventListener('pointermove', e => {
  if(!document.querySelector('#drawing-svg')||(!state.drag&&!state.rectStart&&!state.draftPoints.length))return; const model=screenToModel(e);state.pointer=model;
  if(state.drag){const d=state.drag,dx=model.x-d.start.x,dy=model.y-d.start.y;if(d.type==='room'){const r=state.project.rooms.find(x=>x.id===d.id);r.points=d.original.map(p=>({x:snap(p.x+dx,state.gridSize),y:snap(p.y+dy,state.gridSize)}));}else if(d.type==='room-vertex'){const r=state.project.rooms.find(x=>x.id===d.id);r.points=r.points.map((p,i)=>i===d.index?model:p);}else if(d.type==='boundary'){const item=state.project[d.kind];item.points=d.original.map(p=>({x:snap(p.x+dx,state.gridSize),y:snap(p.y+dy,state.gridSize)}));item.shape='custom';}else if(d.type==='boundary-vertex'){const item=state.project[d.kind];item.points=item.points.map((p,i)=>i===d.index?model:p);item.shape='custom';}else{const el=state.project.elements.find(x=>x.id===d.id);const raw={x:snap(d.original.x+dx,state.gridSize),y:snap(d.original.y+dy,state.gridSize)},hit=nearestWall(raw);if(hit){el.x=hit.point.x;el.y=hit.point.y;el.rotation=wallAngle(hit.wall);el.wallRef={key:hit.wall.key,t:hit.t};}else{el.x=raw.x;el.y=raw.y;delete el.wallRef;}}persist();}
  render();
});
window.addEventListener('pointerup', e => {
  if(state.mode==='rectangle'&&state.rectStart&&document.querySelector('#drawing-svg')){const end=screenToModel(e),a=state.rectStart;state.rectStart=null;const minX=Math.min(a.x,end.x),minY=Math.min(a.y,end.y),maxX=Math.max(a.x,end.x),maxY=Math.max(a.y,end.y);if(maxX-minX>=state.gridSize&&maxY-minY>=state.gridSize){const r={id:uid('room'),name:`공간 ${state.project.rooms.length+1}`,points:[{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}]};if(state.project.building&&!polygonContainsPolygon(state.project.building.points,r.points)){notify('실내 공간은 건물 외곽 안에 그려주세요.','error');}else{commit(p=>({...p,rooms:[...p.rooms,r]}),'사각형 공간을 추가했습니다.');state.selected={type:'room',id:r.id};}}state.mode='select';render();}
  if(state.drag){const invalidSite=state.project.site&&state.project.building&&!polygonContainsPolygon(state.project.site.points,state.project.building.points);const draggedRoom=state.drag.type==='room'||state.drag.type==='room-vertex'?state.project.rooms.find(r=>r.id===state.drag.id):null;const invalidRoom=draggedRoom&&state.project.building&&!polygonContainsPolygon(state.project.building.points,draggedRoom.points);if(invalidSite||invalidRoom){state.project=normalizeProject(state.drag.snapshot);state.frameDraft=deepClone(state.project.frameConfig);state.drag=null;persist();render();notify(invalidSite?'건물 외곽은 대지 안에 위치해야 합니다.':'실내 공간은 건물 외곽 안에 위치해야 합니다.','error');return;}state.history=[...state.history.slice(-39),state.drag.snapshot];state.future=[];state.drag=null;persist();render();}
});
app.addEventListener('dblclick', e => { if(e.target.closest('#drawing-svg')&&state.mode==='polygon')finishPolygon(); });
window.addEventListener('keydown', e => {const tag=document.activeElement?.tagName?.toLowerCase(),editing=['input','textarea','select'].includes(tag);if((e.key==='Delete'||e.key==='Backspace')&&state.selected&&!editing){e.preventDefault();deleteSelected();}if(e.key==='Escape'){state.draftPoints=[];state.rectStart=null;state.wallAnchor=null;state.mode='select';render();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveNamed();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undo();}if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){e.preventDefault();redo();}});

function validateFrame(prefix) { const cfg=state.frameDraft,w=cfg[`${prefix}Width`],d=cfg[`${prefix}Depth`],shape=cfg[`${prefix}Shape`]; if(!Number.isFinite(w)||!Number.isFinite(d)||w<=0||d<=0||w>500||d>500)return `${prefix==='site'?'대지':'건물'} 전체 가로·세로를 올바르게 입력해주세요.`; if(shape==='l'&&(!(cfg[`${prefix}CutWidth`]>0&&cfg[`${prefix}CutWidth`]<w)||!(cfg[`${prefix}CutDepth`]>0&&cfg[`${prefix}CutDepth`]<d)))return 'ㄱ자형의 파인 폭·깊이는 전체 규격보다 작아야 합니다.'; if(shape==='u'&&(!(cfg[`${prefix}NotchWidth`]>0&&cfg[`${prefix}NotchWidth`]<w)||!(cfg[`${prefix}NotchDepth`]>0&&cfg[`${prefix}NotchDepth`]<d)))return 'ㄷ자형의 중앙 홈 폭·깊이는 전체 규격보다 작아야 합니다.'; if(shape==='trapezoid'&&!(cfg[`${prefix}TopWidth`]>0&&cfg[`${prefix}TopWidth`]<=w))return '사다리꼴 윗변 폭은 전체 가로보다 작거나 같아야 합니다.'; return ''; }
function applyFrame() { const cfg=deepClone(state.frameDraft),buildingErr=validateFrame('building'),siteErr=cfg.scope==='site-building'?validateFrame('site'):'';if(buildingErr||siteErr){notify(buildingErr||siteErr,'error');return;}const ox=cfg.scope==='site-building'?cfg.buildingOffsetX:0,oy=cfg.scope==='site-building'?cfg.buildingOffsetY:0;if(cfg.scope==='site-building'&&(!Number.isFinite(ox)||!Number.isFinite(oy))){notify('건물 위치 여백을 올바르게 입력해주세요.','error');return;}const nextSite=cfg.scope==='site-building'?boundary('대지 외곽',cfg.siteShape,shapePoints(cfg.siteShape,cfg,'site')):null;const nextBuilding=boundary('건물 외곽',cfg.buildingShape,shapePoints(cfg.buildingShape,cfg,'building',{x:ox,y:oy}));if(nextSite&&!polygonContainsPolygon(nextSite.points,nextBuilding.points)){notify('입력한 건물 외곽이 대지 경계를 벗어납니다. 건물 크기나 위치 여백을 조정해주세요.','error');return;}snapshot();state.project.scope=cfg.scope;state.project.frameConfig=deepClone(cfg);state.project.site=nextSite;state.project.building=nextBuilding;state.frameDraft=deepClone(cfg);state.selected={type:'boundary',kind:'building'};state.setupOpen=false;persist();fit();notify(cfg.scope==='site-building'?'대지·마당·건물 외부 틀을 생성했습니다.':'건물 외부 틀을 생성했습니다.'); }
function addQuick() { const name=document.querySelector('#quick-name')?.value.trim()||'새 공간',w=toMeters(document.querySelector('#quick-width')?.value,state.unit),h=toMeters(document.querySelector('#quick-height')?.value,state.unit);if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||w>200||h>200){notify('가로·세로 치수를 올바르게 입력해주세요.','error');return;}const base=state.project.building?.points||state.project.rooms.flatMap(r=>r.points),b=bounds(base),x=b.minX+.5,y=b.minY+.5,r={id:uid('room'),name,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]};if(state.project.building&&!polygonContainsPolygon(state.project.building.points,r.points)){notify('입력한 공간 크기가 건물 외곽을 벗어납니다. 더 작은 규격을 입력하거나 직접 위치를 그려주세요.','error');return;}commit(p=>({...p,rooms:[...p.rooms,r]}),'치수 입력 공간을 추가했습니다.');state.selected={type:'room',id:r.id};render(); }
function addWallRoom(){
  const wall=wallByKey(state.wallAnchor);if(!wall){notify('기준 벽을 먼저 선택해주세요.','error');return;}
  const name=document.querySelector('#wall-room-name')?.value.trim()||'새 공간';
  const lengthValue=toMeters(document.querySelector('#wall-room-length')?.value,state.unit),depthValue=toMeters(document.querySelector('#wall-room-depth')?.value,state.unit),offsetValue=toMeters(document.querySelector('#wall-room-offset')?.value,state.unit);
  const side=document.querySelector('#wall-room-side')?.value||state.wallRoomSide||'auto';state.wallRoomSide=side;
  if(!Number.isFinite(lengthValue)||!Number.isFinite(depthValue)||!Number.isFinite(offsetValue)||lengthValue<=0||depthValue<=0||offsetValue<0){notify('벽 기준 방 치수를 올바르게 입력해주세요.','error');return;}
  if(lengthValue>wall.length+.0001||offsetValue+lengthValue>wall.length+.0001){notify(`선택 벽 길이(${formatLength(wall.length,state.unit,true)}) 안에서 시작 거리 + 방 길이를 지정해주세요.`,'error');return;}
  let pts=side==='auto'?chooseAutoWallRoom(wall,lengthValue,depthValue,offsetValue):wallRoomCandidate(wall,lengthValue,depthValue,offsetValue,side);
  if(!pts){notify('선택 벽의 어느 쪽으로도 입력 크기의 방을 건물 안에 만들 수 없습니다. 깊이나 길이를 줄여주세요.','error');return;}
  if(state.project.building&&!polygonContainsPolygon(state.project.building.points,pts)){notify('생성되는 공간이 건물 외곽을 벗어납니다. 방향 또는 치수를 조정해주세요.','error');return;}
  const r={id:uid('room'),name,points:pts,wallSource:{key:wall.key,offset:offsetValue,length:lengthValue,depth:depthValue,side}};
  commit(p=>({...p,rooms:[...p.rooms,r]}),'선택한 벽을 기준으로 공간을 생성했습니다.');state.selected={type:'room',id:r.id};state.wallAnchor=null;state.mode='select';render();
}

function finishPolygon() { if(state.draftPoints.length<3)return;const r={id:uid('room'),name:`공간 ${state.project.rooms.length+1}`,points:deepClone(state.draftPoints)};state.draftPoints=[];if(state.project.building&&!polygonContainsPolygon(state.project.building.points,r.points)){state.mode='select';render();notify('실내 다각형은 건물 외곽 안에 그려주세요.','error');return;}commit(p=>({...p,rooms:[...p.rooms,r]}),'다각형 공간을 추가했습니다.');state.selected={type:'room',id:r.id};state.mode='select';render(); }
function deleteSelected() { if(!state.selected)return;if(state.selected.type==='boundary'){notify('외부 틀은 삭제 대신 왼쪽 외곽 설정에서 다시 생성해주세요.','error');return;}const s=state.selected;commit(p=>s.type==='room'?({...p,rooms:p.rooms.filter(r=>r.id!==s.id)}):({...p,elements:p.elements.filter(el=>el.id!==s.id)}),s.type==='room'?'공간을 삭제했습니다.':'요소를 삭제했습니다.');state.selected=null;render(); }
function undo() { if(!state.history.length)return;state.future=[deepClone(state.project),...state.future].slice(0,40);state.project=normalizeProject(state.history.pop());state.frameDraft=deepClone(state.project.frameConfig);state.selected=null;persist();render(); }
function redo() { if(!state.future.length)return;state.history=[...state.history,deepClone(state.project)].slice(-40);state.project=normalizeProject(state.future.shift());state.frameDraft=deepClone(state.project.frameConfig);state.selected=null;persist();render(); }
function allDrawingPoints() { return [state.project.site?.points,state.project.building?.points,...state.project.rooms.map(r=>r.points)].filter(Boolean).flat(); }
function fit() { const all=allDrawingPoints();if(!all.length){state.zoom=1;render();return;}const b=bounds(all),fitValue=Math.min((CANVAS.width-160)/Math.max(b.width*CANVAS.pxPerMeter,1),(CANVAS.height-150)/Math.max(b.height*CANVAS.pxPerMeter,1));state.zoom=Math.min(1.7,clampZoom(fitValue));render(); }
function saveNamed() { const list=loadProjects(),snap={...deepClone(state.project),updatedAt:new Date().toISOString()};saveProjects([snap,...list.filter(x=>x.id!==snap.id)].slice(0,30));state.project=snap;persist();notify('브라우저에 도면을 저장했습니다.'); }
function loadSavedProject(id) { const item=loadProjects().find(x=>x.id===id);if(!item)return;snapshot();state.project=normalizeProject(item);state.frameDraft=deepClone(state.project.frameConfig);state.selected=null;state.savedOpen=false;persist();fit();notify('저장된 도면을 불러왔습니다.'); }
function deleteSavedProject(id) { saveProjects(loadProjects().filter(x=>x.id!==id));render(); }
function exportJson() { downloadBlob(new Blob([JSON.stringify({version:2,project:state.project},null,2)],{type:'application/json'}),`${safeName(state.project.name)}.json`); }
function importJson(file) { if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result),incoming=parsed.project||parsed;if(!Array.isArray(incoming.rooms)||!Array.isArray(incoming.elements))throw new Error();snapshot();state.project=normalizeProject({...incoming,id:incoming.id||uid('project'),updatedAt:new Date().toISOString()});state.frameDraft=deepClone(state.project.frameConfig);state.selected=null;persist();fit();notify('JSON 도면을 불러왔습니다.');}catch{notify('올바른 도면 JSON 파일이 아닙니다.','error');}};reader.readAsText(file); }
function exportSvg() { downloadBlob(new Blob([buildExportSvg()],{type:'image/svg+xml'}),`${safeName(state.project.name)}.svg`); }
function exportPng() { const svg=buildExportSvg(),blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(png=>{if(png)downloadBlob(png,`${safeName(state.project.name)}.png`);URL.revokeObjectURL(url);},'image/png');};img.src=url; }
function buildExportSvg() { const all=allDrawingPoints(),b=bounds(all),pad=1.2,px=110,width=Math.max(6,b.width+pad*2)*px,height=Math.max(4,b.height+pad*2)*px,tx=x=>(x-b.minX+pad)*px,ty=y=>(y-b.minY+pad)*px,m=metrics();const boundarySvg=['site','building'].map(kind=>{const item=state.project[kind];if(!item)return'';const pts=item.points.map(p=>`${tx(p.x)},${ty(p.y)}`).join(' '),c=polygonCentroid(item.points);return `<g><polygon points="${pts}" fill="${kind==='site'?'#eef7ed':'#f7f9fc'}" stroke="${kind==='site'?'#5d8260':'#172033'}" stroke-width="${kind==='site'?5:11}"/><text x="${tx(c.x)}" y="${ty(c.y)}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="16" fill="${kind==='site'?'#466a49':'#172033'}">${kind==='site'?'대지':'건물 외곽'}</text></g>`;}).join('');const rooms=state.project.rooms.map(r=>{const area=polygonArea(r.points),c=polygonCentroid(r.points),pts=r.points.map(p=>`${tx(p.x)},${ty(p.y)}`).join(' ');return `<g><polygon points="${pts}" fill="#fbf7ef" stroke="#3b4654" stroke-width="6"/><text x="${tx(c.x)}" y="${ty(c.y)}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="18">${esc(r.name)}</text>${state.showArea?`<text x="${tx(c.x)}" y="${ty(c.y)+22}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#374151">${num(area)} m² · ${num(area/PYEONG_M2)}평</text>`:''}</g>`;}).join('');const els=state.project.elements.map(el=>{const x=tx(el.x),y=ty(el.y),w=el.width*px;if(el.type==='window')return `<g transform="translate(${x} ${y}) rotate(${el.rotation||0})" stroke="#1370e8" stroke-width="5"><line x1="${-w/2}" y1="-6" x2="${w/2}" y2="-6"/><line x1="${-w/2}" y1="6" x2="${w/2}" y2="6"/><line x1="${-w/2}" y1="-12" x2="${-w/2}" y2="12"/><line x1="${w/2}" y1="-12" x2="${w/2}" y2="12"/></g>`;if(el.type==='sliding')return `<g transform="translate(${x} ${y}) rotate(${el.rotation||0})" stroke="#29313d" stroke-width="4"><line x1="${-w/2}" y1="-6" x2="${w/4}" y2="-6"/><line x1="${-w/4}" y1="6" x2="${w/2}" y2="6"/><line x1="${-w/2}" y1="-12" x2="${-w/2}" y2="12"/><line x1="${w/2}" y1="-12" x2="${w/2}" y2="12"/></g>`;return `<g transform="translate(${x} ${y}) rotate(${el.rotation||0})" fill="none" stroke="#29313d" stroke-width="4"><line x1="0" y1="0" x2="0" y2="${-w}"/><path d="M 0 ${-w} A ${w} ${w} 0 0 1 ${w} 0"/><line x1="0" y1="0" x2="${w}" y2="0"/></g>`;}).join('');const summary=state.project.site?`대지 ${num(m.siteArea)} m² · 건물 ${num(m.buildingArea)} m² · 마당 ${num(m.yardArea)} m²`:`건물 ${num(m.buildingArea)} m² · ${num(m.buildingPyeong)}평`;return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height+95)}" viewBox="0 0 ${width} ${height+95}"><rect width="100%" height="100%" fill="#fff"/><text x="40" y="42" font-family="Arial,sans-serif" font-weight="700" font-size="25">${esc(state.project.name)}</text><text x="40" y="70" font-family="Arial,sans-serif" font-size="15" fill="#5f6b7a">${summary}</text><g transform="translate(0 90)">${boundarySvg}${rooms}${els}</g></svg>`; }
function safeName(name) { return (name||'floorplan').replace(/[\\/:*?"<>|]/g,'-').trim()||'floorplan'; }
function downloadBlob(blob,name) { const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }

render();

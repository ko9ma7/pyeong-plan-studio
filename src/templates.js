const r = (name,x,y,w,h) => ({ name, points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}] });
const e = (type,x,y,width=.9,rotation=0,name='') => ({ type,x,y,width,rotation,name:name || (type==='window'?'창문':type==='sliding'?'미닫이문':'여닫이문') });
const rect = (name,w,d,x=0,y=0) => ({ name, shape:'rectangle', points:[{x,y},{x:x+w,y},{x:x+w,y:y+d},{x,y:y+d}] });
const frame = ({scope='building',bw,bd,sw=20,sd=15,ox=0,oy=0}) => ({
  scope, siteShape:'rectangle', siteWidth:sw, siteDepth:sd, siteCutWidth:5, siteCutDepth:4, siteNotchWidth:6, siteNotchDepth:5, siteTopWidth:sw,
  buildingShape:'rectangle', buildingWidth:bw, buildingDepth:bd, buildingCutWidth:3, buildingCutDepth:2.5, buildingNotchWidth:3, buildingNotchDepth:3, buildingTopWidth:bw,
  buildingOffsetX:ox, buildingOffsetY:oy,
});
const make = ({id,category,title,nominalPyeong,summary,bw,bd,rooms,elements=[],scope='building',site=null,tags=[]}) => {
  const siteCfg = site || {};
  const cfg = frame({scope,bw,bd,sw:siteCfg.w||20,sd:siteCfg.d||15,ox:siteCfg.ox||0,oy:siteCfg.oy||0});
  const bx = scope==='site-building' ? cfg.buildingOffsetX : 0;
  const by = scope==='site-building' ? cfg.buildingOffsetY : 0;
  return {
    id, category, title, nominalPyeong, summary, tags,
    project:{
      name:title, description:`기본 템플릿 · ${summary}`,
      scope, frameConfig:cfg,
      site:scope==='site-building'?rect('대지 외곽',cfg.siteWidth,cfg.siteDepth):null,
      building:rect('건물 외곽',bw,bd,bx,by),
      rooms:rooms.map(room => r(room[0],room[1]+bx,room[2]+by,room[3],room[4])),
      elements:elements.map(item => e(item[0],item[1]+bx,item[2]+by,item[3],item[4],item[5])),
    }
  };
};

export const TEMPLATE_CATEGORIES = [
  {id:'all',label:'전체'}, {id:'apartment',label:'아파트'}, {id:'house',label:'주택'}, {id:'factory',label:'공장'}, {id:'office',label:'사무실'}
];

export const TEMPLATES = [
  make({id:'apt-18',category:'apartment',title:'아파트 18평형 · 2룸',nominalPyeong:18,summary:'소형 2룸 + 거실·주방 중심',bw:8.5,bd:7,
    rooms:[['안방',0,0,3,3.5],['방 2',3,0,2.5,3.5],['욕실',5.5,0,1.5,2],['현관',7,0,1.5,2],['다용도',5.5,2,3,1.5],['거실',0,3.5,5.5,3.5],['주방·식당',5.5,3.5,3,3.5]],
    elements:[['window',1.5,0,1.5,0],['window',4.2,0,1.2,0],['window',2.5,7,2.1,0],['door',3,3.1,.8,90],['door',5.5,1.2,.8,0],['door',7,1,.9,0]]}),
  make({id:'apt-24',category:'apartment',title:'아파트 24평형 · 3룸',nominalPyeong:24,summary:'방 3개 + 거실 + 독립 주방',bw:9.9,bd:8,
    rooms:[['안방',0,0,3.3,3.2],['방 2',3.3,0,3.3,3.2],['방 3',6.6,0,3.3,3.2],['거실',0,3.2,6.6,4.8],['주방·식당',6.6,3.2,3.3,3],['욕실',6.6,6.2,1.65,1.8],['현관',8.25,6.2,1.65,1.8]],
    elements:[['window',1.6,0,1.5,0],['window',4.9,0,1.5,0],['window',8.2,0,1.5,0],['window',3,8,2.4,0],['door',3.3,2.3,.9,90],['door',6.6,2.3,.9,90],['door',6.6,6.9,.8,0],['door',8.25,7,.9,0]]}),
  make({id:'apt-32',category:'apartment',title:'아파트 32평형 · 3룸',nominalPyeong:32,summary:'국민형 3룸 + 넓은 거실·주방',bw:11.5,bd:9.2,
    rooms:[['안방',0,0,3.5,3.4],['방 2',3.5,0,3,3.4],['방 3',6.5,0,3,3.4],['욕실 1',9.5,0,2,1.7],['드레스룸',9.5,1.7,2,1.7],['거실',0,3.4,7.3,5.8],['주방·식당',7.3,3.4,4.2,3.7],['욕실 2',7.3,7.1,2,2.1],['현관',9.3,7.1,2.2,2.1]],
    elements:[['window',1.8,0,1.8,0],['window',5,0,1.4,0],['window',8,0,1.4,0],['window',3.4,9.2,2.8,0],['window',9.5,3.4,1.8,0],['door',3.5,2.5,.9,90],['door',6.5,2.5,.9,90],['door',9.5,1,.8,0],['door',7.3,7.9,.8,0],['door',9.3,8,.9,0]]}),
  make({id:'apt-42',category:'apartment',title:'아파트 42평형 · 4룸',nominalPyeong:42,summary:'4룸 + 팬트리·드레스룸 포함',bw:13.2,bd:10.5,
    rooms:[['안방',0,0,4,3.8],['방 2',4,0,3,3.8],['방 3',7,0,3,3.8],['방 4',10,0,3.2,3.8],['거실',0,3.8,8,6.7],['주방·식당',8,3.8,5.2,4.2],['드레스룸',8,8,2,2.5],['욕실 1',10,8,1.6,2.5],['욕실 2',11.6,8,1.6,1.4],['현관·팬트리',11.6,9.4,1.6,1.1]],
    elements:[['window',2,0,2,0],['window',5.5,0,1.5,0],['window',8.5,0,1.5,0],['window',11.6,0,1.5,0],['window',4,10.5,3,0],['window',10.4,3.8,2,0],['door',4,2.8,.9,90],['door',7,2.8,.9,90],['door',10,2.8,.9,90],['door',10,8.8,.8,0],['door',11.6,8.7,.8,0]]}),

  make({id:'house-20',category:'house',title:'단독주택 20평 · 2룸',nominalPyeong:20,summary:'작은 마당을 둔 소형 단독주택',bw:9.45,bd:7,scope:'site-building',site:{w:15,d:12,ox:2.5,oy:2.5},
    rooms:[['거실',0,0,5.5,4],['주방·식당',5.5,0,3.95,4],['안방',0,4,3.6,3],['방 2',3.6,4,3.1,3],['욕실',6.7,4,1.35,1.8],['현관·수납',8.05,4,1.4,3]],
    elements:[['window',2.5,0,2.4,0],['window',7.5,0,1.8,0],['window',1.8,7,1.5,0],['window',5,7,1.2,0],['door',8.7,7,.95,0],['door',3.6,5.8,.85,90],['door',6.7,4.8,.8,0]]}),
  make({id:'house-30',category:'house',title:'단독주택 30평 · 3룸',nominalPyeong:30,summary:'3룸 + 거실·주방 + 다용도실',bw:11,bd:9,scope:'site-building',site:{w:18,d:15,ox:3.5,oy:3},
    rooms:[['거실',0,0,6.5,5],['주방·식당',6.5,0,4.5,5],['안방',0,5,3.8,4],['방 2',3.8,5,3.2,4],['방 3',7,5,2.4,4],['욕실',9.4,5,1.6,2],['현관·수납',9.4,7,1.6,2]],
    elements:[['window',3,0,2.6,0],['window',8.7,0,2,0],['window',1.8,9,1.6,0],['window',5.4,9,1.4,0],['window',8.2,9,1.2,0],['door',10.2,9,1,0],['door',3.8,6.5,.85,90],['door',7,6.5,.85,90]]}),
  make({id:'house-40',category:'house',title:'단독주택 40평 · 4룸',nominalPyeong:40,summary:'4룸 + 서재·팬트리 구성',bw:12.5,bd:10.6,scope:'site-building',site:{w:21,d:17,ox:4,oy:3},
    rooms:[['거실',0,0,7.2,5.6],['주방·식당',7.2,0,5.3,5.6],['안방',0,5.6,3.8,5],['방 2',3.8,5.6,3,3],['방 3',6.8,5.6,2.8,3],['방 4·서재',3.8,8.6,3,2],['욕실 1',9.6,5.6,1.45,2.5],['욕실 2',11.05,5.6,1.45,2.5],['현관·팬트리',9.6,8.1,2.9,2.5]],
    elements:[['window',3.2,0,2.8,0],['window',9.5,0,2.3,0],['window',1.8,10.6,1.8,0],['window',5.3,10.6,1.4,0],['window',8.2,8.6,1.3,0],['door',11,10.6,1.1,0],['door',3.8,7.3,.9,90],['door',6.8,7.2,.9,90]]}),
  make({id:'house-50',category:'house',title:'단독주택 50평 · 4룸+',nominalPyeong:50,summary:'넓은 거실 + 4룸 + 취미실·다용도',bw:15,bd:11,scope:'site-building',site:{w:24,d:19,ox:4.5,oy:4},
    rooms:[['거실',0,0,8.5,6],['주방·식당',8.5,0,6.5,6],['안방',0,6,4.2,5],['방 2',4.2,6,3.2,3],['방 3',7.4,6,3.2,3],['방 4',10.6,6,2.8,3],['취미실',4.2,9,4,2],['욕실 1',8.2,9,1.8,2],['욕실 2',10,9,1.8,2],['현관·수납',11.8,9,3.2,2]],
    elements:[['window',4,0,3.2,0],['window',11.5,0,2.8,0],['window',2,11,2,0],['window',5.8,11,1.8,0],['window',9,11,1.4,0],['door',13.4,11,1.1,0],['door',4.2,7.5,.9,90],['door',7.4,7.5,.9,90],['door',10.6,7.5,.9,90]]}),

  make({id:'factory-100',category:'factory',title:'공장 100평 · 소형 제조',nominalPyeong:100,summary:'생산 + 원자재 + 사무 + 상하차',bw:22,bd:15,scope:'site-building',site:{w:32,d:24,ox:5,oy:4},
    rooms:[['생산구역',0,0,14,11],['원자재 창고',14,0,8,7],['완제품 창고',14,7,8,4],['사무실',0,11,6,4],['휴게실',6,11,4,4],['화장실',10,11,2,4],['상하차·출입',12,11,10,4]],
    elements:[['sliding',18,15,3,0],['door',1,15,1,0],['door',6,13,.9,90],['window',3,15,2,0],['window',8,15,1.5,0]]}),
  make({id:'factory-200',category:'factory',title:'공장 200평 · 제조+창고',nominalPyeong:200,summary:'생산라인과 물류창고를 분리한 중소형',bw:33,bd:20,scope:'site-building',site:{w:46,d:32,ox:6,oy:6},
    rooms:[['생산 1',0,0,15,14],['생산 2',15,0,10,14],['원자재 창고',25,0,8,9],['완제품 창고',25,9,8,5],['사무·품질',0,14,8,6],['회의·휴게',8,14,7,6],['설비·전기',15,14,5,6],['화장실',20,14,3,6],['상하차장',23,14,10,6]],
    elements:[['sliding',28,20,4,0],['sliding',18,20,3,0],['door',2,20,1,0],['window',5,20,2.4,0],['window',11,20,2.4,0]]}),
  make({id:'factory-300',category:'factory',title:'공장 300평 · 중형 생산',nominalPyeong:300,summary:'2개 생산존 + 대형 창고 + 관리동',bw:40,bd:24.8,scope:'site-building',site:{w:56,d:39,ox:8,oy:7},
    rooms:[['생산 A',0,0,18,17],['생산 B',18,0,14,17],['원자재 창고',32,0,8,9],['완제품 창고',32,9,8,8],['관리사무',0,17,9,7.8],['회의·교육',9,17,7,7.8],['휴게·식당',16,17,7,7.8],['설비실',23,17,5,7.8],['화장실',28,17,4,7.8],['상하차·물류',32,17,8,7.8]],
    elements:[['sliding',36,24.8,4.5,0],['sliding',25,24.8,3.5,0],['door',2,24.8,1,0],['window',5,24.8,2.5,0],['window',12,24.8,2,0]]}),
  make({id:'factory-500',category:'factory',title:'공장 500평 · 대형 생산물류',nominalPyeong:500,summary:'생산·조립·검사·창고·관리 기능 분리',bw:55,bd:30,scope:'site-building',site:{w:74,d:48,ox:9,oy:8},
    rooms:[['주 생산',0,0,25,21],['조립·검사',25,0,15,21],['원자재 창고',40,0,15,10],['완제품 창고',40,10,15,11],['관리사무',0,21,10,9],['회의·교육',10,21,8,9],['식당·휴게',18,21,9,9],['설비실',27,21,6,9],['화장실·탈의',33,21,7,9],['상하차·물류',40,21,15,9]],
    elements:[['sliding',48,30,5,0],['sliding',35,30,4,0],['sliding',20,30,4,0],['door',2,30,1,0],['window',6,30,2.5,0],['window',14,30,2.5,0]]}),

  make({id:'office-20',category:'office',title:'사무실 20평 · 8~12석',nominalPyeong:20,summary:'소형 오픈오피스 + 회의실',bw:9.45,bd:7,
    rooms:[['오픈오피스',0,0,6.2,5],['회의실',6.2,0,3.25,3],['대표실',6.2,3,3.25,2],['리셉션·대기',0,5,3.2,2],['탕비·복합기',3.2,5,2.2,2],['창고·서버',5.4,5,1.7,2],['출입·복도',7.1,5,2.35,2]],
    elements:[['window',2.5,0,2.4,0],['window',7.8,0,1.5,0],['door',8.3,7,1,0],['door',6.2,1.5,.9,90],['sliding',3.2,5.8,1.2,90]]}),
  make({id:'office-40',category:'office',title:'사무실 40평 · 20~28석',nominalPyeong:40,summary:'오픈오피스 + 회의실 2개 + 임원실',bw:12.5,bd:10.6,
    rooms:[['오픈오피스',0,0,8,7],['대회의실',8,0,4.5,3.5],['소회의실',8,3.5,4.5,2.7],['대표·임원실',8,6.2,4.5,2.4],['리셉션',0,7,3,3.6],['탕비·라운지',3,7,3.5,3.6],['서버·창고',6.5,7,1.5,3.6],['출입·복도',8,8.6,4.5,2]],
    elements:[['window',3.5,0,3,0],['window',10.2,0,2,0],['door',10.5,10.6,1,0],['door',8,2,.9,90],['door',8,4.8,.9,90],['sliding',3,8.2,1.4,90]]}),
  make({id:'office-80',category:'office',title:'사무실 80평 · 45~60석',nominalPyeong:80,summary:'부서형 오피스 + 다수 회의실·라운지',bw:18,bd:14.7,
    rooms:[['업무존 A',0,0,9,8],['업무존 B',9,0,9,8],['대회의실',0,8,5,3.5],['소회의실 1',5,8,3,3.5],['소회의실 2',8,8,3,3.5],['임원실',11,8,3.5,3.5],['라운지·탕비',14.5,8,3.5,3.5],['리셉션',0,11.5,5,3.2],['서버·창고',5,11.5,3,3.2],['복합기·자료',8,11.5,3,3.2],['출입·복도',11,11.5,7,3.2]],
    elements:[['window',4,0,3,0],['window',13,0,3,0],['door',15,14.7,1.2,0],['door',5,9.5,.9,90],['door',8,9.5,.9,90],['door',11,9.5,.9,90]]}),
  make({id:'office-150',category:'office',title:'사무실 150평 · 90~120석',nominalPyeong:150,summary:'대형 오픈오피스 + 프로젝트룸·교육장',bw:24,bd:20.7,
    rooms:[['업무존 A',0,0,12,11],['업무존 B',12,0,12,11],['대회의실',0,11,6,4.5],['교육·프로젝트룸',6,11,7,4.5],['회의실 1',13,11,3.5,4.5],['회의실 2',16.5,11,3.5,4.5],['임원실',20,11,4,4.5],['리셉션',0,15.5,5,5.2],['라운지·탕비',5,15.5,6,5.2],['서버·창고',11,15.5,3,5.2],['복합기·자료',14,15.5,3,5.2],['출입·복도',17,15.5,7,5.2]],
    elements:[['window',5,0,4,0],['window',18,0,4,0],['door',20.5,20.7,1.2,0],['door',6,13,.9,90],['door',13,13,.9,90],['door',16.5,13,.9,90],['door',20,13,.9,90]]}),
];

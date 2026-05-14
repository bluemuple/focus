"use strict";(self.webpackChunkgather_browser=self.webpackChunkgather_browser||[]).push([[841],{61488:(e,t,r)=>{t.ip=t.Jr=t.F7=t.CE=void 0;var i=r(26929);Object.defineProperty(t,"CE",{enumerable:!0,get:function(){return i.RequiredWearables}}),Object.defineProperty(t,"F7",{enumerable:!0,get:function(){return i.WearableColors}}),Object.defineProperty(t,"Jr",{enumerable:!0,get:function(){return i.WearableSubType}}),Object.defineProperty(t,"ip",{enumerable:!0,get:function(){return i.WearableType}})},71620:(e,t,r)=>{r.d(t,{Z:()=>Q});var i=r(35944),a=r(87166),o=r(37884),n=r(12892),s=r(74717),c=r(13352),l=r(11545),d=r(90045),p=r(91381),u=r(96486),m=r(67294),h=r(82232),b=r(87316),Z=r(92851),f=r(76777),g=r(16124),w=r(25292),P=r(68563),S=r(16590),C=r(15445),x=r(86280),k=r(10932);const O={5:60,4:79,3:110,2:172},y=k.Z.button`
  background: transparent;
  border: none;
  border-bottom: ${({isSelected:e})=>e?`2px solid ${Z.COLORS.WHITE}`:`2px solid ${Z.COLORS.DARK0}`};
  padding: 0 15px 8px 15px;
  text-align: center;
  cursor: pointer;
  flex: 1;

  color: ${({isSelected:e})=>e?Z.COLORS.WHITE:Z.COLORS.GRAY4};

  &:hover,
  &:focus {
    color: ${Z.COLORS.WHITE};
  }

  ${f.yM}
`,E=k.Z.button`
  background: transparent;
  border: none;
  text-align: center;
  cursor: pointer;
  border-radius: 20px;
  background: ${({isSelected:e})=>e?`${Z.COLORS.DARK0}`:"#252A48"};
  margin-right: 9px;
  padding: 7px 14px;
  opacity: ${({isSelected:e})=>e?1:.7};

  color: ${({isSelected:e})=>e?Z.COLORS.WHITE:Z.COLORS.BLUE0};

  &:hover,
  &:focus {
    opacity: 1;
    color: ${Z.COLORS.WHITE};
  }

  ${f.yM}
`,v=(0,k.Z)(P.ZP)`
  height: 186px;
  overflow-y: auto;
  margin-right: -18px;
  ${({shouldGrow:e})=>e&&"flex-grow:1;"}
`,R=k.Z.button`
  border: ${({isSelected:e})=>e?`3px solid ${Z.COLORS.WHITE}`:"none"};
  border-radius: 16px;
  padding: ${({isSelected:e})=>e?"0px":"3px"};
  margin: 4px;
  background-color: ${Z.COLORS.DARK0};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  height: min-content;

  [data-popper-escaped="true"] {
    visibility: hidden;
  }

  ${f.yM}
`,L=k.Z.img`
  width: ${({rowWidth:e})=>O[e]}px;
  height: ${({rowWidth:e})=>O[e]}px;
  object-fit: cover;
  object-position: 0 0;
  ${f.zG}

  ${({disabled:e})=>e&&"\n      -webkit-filter: saturate(25%) blur(4px);\n      filter: saturate(25%) blur(4px);\n    "}
`,B=k.Z.button`
  background: transparent;
  border: 3px solid transparent;

  ${e=>e.isSelected?`\n    width: 30px;\n    height: 30px;\n    border: 3px solid ${Z.COLORS.WHITE};\n    margin: 0px 5px;`:"\n    width: 24px;\n    height: 24px;\n    margin: 4px 8px;"}

  border-radius: 50%;
  cursor: pointer;
  background-color: ${e=>e.color};

  ${f.yM}
`,T=k.Z.div`
  position: absolute;
  width: 79px;
  height: 63px;
  background: rgba(17, 17, 17, 0.2);
  bottom: 17px;
  border-radius: 50%;
`,D=k.Z.div`
  border-radius: ${a.M}px ${a.M}px 0px 0px;
  justify-content: center;
  background-color: ${Z.COLORS.DARK1};
  display: flex;
  height: 30vh;
  position: relative;
  min-height: 200px;
  max-height: 240px;
  margin: -32px -32px 0 -32px;
`,I=k.Z.img`
  width: 118px;
  height: 236px;
  object-fit: cover;
  object-position: 0 0;
  position: absolute;
  bottom: 17px;
  z-index: 1;
  ${f.zG}
`;var $,A=r(61488),H=(($=H||{}).BODY="BODY",$.OUTFIT="OUTFIT",$.ACCESSORIES="ACCESSORIES",$.SPECIAL="SPECIAL",$);const W={[A.ip.Skin]:{name:(0,h.ZP)("Skin"),colors:[],customizations:[],wearablesPerRow:4},[A.ip.Hair]:{name:(0,h.ZP)("Hair"),colors:[],customizations:[],wearablesPerRow:4},[A.ip.FacialHair]:{name:(0,h.ZP)("c8d1cc8"),colors:[],customizations:[],wearablesPerRow:4},[A.ip.Top]:{name:(0,h.ZP)("Top"),colors:[],customizations:[],wearablesPerRow:3},[A.ip.Bottom]:{name:(0,h.ZP)("Bottom"),colors:[],customizations:[],wearablesPerRow:3},[A.ip.Shoes]:{name:(0,h.ZP)("Shoes"),colors:[],customizations:[],wearablesPerRow:3},[A.ip.Hat]:{name:(0,h.ZP)("Hat"),colors:[],customizations:[],wearablesPerRow:4},[A.ip.Glasses]:{name:(0,h.ZP)("Glasses"),colors:[],customizations:[],wearablesPerRow:4},[A.ip.Other]:{name:(0,h.ZP)("Other"),colors:[],customizations:[],wearablesPerRow:4},[A.ip.Mobility]:{name:(0,h.ZP)("1f880bb"),colors:[],customizations:[],wearablesPerRow:4},[A.ip.Jacket]:{name:(0,h.ZP)("Jacket"),colors:[],customizations:[],wearablesPerRow:4},[A.ip.Costume]:{name:"",colors:[],customizations:[],wearablesPerRow:4},[A.Jr.Seasonal]:{name:(0,h.ZP)("8925f0b"),colors:[],customizations:[],wearablesPerRow:2,parent:A.ip.Costume},[A.Jr.Internal]:{name:(0,h.ZP)("fc9225a"),colors:[],customizations:[],wearablesPerRow:2,parent:A.ip.Costume},[A.Jr.Experimental]:{name:(0,h.ZP)("b718f8c"),colors:[],customizations:[],wearablesPerRow:2,parent:A.ip.Costume}},z={BODY:{name:(0,h.ZP)("Base"),subCategories:[A.ip.Skin,A.ip.Hair,A.ip.FacialHair]},OUTFIT:{name:(0,h.ZP)("d31d367"),subCategories:[A.ip.Top,A.ip.Jacket,A.ip.Bottom,A.ip.Shoes]},ACCESSORIES:{name:(0,h.ZP)("f3b50cd"),subCategories:[A.ip.Hat,A.ip.Glasses,A.ip.Mobility,A.ip.Other]},SPECIAL:{name:(0,h.ZP)("Special"),subCategories:[A.Jr.Seasonal]}};var F=r(56614),N=r(17126),J=r(13143);const j=m.memo((({isSelected:e,wearable:t,size:r,onClick:a})=>{const{type:o,previewUrl:n,startDate:s,endDate:c}=t,l=N.ou.local();let d,p=!0;if(s&&c){const e=new Date(s),t=new Date(c);p=(0,J._w)(s,c),p||(0,J.J_)(l).after(N.ou.fromJSDate(t))?d=(0,h.ZP)("53f9b60",{endDate:(0,J.in)(c)}):(0,J.J_)(N.ou.fromJSDate(e)).after(l)&&(d=(0,h.ZP)("2fd29a0",{startDate:(0,J.in)(s)}))}else s?(p=(0,J.J_)(l).after(N.ou.fromJSDate(new Date(s))),d=p?"":(0,h.ZP)("2fd29a0",{startDate:(0,J.in)(s)})):c&&(p=(0,J.J_)(N.ou.fromJSDate(new Date(c))).after(l),d=p?"":(0,h.ZP)("53f9b60",{endDate:(0,J.in)(c)}));return(0,i.BX)(F.Z,{placement:"right",offset:{mainAxis:0,crossAxis:-O[r]/4},children:[(0,i.tZ)(F.Z.ReferenceElement,{children:(0,i.tZ)(R,{"aria-selected":e,isSelected:e,onClick:()=>{p&&a(o,t)},children:(0,i.tZ)(L,{src:n,rowWidth:r,disabled:!p})})}),d&&(0,i.tZ)(F.Z.FloatingElement,{children:(0,i.tZ)("div",{role:"tooltip",className:"Tooltip-content",children:d})})]})}));var M=r(93633),X=r(11771),G=r(91936);const Y=m.memo((function({name:e,onChangeName:t,disableNameField:r,showNameEmptyError:a,onBack:o,initNameActive:n,onSave:s}){return(0,i.BX)(P.ZP,{flexDirection:"column",children:[(0,i.tZ)(P.ZP,{marginBottom:5,children:(0,i.tZ)(S.Z,{kind:"h2",children:(0,h.ZP)("041e6ec")})}),(0,i.tZ)(P.ZP,{marginBottom:5,children:(0,i.tZ)(S.Z,{kind:"body2",color:Z.COLORS.BLUE1,children:r?(0,h.ZP)("7b5c92c"):(0,h.ZP)("523613f")})}),(0,i.BX)(P.ZP,{flexDirection:"column",alignItems:"center",marginBottom:5,gap:1,children:[(0,i.tZ)(X.Z,{value:e,maxLength:G.MAX_NAME_LENGTH,onChange:t,placeholder:(0,h.ZP)("54f2dd9"),isDisabled:r,autoFocus:!0,hasError:a}),a&&(0,i.tZ)("div",{css:{width:"100%"},children:(0,i.tZ)(S.Z,{kind:"caption1",color:"#FF8190",children:(0,h.ZP)("9c6a919")})})]}),(0,i.BX)(P.ZP,{justifyContent:"center",gap:4,children:[(0,i.tZ)(P.ZP,{children:(0,i.tZ)(g.Z,{kind:"low-key",size:"lg",onPress:o,children:n?(0,h.ZP)("239dce6"):(0,h.ZP)("Back")})}),(0,i.tZ)(P.ZP,{width:"170px",children:(0,i.tZ)(g.Z,{kind:"primary",onPress:s,size:"lg",isFullWidth:!0,children:(0,h.ZP)("4cdf5f3",null)})})]})]})}));var q=r(32190),U=r(2948),_=r(2823),V=r(95551);const K=e=>e===A.Jr.Seasonal||e===A.Jr.Internal||e===A.Jr.Experimental?A.ip.Costume:e,Q=m.memo((function({initialNameValue:e="",disableNameField:t=!1,initialWearables:r,initNameActive:k,onClickSave:L,onBack:$,skipToChooseNameScreen:F=!1,isModal:N=!0,styles:J,allowEmptyName:X,eventSource:G}){const{currUser:Q,updateCurrentlyEquippedWearables:ee}=(0,m.useContext)(p.St),[te,re]=(0,m.useState)(e),ie=r||Q?.currentlyEquippedWearables,[ae,oe]=(0,m.useState)(void 0),[ne,se]=(0,m.useState)(!1),[ce,le]=(0,m.useState)(H.BODY),de=z,[pe,ue]=(0,m.useState)(de[ce].subCategories[0]??A.ip.Hat),[me,he]=(0,m.useState)({[A.ip.Skin]:[],[A.ip.Hair]:[],[A.ip.FacialHair]:[],[A.ip.Top]:[],[A.ip.Bottom]:[],[A.ip.Shoes]:[],[A.ip.Hat]:[],[A.ip.Glasses]:[],[A.ip.Other]:[],[A.ip.Costume]:[],[A.ip.Mobility]:[],[A.ip.Jacket]:[],[A.Jr.Seasonal]:[]}),[be,Ze]=(0,m.useState)(new Set),[fe,ge]=(0,m.useState)(),[we,Pe]=(0,m.useState)(),[Se,Ce]=(0,m.useState)(!!k),xe=(0,m.useRef)(null),ke=(0,m.useRef)(0),{stopTrackingMetric:Oe}=(0,d.lu)({metricName:d.k4.CharacterSelectionLoaded}),ye=O[W[pe].wearablesPerRow],Ee=ye+14,ve=ce===H.SPECIAL?A.ip.Costume:pe,Re=de[H.SPECIAL].subCategories[0],Le=(0,m.useCallback)((e=>{Q?.id&&(0,s.PM)()&&(0,b.wY)()&&C.H.setCurrentlyEquippedWearables((0,l.qB)(e)),Pe(e)}),[Q?.id]),Be=(0,m.useCallback)(((e,t)=>{!we||!e||Pe({...we,[A.ip.Costume]:null,[e]:t})}),[we]);(0,m.useEffect)((()=>{if(void 0===ae&&(ie?(0,q.hq)(ie):(0,x.pb)()).then((e=>{e&&(oe(e),ee((0,l.qB)(e)))})),void 0===ae||void 0!==we)return;if(Pe(ae),!ae[A.ip.Costume]?.id)return void ge(ae[K(ve)]?.color||Object.keys(A.F7[pe])[0]);const e=ae[A.ip.Costume],t=H.SPECIAL,r=A.ip.Costume,i=de[t].subCategories,a=e?.subType&&i.indexOf(e?.subType)>-1?i.indexOf(e?.subType):0;le(t);const o=i[a];void 0!==o&&ue(o),ge(ae[r]?.color||Object.keys(A.F7[r])[0])}),[ie,ae,we,pe,ve,ee,de]),(0,m.useEffect)((()=>{Q?.id&&(async()=>{if(!be.has(ve)){Ze((e=>new Set([...e,ve])));try{const e=await(({type:e,styles:t})=>n.wP.get(_.HttpV2Paths.UserDefaultWearables,{params:{query:{type:e,styles:t}}}))({type:ve,styles:J});if(!e)return void M.Y.warn("Something went wrong while grabbing wearables");e.sort(((e,t)=>e.name===t.name?0:e.name<t.name?-1:1)),he((t=>({...t,[ve]:e})))}catch{M.Y.error("Something went wrong while grabbing wearables"),Ze((e=>{const t=new Set(e);return t.delete(ve),t}))}Oe()}})()}),[ve,me,be,Q?.id,Oe,J]),(0,m.useEffect)((()=>{if(!xe.current)return;const e=ke.current+1;xe.current.scrollTop=e>0?Math.floor(e/W[pe].wearablesPerRow)*Ee:0}),[pe,me,Ee]),(0,m.useEffect)((function(){!ne||!te.trim?.()||se(!1)}),[te,ne]);const Te=e=>{ge(we?.[e]?.color||Object.keys(A.F7[e])[0]),ue(e)},De=e=>{const t={};return Object.values(A.ip).forEach((r=>t[r]=(0,u.pick)(e[r],["color","name","isDefault"]))),t},Ie=()=>{if(!X&&!te?.trim())return void se(!0);const e=we&&(0,l.qB)(we);L({name:te,wearables:e}),we&&!(0,u.isEqual)(ae,we)&&(Le(we),(0,U.NO)(c.MetricsEventName.CHANGE_APPEARANCE,{...De(we),characterSelectionSource:G}))},$e=(0,m.useCallback)((()=>{L({name:e,wearables:ae&&(0,l.qB)(ae)})}),[e,L,ae]),Ae=(0,i.BX)(i.HY,{children:[(0,i.BX)(P.ZP,{flexDirection:"column",children:[(0,i.tZ)(P.ZP,{marginBottom:4,justifyContent:"center",children:Object.entries(de).map((([e,t],r)=>(0,i.tZ)(y,{"aria-label":(0,h.EI)((0,h.ZP)("374fecb",{name:t.name})),"aria-selected":e===ce,isSelected:e===ce,onClick:()=>{const t=(0,V.enumFromValue)(e,H);le(t),e!==ce&&Te(de[e].subCategories[0])},children:(0,i.tZ)(S.Z,{kind:"h3",color:"inherit",children:t.name})},r)))}),(0,i.tZ)(P.ZP,{children:de[ce].subCategories?.map((e=>(0,i.tZ)(E,{"aria-label":(0,h.EI)((0,h.ZP)("33a7845",{subHeader:e})),"aria-selected":e===pe,isSelected:e===pe,onClick:()=>Te(e),children:(0,i.tZ)(S.Z,{kind:"h4",color:"inherit",children:W[e].name})},e)))})]}),Object.keys(A.F7[pe]).length>1?(0,i.tZ)(P.ZP,{marginTop:5,marginBottom:5,flexWrap:"wrap",children:Object.keys(A.F7[pe]).map((e=>(0,i.tZ)(B,{onClick:()=>(e=>{if(ge(e),!we)return;const t=we[K(ve)]?.name,r=me[ve]?.find((r=>r.name===t&&r.color===e));r&&Be(ve,r)})(e),color:A.F7[pe][e],isSelected:e===fe,"aria-label":(0,h.ZP)("d443acb",{color:e}),"aria-selected":e===fe},e)))}):(0,i.tZ)(P.ZP,{marginTop:5}),(0,i.tZ)(v,{shouldGrow:!N,css:f.nV,ref:xe,children:(0,i.BX)(P.ZP,{flexGrow:1,flexWrap:"wrap",width:"0",paddingBottom:8,children:[!A.CE.has(ve)&&(0,i.tZ)(R,{isSelected:!we?.[K(ve)]?.type,onClick:()=>Be(ve,null),children:(0,i.tZ)(P.ZP,{width:`${ye}px`,height:`${ye}px`,alignItems:"center",justifyContent:"center",children:(0,i.tZ)(w.Z,{icon:(0,i.tZ)(o.x8P,{}),size:"lg",color:Z.COLORS.WHITE})})}),me[ve]&&me[ve]?.filter((e=>{const t=e.color===fe||!fe;return ve===A.ip.Costume?pe!==Re?e.subType&&e.subType===pe&&t:(!e.subType||e.subType===Re)&&t:t})).map(((e,t)=>{0===t&&(ke.current=-1);const r=e.id===we?.[e.type]?.id;return r&&(ke.current=t),(0,i.tZ)(j,{isSelected:r,wearable:e,size:W[pe].wearablesPerRow,onClick:Be},e.id)}))]})}),(0,i.BX)(P.ZP,{justifyContent:"center",marginTop:4,children:[(0,i.tZ)(P.ZP,{margin:2,children:(0,i.tZ)(g.Z,{kind:"low-key",size:"lg",onPress:$,children:(0,h.ZP)("Back")})}),(0,i.tZ)(P.ZP,{margin:2,children:(0,i.tZ)(g.Z,{kind:"primary",onPress:()=>{k?Ce(!0):Ie()},size:"lg",children:k?(0,h.ZP)("574f02b"):(0,h.ZP)("9f0a561")})})]})]}),He=(0,i.BX)(P.ZP,{flexDirection:"column",flexGrow:1,className:"new",children:[(0,i.BX)(D,{children:[we&&(0,i.tZ)(I,{src:(0,q.e1)((0,l.qB)(we))}),(0,i.tZ)(T,{})]}),te&&(0,i.tZ)(P.ZP,{padding:2,backgroundColor:(0,Z.CZ)("black",.5),width:"fit-content",borderRadius:2,cursor:"pointer",onClick:()=>Ce(!0),position:"absolute",top:"20px",left:"20px",children:(0,i.tZ)(S.Z,{color:"white",kind:"h3",children:te})}),(0,i.tZ)(P.ZP,{paddingTop:5,width:"372px",flexDirection:"column",flexGrow:N?void 0:1,children:Se||F?(0,i.tZ)(Y,{name:te,onChangeName:re,disableNameField:t,showNameEmptyError:ne,onBack:()=>{if(F)return $?.();te||re(e),Ce(!1)},initNameActive:k,onSave:Ie}):Ae})]});return N?(0,i.tZ)(a.Z,{bg:Z.COLORS.DARK3,closeIcon:!0,onClose:$e,closeOnClickOutside:!1,children:He}):He}))},75e3:(e,t,r)=>{r.d(t,{W:()=>w});var i=r(35944),a=r(67294),o=r(62518),n=r(82232),s=r(80160),c=r(85518),l=r(15267),d=r(41242),p=r(86280),u=r(7360),m=r(73339),h=r(37884),b=r(68563),Z=r(33829),f=r(47856);const g=l.ip.concat(),w=a.memo((function({variant:e,eventSource:t}){const[r,w]=(0,a.useState)(null);(0,a.useEffect)((()=>{(async()=>{const e=await(0,p.H9)("selectedLanguage")??u.SP,t=l.i8.includes(e)?e??u.SP:u.SP;w(t)})()}),[]);const P=(0,a.useCallback)((async e=>{try{await(0,u.zp)(e,t),w(e),s.Am.success((0,n.EI)((0,n.ZP)("6f2a180",{isElectron:c.d})))}catch{s.Am.error((0,n.EI)((0,n.ZP)("8956972")))}}),[t]),S="compact"===e,C="button"===e,x=(0,i.tZ)(d.ZP,{value:g.find((e=>e.value===r))?.value,placeholder:null===r?(0,n.ZP)("b04ba49"):(0,n.ZP)("f1add62"),options:g.map((e=>({label:S?e.shortLabel:e.label,value:e.value}))),kind:d.hk.Dark,onChange:e=>{C?w(e):P(e)},compact:!0,formatOptionLabel:S?e=>(0,i.BX)(b.ZP,{alignItems:"center",gap:2,children:[(0,i.tZ)(m.Z,{icon:(0,i.tZ)(h.THo,{})}),(0,i.tZ)(Z.Z,{kind:"h3",children:e.label})]}):void 0,styles:S?{valueContainer:e=>({...e,paddingRight:0}),singleValue:e=>({...e,marginRight:0}),menu:e=>({...e,width:355})}:void 0,menuPlacement:"bottom"});return(0,i.BX)(i.HY,{children:[C?(0,i.BX)(b.ZP,{width:"100%",gap:4,children:[x,(0,i.tZ)(b.ZP,{minWidth:"140px",children:(0,i.tZ)(f.Z,{onPress:()=>r&&P(r),kind:"primary",isFullWidth:!0,children:(0,n.ZP)("2942192")})})]}):x,o.createPortal((0,i.tZ)(s.x7,{}),document.body)]})}))},81763:(e,t,r)=>{r.d(t,{E0:()=>d,QJ:()=>p,sF:()=>u});var i=r(67294),a=r(36170),o=r(86280),n=r(72745),s=r(89250),c=r(91936),l=r(91381);const d=()=>{const[e,t]=(0,i.useState)();return(0,i.useEffect)((()=>{(0,o.LX)().then((e=>{e&&t((0,n.t)(e))}));const e=setInterval((()=>(0,o.LX)().then((e=>{e&&t((0,n.t)(e))}))),1e4);return()=>clearInterval(e)}),[]),e},p=(e,t)=>(0,i.useMemo)((()=>e&&e.filter((({defaultName:e})=>e.toLowerCase().includes(t.toLowerCase())&&e!==a.bi))),[e,t]),u=()=>{const{currUser:e}=(0,l.SE)(),t=(0,s.s0)();return()=>{const r=window.location.hostname.includes("staging.gather.town"),i=e?.email?.endsWith(c.GATHER_EMAIL_DOMAIN);r&&!1===i?window.location.href="https://app.gather.town/app":t("/app")}}},3452:(e,t,r)=>{r.d(t,{Z:()=>p});var i=r(35944),a=r(68563),o=r(16590),n=r(10932),s=r(92851),c=r(76777);const l=(0,n.Z)(a.ZP)`
  width: 100%;
  padding: 8px 16px;

  :hover {
    background: rgba(145, 173, 255, 0.7);
  }

  ${({isSelected:e})=>e&&`background: ${s.COLORS.BLUE2};`}
`,d=({onClick:e,selected:t,label:r})=>(0,i.tZ)(l,{isSelected:t,display:"flex",alignItems:"center",onMouseDown:t=>{e&&e()},children:(0,i.tZ)(o.Z,{kind:"body1",color:s.COLORS.DARK3,style:c.iL,children:r})}),p=({options:e,onSelect:t,handleOpen:r,backgroundColor:o=s.COLORS.BLUE1,borderRadius:n=4,paddingY:c=4})=>e.length?(0,i.tZ)(a.ZP,{maxHeight:"230px",overflowY:"auto",backgroundColor:o,borderRadius:n,display:"flex",flexDirection:"column",paddingY:c,width:"100%",children:e.map(((e,a)=>(0,i.tZ)(d,{label:e.label,value:e.value,onClick:()=>{t(e),r&&r()}},a)))}):null},72745:(e,t,r)=>{r.d(t,{Z:()=>p,t:()=>d});var i=r(67294),a=r(93633),o=r(86280),n=r(14096),s=r(87613),c=r(13143),l=r(20803);const d=e=>Object.values(e).map((e=>{const{id:t,lastVisited:r}=e;return{...e,defaultName:(0,n.tW)(t),lastVisitedInfo:(0,c.H9)(r)}})).sort(l.OD),p=({fetchRecentSpaces:e=!1,fetchOwnedSpaces:t=!1})=>{const[r,n]=(0,i.useState)(),[c,l]=(0,i.useState)(),[p,u]=(0,i.useState)(!0),m=(0,i.useCallback)((async({fetchRecentSpaces:e,fetchOwnedSpaces:t})=>{try{const[r,i]=await Promise.all([e?(0,o.LX)():void 0,t?(0,o.nZ)():void 0]);r&&n(d(r)),i&&l(d(i))}catch(e){a.Y.error("Error trying to fetch explore data",(0,s.d)(e))}u(!1)}),[]);return(0,i.useEffect)((()=>{m({fetchRecentSpaces:e,fetchOwnedSpaces:t})}),[m,t,e]),{recentSpaces:r,ownedSpaces:c,isLoading:p}}},93445:(e,t,r)=>{r.d(t,{Z:()=>a});var i=r(89250);const a=function(){return new URLSearchParams((0,i.TH)().search)}}}]);
//# sourceMappingURL=https://sourcemaps.us-east-1-a.prod.aws.gather.town/v1/gather-browser/72991861a/bundle.3a9da565817b5439f2ab.js.map
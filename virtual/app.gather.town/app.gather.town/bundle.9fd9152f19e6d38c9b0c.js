"use strict";(self.webpackChunkgather_browser=self.webpackChunkgather_browser||[]).push([[4889],{14889:(e,t,a)=>{a.d(t,{Z:()=>lt,o:()=>st});var n,o=a(35944),r=a(67294),s=a(82232),i=a(89250),c=a(44308),l=a(74229),p=a(13352),d=a(50662),u=a(97566),m=a(26327),h=a(91381),g=a(78727),b=a(62247),f=a(3332),P=a(91936),I=a(37884),w=a(16124),E=a(87166),Z=a(55184),S=a(68563),y=a(16590),v=a(11771),k=a(36170),C=a(25292),R=a(66948),x=a(2948),T=((n=T||{}).None="None",n.GuestCheckIn="GuestCheckIn",n.PasswordProtect="PasswordProtect",n);const O=r.memo((function({spaceName:e,setSpaceName:t,securityOption:a,setSecurityOption:n,isRemoteWorkOffice:s=!1,showNextModal:i,showPrevModal:c,password:l,setPassword:d,closable:u,hideModal:m,wrapInModal:h=!1,from:g}){return(0,r.useEffect)((()=>{(0,x.NO)(p.MetricsEventName.WIZARD_SPACE_NAME_PAGE_VIEWED,{location:`From ${g}`})}),[g]),h?(0,o.tZ)(Z.Z,{children:(0,o.tZ)(E.Z,{closeOnClickOutside:u,closeIcon:u,onClose:m,borderRadius:4,pad:6,children:(0,o.tZ)(M,{spaceName:e,setSpaceName:t,securityOption:a,setSecurityOption:n,isRemoteWorkOffice:s,password:l,setPassword:d,closable:u,hideModal:m,showNextModal:i,showPrevModal:c,from:g})})}):(0,o.tZ)(M,{spaceName:e,setSpaceName:t,securityOption:a,setSecurityOption:n,isRemoteWorkOffice:s,password:l,setPassword:d,closable:u,hideModal:m,showNextModal:i,showPrevModal:c,from:g})})),M=r.memo((function({spaceName:e,setSpaceName:t,securityOption:a,setSecurityOption:n,isRemoteWorkOffice:i,showNextModal:l,showPrevModal:d,password:u,setPassword:m,from:h}){const[g,b]=(0,r.useState)(!1),f=e.trim(),E=(0,c.isValidSpaceName)(f),Z=(0,r.useCallback)((e=>{(0,x.NO)(p.MetricsEventName.WIZARD_PASSWORD_PROTECT_TOGGLED,{hasPassword:e,location:`From ${h}`}),n(e?"PasswordProtect":"None")}),[n,h]),T=(0,r.useCallback)((()=>{b(!0),d()}),[d,b]),O=(0,r.useCallback)((()=>{b(!0),l()}),[l,b]);return(0,o.BX)(o.HY,{children:[(0,o.tZ)(S.ZP,{width:"100%",alignItems:"center",marginBottom:6,marginRight:10,minWidth:"470px",children:(0,o.tZ)(y.Z,{kind:"h1",children:(0,s.ZP)("74ca270")})}),(0,o.tZ)(v.Z,{label:(0,s.ZP)("29ce8c4"),placeholder:(0,s.ZP)("dadedc5"),value:e,autoComplete:"new-password",maxLength:P.MAX_SPACE_NAME_LENGTH,onChange:t,hasError:f.length>0&&!E,errorMessage:k.wD,size:"lg",autoFocus:!0}),!i&&(0,o.BX)(S.ZP,{justifyContent:"space-between",marginTop:4,children:[(0,o.BX)(S.ZP,{alignItems:"center",children:[(0,o.tZ)(S.ZP,{marginRight:2,children:(0,o.tZ)(C.Z,{icon:(0,o.tZ)(I.HEZ,{}),size:"sm"})}),(0,o.tZ)(y.Z,{kind:"body2",children:(0,s.ZP)("5a62db3")})]}),(0,o.tZ)(R.Z,{checked:"PasswordProtect"===a,setChecked:Z})]}),"PasswordProtect"===a&&(0,o.tZ)(S.ZP,{marginTop:2,children:(0,o.tZ)(v.Z,{label:(0,s.ZP)("8be3c94"),autoComplete:"new-password",value:u,onChange:m,type:"password",size:"lg"})}),(0,o.BX)(S.ZP,{justifyContent:"space-between",marginTop:6,children:[(0,o.tZ)(S.ZP,{marginRight:2,children:(0,o.tZ)(w.Z,{kind:"low-key",size:"lg",onPress:T,isDisabled:g,children:(0,s.ZP)("Back")})}),(0,o.tZ)(w.Z,{kind:"primary",isDisabled:!E||g,onPress:O,size:"lg",startIcon:(0,o.tZ)(I.fU8,{}),children:(0,s.ZP)("53c7ff7")})]})]})})),N=O;var W=a(1983),A=a(92851),_=a(10114),G=a(10932),F=a(34388),B=a(73799),z=a(81697);const X=({sourceSpace:e})=>{const{id:t,foreground:a,background:n,objects:i,scale:c,contentRef:l,computeScale:p,offsetX:d,offsetY:u}=function({sourceSpace:e}){const[t,a]=(0,r.useState)(0),[n,o]=(0,r.useState)(0),[s,i]=(0,r.useState)(0),c=(0,r.useRef)(null),l=(0,r.useCallback)((()=>e?(0,F.yr)(e):Promise.reject("Missing space id")),[e]),{resource:{id:p,foregroundImagePath:d,backgroundImagePath:u,objects:m}}=(0,B.L)(l,{id:"",foregroundImagePath:"",backgroundImagePath:"",objects:{}}),h=(0,r.useCallback)((()=>{if(!c.current)return;const e=c.current.clientWidth,t=c.current.clientHeight,n=506/e,r=308/t,s=Math.min(n,r,1);a(s),o((e-e*s)/2),i((328-t*s)/2)}),[]);return(0,r.useEffect)((function(){h()}),[h]),(0,r.useEffect)((function(){a(0)}),[e]),{id:p,foreground:d,background:u,objects:m,scale:t,offsetX:n,offsetY:s,contentRef:c,computeScale:h}}({sourceSpace:e});return(0,o.tZ)(V,{children:(0,o.BX)(Y,{scale:c,offsetX:d,offsetY:u,children:[(0,o.tZ)("img",{src:n,alt:(0,s.EI)((0,s.ZP)("ece724d",{id:t})),ref:l,onLoad:p}),(0,o.tZ)($,{children:(0,z.MRu)((0,z.vgT)("zIndex"),Object.values(i??{})).map((({id:e,x:t,y:a,normal:n,_name:r,offsetX:s,offsetY:i},c)=>(0,o.tZ)(U,{x:t,y:a,size:32,children:(0,o.tZ)(H,{src:n,alt:r,x:s??0,y:i??0})},`${e}-${c}`)))}),a&&(0,o.tZ)(j,{src:a,alt:(0,s.EI)((0,s.ZP)("cca94a6",{id:t}))})]})})},D=({sourceSpace:e})=>{const{url:t,alt:a}=(0,_.ST)(e);return(0,o.tZ)(V,{display:"flex",padding:16,children:(0,o.tZ)(L,{src:t,alt:a})})},L=G.Z.img`
  max-width: 100%;
  max-height: 100%;
`,V=G.Z.div`
  width: 516px;
  height: 328px;
  display: ${({display:e="grid"})=>e};
  align-items: center;
  justify-content: center;
  background: ${A.COLORS.BLACK};
  border-radius: 16px;
  overflow: hidden;
  padding: ${({padding:e=0})=>`${e}px`};
`,j=G.Z.img`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
`,$=G.Z.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
`,U=G.Z.div`
  display: grid;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: ${({x:e,size:t=32})=>e*t+"px"};
  top: ${({y:e,size:t=32})=>e*t+"px"};
`,H=G.Z.img`
  position: relative;
  left: ${({x:e})=>`${e}px`};
  top: ${({y:e})=>`${e}px`};
`,Y=G.Z.div`
  position: relative;
  top: ${({offsetY:e})=>`${e}px`};
  left: ${({offsetX:e})=>`${e}px`};
  transform-origin: 0 0;
  transform: ${({scale:e})=>`scale(${e})`};
  opacity: ${({scale:e})=>Number(!!e)};
  transition: opacity 150ms ease-in-out;
`,J=({sourceSpace:e})=>(0,_.SI)(e)?(0,o.tZ)(D,{sourceSpace:e}):(0,o.tZ)(X,{sourceSpace:e});var K=a(79655);const Q=G.Z.div`
  display: grid;
  grid-gap: 6px;
  padding-bottom: 10px;
`,q=G.Z.div`
  display: grid;
  grid-gap: 6px;
  grid-template-columns: 1fr auto;
  align-items: center;
`,ee=G.Z.div`
  display: grid;
  grid-gap: 8px;
  grid-template-columns: auto auto;
  align-items: center;
`,te=G.Z.div`
  display: grid;
  grid-gap: 24px;
`,ae=G.Z.div`
  display: grid;
  grid-gap: 8px;
`,ne=G.Z.div`
  display: grid;
  grid-gap: 24px;
  grid-template-columns: 1fr auto;
`,oe=G.Z.div`
  width: 248px;
  display: grid;
  grid-gap: 12px;
`,re=G.Z.div`
  display: grid;
  grid-gap: 8px;
  grid-template-columns: 1fr auto;
`,se=G.Z.div`
  display: grid;
  grid-gap: 8px;
  overflow: hidden;
  grid-template-rows: auto 1fr;
`,ie=G.Z.div`
  display: ${({numItems:e})=>3===e?"flex":"grid"};
  grid-gap: 16px;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 1fr;
  align-items: flex-start;
`,ce=G.Z.div`
  background: ${A.COLORS.DARK0};
  opacity: ${({disabled:e})=>e?.5:1};
  border: ${({selected:e})=>`2px solid ${e?A.COLORS.GREEN:"transparent"}`};
  width: 100%;
  height: 76px;
  border-radius: 12px;
  display: inline-grid;
  grid-template-rows: auto auto;
  grid-gap: 4px;
  cursor: ${({disabled:e})=>e?"not-allowed":"pointer"};

  span:first-of-type {
    align-self: flex-end;
    justify-self: center;
  }
  span:nth-of-type(2) {
    align-self: flex-start;
    justify-self: center;
  }
`,le=G.Z.span`
  width: 24px;
  height: 24px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
`,pe=(0,G.Z)(K.rU)`
  color: ${A.COLORS.GREEN};
`;var de=a(72955),ue=a(67224);const me=()=>{},he=r.memo((function({onChange:e,showNextModal:t,showPrevModal:a,closable:n,hideModal:s,from:i,wrapInModal:c=!0}){const{themeSetName:l}=(0,de.$)();return(0,r.useEffect)((()=>{(0,x.NO)(p.MetricsEventName.WIZARD_SPACE_CONFIGURATION_PAGE_VIEWED,{location:`From ${i}`,themeSetName:l})}),[i,l]),c?(0,o.tZ)(Z.Z,{children:(0,o.tZ)(E.Z,{minWidth:"836px",closeOnClickOutside:n,closeIcon:n,onClose:s,pad:6,borderRadius:4,children:(0,o.tZ)(ge,{onChange:e,closable:n,hideModal:s,showNextModal:t,showPrevModal:a,from:i})})}):(0,o.tZ)(ge,{onChange:e,closable:n,hideModal:s,showNextModal:t,showPrevModal:a,from:i})})),ge=r.memo((function({onChange:e,showNextModal:t,showPrevModal:a,from:n}){const{sourceSpace:i,size:c,theme:l,disabledThemes:d,handleChangeSize:u,handleChangeTheme:m}=((e,t)=>{const{marksToSize:a,initialTemplateSize:n,themeSetName:o,initialTheme:s}=(0,de.$)(),[i,c]=(0,r.useState)(n),[l,d]=(0,r.useState)(s),u=(0,_.Ai)(o,i),m=(0,r.useCallback)(((a,n)=>{(0,x.NO)(p.MetricsEventName.RW_WIZARD_OFFICE_CONFIGURATION_MAP_SWITCH,{size:a,theme:n,location:t,themeSetName:o});const r=(0,ue.NT)(o,a,n);e(r)}),[e,t,o]),h=(0,r.useCallback)((([e])=>{if(!e&&0!==e)return;const t=`${e}`;if(!t||!a.hasOwnProperty(t))return;const n=a[t];if(!n)return;if(l&&(0,_.nC)(o,n,l))return c(n),void m(n,l);const r=_.le.find((e=>(0,_.nC)(o,n,e)));r&&(d(r),c(n),m(n,r))}),[a,m,l,o]),g=(0,r.useCallback)((e=>()=>{if(!i)return;let t=i;if(!(0,_.nC)(o,i,e)){const a=(0,_.BX)(o,e);if(!a)return;t=a,c(a)}d(e),m(t,e)}),[m,i,o]);return{sourceSpace:(0,ue.NT)(o,i,l),size:i,theme:l,disabledThemes:u,handleChangeSize:h,handleChangeTheme:g}})(e,n),{themeSetName:h}=(0,de.$)(),[g,b]=(0,r.useState)(!1),f=(0,r.useCallback)((()=>{b(!0),(0,x.NO)(p.MetricsEventName.WIZARD_SPACE_CONFIGURATION_SELECTION_CONFIRMED,{size:c,theme:l,location:`From ${n}`,themeSetName:h}),t()}),[n,t,c,l,h]),P=(0,r.useCallback)((()=>{b(!0),a()}),[a]);return(0,o.BX)(te,{children:[(0,o.BX)(ae,{children:[(0,o.tZ)(y.Z,{kind:"h1",children:(0,s.ZP)("beefec6")}),(0,o.tZ)(y.Z,{kind:"body1",color:A.COLORS.GRAY2,children:(0,s.ZP)("600f48c")})]}),(0,o.BX)(ne,{children:[(0,o.tZ)(J,{sourceSpace:i}),(0,o.BX)(oe,{children:[(0,o.tZ)(be,{onChange:u,size:c}),(0,o.tZ)(fe,{onChange:m,theme:l,disabledThemes:d})]})]}),(0,o.BX)(re,{children:[(0,o.tZ)("div",{children:(0,o.tZ)(w.Z,{kind:"low-key",size:"lg",onPress:P,isDisabled:g,children:(0,s.ZP)("Back")})}),(0,o.tZ)(w.Z,{kind:"primary",onPress:f,size:"lg",isDisabled:g,children:(0,s.ZP)("67f4c6c")})]})]})})),be=r.memo((function({onChange:e,size:t}){const{marksToSize:a,sliderMarks:n,hasMaxTemplateMessage:r}=(0,de.$)(),i=[Object.entries(a).reduce(((e,[a,n])=>n===t?Number(a):e),0)],c=Object.keys(n).length-1,l=t===a[c];return(0,o.BX)(o.HY,{children:[(0,o.BX)(Q,{children:[(0,o.BX)(q,{children:[(0,o.tZ)(y.Z,{kind:"subtitle1",children:(0,s.ZP)("cad3197")}),(0,o.BX)(ee,{children:[(0,o.tZ)(C.Z,{icon:(0,o.tZ)(I.hR0,{}),size:"sm"}),(0,o.tZ)(y.Z,{kind:"subtitle1",children:t})]})]}),(0,o.tZ)(W.Z,{onFinalChange:e,defaultValues:i,marks:n,step:1,min:0,max:c,thumbStyle:{backgroundColor:A.COLORS.BLUE3,border:`2px ${A.COLORS.GRAY0} solid`},markColor:A.COLORS.WHITE,backgroundColors:[A.COLORS.BLUE3,A.COLORS.GRAY2]})]}),(0,o.tZ)(S.ZP,{alignItems:"center",visibility:r&&l?"visible":"hidden",children:(0,o.tZ)(y.Z,{kind:"caption3",children:(0,s.ZP)("05db418",{templateLink:e=>(0,o.tZ)(pe,{to:P.CONTACT_US_LINK,children:e})})})})]})})),fe=r.memo((function({onChange:e,theme:t,disabledThemes:a}){const{getThemeName:n,getThemeIcon:r,getThemeExists:i}=(0,de.$)();return(0,o.BX)(se,{children:[(0,o.tZ)(y.Z,{kind:"subtitle1",children:(0,s.ZP)("8d8a6a0")}),(0,o.tZ)(ie,{numItems:_.le.filter((e=>i(e))).length,children:_.le.map((s=>{const c=a.includes(s);return i(s)?(0,o.BX)(ce,{selected:t===s,onClick:c?me:e(s),disabled:c,children:[(0,o.tZ)(le,{children:r(s)}),(0,o.tZ)(y.Z,{kind:"h3",children:n(s)})]},s):null}))})]})})),Pe=he,Ie={image:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work-events%2Fuse-cases-covers%2Fconference.png?alt=media&token=fb7a8707-51b2-483c-9753-d7b3ec5bee86",text:(0,s.ZP)("8a1e29b"),subtext:(0,s.ZP)("2c3d2fa"),useCase:d.ke.Event},we={image:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work-events%2Fuse-cases-covers%2Fremote-work.png?alt=media&token=9416a29b-02b8-4bf3-9335-74a396af0e86",text:(0,s.ZP)("b9b3f64"),subtext:(0,s.ZP)("9c250ab"),useCase:d.ke.Work};function Ee({useCases:e,onClick:t,from:a}){const n=(0,i.s0)();return(0,o.BX)(Se,{children:[(0,o.tZ)(y.Z,{kind:"h1",children:(0,s.ZP)("b1faec9")}),(0,o.BX)(ye,{children:[e.map(((e,a)=>{const{image:n,text:r,subtext:s,useCase:i}=e;return(0,o.tZ)(Ze,{image:n,text:r,subtext:s,onClick:t,index:a},i)})),"/get-started"!==a&&(0,o.tZ)(w.Z,{isFullWidth:!0,kind:"low-key",onPress:()=>{(0,x.NO)(p.MetricsEventName.WIZARD_START_FROM_SCRATCH),n("/create")},size:"lg",children:(0,s.ZP)("9131969")})]})]})}function Ze({image:e,text:t,subtext:a,onClick:n,index:i}){const c=(0,r.useCallback)((()=>{n(i)}),[i,n]);return(0,o.BX)(ve,{onClick:c,children:[(0,o.tZ)(ke,{src:e,alt:(0,s.EI)(t)}),(0,o.BX)(Ce,{children:[(0,o.tZ)(y.Z,{kind:"h2",children:t}),(0,o.tZ)(y.Z,{kind:"body2",color:A.COLORS.GRAY2,children:a})]})]})}const Se=G.Z.div`
  display: grid;
  grid-gap: 24px;

  & button {
    justify-content: flex-start;
    border-radius: 12px;
  }
`,ye=G.Z.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-gap: 16px;
  width: 480px;
`,ve=G.Z.li`
  outline: ${({selected:e})=>e?"4px solid #06D6A0":"0.6px solid rgba(255, 255, 255, 0.1)"};
  cursor: pointer;
  border-radius: 18px;
  background: ${A.COLORS.DARK0};
  position: relative;
  transition: top ease 0.2s;
  top: 0;
  display: grid;
  width: 100%;
  border-radius: 12px;
  grid-template-columns: auto 1fr;
  overflow: hidden;

  :hover {
    background: rgba(118, 125, 165, 1);
    filter: drop-shadow(0px 8px 24px rgba(0, 0, 0, 0.55));
    top: -8px;
  }
`,ke=G.Z.img`
  width: 180px;
  height: 144px;
`,Ce=G.Z.div`
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: start;
  justify-content: center;
  grid-gap: 8px;
  padding: 0 24px;
`,Re=({setNewSpaceUseCase:e,closable:t,hideModal:a,from:n,wrapInModal:s=!0})=>{const i=(0,r.useMemo)((()=>[we,Ie]),[]),c=(0,r.useCallback)((t=>{const a=i[t]?.useCase;(0,x.NO)(p.MetricsEventName.WIZARD_CLICK_USE_CASE,{useCase:a,location:`From ${n}`}),a&&e(a)}),[n,e,i]);return(0,r.useEffect)((()=>{(0,x.NO)(p.MetricsEventName.WIZARD_USE_CASE_PAGE_VIEWED,{location:`From ${n}`})}),[n]),s?(0,o.tZ)(Z.Z,{children:(0,o.tZ)(E.Z,{minWidth:"528px",closeOnClickOutside:t,closeIcon:t,onClose:a,pad:6,borderRadius:4,children:(0,o.tZ)(Ee,{useCases:i,onClick:c,from:n})})}):(0,o.tZ)(Ee,{useCases:i,onClick:c,from:n})};var xe=a(93633),Te=a(74717),Oe=a(35025),Me=a(57333),Ne=a(89674);const We=(0,G.Z)(S.ZP)`
  display: flex;
  width: 100vw;
  height: 100vh;
  position: relative;
  align-items: center;
  justify-content: center;
`,Ae=(0,G.Z)(S.ZP)`
  padding: 16px;
  background: ${A.COLORS.WHITE};
  border-radius: 24px;
  flex-direction: column;
`,_e=G.Z.img`
  width: 48px;
  object-fit: cover;
  object-position: 0 -24px;
  height: 200%;
  transform: scale(1.25);
  image-rendering: pixelated;
`,Ge=(0,G.Z)(S.ZP)`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${A.COLORS.BLUE2};
  border: 2px solid ${A.COLORS.BLUE4};
  overflow: hidden;
`,Fe=r.memo((function({img:e,nextButtonText:t,prevButtonText:a,showNextButtonIcon:n,showPrevButtonIcon:r,onNext:i,onPrev:c,onSkip:l,heading:p,body:d,hasSkipButton:u}){return(0,o.tZ)(Ne.a,{theme:Me.f,children:(0,o.tZ)(We,{children:(0,o.BX)(Ae,{children:[(0,o.tZ)("img",{src:e,width:"900px",height:"500px",alt:(0,s.EI)((0,s.ZP)("86f65d2"))}),(0,o.BX)(S.ZP,{flexDirection:"row",marginTop:4,gap:4,children:[(0,o.tZ)(Ge,{children:(0,o.tZ)(_e,{src:"/images/events-setup/riley.png"})}),(0,o.BX)(S.ZP,{flexDirection:"column",children:[(0,o.tZ)(y.Z,{color:A.COLORS.DARK4,kind:"h2",children:p}),(0,o.tZ)(y.Z,{color:A.COLORS.GRAY5,kind:"body1",children:d})]}),(0,o.BX)(S.ZP,{flex:"1",justifyContent:"flex-end",gap:2,children:[u&&(0,o.tZ)(w.Z,{kind:"low-key",size:"lg",onPress:l,children:(0,s.ZP)("0e4aaf5")}),a&&(0,o.tZ)(w.Z,{startIcon:r?(0,o.tZ)(I.s$$,{}):void 0,kind:"low-key",size:"lg",onPress:c,children:a}),t&&(0,o.tZ)(w.Z,{endIcon:n?(0,o.tZ)(I._Qn,{}):void 0,kind:"tertiary",size:"lg",onPress:i,children:t})]})]})]})})})})),Be=Fe;var ze,Xe=a(78368),De=((ze=De||{}).ValuePropEnergy="ValuePropEnergy",ze.ValuePropTalk="ValuePropTalk",ze.ValuePropSeeTeammates="ValuePropSeeTeammates",ze.ValuePropPersonality="ValuePropPersonality",ze.ValuePropYourTurn="ValuePropYourTurn",ze);const Le={ValuePropEnergy:{img:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/manually-uploaded%2Fvalueprop%2Fvalueprop1.png?alt=media",heading:(0,s.EI)((0,s.ZP)("a05e935")),body:(0,s.EI)((0,s.ZP)("afb0ee1")),nextButtonText:(0,s.EI)((0,s.ZP)("Explore")),showNextButtonIcon:!0},ValuePropTalk:{img:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/manually-uploaded%2Fvalueprop%2Fvalueprop2.png?alt=media",heading:(0,s.EI)((0,s.ZP)("13255a7")),body:(0,s.EI)((0,s.ZP)("ef4d827")),nextButtonText:(0,s.EI)((0,s.ZP)("Next")),showNextButtonIcon:!0,prevButtonText:(0,s.EI)((0,s.ZP)("Prev")),showPrevButtonIcon:!0},ValuePropSeeTeammates:{img:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/manually-uploaded%2Fvalueprop%2Fvalueprop3.png?alt=media",heading:(0,s.EI)((0,s.ZP)("cec1576")),body:(0,s.EI)((0,s.ZP)("e0f1f26")),nextButtonText:(0,s.EI)((0,s.ZP)("Next")),showNextButtonIcon:!0,prevButtonText:(0,s.EI)((0,s.ZP)("Prev")),showPrevButtonIcon:!0},ValuePropPersonality:{img:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/manually-uploaded%2Fvalueprop%2Fvalueprop4.png?alt=media",heading:(0,s.EI)((0,s.ZP)("6160a8a")),body:(0,s.EI)((0,s.ZP)("0188185")),nextButtonText:(0,s.EI)((0,s.ZP)("Next")),showNextButtonIcon:!0,prevButtonText:(0,s.EI)((0,s.ZP)("Prev")),showPrevButtonIcon:!0},ValuePropYourTurn:{img:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/manually-uploaded%2Fvalueprop%2Fvalueprop5.png?alt=media",heading:(0,s.EI)((0,s.ZP)("0d24c62")),body:(0,s.EI)((0,s.ZP)("a54bba6")),nextButtonText:(0,s.EI)((0,s.ZP)("dde33a6")),prevButtonText:(0,s.EI)((0,s.ZP)("Prev")),showPrevButtonIcon:!0}},Ve=["ValuePropEnergy","ValuePropTalk","ValuePropSeeTeammates","ValuePropPersonality","ValuePropYourTurn"],je=r.memo((function({showNextModal:e,showPrevModal:t,hasSkipButton:a,onSkip:n,isNavigatingFromPrevStep:s}){const[i,c]=(0,r.useState)(s?(0,Oe.just)((0,z.Z$Q)(Ve)):"ValuePropEnergy"),l=Ve.findIndex((e=>e===i)),p=0===l;(0,r.useEffect)((()=>{Ve.forEach((e=>(0,Xe.p)(Le[e].img)))}),[]);const d=Le[i];return(0,o.tZ)(Be,{...d,onNext:()=>{const t=Ve.findIndex((e=>e===i)),a=t+1;if(a===Ve.length)return void e();const n=(0,Oe.just)(Ve[a]);c(n)},onPrev:()=>{if(p)return void t();const e=l-1,a=(0,Oe.just)(Ve[e]);c(a)},onSkip:n,hasSkipButton:a&&p})})),$e=je;var Ue=a(33021),He=a(1300),Ye=a(87613),Je=a(54144),Ke=a(2023),Qe=a(57520),qe=a(40657),et=a(87733),tt=a(92307),at=a(96486);const nt=(0,G.Z)(S.ZP)`
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: url("https://cdn.gather.town/v0/b/gather-town.appspot.com/o/images%2Fsignin_bg.png?alt=media&token=be54b54c-34be-4644-a640-7d69507f0941");
  background-repeat: repeat-x;
  filter: blur(20px);
  position: absolute;
  left: 0;
  top: 0;
`;var ot,rt=((ot=rt||{}).PickUseCase="PickUseCase",ot.PickSize="PickSize",ot.PickName="PickName",ot.SignInWall="SignInWall",ot.RWEName="RWEName",ot.ValueProp="ValueProp",ot);const st=()=>(0,at.pick)([...new URLSearchParams(window.location.search).entries()].reduce(((e,[t,a])=>(e[t]=a,e)),{}),"role","company_type","company_plan","timezone","company_size","goal","use_case","calendar_tool","region"),it=async(e,t,a,n,o,r,s={})=>{let i;e=e.trim();const l=st();try{if(i=await(0,m.NF)(e,t,a,n,s,o?.hubSpotContactId),i){const d=i,u=(0,c.roomURLIdToDBId)(d);i=`/app/${d}`;const m=(0,ue.c)(t)??"na",h=(0,ue.Mx)(t)??"na";((0,Oe.isNotEmpty)(n)||Boolean(s.guestCheckInEnabled))&&(0,He.Gs)(p.MetricsEventName.SPACE_ACCESS_RESTRICTION_EDITED,{userId:(0,Oe.just)(o?.id),spaceId:u,spaceAccessRestrictionEnabled:!0,spaceAccessRestrictionEditedSource:"CreateSpace",spaceAccessRestrictionType:s.guestCheckInEnabled?"GuestCheckIn":"Password"}),(0,He.Gs)(p.MetricsEventName.CREATE_SPACE,{userId:(0,Oe.just)(o?.id),spaceId:u,creatorId:o?.id,creatorName:o?.name,spaceName:e,map:t,hasPassword:""!==n,reason:a,location:`From ${r}`,size:m,theme:h},void 0,p.MetricsEventCategory.CREATION,t),"/get-started"===r&&(0,Oe.isNotEmpty)(st)&&(0,He.Gs)(p.MetricsEventName.SPACE_CREATOR_ONBOARDING_SURVEY_RESPONDED,{userId:o?.id??"",spaceCreatorSurveyCompanyRole:l.role,spaceCreatorSurveyCompanyWorkTypes:[l.company_type],spaceCreatorSurveyMainGoal:l.goal,spaceCreatorSurveyOfficeUse:l.use_case,spaceCreatorSurveyRegion:l.region,spaceCreatorSurveyCompanyPlan:l.company_plan,spaceCreatorSurveyTimezone:l.timezone,spaceCreatorSurveyCompanySize:l.company_size,spaceCreatorSurveyCalendarTool:l.calendar_tool,space:u})}}catch(e){xe.Y.error("Error creating Space",(0,Ye.d)(e))}return i},ct=r.memo((function({hideModal:e=(()=>{}),closable:t=!1,from:a,wrapInModal:n=!0,useCase:m}){const{sections:P,spaceCreating:I,stepDirection:E,currentStep:Z,handleSkipOnboarding:y}=(({hideModal:e=(()=>{}),closable:t=!1,from:a,wrapInModal:n=!0,useCase:s})=>{const m=(0,i.s0)(),{currUser:g,waitForUserLogin:P}=(0,r.useContext)(h.St),{initialTemplateSize:I,themeSetName:w,initialTheme:E}=(0,de.$)(),Z=!(0,c.isAnonymous)(g),[S,y]=(0,r.useState)((0,ue.NT)(w,I,E)),[v,k]=(0,r.useState)(""),[C,R]=(0,r.useState)(null),[O,M]=(0,r.useState)(""),[W,A]=(0,r.useState)(!1),[_,G]=(0,r.useState)(T.None),[F,B]=(0,r.useState)(!1),X=(0,Oe.just)(g?.id),[D,L]=(0,r.useState)(s===d.ke.WorkSocial?"RWEName":"PickUseCase"),[V,j]=(0,r.useState)(u.N.Left),$=(0,Ke.HR)(l.Df.TestABTestingAndMetricsUser,X,null),U=(0,Ke.HR)(l.Df.TestABTestingAndMetricsSpace,X,null),H=(0,r.useRef)(!1),Y=(0,qe.Z)(),J=(()=>{const{currUser:e}=(0,r.useContext)(h.St),t=(0,Oe.just)(e?.id),a=(0,et.p)(tt.bn.NewCreatorOnboardingFebruary2025,{userId:t});return!e?.id||a.isEnabled("HideSkipAndNewQuestions")})(),K=!Z,Q=(e,t=u.N.Left)=>{L(e),j(t)},q=(0,r.useCallback)((async()=>{if(C){if(S)return await P(),await it(v,S,C,_===T.PasswordProtect?O:"",g,a,_===T.GuestCheckIn?{guestCheckInEnabled:!0}:{});xe.Y.error("onSubmitSpace: missing sourceSpace")}else xe.Y.error("onSubmitSpace: missing useCase")}),[C,S,v,O,g,a,_,P]),ee=(0,r.useCallback)((async()=>{if(C)return await it(v,Qe.IA,C,O,g,a,{spaceWasRWHangoutOnCreation:!0});xe.Y.error("onSubmitRWESpace: missing useCase")}),[C,v,O,g,a]),te=(0,r.useCallback)((e=>{const t=(0,Te.PM)(e);t&&(Je.wI.setForRoom(Je.pt.CreatorOnboardingShowDeskOnboarding,Ue.J.NeedToAssignDesk,t),H.current||Je.wI.setForRoom(Je.pt.SpaceOnboardingStep,!0,t)),m(e)}),[m]),ae=(0,r.useCallback)((async()=>{A(!0),(0,x.NO)(p.MetricsEventName.WIZARD_SELECT_NAME,{location:`From ${a}`},void 0,p.MetricsEventCategory.ONBOARDING),(0,He.Gs)(p.MetricsEventName.SPACE_CREATOR_ONBOARDING_CREATE_SPACE_CLICKED,{userId:X,spaceCreatorSecurityOption:_});const e=await q();if(!e)throw new Error("Unable to get the URL for the newly created space.");e&&te(e)}),[a,X,_,q,te]),ne=(0,r.useCallback)((async()=>{(0,x.NO)(p.MetricsEventName.WIZARD_SELECT_NAME,{location:`From ${a}`},void 0,p.MetricsEventCategory.ONBOARDING),A(!0);const e=await ee();if(!e)throw new Error("Unable to get the URL for the newly created space.");m(e)}),[a,ee,m]),oe=(0,r.useCallback)((e=>e===d.ke.WorkSocial?(0,Oe.compact)(["PickUseCase","RWEName",K&&"SignInWall"]):(0,Oe.compact)(["PickUseCase",Y&&"ValueProp","PickSize","PickName",K&&"SignInWall"])),[K,Y]),re=(0,r.useMemo)((()=>oe(C)),[oe,C]),se=(0,r.useCallback)((async e=>{const{currentStepOverride:t,currentUseCaseOverride:a}=e||{},n=D??t,o=oe(a??C),r=o.findIndex((e=>e===n));if(-1===r)throw new Error("Couldn't find the current step for the CreateSpaceModal.");(0,He.Gs)(p.MetricsEventName.SPACE_CREATOR_ONBOARDING_STEP_COMPLETED,{userId:X,spaceCreatorOnboardingStep:n});const s=r+1,i=r===o.length-1;switch(n){case"PickName":if(K)break;await ae(),i||A(!1);break;case"RWEName":if(K)break;await ne();break;case"SignInWall":A(!1)}if(i)return;const c=(0,Oe.just)(o[s]);Q(c),B(!1)}),[D,oe,ne,ae,K,C,X]),ie=(0,r.useCallback)((e=>{const t=D??e,a=re.findIndex((e=>e===t))-1;if(a>=0){const e=(0,Oe.just)(re[a]);Q(e,u.N.Right),B(!0)}$&&(0,x.NO)(p.MetricsEventName.TEST_AB_TESTING_AND_METRICS_USER,{sourceComponent:"CreateSpaceModal"}),U&&(0,x.NO)(p.MetricsEventName.TEST_AB_TESTING_AND_METRICS_SPACE,{sourceComponent:"CreateSpaceModal"})}),[D,U,$,re]),ce=(0,r.useCallback)((e=>{e!==d.ke.Event?(R(e),$&&(0,x.NO)(p.MetricsEventName.TEST_AB_TESTING_AND_METRICS_USER),U&&(0,x.NO)(p.MetricsEventName.TEST_AB_TESTING_AND_METRICS_SPACE),se({currentUseCaseOverride:e})):m("/events-setup")}),[se,U,$,m]),le=(0,r.useCallback)((async()=>{if(A(!0),(0,x.NO)(p.MetricsEventName.WIZARD_SIGN_IN_COMPLETE,{location:`From ${a}`},void 0,p.MetricsEventCategory.ONBOARDING),C===d.ke.Work){const e=await q();if(!e)throw new Error("Unable to get the URL for the newly created space.");te(e)}else if(C===d.ke.WorkSocial){const e=await ee();if(!e)throw new Error("Unable to get the URL for the newly created space.");m(e)}se()}),[a,C,se,q,te,ee,m]),pe=(0,r.useCallback)((()=>{se(),H.current=!0,(0,He.Gs)(p.MetricsEventName.SPACE_CREATOR_ONBOARDING_ALL_SKIPPED,{userId:X})}),[se,X]),me=(0,r.useMemo)((()=>{const r={closable:t,hideModal:e,from:a,wrapInModal:n,showNextModal:()=>{se()},showPrevModal:()=>{ie()}};return{PickUseCase:{render:()=>(0,o.tZ)(Re,{...r,setNewSpaceUseCase:ce})},PickSize:{render:()=>(0,o.tZ)(Pe,{...r,onChange:e=>y(e)})},PickName:{render:()=>(0,o.tZ)(N,{...r,isRemoteWorkOffice:C===d.ke.Work,spaceName:v,setSpaceName:k,securityOption:_,setSecurityOption:G,password:O,setPassword:M})},SignInWall:{render:()=>((0,b.Z)(!1),(0,o.tZ)(f.Z,{onClose:e,wizard:!0,onSignInComplete:le}))},RWEName:{render:()=>(0,o.tZ)(N,{...r,spaceName:v,setSpaceName:k,securityOption:_,setSecurityOption:G,password:O,setPassword:M})},ValueProp:{render:()=>(0,o.tZ)($e,{...r,hasSkipButton:n&&Y&&!J,onSkip:pe,isNavigatingFromPrevStep:F})}}}),[t,e,a,n,se,ie,ce,C,v,_,O,le,Y,J,pe,F]);return(0,r.useEffect)((()=>{(0,He.Gs)(p.MetricsEventName.SPACE_CREATOR_ONBOARDING_STEP_VIEWED,{userId:X,spaceCreatorOnboardingStep:D})}),[D,X]),{sections:(0,r.useMemo)((()=>(0,z.UID)((([e,t])=>({...t,id:e})),(0,z.Zpf)(me))),[me]),spaceCreating:W,stepDirection:V,currentStep:D,handleSkipOnboarding:pe}})({hideModal:e,closable:t,from:a,wrapInModal:n,useCase:m}),v=(0,qe.Z)();return I?(0,o.tZ)(g.Z,{loadingText:(0,s.ZP)("02a878b")}):"ValueProp"!==Z||n?(0,o.tZ)(u.Z,{sections:P,sectionId:Z,direction:E}):(0,o.BX)(o.HY,{children:[(0,o.tZ)(nt,{}),(0,o.tZ)(u.Z,{sections:P,sectionId:Z,direction:E}),v&&(0,o.tZ)(S.ZP,{position:"absolute",right:"20px",bottom:"20px",children:(0,o.tZ)(w.Z,{kind:"ghost",onPress:y,children:(0,s.ZP)("0e4aaf5")})})]})})),lt=ct},34388:(e,t,a)=>{a.d(t,{Ax:()=>z,B9:()=>R,Bt:()=>f,EY:()=>I,GR:()=>P,Ge:()=>S,Gn:()=>N,Gr:()=>O,HO:()=>T,IF:()=>b,J4:()=>W,J5:()=>q,Lp:()=>G,Qq:()=>V,R2:()=>K,Rx:()=>_,SO:()=>B,U9:()=>E,UU:()=>F,VN:()=>C,VU:()=>w,X:()=>H,_i:()=>D,b6:()=>J,fp:()=>A,gV:()=>g,ik:()=>$,jJ:()=>h,jf:()=>Y,ke:()=>M,lz:()=>U,mH:()=>k,oT:()=>ee,p6:()=>L,pm:()=>X,uJ:()=>Q,uR:()=>Z,v7:()=>v,wP:()=>j,yr:()=>y,ys:()=>x});var n,o=a(77736),r=a(53123),s=a(12892),i=a(17126),c=a(24914),l=a(95473),p=a(82232),d=a(13143),u=a(2823),m=a(95551),h=((n=h||{}).Options="Options",n.Link="Link",n.Create="Create",n);async function g(e){return await s.wP.get(u.HttpV2Paths.SpaceUsers,{auth:!0,params:{path:{space:e}}})}async function b(e){return await s.wP.get(u.HttpV2Paths.SpaceReservations,{auth:!0,params:{path:{space:e}}})}async function f(e){await s.wP.delete(u.HttpV2Paths.Event,{auth:!0,params:{path:{eventId:e}}})}async function P(e,t){return await s.wP.patch(u.HttpV2Paths.Event,{auth:!0,params:{path:{eventId:e},body:{patch:t}}})}async function I(e){return(await s.wP.get(u.HttpV2Paths.Event,{auth:!0,params:{path:{eventId:e}}})).event}async function w(e){return(await s.wP.get(u.HttpV2Paths.PublishedEvent,{params:{path:{eventId:e}}})).event}async function E(e){return(await s.wP.post(u.HttpV2Paths.Events,{auth:!0,params:{body:e}})).event}async function Z(){return(await o.axios.get(r.v.apiURL+"/api/getSpaces")).data}async function S(e){const t=await s.wP.get(u.HttpV2Paths.TemplateMap,{auth:!0,params:{path:{template:e}}});if(!t)throw new Error("Map not found");return t}async function y(e){const t=await s.wP.get(u.HttpV2Paths.GetMapInfoForSpace,{auth:!0,params:{path:{spaceId:e}}});if(!t?.mapInfo)throw new Error("Map not found");return t.mapInfo}async function v(e,t){const a=await s.wP.get(u.HttpV2Paths.SpaceMap,{auth:!0,params:{path:{space:e,map:t}}});if(!a)throw new Error("Map not found");return a}async function k(e){const t=await s.wP.get(u.HttpV2Paths.GatherEventMapLocations,{auth:!0,params:{path:{spaceId:e}}});return t?.mapLocations?t.mapLocations:[]}async function C(e,t){const a=await s.wP.post(u.HttpV2Paths.GatherEventMapLocations,{auth:!0,params:{path:{spaceId:e},body:{location:t}}});if(!a)throw new Error("Failed to create map location");return a.location}async function R(e,t,a){const n=await s.wP.patch(u.HttpV2Paths.GatherEventMapLocation,{auth:!0,params:{path:{spaceId:e,locationId:t},body:{location:a}}});if(!n)throw new Error("Failed to update map location");return n.location}async function x(e,t){await s.wP.delete(u.HttpV2Paths.GatherEventMapLocation,{auth:!0,params:{path:{spaceId:e,locationId:t}}})}async function T(e){return(await s.wP.get(u.HttpV2Paths.GatherEventsACLIsUserOwnerOrEditor,{auth:!0,params:{path:{eventId:e}}})).isOwnerOrEditor}async function O(e){return(await s.wP.get(u.HttpV2Paths.GatherEventsACL,{auth:!0,params:{path:{eventId:e}}})).acl}async function M({eventId:e,email:t}){return(await s.wP.post(u.HttpV2Paths.GatherEventsACL,{auth:!0,params:{path:{eventId:e},body:{email:t}}})).collaborator}async function N({eventId:e,email:t}){await s.wP.delete(u.HttpV2Paths.GatherEventsACLDelete,{auth:!0,params:{path:{eventId:e,email:t}}})}async function W({eventId:e,email:t}){return(await s.wP.post(u.HttpV2Paths.GatherEventsACLMakeOwner,{auth:!0,params:{path:{eventId:e},body:{email:t}}})).collaborator}async function A({spaceId:e,eventId:t}){return(await s.wP.get(u.HttpV2Paths.GatherEventsSessionsSchedule,{auth:!0,params:{path:{spaceId:e,eventId:t}}})).sessions}async function _({spaceId:e,eventId:t}){return(await s.wP.get(u.HttpV2Paths.GatherEventsSessions,{auth:!0,params:{path:{space:e,eventId:t}}})).sessions}async function G({spaceId:e,eventId:t,session:a}){return(await s.wP.post(u.HttpV2Paths.GatherEventsSessions,{auth:!0,params:{path:{space:e,eventId:t},body:{session:a}}})).session}async function F({spaceId:e,eventId:t,sessionId:a,session:n}){return(await s.wP.patch(u.HttpV2Paths.GatherEventsSession,{auth:!0,params:{path:{spaceId:e,eventId:t,sessionId:a},body:{session:n}}})).session}async function B({spaceId:e,eventId:t,sessionId:a}){await s.wP.delete(u.HttpV2Paths.GatherEventsSession,{auth:!0,params:{path:{spaceId:e,eventId:t,sessionId:a}}})}async function z(e){return(await s.wP.get(u.HttpV2Paths.GatherEventsSpeakers,{auth:!0,params:{path:{spaceId:e}}})).speakers}async function X({spaceId:e,speaker:t,eventId:a}){return(await s.wP.post(u.HttpV2Paths.GatherEventsSpeakers,{auth:!0,params:{path:{spaceId:e},body:{speaker:t,eventId:a}}})).speaker}async function D(e){return(await s.wP.get(u.HttpV2Paths.GatherEventsSpaceMaps,{auth:!0,params:{path:{spaceId:e}}})).maps}function L(e){return e?(0,c._L)(i.ou.fromISO(e).toLocal(),null,(0,d.zO)(i.ou.local())):""}function V(){const e=decodeURI(window.location.pathname).split("/"),t=e[2];return 4===e.length&&t?t:null}async function j({spaceId:e}){return(await s.wP.get(u.HttpV2Paths.GatherEventsSessionsForSpace,{auth:!0,params:{path:{spaceId:e}}})).sessions}async function $({spaceId:e}){return await s.wP.get(u.HttpV2Paths.GatherEventsPathwaysRooms,{auth:!0,params:{path:{spaceId:e}}})}async function U({spaceId:e,roomId:t}){return await s.wP.get(u.HttpV2Paths.SpaceRoomSpawns,{auth:!0,params:{path:{space:e,room:t}}})}function H(e,t){return s.wP.post(u.HttpV2Paths.GatherEventsMessages,{auth:!0,params:{path:{spaceId:e},body:t}})}function Y(e,t,a){return s.wP.patch(u.HttpV2Paths.GatherEventsMessage,{auth:!0,params:{path:{spaceId:e,messageId:t},body:a}})}function J(e,t,a){return s.wP.get(u.HttpV2Paths.GatherEventsRoomMessages,{auth:!0,params:{path:{spaceId:e,roomId:t},query:a}})}async function K({spaceId:e,eventId:t,rooms:a,numAttendees:n}){await s.wP.post(u.HttpV2Paths.GatherEventsSyncRooms,{auth:!0,params:{path:{spaceId:e},body:{eventId:t,rooms:a,numAttendees:n}}})}const Q=(0,m.enumToHuman)(l.GatherEventUseCase,{PartyOrSocialGathering:(0,p.EI)((0,p.ZP)("a6ef6ee")),TalkOrSeminar:(0,p.EI)((0,p.ZP)("3fa7698")),ConferenceConventionOrExpo:(0,p.EI)((0,p.ZP)("6aabc31")),MeetingOrNetworkingEvent:(0,p.EI)((0,p.ZP)("379be88")),ClassOrWorkshop:(0,p.EI)((0,p.ZP)("a253f5a")),Other:(0,p.EI)((0,p.ZP)("Other"))}),q=(0,m.enumToHuman)(l.GatherEventProfessionalCategory,{internal:(0,p.EI)((0,p.ZP)("67d2b83")),external:(0,p.EI)((0,p.ZP)("60282a4")),NA:(0,p.EI)((0,p.ZP)("N/A"))}),ee=(0,m.enumToHuman)(l.GatherEventCategory,{ProfessionalOrBusiness:(0,p.EI)((0,p.ZP)("0c769eb")),CommunityOrOrganization:(0,p.EI)((0,p.ZP)("45e39d4")),EducationOrAcademia:(0,p.EI)((0,p.ZP)("eb6b70d")),FriendsOrFamily:(0,p.EI)((0,p.ZP)("3b53d25")),Other:(0,p.EI)((0,p.ZP)("Other"))})},3332:(e,t,a)=>{a.d(t,{Z:()=>c});var n=a(35944),o=a(67294),r=a(61120),s=a(45078),i=a(68563);const c=({onClose:e,wizard:t=!1,onSignInComplete:a,event:c=!1,signInText:l})=>{const p=(0,o.useRef)(null);return(0,s.Z)(p,e),(0,n.tZ)(i.ZP,{display:"flex",ref:p,children:(0,n.tZ)(r.default,{wizard:t,event:c,onSignInComplete:a,signInText:l})})}},33021:(e,t,a)=>{a.d(t,{J:()=>s,X:()=>r});var n,o,r=((o=r||{}).InviteTeam="InviteTeam",o.OnboardingSurveyRole="OnboardingSurveyRole",o.OnboardingSurveyWorkType="OnboardingSurveyWorkType",o.OnboardingSurveySize="OnboardingSurveySize",o.OnboardingSurveyLearnAbout="OnboardingSurveyLearnAbout",o.Calendar="Calendar",o.AutoPromotion="AutoPromotion",o.OnboardingSurveyChoosingProcess="OnboardingSurveyChoosingProcess",o.OnboardingSurveyOfficeUse="OnboardingSurveyOfficeUse",o.OnboardingSurveyMainGoal="OnboardingSurveyMainGoal",o.OnboardingSurveyExpectedUsers="OnboardingSurveyExpectedUsers",o),s=((n=s||{}).NeedToAssignDesk="AssignDesk",n.DesksAlreadyAssigned="DesksAlreadyAssigned",n)},10114:(e,t,a)=>{a.d(t,{Ai:()=>g,BX:()=>u,F2:()=>h,Lb:()=>m,R4:()=>b,SI:()=>f,ST:()=>P,YA:()=>Z,le:()=>I,nC:()=>d,xC:()=>w});var n=a(69983),o=a.n(n),r=a(12892),s=a(15445),i=a(47727),c=a(2823),l=a(67224),p=a(95551);function d(e,t,a){try{return(0,l.NT)(e,t,a),!0}catch{return!1}}function u(e,t){for(const a of Object.values(l.n4))try{return(0,l.NT)(e,a,t),a}catch{}}function m(e){const[t,a,...n]=e.split("_");return n.join("_")}const h=async(e,t)=>r.wP.post(c.HttpV2Paths.RWOfficeConfigurationConfigure,{auth:!0,params:{path:{space:e},body:{sourceSpace:t}}});function g(e,t){if(!t)return Object.values(l.gX);const a=l.aq[e][t];return a?Object.values(l.gX).reduce(((e,t)=>[...e,...a[t]?[]:[t]]),[]):Object.values(l.gX)}function b(e){const[t,a]=e.split("_");return Number(a)??0}function f(e){return!!l.iN[e]}function P(e){return{url:l.iN[e]??"",alt:`Preview for map size: ${(0,l.c)(e)} and theme: ${(0,l.Mx)(e)}`}}const I=o()(Object.values(l.gX)).map((e=>(0,p.enumFromValue)(e,l.gX))),w=async(e,t,a=!1)=>await r.wP.get(c.HttpV2Paths.RWOfficeConfigurationConfigureDefaultMapId,{auth:!0,params:{path:{space:e,source:t,isBackup:String(a)}}})??"",E=e=>{const[t,a]=function(e){const t=(i.x.mapState[e]?.spawns??[]).filter((e=>!e.spawnId)),a=t[Math.trunc(Math.random()*t.length)];return[a?.x??0,a?.y??0]}(e);Object.keys(i.x.gameState??{}).forEach((n=>s.H.teleport(e,t,a,n)))},Z=async(e,t)=>new Promise((a=>{s.H.lastMapUpdateIds[e]===t&&(E(e),a(void 0));const n=s.H.subscribeToEvent("mapCommitsChanges",(async({mapCommitsChanges:o})=>{o.mapId!==e||o.updateId!==t||(n(),E(e),a(void 0))}))}))},97566:(e,t,a)=>{a.d(t,{N:()=>c,Z:()=>p});var n,o=a(35944),r=a(67294),s=a(81472),i=a(99985),c=((n=c||{}).Left="left",n.Right="right",n);const l=r.memo((function({sections:e,defaultId:t,delta:a=50,config:n=i.Vo,immediate:c=!0,defaultDirection:l="right",sectionId:p,direction:d,onRest:u,exitBeforeEnter:m=!1}){const[h,g]=(0,r.useState)(t?e.findIndex((e=>e.id===t)):0),[b,f]=(0,r.useState)(l),[P,I]=(0,r.useState)(c),w=(0,s.useTransition)(h,{immediate:P,from:{opacity:0,pointer:!1,progress:("left"===b?1:-1)*a},enter:{opacity:1,pointer:!0,progress:0},leave:{opacity:0,pointer:!1,progress:("left"===b?-1:1)*a},config:n,onRest:u,exitBeforeEnter:m});return(0,r.useEffect)((()=>{I(!1)}),[]),(0,r.useEffect)((function(){d&&f(d)}),[d]),(0,r.useEffect)((function(){p&&g(e.findIndex((e=>e.id===p)))}),[p,e]),w((({opacity:t,progress:a,pointer:n},r)=>e[r]&&(0,o.tZ)(s.animated.div,{style:{pointerEvents:n?"auto":"none",position:"absolute",opacity:t,transform:a.to((e=>`translate3d(${e}px, 0, 0)`))},children:e[r]?.render({exit:(t,a="left")=>{f(a),g(e.findIndex((e=>e.id===t)))}})})))})),p=l},1983:(e,t,a)=>{a.d(t,{Z:()=>h});var n=a(35944),o=a(67294),r=a(94398),s=a(10932),i=a(92851);const c=s.Z.div`
  height: 16px;
  width: 16px;
  background-color: ${i.COLORS.WHITE};
  border: 2px solid ${i.COLORS.BLUE3};
  border-radius: 10px;
  left: 0;
`,l=s.Z.div`
  height: 16px;
  display: flex;
  justify-content: center;
  width: 100%;
`,p=s.Z.div`
  height: 20px;
  width: auto;
  left: 0;
  text-align: center;
`,d=s.Z.div`
  position: absolute;
  top: 5px;
  left: calc(50% - 5px);
  height: 10px;
  width: 10px;
  background-color: ${i.COLORS.WHITE};
  border: 2px solid ${i.COLORS.GRAY2};
  border-radius: 10px;
`,u=s.Z.div`
  position: relative;
  top: 22px;
  font-size: 12px;
  font-weight: ${({isCurrentValue:e})=>e?"600":"normal"};
  color: ${({color:e})=>e};
`,m=s.Z.div`
  position: absolute;
  top: calc(50% - 2px);
  height: 4px;
  width: 100%;
  background-color: ${i.COLORS.GRAY2};
  border-radius: 2px;
`,h=({step:e=1,min:t=0,max:a=100,defaultValues:s=[],values:h,onChange:g,onFinalChange:b,marks:f,markColor:P,backgroundColors:I=[i.COLORS.GRAY2,i.COLORS.GRAY2],thumbStyle:w,thumb:E=!0})=>{const[Z,S]=(0,o.useState)(s),y=h||Z,v=f?(({step:e,values:t,min:a,marks:o,color:r})=>({props:s,index:c})=>{const l=+(a+c*e).toFixed(10),m=t.includes(l),h=o[l];return h?(0,n.BX)(p,{...s,style:s.style,children:[(0,n.tZ)(d,{}),(0,n.tZ)(u,{isCurrentValue:m,style:"object"==typeof h&&"label"in h?h.style:void 0,color:r??i.COLORS.GRAY5,children:"object"==typeof h&&"label"in h?h.label:h})]}):null})({step:e,values:y,min:t,marks:f,color:P}):void 0,k=(({backgroundColors:e,values:t,min:a,max:o})=>({props:s,children:i})=>(0,n.BX)(l,{...s,style:s.style,children:[(0,n.tZ)(m,{style:{background:(0,r.getTrackBackground)({values:t,colors:e,min:a,max:o})}}),i]}))({values:y,min:t,max:a,backgroundColors:I});return(0,n.tZ)(r.Range,{step:e,min:t,max:a,values:y,onChange:e=>{h||S(e),g&&g(e)},onFinalChange:b,renderThumb:({props:e})=>E?(0,n.tZ)(c,{...e,style:{...w,...e.style}}):null,renderTrack:k,renderMark:v})}},66948:(e,t,a)=>{a.d(t,{Z:()=>c});var n=a(35944),o=a(10932),r=a(70917);const s=o.Z.label`
  position: relative;
  display: inline-block;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  ${({size:e})=>{const{width:t,height:a}=(e=>{switch(e){case"sm":return{height:"18px",width:"28px"};case"md":return{height:"22px",width:"40px"};case"lg":return{height:"30px",width:"54px"}}})(e);return r.iv`
      width: ${t};
      height: ${a};
    `}}
`,i=o.Z.span`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  transition: 200ms;
  border-radius: 22px;
  cursor: ${({checkedState:e})=>"disabled"===e?"default":"pointer"};

  &:before {
    position: absolute;
    content: "";
    transition: 200ms;
    border-radius: 50%;
  }

  ${({theme:e,size:t,checked:a,checkedState:n,kind:o})=>{const{backgroundColor:s}=e.switch[o][n],{width:i,height:c,left:l,bottom:p,xDelta:d,borderSize:u}=(e=>{switch(e){case"sm":return{height:"10px",width:"10px",left:"2px",bottom:"2px",xDelta:"10px",borderSize:"2px"};case"md":return{height:"14px",width:"14px",left:"3px",bottom:"2px",xDelta:"16px",borderSize:"2px"};case"lg":return{height:"20px",width:"20px",left:"3px",bottom:"2px",xDelta:"22px",borderSize:"3px"}}})(t);return r.iv`
      border: ${u} solid ${s};

      &:before {
        width: ${i};
        height: ${c};
        left: ${l};
        bottom: ${p};
        ${a&&`transform: translateX(${d});`}
        background-color: ${s};
      }
    `}}
`,c=e=>{const{kind:t="standard",checked:a,setChecked:o,size:r="md",isDisabled:c=!1,isLoading:l=!1,noLabelClick:p=!1}=e,d=(({checked:e,isDisabled:t,isLoading:a})=>{switch(!0){case t:return"disabled";case a:return"loading";case e:return"checked";default:return"unchecked"}})({isLoading:l,isDisabled:c,checked:a});return(0,n.BX)(s,{size:r,"data-testid":e["data-testid"],onClick:p?e=>{e.preventDefault()}:void 0,children:[(0,n.tZ)("input",{type:"checkbox",checked:a,onChange:e=>o(e.target.checked),disabled:c||l}),(0,n.tZ)(i,{kind:t,checkedState:d,checked:a,size:r})]})}},72955:(e,t,a)=>{a.d(t,{$:()=>k,n:()=>C});var n,o=a(35944),r=a(67294),s=((n=s||{})[n.Emoji=0]="Emoji",n[n.ImageSrc=1]="ImageSrc",n),i=a(82232),c=a(67224);const l={name:c.Pt.Original2022,themeNameAndIconMap:{[c.gX.Group1]:{name:(0,i.EI)((0,i.ZP)("43b3bfc")),icon:"🌳",iconType:s.Emoji},[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("4b842ec")),icon:"🏙️",iconType:s.Emoji},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("7db3cf5")),icon:"🏠",iconType:s.Emoji},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"🚀",iconType:s.Emoji}},marksToSize:{0:c.n4.RW2_6,1:c.n4.RW6_12,2:c.n4.RW12_18,3:c.n4.RW18_25,4:c.n4.RW25_35,5:c.n4.RW35_50,6:c.n4.RW50_65,7:c.n4.RW65_85,8:c.n4.RW85_110,9:c.n4.RW110_125,10:c.n4.RW125_150},sliderMarks:{0:{label:"2"},1:{label:" "},2:{label:" "},3:{label:"25"},4:{label:" "},5:{label:" "},6:{label:"50"},7:{label:" "},8:{label:" "},9:{label:" "},10:{label:"150"}},hasMaxTemplateMessage:!1},p={name:c.Pt.June2023,themeNameAndIconMap:{[c.gX.Group1]:{name:(0,i.EI)((0,i.ZP)("Modern")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_modern.png?alt=media",iconType:s.ImageSrc},[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Nature")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_nature.png?alt=media",iconType:s.ImageSrc},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Future")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_future.png?alt=media",iconType:s.ImageSrc},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_cozy.png?alt=media",iconType:s.ImageSrc}},marksToSize:{0:c.n4.RW10,1:c.n4.RW20,2:c.n4.RW30,3:c.n4.RW40,4:c.n4.RW50,5:c.n4.RW60,6:c.n4.RW70,7:c.n4.RW80,8:c.n4.RW90,9:c.n4.RW100},sliderMarks:{0:{label:"10"},1:{label:"20"},2:{label:"30"},3:{label:"40"},4:{label:"50"},5:{label:"60"},6:{label:"70"},7:{label:"80"},8:{label:"90"},9:{label:"100"}},hasMaxTemplateMessage:!0},d={name:c.Pt.Bigger2023,themeNameAndIconMap:{[c.gX.Group1]:{name:(0,i.EI)((0,i.ZP)("Modern")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_modern.png?alt=media",iconType:s.ImageSrc},[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Nature")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_nature.png?alt=media",iconType:s.ImageSrc},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Future")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_future.png?alt=media",iconType:s.ImageSrc},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_cozy.png?alt=media",iconType:s.ImageSrc}},marksToSize:{0:c.n4.RW10,1:c.n4.RW20,2:c.n4.RW30,3:c.n4.RW40,4:c.n4.RW50,5:c.n4.RW60,6:c.n4.RW70,7:c.n4.RW80,8:c.n4.RW90,9:c.n4.RW100},sliderMarks:{0:{label:"10"},1:{label:"20"},2:{label:"30"},3:{label:"40"},4:{label:"50"},5:{label:"60"},6:{label:"70"},7:{label:"80"},8:{label:"90"},9:{label:"100"}},hasMaxTemplateMessage:!0},u={name:c.Pt.Chunked2023,themeNameAndIconMap:{[c.gX.Group1]:{name:(0,i.EI)((0,i.ZP)("Modern")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_modern.png?alt=media",iconType:s.ImageSrc},[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Nature")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_nature.png?alt=media",iconType:s.ImageSrc},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Future")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_future.png?alt=media",iconType:s.ImageSrc},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_cozy.png?alt=media",iconType:s.ImageSrc}},marksToSize:{0:c.n4.RW10,1:c.n4.RW20,2:c.n4.RW30,3:c.n4.RW40,4:c.n4.RW50,5:c.n4.RW60,6:c.n4.RW70,7:c.n4.RW80,8:c.n4.RW90,9:c.n4.RW100},sliderMarks:{0:{label:"10"},1:{label:"20"},2:{label:"30"},3:{label:"40"},4:{label:"50"},5:{label:"60"},6:{label:"70"},7:{label:"80"},8:{label:"90"},9:{label:"100"}},hasMaxTemplateMessage:!0},m={name:c.Pt.Decorated2023,themeNameAndIconMap:{[c.gX.Group1]:{name:(0,i.EI)((0,i.ZP)("Modern")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_modern.png?alt=media",iconType:s.ImageSrc},[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Nature")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_nature.png?alt=media",iconType:s.ImageSrc},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Future")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_future.png?alt=media",iconType:s.ImageSrc},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/remote-work%2Foffice-configuration%2Ficons%2Fmapicon_cozy.png?alt=media",iconType:s.ImageSrc}},marksToSize:{0:c.n4.RW10,1:c.n4.RW20,2:c.n4.RW30,3:c.n4.RW40,4:c.n4.RW50,5:c.n4.RW60,6:c.n4.RW70,7:c.n4.RW80,8:c.n4.RW90,9:c.n4.RW100},sliderMarks:{0:{label:"10"},1:{label:"20"},2:{label:"30"},3:{label:"40"},4:{label:"50"},5:{label:"60"},6:{label:"70"},7:{label:"80"},8:{label:"90"},9:{label:"100"}},hasMaxTemplateMessage:!0},h={name:c.Pt.UFP3,themeNameAndIconMap:{[c.gX.Group1]:{name:(0,i.EI)((0,i.ZP)("Clean")),icon:"🏙️",iconType:s.Emoji},[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"🛋️",iconType:s.Emoji},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Beach")),icon:"⛱️",iconType:s.Emoji},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Sleek")),icon:"🌇",iconType:s.Emoji}},marksToSize:{0:c.n4.RW10,1:c.n4.RW20,2:c.n4.RW30,3:c.n4.RW40,4:c.n4.RW50,5:c.n4.RW60,6:c.n4.RW70,7:c.n4.RW80,8:c.n4.RW90,9:c.n4.RW100},sliderMarks:{0:{label:"10"},1:{label:"20"},2:{label:"30"},3:{label:"40"},4:{label:"50"},5:{label:"60"},6:{label:"70"},7:{label:"80"},8:{label:"90"},9:{label:"100"}},hasMaxTemplateMessage:!0},g={name:c.Pt.UFPNoClean,themeNameAndIconMap:{[c.gX.Group1]:null,[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"🛋️",iconType:s.Emoji},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Beach")),icon:"⛱️",iconType:s.Emoji},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Sleek")),icon:"🌇",iconType:s.Emoji}},marksToSize:{0:c.n4.RW10,1:c.n4.RW20,2:c.n4.RW30,3:c.n4.RW40,4:c.n4.RW50,5:c.n4.RW60,6:c.n4.RW70,7:c.n4.RW80,8:c.n4.RW90,9:c.n4.RW100},sliderMarks:{0:{label:"10"},1:{label:"20"},2:{label:"30"},3:{label:"40"},4:{label:"50"},5:{label:"60"},6:{label:"70"},7:{label:"80"},8:{label:"90"},9:{label:"100"}},hasMaxTemplateMessage:!0},b={name:c.Pt.UFPNoCleanNoBeach,themeNameAndIconMap:{[c.gX.Group1]:null,[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"🛋️",iconType:s.Emoji},[c.gX.Group3]:null,[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Sleek")),icon:"🌇",iconType:s.Emoji}},marksToSize:{0:c.n4.RW10,1:c.n4.RW20,2:c.n4.RW30,3:c.n4.RW40,4:c.n4.RW50,5:c.n4.RW60,6:c.n4.RW70,7:c.n4.RW80,8:c.n4.RW90,9:c.n4.RW100},sliderMarks:{0:{label:"10"},1:{label:"20"},2:{label:"30"},3:{label:"40"},4:{label:"50"},5:{label:"60"},6:{label:"70"},7:{label:"80"},8:{label:"90"},9:{label:"100"}},hasMaxTemplateMessage:!0},f={name:c.Pt.UFPAndClassic,themeNameAndIconMap:{[c.gX.Group1]:{name:(0,i.EI)((0,i.ZP)("43b3bfc")),icon:"🌳",iconType:s.Emoji},[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"🛋️",iconType:s.Emoji},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Warm")),icon:"🏠",iconType:s.Emoji},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Sleek")),icon:"🌇",iconType:s.Emoji}},marksToSize:{0:c.n4.RW10,1:c.n4.RW20,2:c.n4.RW30,3:c.n4.RW40,4:c.n4.RW50,5:c.n4.RW60,6:c.n4.RW70,7:c.n4.RW80,8:c.n4.RW90,9:c.n4.RW100},sliderMarks:{0:{label:"10"},1:{label:"20"},2:{label:"30"},3:{label:"40"},4:{label:"50"},5:{label:"60"},6:{label:"70"},7:{label:"80"},8:{label:"90"},9:{label:"100"}},hasMaxTemplateMessage:!0},P={name:c.Pt.AmbientDesks,themeNameAndIconMap:{[c.gX.Group1]:{name:(0,i.EI)((0,i.ZP)("Clean")),icon:"🏙️",iconType:s.Emoji},[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"🛋️",iconType:s.Emoji},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Beach")),icon:"⛱️",iconType:s.Emoji},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Sleek")),icon:"🌇",iconType:s.Emoji}},marksToSize:{0:c.n4.AMB8,1:c.n4.AMB16,2:c.n4.AMB24,3:c.n4.AMB32,4:c.n4.AMB40,5:c.n4.RW50,6:c.n4.RW60,7:c.n4.RW70,8:c.n4.RW80,9:c.n4.RW90,10:c.n4.RW100},sliderMarks:{0:{label:"8"},1:{label:"16"},2:{label:"24"},3:{label:"30"},4:{label:"40"},5:{label:"50"},6:{label:"60"},7:{label:"70"},8:{label:"80"},9:{label:"90"},10:{label:"100"}},hasMaxTemplateMessage:!0},I={name:c.Pt.AmbientDesks,themeNameAndIconMap:{[c.gX.Group1]:null,[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"🛋️",iconType:s.Emoji},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Beach")),icon:"⛱️",iconType:s.Emoji},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Sleek")),icon:"🌇",iconType:s.Emoji}},marksToSize:{0:c.n4.AMB8,1:c.n4.AMB16,2:c.n4.AMB24,3:c.n4.AMB32,4:c.n4.AMB40,5:c.n4.RW50,6:c.n4.RW60,7:c.n4.RW70,8:c.n4.RW80,9:c.n4.RW90,10:c.n4.RW100},sliderMarks:{0:{label:"8"},1:{label:"16"},2:{label:"24"},3:{label:"30"},4:{label:"40"},5:{label:"50"},6:{label:"60"},7:{label:"70"},8:{label:"80"},9:{label:"90"},10:{label:"100"}},hasMaxTemplateMessage:!0},w={name:c.Pt.AmbientDesksJan2024,themeNameAndIconMap:{[c.gX.Group1]:{name:(0,i.EI)((0,i.ZP)("43b3bfc")),icon:"🌳",iconType:s.Emoji},[c.gX.Group2]:{name:(0,i.EI)((0,i.ZP)("Cozy")),icon:"🛋️",iconType:s.Emoji},[c.gX.Group3]:{name:(0,i.EI)((0,i.ZP)("Startup")),icon:"🚀",iconType:s.Emoji},[c.gX.Group4]:{name:(0,i.EI)((0,i.ZP)("Sleek")),icon:"🌇",iconType:s.Emoji}},marksToSize:{0:c.n4.AMB8,1:c.n4.AMB16,2:c.n4.AMB24,3:c.n4.AMB32,4:c.n4.AMB40,5:c.n4.RW50,6:c.n4.RW60,7:c.n4.RW70,8:c.n4.RW80,9:c.n4.RW90,10:c.n4.RW100},sliderMarks:{0:{label:"8"},1:{label:"16"},2:{label:"24"},3:{label:"32"},4:{label:"40"},5:{label:"50"},6:{label:"60"},7:{label:"70"},8:{label:"80"},9:{label:"90"},10:{label:"100"}},hasMaxTemplateMessage:!0},E={[c.Pt.Original2022]:l,[c.Pt.June2023]:p,[c.Pt.Bigger2023]:d,[c.Pt.Chunked2023]:u,[c.Pt.Decorated2023]:m,[c.Pt.UFP3]:h,[c.Pt.UFPNoClean]:g,[c.Pt.UFPNoCleanNoBeach]:b,[c.Pt.UFPAndClassic]:f,[c.Pt.AmbientDesks]:P,[c.Pt.AmbientDesksNoClean]:I,[c.Pt.AmbientDesksJan2024]:w};var Z=a(35025),S=a(55371),y=a(76777),v=a(10114);const k=e=>{const t=e??c.Pt.Original2022,a=(0,r.useMemo)((()=>E[t]),[t]),n=e=>(0,Z.isNotNil)(a.themeNameAndIconMap[e]),{sliderMarks:i,marksToSize:l,hasMaxTemplateMessage:p,name:d}=a,u=(0,Z.just)(l[0]),m=(0,Z.just)(v.le.find((e=>n(e))));return{getThemeName:e=>a.themeNameAndIconMap[e]?.name,getThemeIcon:e=>{const t=a.themeNameAndIconMap[e];return t?(({name:e,icon:t,iconType:a})=>a===s.Emoji?t:a===s.ImageSrc?(0,o.tZ)("img",{css:y.zG,src:t,alt:e}):void 0)(t):void 0},getThemeExists:n,sliderMarks:i,marksToSize:l,initialTemplateSize:u,hasMaxTemplateMessage:p,themeSetName:d,initialTheme:m}},C=()=>{const e=(0,S.V5)(),t=(0,c._R)(e);return k(t)}},73799:(e,t,a)=>{a.d(t,{L:()=>r});var n=a(67294),o=a(44308);function r(e,t){const[a,r]=(0,n.useState)(!0),[s,i]=(0,n.useState)(null),[c,l]=(0,n.useState)(t),[p,d]=(0,n.useState)(0),u=(0,n.useCallback)((()=>{d(Date.now())}),[]);return(0,n.useEffect)((()=>{let t=!1;return(async()=>{try{r(!0);const a=await e();if(t)return;l(a),r(!1)}catch(e){const a=(0,o.guaranteedError)(e);if(t)return;i(a),r(!1)}})(),()=>{t=!0}}),[e,p]),{resource:c,loading:a,error:s,refresh:u}}},87733:(e,t,a)=>{a.d(t,{p:()=>r});var n=a(67294),o=a(75348);const r=(e,t)=>(0,n.useMemo)((()=>new o.n(e,t)),[t,e])},78368:(e,t,a)=>{a.d(t,{p:()=>n});const n=e=>new Promise((t=>{const a=new Image;a.onload=()=>t(),a.src=e}))},26327:(e,t,a)=>{a.d(t,{Bx:()=>f,ID:()=>w,NF:()=>I,gt:()=>P});var n=a(77736),o=a(53123),r=a(50662),s=a(44308),i=a(16098),c=a(12892),l=a(82232),p=a(2823),d=a(93463),u=a(54144),m=a(86280),h=a(81697),g=a(17126);const b=async e=>{(r.Us.includes(e)||r._u.includes(e))&&await(0,i.P)({[r.Us.includes(e)?d.g.LastRemoteWorkSpaceCreationDate:d.g.LastEventSpaceCreationDate]:(0,s.getFormattedHubSpotDate)()})},f=async(e,t,a,r,s,i={},c)=>{const l={name:t,settings:i,password:a,map:r,reason:s};return/[a-zA-Z0-9]{16}\\.+/.test(r)&&(l.sourceSpace=r),c&&await b(s),await n.axios.post(o.v.apiURL+"/api/v2/spaces",l,{headers:{authorization:`Bearer ${e}`}})},P=()=>{const e=u.wI.getKey(u.gA.FirstSpaceCreationDateMetric);if((0,h.kKJ)(e))return e;if("string"!=typeof e)return null;const t=g.ou.fromISO(e);return t.isValid?t:null},I=async(e,t,a,n,o={},r)=>{const s=P(),i={name:e,settings:o,reason:a,password:n,sourceSpace:t};r&&await b(a);const l=await c.wP.post(p.HttpV2Paths.Spaces,{auth:!0,params:{body:i}});if(void 0===s){const e=await(0,m.nZ)();1===Object.keys(e??{}).length?u.wI.set(u.gA.FirstSpaceCreationDateMetric,(new Date).toISOString()):u.wI.set(u.gA.FirstSpaceCreationDateMetric,null)}return l},w=[{value:r.ke.Work,label:(0,l.EI)((0,l.ZP)("00652b1"))},{value:r.ke.Event,label:(0,l.EI)((0,l.ZP)("Event"))},{value:r.ke.SocialExperience,label:(0,l.EI)((0,l.ZP)("228d14e"))},{value:r.ke.Edu,label:(0,l.EI)((0,l.ZP)("aaf87fe"))},{value:r.ke.Other,label:(0,l.EI)((0,l.ZP)("Other"))}]},40657:(e,t,a)=>{a.d(t,{Z:()=>s});var n=a(31338),o=a(81697);const r=["ja-JP","ja"],s=()=>!r.some((0,o.fS0)((0,n.fu)()))}}]);
//# sourceMappingURL=https://sourcemaps.us-east-1-a.prod.aws.gather.town/v1/gather-browser/72991861a/bundle.9fd9152f19e6d38c9b0c.js.map
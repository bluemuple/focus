"use strict";(self.webpackChunkgather_browser=self.webpackChunkgather_browser||[]).push([[7473],{6564:(e,t,n)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.getSupportedTimezoneValues=void 0;const i=n(75323);t.getSupportedTimezoneValues=e=>"supportedValuesOf"in Intl?Intl.supportedValuesOf("timeZone"):(0,i.supportedValuesOf)("timeZone",e)},85515:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.getRemoteWorkEmojiAndStatus=t.sortPlayerIdsBasedOnSearch=t.getOrderedPlayerIds=t.getSearchFilteredPlayerIds=t.compareNames=void 0,t.compareNames=(e,t)=>e?t?e.toLowerCase().localeCompare(t.toLowerCase()):-1:1,t.getSearchFilteredPlayerIds=(e,t,n)=>e.length>0?t.filter((t=>n[t]?.toLowerCase().includes(e.toLowerCase()))):t,t.getOrderedPlayerIds=(e,n,i,o,a)=>[...n].sort(((n,r)=>{const s=a&&a.length>0?((e,t)=>Number(t)-Number(e))(a.includes(n),a.includes(r)):0,d=((e,t)=>(t?1:0)-(e?1:0))(o?.[n]??!1,o?.[r]??!1);if(0!==s)return s;if(0===d){const o=((e,t,n)=>e===n?-1:t===n?1:0)(n,r,e);return 0===o?(0,t.compareNames)(i[n]??"",i[r]??""):o}return d})),t.sortPlayerIdsBasedOnSearch=function({search:e,playerIds:t,playerNames:n}){if(!e)return t;const i=e.toLowerCase();return[...t].sort(((e,t)=>{const o=n[e]??"",a=n[t]??"",r=o.toLowerCase().startsWith(i),s=a.toLowerCase().startsWith(i);return r&&!s?-1:!r&&s?1:0}))},t.getRemoteWorkEmojiAndStatus=({isOnline:e,eventStatus:t,emojiStatus:n,textMap:i,textStatus:o,inConversation:a})=>e?t?{emoji:" 🗓️",status:i.inMeeting}:a?{emoji:" 💬",status:i.inConversation}:{emoji:n?` ${n}`:"",status:o}:{emoji:"",status:""}},45521:(e,t,n)=>{t.iP=t.rz=t.NZ=t.pL=t.dj=void 0;var i=n(85515);Object.defineProperty(t,"dj",{enumerable:!0,get:function(){return i.compareNames}}),Object.defineProperty(t,"pL",{enumerable:!0,get:function(){return i.getSearchFilteredPlayerIds}}),Object.defineProperty(t,"NZ",{enumerable:!0,get:function(){return i.getOrderedPlayerIds}}),Object.defineProperty(t,"rz",{enumerable:!0,get:function(){return i.sortPlayerIdsBasedOnSearch}}),Object.defineProperty(t,"iP",{enumerable:!0,get:function(){return i.getRemoteWorkEmojiAndStatus}})},64755:(e,t,n)=>{t.Ey=t.HG=t.sX=t.Ez=void 0;var i=n(9411);Object.defineProperty(t,"Ez",{enumerable:!0,get:function(){return i.getOffsetForZone}}),Object.defineProperty(t,"sX",{enumerable:!0,get:function(){return i.offsetToLabel}}),Object.defineProperty(t,"HG",{enumerable:!0,get:function(){return i.getTimezoneLabel}}),Object.defineProperty(t,"Ey",{enumerable:!0,get:function(){return i.getTimezoneOptionsMap}})},9411:function(e,t,n){var i=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0}),t.offsetToLabel=t.getOffsetForZone=t.getTimezoneLabel=t.getTimezoneOptionsMap=void 0;const o=n(44868),a=i(n(64344)),r=n(6564),s=/\/([^/]+)$/;t.getTimezoneOptionsMap=(e="en-US")=>{const t=(0,r.getSupportedTimezoneValues)(e).map((t=>{const n=o.DateTime.local({zone:t,locale:e});return{value:t,long:n.toFormat("ZZZZZ"),offset:n.offset}})),n=(0,a.default)(t,"long");return Object.values(n).reduce(((e,t)=>t[0]?{...e,[t[0].value]:{value:t[0].value,long:t[0].long,offset:t[0].offset,cities:t.map((e=>e.value.match(s)?.[1]?.replace("_"," ")))}}:e),{})},t.getTimezoneLabel=function(e,n="en-US"){const i=(0,t.getTimezoneOptionsMap)(n);let a=i[e]?.long;if(a)return a;const r=o.FixedOffsetZone.parseSpecifier(e);return a=r?Object.values(i).find((e=>{const t=o.DateTime.local({zone:e.value});return r.offset(t.toMillis())===t.offset}))?.long:void 0,a||e},t.getOffsetForZone=(e,t)=>{const n=t?o.DateTime.fromJSDate(t).setZone(e):o.DateTime.now().setZone(e);return n.zone.offset(n.toMillis())},t.offsetToLabel=(e,t,n)=>{const i=`${Math.trunc(e/60)}:`+(e%60==0?"00":Math.abs(e%60));return`${t??""}GMT${e<0?i:`+${i}`}${n??""}`}},58980:(e,t,n)=>{t.ZF=t.fU=void 0;var i=n(29385);Object.defineProperty(t,"fU",{enumerable:!0,get:function(){return i.Plan}}),Object.defineProperty(t,"ZF",{enumerable:!0,get:function(){return i.PlanInterval}})},29385:(e,t)=>{var n,i,o;Object.defineProperty(t,"__esModule",{value:!0}),t.PlanInterval=t.Plan=void 0,(i=n||(t.Plan=n={})).Free="free",i.Trial="trial",i.Premium="premium",i.Enterprise="enterprise",function(e){e.Annual="annual",e.Monthly="monthly"}(o||(t.PlanInterval=o={}))},97995:(e,t,n)=>{t.Lz=t.mb=void 0;var i=n(22766);Object.defineProperty(t,"mb",{enumerable:!0,get:function(){return i.LokalizedLink}}),Object.defineProperty(t,"Lz",{enumerable:!0,get:function(){return i.getLocalizedLink}})},22766:(e,t,n)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.getLocalizedLink=t.LokalizedLink=void 0;const i=n(13187),o=n(19695);var a,r;(r=a||(t.LokalizedLink=a={})).LocalizationEduModalScreenshot="LocalizationEduModalScreenshot",r.RolesAndPermissions="RolesAndPermissions",r.Support="Support",r.NewSupportTicket="NewSupportTicket",r.VPNFirewall="VPNFirewall";const s={LocalizationEduModalScreenshot:"/images/localized_images/${locale}_switch-language-in-settings-tutorial.png",RolesAndPermissions:"https://support.gather.town/hc/${locale}/articles/15975179137812",Support:"https://support.gather.town/hc/${locale}",NewSupportTicket:"https://support.gather.town/hc/${locale}/requests/new",VPNFirewall:"https://support.gather.town/hc/${locale}/articles/15994331253780"};t.getLocalizedLink=(e,t,n=!1)=>{const a=n?(e=>(0,o.localeMatcher)([e],["en-us","pt-br","ja"],"en-us"))(t):(e=>(0,o.localeMatcher)([e],i.BROWSER_SUPPORTED_LOCALES,i.DEFAULT_LOCALE))(t);return s[e].replace(/\$\{locale\}/g,a).toLowerCase()}},80912:(e,t,n)=>{n.d(t,{S:()=>r,y:()=>a});var i=n(12892),o=n(2823);const a=async(e,t)=>i.wP.get(o.HttpV2Paths.SpaceUser,{auth:!0,params:{path:{space:e,user:t}}}),r=async(e,t)=>i.wP.get(o.HttpV2Paths.SpaceUserRequest,{auth:!0,params:{path:{space:e,user:t}}})},6968:(e,t,n)=>{n.d(t,{$L:()=>r,Cp:()=>d,Jy:()=>l,hO:()=>p,rf:()=>c,xt:()=>s});var i=n(12892),o=n(2823),a=n(58980);const r=async(e,{coupon:t,planInterval:n})=>await i.wP.post(o.HttpV2Paths.SpaceSubscriptionsInvoicePreview,{auth:!0,params:{path:{space:e},body:{coupon:t,planInterval:n,plan:a.fU.Premium}}}),s=async e=>await i.wP.get(o.HttpV2Paths.SpaceCustomerPaymentInfo,{auth:!0,params:{path:{space:e}}}),d=async()=>await i.wP.get(o.HttpV2Paths.SpaceSubscriptions,{auth:!0}),l=async(e,t)=>await i.wP.post(o.HttpV2Paths.SpaceSubscriptions,{auth:!0,params:{path:{space:e},body:{...t}}}),c=async()=>await i.wP.get(o.HttpV2Paths.SpacePlanIntervals,{auth:!0}),p=async(e,t)=>{await i.wP.post(o.HttpV2Paths.SpaceSubscriptionSurveys,{auth:!0,params:{path:{subscription:e},body:t}})}},81040:(e,t,n)=>{n.d(t,{A6:()=>R,Az:()=>G,Ct:()=>E,DB:()=>O,DS:()=>L,DT:()=>z,Dv:()=>U,FL:()=>B,Fv:()=>T,G4:()=>x,I7:()=>f,I9:()=>k,Iz:()=>A,KP:()=>p,Oj:()=>I,PQ:()=>m,S4:()=>F,Ti:()=>l,V3:()=>w,bR:()=>Z,bh:()=>s,c7:()=>N,k6:()=>v,nG:()=>M,pI:()=>u,ti:()=>y,uO:()=>S,uW:()=>h,v2:()=>j,vc:()=>$,w6:()=>d,wZ:()=>c,x2:()=>g,yF:()=>P,z9:()=>C,zf:()=>D,zn:()=>b}),n(67294);var i=n(70917),o=n(10932),a=n(30800),r=n(92851);const s=180,d=120,l=7,c=5,p=1,u=16/9,h=48,g=h*u,m=o.Z.div`
  ${({hasTransition:e})=>e&&"transition: width 400ms ease, height 400ms ease;"}

  position: relative;

  ${({gridView:e,floating:t,isVertical:n})=>e&&!t?`\n          position: relative;\n          padding: ${c}px;\n        `:`\n          display: flex;\n          flex-direction: column;\n          margin: ${n?"4px 8px":`${l}px`};\n        `}

  ${({videoWidth:e,videoHeight:t})=>`\n      width: ${e}px;\n      height: ${t}px;\n    `}

    ${({clickable:e})=>`cursor: ${e?"pointer":"default"};`}

    ${({floating:e})=>e&&"\n      margin: 2px 0px;\n      border-radius: 0px;\n    "}
`,f=o.Z.div`
  height: 100%;
  ${({blurred:e=!1})=>e&&"filter: blur(5px);"}
`,b=o.Z.div`
  width: 100%;
  height: 100%;
  padding: 0;
  border-radius: ${12}px;
  overflow: hidden;
  box-sizing: border-box;
  box-shadow: 0 6px 6px rgba(0, 0, 0, 0.35);
  border: ${({lightBorder:e})=>`${p}px solid rgba(255, 255, 255, ${e?"0.10":"0.15"})`};
  background: ${e=>e&&r.COLORS.DARK3};
  & video {
    height: 100%;
    width: 100%;
    object-fit: cover;
  }

  ${({flip:e})=>e&&"\n    & video {\n      transform: scale(-1, 1);\n    }\n    "}
`,Z=(o.Z.div`
  background-color: rgba(255, 255, 255, 0.1);
  width: 1px;
  margin: 5px 2px;
`,o.Z.div`
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 30px;
  height: 30px;
  border-radius: 20px;
`),P=o.Z.div`
  pointer-events: none;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  border-radius: ${({borderRadius:e="12px"})=>e};

  ${({isVisible:e,color:t})=>e&&`border: 2px solid ${t}`}
`,x=o.Z.div`
  width: ${({size:e})=>`${e}px`};
  height: ${({size:e})=>`${e}px`};
  box-sizing: content-box;
  border: solid #434a61 3px;
  border-radius: 50rem;
  position: relative;
  // [START EXPERIMENT]: Ambient Desks / @a-lchen / End Date 2024-01-01
  ${({blurred:e=!1})=>e&&"filter: blur(5px);"}// [END EXPERIMENT]
`,y=o.Z.div`
  position: absolute;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
`,v=o.Z.div`
  width: 100%;
  height: 80%;
  position: absolute;
  top: 0;
  display: flex;
  align-items: flex-start;
  flex-direction: row;
  border-radius: 16px;
  visibility: ${({isVisible:e})=>e?"visible":"hidden"};
`,C=o.Z.div`
  padding-left: 8px;
  position: absolute;
  bottom: ${({bottomMargin:e})=>e?`${e}px`:"auto"};
  top: ${({topMargin:e})=>e?`${e}px`:"auto"};
  border-radius: 16px;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
`,S=o.Z.div`
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
`,R=o.Z.div`
  background: rgba(0, 0, 0, ${({darkened:e})=>e?.5:0});
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: ${12}px;
`,w=o.Z.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
  z-index: ${a.S.CanvasContextMenu};
  height: 38px;
  padding: 0 8px;
`,O=o.Z.div`
  position: relative;
  display: flex;
  flex: 0 0;
  visibility: ${({isVisible:e})=>e?"visible":"hidden"};
  align-items: center;
  z-index: ${a.S.VideoUI};
`,k=o.Z.div`
  padding: 0px 1px;
`,L=(0,o.Z)(O)`
  flex: 1 1;
  min-width: 0px;
  gap: 4px;
`,D=o.Z.span`
  padding-left: 2px;
  padding-right: 2px;
  font-size: 10px;
  font-weight: 400;
  flex: 1 1;
  min-width: 0px;
  background-color: ${(0,r.CZ)("black",.6)};
  color: white;
`,I=o.Z.div`
  padding-left: 4px;
  display: flex;
  align-items: center;
`,E=o.Z.div`
  padding: 0px 3px;
  border-radius: 6px;
  background-color: ${e=>e.spotlighted?r.COLORS.ORANGE1:(0,r.CZ)("black",.5)};
  display: flex;
  align-items: center;
  overflow: hidden;
`,A=o.Z.button`
  padding: 0px 3px;
  border-radius: 6px;
  background-color: ${(0,r.CZ)(r.COLORS.BLACK,.5)};
  display: flex;
  align-items: center;
  cursor: pointer;
  border: none;
  width: 20px;
  height: 20px;

  &:hover,
  &:focus {
    background-color: ${(0,r.CZ)(r.COLORS.GRAY5,.5)};
  }
`,M=o.Z.span`
  cursor: pointer;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  color: ${({color:e})=>e??"white"};

  ${({isFullscreen:e})=>e?"font-size: 15px;\n          font-weight: 500;\n          max-width: 250px;\n          flex-grow: 1;\n          margin-right: 16px;":"font-size: 12px;\n          font-weight: 600;\n          max-width: 100%;\n          line-height: 20px;\n          padding: 0px 1px;"}

  &:hover,
    &:focus {
    text-decoration: underline;
  }
`,T=o.Z.span`
  ${({color:e})=>`color: ${e}`}
`,N=o.Z.div`
  color: white;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  padding: 0.25rem;

  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50rem;
  margin-bottom: ${({noMargin:e=!1})=>e?"0px":"8px"};
  max-width: calc(100% - 16px);

  &:empty {
    border: none;
  }

  ${({hasDividers:e})=>e&&i.iv`
      & > *:not(:last-child) {
        border-right: solid 1px rgba(255, 255, 255, 0.12);
        height: 18px;
        margin: auto 0px;
      }
    `}
`,B=(o.Z.div`
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 16px;
  display: flex;
  flex-direction: row;
`,o.Z.div`
  font-weight: 500;
  font-size: 12px;
  line-height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0px 4px;
  text-overflow: ellipsis;

  overflow: hidden;
`),$=o.Z.div`
  position: relative;
  opacity: 1;
  border-radius: 16px;
  height: 100%;
  font-size: 16px;
  transition: opacity 0.25s;
`,z=(o.Z.div`
  cursor: pointer;
  padding: 2px 1px;
  display: flex;
  justify-content: center;
  align-items: center;
`,o.Z.div`
  position: absolute;
  cursor: pointer;
  display: flex;
`,o.Z.div`
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  margin-top: 2px;
`,o.Z.div`
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  border-radius: 16px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
`,o.Z.div`
  display: flex;
  align-items: center;
  margin: 1px 0;
  flex-direction: column;
`,o.Z.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  visibility: visible;
  text-align: center;
`),F=o.Z.div`
  width: 80%;
  height: 20px;
  border: 1px solid white;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 12px;
  margin: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover,
  &:focus {
    background-color: white;
    color: black;
  }
`,U=o.Z.div`
  color: ${r.COLORS.GRAY4};
  font-weight: 500;
  font-size: 12px;

  margin: 0px 4px;
  margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 0px 8px;

  display: flex;
  align-items: center;
  height: 24px;

  max-width: calc(100% - 16px);
  cursor: default;
`,j=o.Z.div`
  display: flex;
  align-items: center;
  padding: 0px 4px;
  height: 20px;
  margin-right: 2px;
  background: ${r.COLORS.RED2};
  border-radius: 6px;
`,G=o.Z.div`
  border-radius: 16px;
  padding: 4px 8px;
  background-color: ${(0,r.CZ)(r.COLORS.DARK4,.9)};
`},12817:(e,t,n)=>{n.d(t,{Ag:()=>s,h6:()=>d,kG:()=>r});var i=n(70917),o=n(92851),a=n(10932);const r=a.Z.label`
  border-radius: 12px;
  height: 48px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  display: flex;
  padding: 14px 12px;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background-color 200ms ease;
  ${({selected:e})=>e&&"background-color: rgba(255, 255, 255, 0.15);"};
  ${({fitContentWidth:e})=>!e&&"flex-basis: calc(25% - 6px)"};

  :hover {
    ${({selected:e})=>!e&&"background-color: rgba(255, 255, 255, 0.1);"};
  }
`,s=i.iv`
  padding: 16px;
  &::placeholder {
    color: ${o.COLORS.GRAY3};
  }
`,d=a.Z.div`
  div {
    height: auto;
    padding: 0;
  }
  input {
    padding: 16px;
  }
  input::placeholder {
    color: ${o.COLORS.GRAY3};
  }
`},2569:(e,t,n)=>{n.d(t,{d:()=>a});var i=n(10932),o=n(92851);const a=i.Z.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(0deg, #333a64 0%, ${o.COLORS.DARK4} 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding: 20px;

  @media (max-width: 420px) {
    align-items: flex-start;
  }
`},74458:(e,t,n)=>{n.d(t,{BD:()=>P,CK:()=>l,LP:()=>h,Lv:()=>b,MZ:()=>u,Nm:()=>m,Sr:()=>v,Vb:()=>c,ct:()=>C,d_:()=>f,rJ:()=>Z,ti:()=>d,uZ:()=>g,ve:()=>y,wf:()=>x,x0:()=>p});var i=n(10932),o=n(70917),a=n(92851),r=n(76777),s=n(68563);i.Z.div`
  border-radius: 16px;
  background-color: #3f4776;
`,i.Z.div`
  padding: 16px;

  ${({hideBottomBorder:e})=>!e&&`border-bottom: 1px solid ${(0,a.CZ)(a.COLORS.WHITE,.1)};`}
  ${({isEnabled:e=!0})=>!e&&"opacity: 0.5; pointer-events: none;"}
`;const d=i.Z.div`
  display: flex;
  align-items: flex-start;
`,l=i.Z.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  grid-gap: ${({hasGridPadding:e})=>e?"8px":"0px"};
  display: grid;
  max-height: 260px;
  padding-right: 5px;
  ${r.nV}
  overflow-y: auto;
`,c=i.Z.div`
  opacity: 0;
  transition: opacity 0.25s ease-in-out;
  display: grid;
  grid-template-columns: auto auto;
  position: relative;
  top: -0.5em;
`,p=i.Z.li`
  position: relative;
  padding: 10px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-gap: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background-color: ${({hasBackground:e})=>e?"rgba(63, 71, 118, 0.7)":"transparent"};

  &:hover,
  &:focus {
    .controls {
      opacity: 1;
    }
  }
`,u=i.Z.li`
  background: ${({highlight:e})=>e?a.COLORS.DARK0:a.COLORS.DARK1};
  transition: background 0.2s ease-out;
  padding: 12px 16px;
  border-radius: 8px;
  line-height: 18px;
  word-break: break-word;
`,h=i.Z.div`
  display: grid;
  grid-template-columns: auto auto;
  grid-gap: 4px;
  justify-content: flex-end;
  font-size: 13px;
  line-height: 17px;
  color: ${a.COLORS.GRAY3};

  & b {
    font-weight: bold;
  }
  & em {
    font-style: italic;
  }
`,g=i.Z.textarea`
  resize: none;
  box-shadow: none;
  background: transparent;
  font-weight: 500;
  font-size: 15px;
  font-family: inherit;
  line-height: 20px;
  border: 2px solid #909ce2;
  border-radius: 16px;
  width: ${({width:e})=>e||"320px"};
  height: 120px;
  padding: 8px 8px 8px 16px;
  color: ${a.COLORS.GRAY0};

  &::placeholder {
    color: ${a.COLORS.GRAY4};
    font-weight: 500;
    font-size: 15px;
    line-height: 20px;
  }

  & :active,
  :focus {
    border-color: ${({theme:e})=>e.textInput.borderColor.focus};
  }

  ${r.nV}
`,m=i.Z.div`
  font-size: 14px;
  line-height: 18px;
  color: ${a.COLORS.GRAY2};
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 24px;
  padding: 16px 4px 0 4px;
  display: grid;
  grid-template-columns: 1fr auto;
`,f=i.Z.div`
  font-size: 13px;
  line-height: 17px;
  margin-right: 8px;
  color: ${a.COLORS.GRAY2};
  overflow-wrap: break-word;

  & strong {
    font-weight: bold;
  }
  & em {
    font-style: italic;
  }
  & a {
    color: inherit;
    text-decoration: underline;
  }
`,b=(i.Z.div`
  display: grid;
  grid-gap: 12px;
`,i.Z.div`
  display: grid;
  grid-gap: 24px;
`),Z=i.Z.div`
  display: grid;
  grid-gap: 8px;
`,P=i.Z.div`
  border-radius: 8px;
  background-color: ${a.COLORS.DARK1};
  padding: 8px 12px;
`,x=i.Z.img`
  width: 55px;
  margin-bottom: 16px;
`,y=i.Z.div`
  ${({toast:e})=>e&&o.iv`
      width: 380px;
      border-radius: 8px;
      background-color: ${a.COLORS.DARK2};
      box-shadow: 0px 10px 25px rgba(0, 0, 0, 0.45);
    `}
`,v=i.Z.div`
  width: 52px;
`,C=(0,i.Z)(s.ZP)`
  width: ${({toast:e})=>e&&"328px"};
`},34716:(e,t,n)=>{n.d(t,{Z:()=>m});var i=n(35944),o=n(37884),a=n(82232),r=n(92851),s=n(25292),d=n(78694),l=n(68563),c=n(16590),p=n(74458),u=n(86187),h=n(13143),g=n(17126);const m=({announcement:e,isToast:t,onClose:n})=>(0,i.tZ)(p.ve,{toast:t,children:(0,i.BX)(l.ZP,{children:[t&&(0,i.tZ)(p.Sr,{children:(0,i.tZ)(l.ZP,{marginTop:2,justifyContent:"center",children:(0,i.tZ)(s.Z,{icon:(0,i.tZ)(o.LXT,{})})})}),(0,i.BX)(p.ct,{marginBottom:t?3:0,display:"block",toast:t,children:[(0,i.BX)(l.ZP,{marginTop:t?1:0,justifyContent:"space-between",alignItems:"center",children:[t&&(0,i.tZ)(c.Z,{kind:"h3",children:(0,a.ZP)("cf84a98")}),(0,i.BX)(l.ZP,{alignItems:"center",children:[(0,i.tZ)(c.Z,{kind:"subtitle2",color:r.COLORS.BLUE1,children:(0,h.nx)(g.ou.fromISO(e.createdAt).toMillis())}),n&&(0,i.tZ)(d.Z,{icon:(0,i.tZ)(o.x8P,{}),kind:"ghost",size:"xs",onPress:n})]})]}),(0,i.tZ)(u.Z,{msg:e.message})]})]})})},11224:(e,t,n)=>{n.d(t,{Z:()=>y});var i=n(35944),o=n(67294),a=n(82232),r=n(37884),s=n(85571),d=n(20407),l=n(68563),c=n(25292),p=n(20715),u=n(76777),h=n(16590),g=n(92851),m=n(36170),f=n(34716),b=n(86187),Z=n(78694),P=n(74458);const x=({id:e,msg:t,onEdit:n,onRemove:a,provided:s,snapshot:d})=>{const l=(0,o.useCallback)((()=>{n&&n(e)}),[e,n]),p=(0,o.useCallback)((()=>{a&&a(e)}),[e,a]);return(0,i.BX)(P.x0,{ref:s.innerRef,...s.draggableProps,hasBackground:d.isDragging,children:[(0,i.tZ)(P.ti,{...s.dragHandleProps,children:(0,i.tZ)(c.Z,{icon:(0,i.tZ)(r.y97,{}),size:"xs"})}),(0,i.tZ)(b.Z,{msg:t}),(0,i.BX)(P.Vb,{className:"controls",children:[(0,i.tZ)("div",{children:(0,i.tZ)(Z.Z,{icon:(0,i.tZ)(r.I8b,{}),kind:"ghost",size:"xs",onPress:l})}),(0,i.tZ)("div",{children:(0,i.tZ)(Z.Z,{icon:(0,i.tZ)(r.rFk,{}),kind:"ghost",size:"xs",onPress:p})})]})]})},y=({announcements:e,isLoading:t,isEditable:n,modalTab:Z,highlightAnnouncementIds:y,onDragEnd:v,onEdit:C,onRemove:S})=>{const R=(0,o.useCallback)((e=>{e.destination&&e.destination.index!==e.source.index&&v(e.source.index,e.destination.index)}),[v]);return t?(0,i.BX)(P.Nm,{children:[(0,i.tZ)("span",{children:(0,a.ZP)("ab73346")}),(0,i.tZ)(l.ZP,{css:u.fS,children:(0,i.tZ)(c.Z,{icon:(0,i.tZ)(r.$jN,{}),size:"xs"})})]}):e.length?n?(0,i.tZ)(s.Z5,{onDragEnd:R,children:(0,i.tZ)(s.bK,{droppableId:"list",renderClone:(t,n,o)=>(0,i.tZ)(x,{id:e[o.source.index].id,msg:e[o.source.index].message,provided:t,snapshot:n}),children:t=>(0,i.BX)(P.CK,{ref:t.innerRef,...t.droppableProps,children:[e.map(((e,t)=>(0,i.tZ)(s._l,{draggableId:e.id,index:t,children:(t,n)=>(0,i.tZ)(x,{id:e.id,msg:e.message,onEdit:C,onRemove:S,provided:t,snapshot:n})},e.id))),t.placeholder]})})}):(0,i.tZ)(P.CK,{hasGridPadding:!0,children:e.map((e=>(0,i.tZ)(P.MZ,{highlight:y?.includes(e.id),children:Z===d.xj.Pinned?(0,i.tZ)(b.Z,{msg:e.message}):y?.includes(e.id)?(0,i.tZ)(p.Z,{animate:!0,children:(0,i.tZ)(f.Z,{announcement:e})}):(0,i.tZ)(f.Z,{announcement:e})},e.id)))}):Z===d.xj.Announcements?(0,i.tZ)(P.CK,{hasGridPadding:!0,children:(0,i.BX)(l.ZP,{flexDirection:"column",alignItems:"center",justifyContent:"center",marginTop:6,children:[(0,i.tZ)(P.wf,{src:m.Gk}),(0,i.tZ)(h.Z,{kind:"caption1",style:{textAlign:"center"},color:g.COLORS.GRAY3,children:(0,a.ZP)("e1f047f")})]})}):(0,i.tZ)(P.CK,{hasGridPadding:!0,children:(0,i.tZ)(P.MZ,{children:(0,i.tZ)(b.Z,{msg:(0,a.EI)((0,a.ZP)("63d2262"))})})})}},86187:(e,t,n)=>{n.d(t,{Z:()=>s});var i=n(35944),o=n(74458),a=n(58436),r=n(62e3);const s=({msg:e})=>(0,i.tZ)(o.d_,{children:(0,i.tZ)(r.Z,{components:a.k,children:e})})},17048:(e,t,n)=>{n.d(t,{Z:()=>b});var i=n(35944),o=n(82232),a=n(37884),r=n(89674),s=n(59973),d=n(92851),l=n(25292),c=n(68563),p=n(16590),u=n(74458),h=n(30264);const g={[h.Nh.CreateAnnouncement]:(0,o.ZP)("f4bd89e"),[h.Nh.CreatePinnedMessage]:(0,o.ZP)("72aac8b"),[h.Nh.EditPinnedMessage]:(0,o.ZP)("96116a5")},m={[h.Nh.CreateAnnouncement]:(0,o.ZP)("e02c418"),[h.Nh.CreatePinnedMessage]:(0,o.ZP)("1c27385"),[h.Nh.EditPinnedMessage]:(0,o.ZP)("83a0ffe")},f={[h.jM.Overwrite]:(0,o.ZP)("b8154f2"),[h.jM.Delete]:(0,o.ZP)("0ed38bc")},b=({editingConflict:e,modalAction:t,value:n,isLoading:b,onChange:Z,onSubmit:P,onCancel:x})=>{const y=(0,r.u)(),v=t===h.Nh.EditPinnedMessage?(0,o.ZP)("Update"):(0,o.ZP)("Post");return t===h.Nh.None?null:(0,i.tZ)(s.Z,{title:g[t],primaryActionText:v,onPrimaryAction:P,secondaryActionText:(0,o.ZP)("Cancel"),onSecondaryAction:x,closeIcon:!1,primaryButtonKind:"primary",closeOnClickOutside:!0,hasTitleIcon:!1,onClose:x,maxWidth:"416px",minWidth:"416px",isLoading:b,children:(0,i.BX)(u.Lv,{children:[(0,i.tZ)(p.Z,{kind:"body1",color:d.COLORS.GRAY2,children:m[t]}),(0,i.BX)(u.rJ,{children:[(0,i.tZ)(p.Z,{kind:"caption1",color:d.COLORS.GRAY0,children:(0,o.ZP)("Message")}),(0,i.tZ)(u.uZ,{maxLength:1500,theme:y,value:n,onChange:e=>Z(e.currentTarget.value),placeholder:(0,o.EI)((0,o.ZP)("d177093")),width:"100%",autoFocus:!0}),(0,i.BX)(c.ZP,{justifyContent:"space-between",children:[(0,i.tZ)(p.Z,{kind:"caption1",color:d.COLORS.GRAY3,children:(0,o.ZP)("4b12202",{num:1500-(n?.length??0)})}),(0,i.BX)(u.LP,{children:[(0,i.tZ)("b",{children:(0,o.ZP)("40b7d42")}),(0,i.tZ)("em",{children:(0,o.ZP)("62d3c8d")})]})]}),e?.error&&(0,i.tZ)(u.BD,{children:(0,i.BX)(c.ZP,{alignItems:"center",children:[(0,i.tZ)(c.ZP,{marginRight:2,children:(0,i.tZ)(l.Z,{icon:(0,i.tZ)(a.v3j,{}),color:d.COLORS.YELLOW})}),(0,i.tZ)(p.Z,{kind:"caption2",children:f[e?.error]})]})})]})]})})}},30264:(e,t,n)=>{n.d(t,{Nh:()=>u,ZP:()=>g,jM:()=>h});var i,o,a=n(13352),r=n(93323),s=n(67294),d=n(5243),l=n(20407),c=n(45211),p=n(2948),u=((o=u||{}).None="None",o.CreateAnnouncement="CreateAnnouncement",o.CreatePinnedMessage="CreatePinnedMessage",o.EditPinnedMessage="EditPinnedMessage",o),h=((i=h||{}).Overwrite="overwrite",i.Delete="delete",i);const g=function(e,t,n){const{onRefetch:i,onReorder:o}=n||{},[u,h]=(0,s.useState)(null),[g,m]=(0,s.useState)(null),[f,b]=(0,s.useState)(null),[Z,P]=(0,s.useState)(""),[x,y]=(0,s.useState)("None"),[v,C]=(0,s.useState)(!1),{createSpaceAnnouncement:S,updateSpaceAnnouncement:R,deleteSpaceAnnouncement:w,reorderSpaceAnnouncements:O}=(0,r.ZP)(),k=(0,s.useCallback)((e=>{P(e)}),[]),L=(0,s.useCallback)((e=>{P(""),y(e?"CreatePinnedMessage":"CreateAnnouncement"),h(null)}),[]),D=(0,s.useCallback)((()=>{P(""),m(null),y("None"),h(null)}),[]),I=(0,s.useCallback)((e=>{const n=t.find((t=>t.id===e));n&&(m(e),b(n)),P(n?.message||""),y("EditPinnedMessage")}),[t]),E=(0,s.useCallback)((async t=>{(0,p.NO)(a.MetricsEventName.HOST_PINNED_MESSAGE_DELETE,{spaceId:e}),await w(e,t),i&&i()}),[e,w,i]),A=(0,s.useCallback)((async()=>{if(Z&&!v){if(C(!0),"CreatePinnedMessage"===x||"delete"===u?.error)(0,p.NO)(a.MetricsEventName.HOST_PINNED_MESSAGE_POST,{spaceId:e}),await S(e,{message:Z},{pinned:!0});else if("EditPinnedMessage"===x&&g)await R(e,g,{id:g,message:Z});else if("CreateAnnouncement"===x){(0,p.NO)(a.MetricsEventName.HOST_ANNOUNCEMENT_POST,{spaceId:e});const t=await S(e,{message:Z},{pinned:!1});(0,c.b)().dispatch((0,d.E3w)()),t&&(0,c.b)().dispatch((0,l.lG)(t.id))}y("None"),m(null),C(!1),h(null),i&&i()}}),[g,Z,v,x,u?.error,e,S,R,i]),M=(0,s.useCallback)((async(n,a)=>{const r=((e,t,n)=>{const i=Array.from(e),[o]=i.splice(t,1);return i.splice(n,0,o),i})(t,n,a);o&&o(r),await O(e,r.map((e=>e.id))),i&&i()}),[t,e,O,i,o]);return(0,s.useEffect)((()=>{if(!g||!f)return;const e=t.find((e=>e.id===g));h(e?e?.message!==f?.message?{error:"overwrite",announcement:f}:null:{error:"delete",announcement:f})}),[g,f,t]),{selectedId:g,editingConflict:u,text:Z,modalAction:x,isCreating:v,handleTextChange:k,handleCreateAnnouncement:L,handleCancelAnnouncement:D,handleEditAnnouncement:I,handleDeleteAnnouncement:E,handleSubmitAnnouncement:A,handleReorderAnnouncements:M}}},59973:(e,t,n)=>{n.d(t,{Z:()=>f});var i=n(35944),o=n(67294),a=n(10932),r=n(68563),s=n(92851),d=n(25292),l=n(16124),c=n(87166),p=n(50040),u=n(16590),h=n(37884);const g=a.Z.div`
  a {
    color: ${s.COLORS.GRAY2};
    text-decoration: underline;
  }
`,m=(0,a.Z)(r.ZP)`
  background-image: url(${({coverImageURL:e})=>e});
  background-size: 200%;
  background-position: center;
  opacity: ${({coverImageDimmed:e})=>e?.5:1};
`,f=o.memo((function({title:e,titleMargin:t=0,children:n,primaryActionText:o,primaryButton:a,onPrimaryAction:f,secondaryActionText:b,onSecondaryAction:Z,closeIcon:P=!1,imageURL:x,coverImageURL:y,coverImageDimmed:v=!1,primaryButtonKind:C="primary",closeOnClickOutside:S=!1,submitOnEnter:R=!1,hasTitleIcon:w=!0,iconName:O=(0,i.tZ)(h.v3j,{}),iconColor:k=s.COLORS.YELLOW,onClose:L,hideActions:D=!1,maxWidth:I="368px",isLoading:E=!1,minWidth:A,errorMessage:M}){const{hideModal:T}=(0,p.dd)();return(0,i.tZ)(r.ZP,{position:"relative",children:(0,i.tZ)(c.Z,{maxWidth:I,minWidth:A,closeIcon:P,closeOnClickOutside:S,onClose:L||T,pad:6,overflow:"hidden",shadow:!0,children:(0,i.BX)("form",{onSubmit:e=>{e.preventDefault(),R&&f?.()},children:[y&&(0,i.tZ)(m,{marginTop:-6,marginLeft:-6,marginBottom:6,justifyContent:"center",width:"calc(100% + 48px)",height:"160px",coverImageURL:y,coverImageDimmed:v}),(0,i.BX)(r.ZP,{width:"100%",alignItems:"center",marginBottom:2,children:[w&&(0,i.tZ)(r.ZP,{marginRight:2,children:(0,i.tZ)(d.Z,{icon:O,color:k,size:"md"})}),(0,i.tZ)(r.ZP,{marginRight:t,children:(0,i.tZ)(u.Z,{kind:"h1",style:{textAlign:"left"},children:e})})]}),(0,i.tZ)(r.ZP,{children:(0,i.tZ)(g,{children:(0,i.tZ)(u.Z,{kind:"body1",color:s.COLORS.GRAY2,style:{display:"inline-block",textAlign:"left"},children:n})})}),x&&(0,i.tZ)(r.ZP,{marginTop:6,justifyContent:"center",width:"100%",children:(0,i.tZ)("img",{src:x})}),!D&&(0,i.BX)(r.ZP,{width:"100%",marginTop:6,children:[b&&(0,i.tZ)(r.ZP,{flex:"0.4 1 0px",paddingRight:4,children:(0,i.tZ)(l.Z,{kind:"low-key",size:"lg",isFullWidth:!0,onPress:Z,children:b})}),(0,i.tZ)(r.ZP,{flex:(b?.6:1)+" 1 0px",children:a||(0,i.tZ)(l.Z,{kind:C,size:"lg",isFullWidth:!0,onPress:f,isLoading:E,children:o})})]}),M&&(0,i.tZ)(r.ZP,{marginTop:2,width:"100%",justifyContent:"center",children:(0,i.tZ)(u.Z,{kind:"caption2",color:s.COLORS.RED0,children:M})})]})})})}))},77171:(e,t,n)=>{n.d(t,{Z:()=>T});var i=n(35944),o=n(67294),a=n(90433),r=n(82232),s=n(68563),d=n(16590),l=n(92851),c=n(11771),p=n(76777),u=n(16124),h=n(25292),g=n(37884),m=n(10932),f=n(73339),b=n(33829),Z=n(1300),P=n(13352);const x=m.Z.a`
  display: flex;
  flex-direction: column;
  background-color: ${l.COLORS.DARK1};
  border-radius: 8px;
  flex: 1;
  padding: 12px;
  gap: 8px;
  cursor: pointer;
  align-items: stretch;

  &:hover {
    background-color: ${l.COLORS.DARK0};
  }
`,y=o.memo((function(){return(0,i.BX)(x,{href:"https://forms.gle/1umo2UyLzV7xnDJs5",target:"_blank",onClick:()=>{(0,Z.uE)(P.MetricsEventName.CLICK_JOIN_SLACK_COMMUNITY)},children:[(0,i.BX)(s.ZP,{gap:2,flexGrow:1,justifyContent:"space-between",alignItems:"center",children:[(0,i.BX)(s.ZP,{gap:2,alignItems:"center",children:[(0,i.tZ)(f.Z,{icon:(0,i.tZ)(g.TvO,{})}),(0,i.tZ)(b.Z,{kind:"h3",children:(0,r.ZP)("06bfe82")})]}),(0,i.tZ)(f.Z,{icon:(0,i.tZ)(g.dLw,{})})]}),(0,i.tZ)(s.ZP,{children:(0,i.tZ)(b.Z,{kind:"body1",color:l.COLORS.GRAY2,style:{textAlign:"left"},children:(0,r.ZP)("dc26caf")})})]})}));var v=n(46796),C=n(41242),S=n(35025),R=n(1546),w=n(36170),O=n(84634);const k=o.memo((function({participantId:e}){const t=(0,R.Oj)(e||"");return(0,i.BX)(s.ZP,{alignItems:"center",gap:2,children:[(0,i.tZ)(v.Z,{playerId:e,size:"xs"}),(0,i.tZ)(s.ZP,{children:t||w.j2})]})})),L="everyone",D=o.memo((function({participants:e,selectedParticipants:t,onSelectedParticipants:n}){const a=(0,R.Vy)(),s=(0,O.JD3)(),d=(0,o.useMemo)((()=>s.map((e=>e.id))),[s]),l=(0,o.useMemo)((()=>{const t=e.slice();t.sort(((e,t)=>{const n=a[e]||"",i=a[t]||"";return n<i?-1:n>i?1:0}));const n=t.filter((e=>d.includes(e))),i=t.filter((e=>!d.includes(e)));return n.concat(i)}),[d,e,a]),c=(0,o.useMemo)((()=>{const e=l.map((e=>({label:[(0,i.tZ)(k,{participantId:e},e)],value:e})));return l.length>1&&e.unshift({label:[(0,i.tZ)(i.HY,{children:(0,r.ZP)("c756f6a")})],value:L}),e}),[l]),p=(0,o.useCallback)(((e,t)=>""===t||!!a[e.value]?.toLocaleLowerCase().includes(t.toLocaleLowerCase())),[a]);return(0,i.tZ)("div",{children:(0,i.tZ)(C.ZP,{isSearchable:!0,filterOption:p,value:t,kind:C.hk.Dark,placeholder:(0,r.ZP)("e5116af"),isMulti:!0,onChange:e=>{const t=e.split(C.Z0).filter(S.isNotEmpty);n(t[t.length-1]===L?[L]:t.filter((e=>e!==L)))},options:c})})}));var I=n(64243),E=n(66948);const A=m.Z.textarea`
  width: 100%;
  border: 2px solid #909ce2;
  background-color: transparent;
  border-radius: 16px;
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  font-family: inherit;
  padding: 8px 16px;
  resize: none;
  height: 120px;
  overflow: auto;
  color: ${l.COLORS.WHITE};

  &::placeholder {
    color: ${l.COLORS.GRAY3};
  }
  &:focus {
    border: 2px solid ${l.COLORS.WHITE};
  }

  ${p.nV}
`,M=o.memo((function({feedbackContext:e,onClose:t,contextInfo:n}){const{name:h,email:g,message:m,setMessage:f,response:b,responseType:Z,sendingFeedback:x,handleNameChange:v,handleEmailChange:C,submitFeedback:S,isFormDisabled:R,SelectReasonsComponents:w,setAffectedUsers:O,affectedUsers:k,reason:L}=(0,a.Z)(e,n),[M,T]=(0,o.useState)(!1),B=L===P.FeedbackReason.VideoOrAudio,$=(0,I.Sb)(),z=(0,o.useCallback)((e=>{O(e||[])}),[O]),F=e===a.l.Issue?(0,r.ZP)("31b45c8"):(0,r.ZP)("f1e53f1"),U=e===a.l.Issue?(0,r.ZP)("b7cefbb",{support:e=>(0,i.tZ)(d.Z,{kind:"body1",color:l.COLORS.GREEN,href:"https://support.gather.town/hc/en-us/articles/15910394815508-Troubleshooting-Checklist",target:"_blank",children:e})}):(0,r.ZP)("c11090d",{support:e=>(0,i.tZ)(d.Z,{kind:"body1",color:l.COLORS.GREEN,href:"https://support.gather.town/hc",target:"_blank",children:e})}),j=e===a.l.Issue?(0,r.ZP)("ee27c0a"):(0,r.ZP)("b4bd2b4");return"success"===Z?(0,i.tZ)(N,{onDone:t}):(0,i.BX)(i.HY,{children:[(0,i.tZ)(s.ZP,{flexDirection:"row",justifyContent:"space-between",marginBottom:3,children:(0,i.tZ)(d.Z,{kind:"h2",children:F})}),Z?(0,i.tZ)("div",{children:(0,i.tZ)(d.Z,{kind:"h2",color:"failure"===Z?l.COLORS.RED2:"white",style:{fontWeight:400},children:b})}):(0,i.BX)(i.HY,{children:[(0,i.BX)("form",{action:"modules/gather-browser/src/components/modals",onSubmit:e=>S(e),children:[(0,i.tZ)(s.ZP,{marginY:3,children:(0,i.tZ)(d.Z,{kind:"body3",children:U})}),(0,i.BX)(s.ZP,{flexDirection:"column",gap:2,children:[(0,i.BX)(s.ZP,{gap:2,children:[(0,i.tZ)(c.Z,{placeholder:(0,r.ZP)("32861ac"),value:h,type:"text",onChange:v,size:"lg"}),(0,i.tZ)(c.Z,{placeholder:(0,r.ZP)("c7ebade"),value:g,type:"email",onChange:C,size:"lg"})]}),w,B&&(0,i.BX)(i.HY,{children:[(0,i.BX)(s.ZP,{justifyContent:"space-between",paddingY:1.5,children:[(0,i.tZ)(d.Z,{kind:"h3",color:l.COLORS.GRAY0,children:(0,r.ZP)("4624d8b")}),(0,i.tZ)(E.Z,{checked:M,setChecked:e=>T(e)})]}),!n.inDashboard&&M&&(0,i.tZ)(D,{participants:$,selectedParticipants:k,onSelectedParticipants:z})]}),(0,i.tZ)(A,{value:m,placeholder:(0,r.EI)(j),onChange:e=>{f(e.target.value)},css:[p.nV,{minHeight:100}]})]}),(0,i.tZ)(s.ZP,{marginTop:4,children:(0,i.tZ)(u.Z,{isFullWidth:!0,onPress:S,isDisabled:R(),isLoading:x,size:"lg",children:(0,r.ZP)("Submit")})})]}),e===a.l.General&&(0,i.tZ)(s.ZP,{paddingTop:4,children:(0,i.tZ)(y,{})})]})]})})),T=M,N=o.memo((function({onDone:e}){return(0,i.BX)(s.ZP,{flexDirection:"column",gap:4,children:[(0,i.tZ)("img",{src:"https://firebasestorage.googleapis.com/v0/b/gather-town.appspot.com/o/remote-work%2Ffeedback%2Ffeedback_success.png?alt=media&token=54b3bc76-c1d7-40a7-9e21-6fdd63ba0bf3",css:{borderRadius:8}}),(0,i.BX)(s.ZP,{gap:1,alignItems:"center",children:[(0,i.tZ)(h.Z,{icon:(0,i.tZ)(g.fU8,{}),size:"sm",color:l.COLORS.GREEN}),(0,i.tZ)(d.Z,{kind:"h1",children:(0,r.ZP)("8b18ff0")})]}),(0,i.tZ)(d.Z,{kind:"body1",children:(0,r.ZP)("356ed5d")}),(0,i.tZ)(u.Z,{isFullWidth:!0,onPress:e,children:(0,r.ZP)("Done")})]})}))},90433:(e,t,n)=>{n.d(t,{l:()=>w,Z:()=>O});var i,o=n(35944),a=n(67294),r=n(91381),s=n(84634),d=n(45211),l=n(26948),c=n(23139),p=n(82232),u=n(41242),h=n(13352),g=n(40248),m=n(93633),f=n(13402),b=n(87613),Z=n(52305),P=n(95551),x=n(98645),y=n(42235),v=n(74717),C=n(43507),S=n(26101),R=n(93071),w=((i=w||{}).Issue="Issue",i.General="General",i);const O=(e,t)=>{const{useDebug:n=!0,showDebugUi:i,initialName:w,reason:O,defaultMessage:k}=t,{currUser:L}=(0,a.useContext)(r.St),[D,I]=(0,a.useState)(w||L?.name||""),[E,A]=(0,a.useState)(L?.email||""),[M,T]=(0,a.useState)(k||""),[N,B]=(0,a.useState)(""),[$,z]=(0,a.useState)(""),[F,U]=(0,a.useState)(O||""),[j,G]=(0,a.useState)(""),[V,H]=(0,a.useState)(L?.id?[L.id]:[]),[K,X]=(0,a.useState)(!1);(0,a.useEffect)((()=>{if(n)return(0,d.b)().dispatch((0,s.yDC)(!0)),()=>{i||(0,d.b)().dispatch((0,s.yDC)(!1))}}),[i,n]);const Y=(0,a.useCallback)((async n=>{n?.preventDefault(),X(!0);const i="Issue"===e?g.md[(0,P.enumFromValue)(F,h.FeedbackReason)]:g.xJ[(0,P.enumFromValue)(F,h.HelpReason)];let o;l.newRelicManager.addPageAction("Debug report",{reason:i||"null",message:M,...j?{performanceProblem:j}:{}});try{o=await(f.Z?.sendDesktopLogs?.())}catch{m.Y.error("Could not send desktop logs, or at least could not retrieve the filename for it.")}return(t.inDashboard?e=>(async(e,t)=>{const n=(0,v.PM)(),i=(0,C.IP)(S.Z.getState()),o=i?.creationDate?new Date(i?.creationDate):void 0,a=(0,R.L)(t??null,n,i,o),r=(0,C.Ny)(S.Z.getState());return(0,y.sw)(e,{trueGates:a,useCase:r})})(e,L?.id):c.B)({message:M,reason:F,...j?{performanceProblem:j}:{},name:D,email:E,desktopLogFileName:o?.logFileName||"(error: could not upload desktop logs, or could not receive log file name)",affectedUsers:V}).then((e=>{X(!1),B((0,p.EI)((0,p.ZP)("0d404de"))),z("success"),(0,Z.B)("Submit Feedback","In-Space",i)})).catch((e=>{X(!1),B((0,p.EI)((0,p.ZP)("b340df5"))),z("failure"),setTimeout((()=>{z("")}),5e3),m.Y.error("Failed to send feedback report.",(0,b.d)(e))})),!1}),[e,F,M,j,D,E,L?.id,t.inDashboard,V]),W=(0,o.BX)(o.HY,{children:[(0,o.tZ)(u.ZP,{value:F,placeholder:"Select a reason*",options:"Issue"===e?g.e0:g.vz,kind:u.hk.Dark,onChange:e=>{U(e),G("")}}),F===h.FeedbackReason.Performance&&(0,o.tZ)(u.ZP,{value:j,placeholder:(0,p.ZP)("a2a6344"),options:g.iO,kind:u.hk.Dark,onChange:e=>G((0,P.enumFromValue)(e,x.i))})]});return{name:D,email:E,message:M,setMessage:T,response:N,responseType:$,sendingFeedback:K,handleNameChange:e=>{I(e)},handleEmailChange:e=>{A(e)},submitFeedback:Y,isFormDisabled:()=>!(M&&F&&!K&&(F!==h.FeedbackReason.Performance||j)),SelectReasonsComponents:W,affectedUsers:V,setAffectedUsers:H,reason:F}}},40248:(e,t,n)=>{n.d(t,{e0:()=>c,iO:()=>p,md:()=>s,vz:()=>u,xJ:()=>d});var i=n(13352),o=n(81697),a=n(82232),r=n(98645);const s={[i.FeedbackReason.VideoOrAudio]:(0,a.EI)((0,a.ZP)("3647f8c")),[i.FeedbackReason.Performance]:(0,a.EI)((0,a.ZP)("85dc591")),[i.FeedbackReason.Connection]:(0,a.EI)((0,a.ZP)("c095faf")),[i.FeedbackReason.MapDisplayIssues]:(0,a.EI)((0,a.ZP)("453a0d4")),[i.FeedbackReason.Others]:(0,a.EI)((0,a.ZP)("c4ad1f6"))},d={[i.HelpReason.StartOffice]:(0,a.EI)((0,a.ZP)("26bb873")),[i.HelpReason.RunMeetings]:(0,a.EI)((0,a.ZP)("c57d360")),[i.HelpReason.MeetingRecording]:(0,a.EI)((0,a.ZP)("3e63bfe")),[i.HelpReason.CustomizeSpace]:(0,a.EI)((0,a.ZP)("1b24a16")),[i.HelpReason.BillSubscriptions]:(0,a.EI)((0,a.ZP)("3db139b")),[i.HelpReason.ProductFeedback]:(0,a.EI)((0,a.ZP)("2759acc")),[i.HelpReason.Other]:(0,a.EI)((0,a.ZP)("98ed119"))},l={[r.i.SlowComputer]:(0,a.EI)((0,a.ZP)("721d48e")),[r.i.SlowMap]:(0,a.EI)((0,a.ZP)("1f527a0")),[r.i.SlowBrowser]:(0,a.EI)((0,a.ZP)("353ab29"))},c=(0,o.Zpf)(s).map((([e,t])=>({label:t,value:e}))),p=(0,o.Zpf)(l).map((([e,t])=>({label:t,value:e}))),u=(0,o.Zpf)(d).map((([e,t])=>({label:t,value:e})))},75149:(e,t,n)=>{n.d(t,{P:()=>a});var i=n(10932),o=n(92851);const a=i.Z.textarea`
  width: 100%;
  border: 2px solid #909ce2;
  background-color: transparent;
  border-radius: 16px;
  margin-bottom: ${({marginBottom:e})=>e||16}px;
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  color: ${o.COLORS.GRAY0};
  font-family: inherit;
  padding: 8px 16px;
  resize: none;
  height: ${({height:e})=>e||120}px;
  overflow: auto;

  &::placeholder {
    color: ${o.COLORS.GRAY4};
  }
`},51567:(e,t,n)=>{n.d(t,{Qp:()=>d,bj:()=>p,jb:()=>c,lT:()=>u,pm:()=>h,pu:()=>l});var i=n(10932),o=n(68563),a=n(92851),r=n(76777),s=n(50158);const d=(0,i.Z)(o.ZP)`
  border: 1px solid rgba(0, 0, 0, 0.2);
  width: 100%;
`,l=i.Z.div`
  border: 1px solid ${({color:e})=>e};
  background: ${({color:e})=>(0,a.CZ)(e,.2)};
  padding: 4px 8px;
  border-radius: 14px;
  height: fit-content;
`,c=(0,i.Z)(o.ZP)`
  background-color: ${a.COLORS.BLUE0};
  border-radius: 8px;
  width: 212px;
  ${r.xJ}
`,p=i.Z.button`
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-family: "DM Sans", sans-serif;
  padding: 8px 16px;
  text-align: start;

  &:hover {
    background-color: ${a.COLORS.BLUE2};
  }
`,u=(0,i.Z)(o.ZP)`
  background: ${(0,a.CZ)(a.COLORS.RED2,.1)};
  border-radius: 8px;
  padding: 8px;
`,h={[s.CoreRole.Owner]:a.COLORS.GREEN,[s.CoreRole.Builder]:a.COLORS.YELLOW,[s.CoreRole.Mod]:a.COLORS.BLUE3,[s.CoreRole.GeneralMember]:a.COLORS.BLUE3,[s.CoreRole.Guest]:a.COLORS.RED2}},19906:(e,t,n)=>{n.d(t,{Z:()=>l});var i=n(35944),o=n(10932),a=n(88713),r=n(25292),s=n(92851);const d=o.Z.div`
  border-radius: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: ${({size:e})=>e}px;
  width: ${({size:e})=>e}px;
  background-color: ${({backgroundColor:e})=>e};
  color: ${({color:e})=>e};
`;function l({src:e,children:t,size:n="md",backgroundColor:o=s.COLORS.GRAY3,icon:l,color:c}){const p="number"==typeof n?n:a.w[n];return(0,i.tZ)(d,{size:p,style:e?{backgroundImage:`url(${e})`}:void 0,backgroundColor:o,color:c,children:l?(0,i.tZ)(r.Z,{icon:l,size:5,color:"currentColor"}):t})}},58436:(e,t,n)=>{n.d(t,{c:()=>a,k:()=>r});var i=n(35944),o=n(63618);const a={target:"_blank",attributes:{rel:"nofollow noopener noreferrer"}},r={p:function({children:e}){return(0,i.tZ)(o.Z,{options:a,tagName:"p",children:e})}}},10754:(e,t,n)=>{n.d(t,{Z:()=>d});var i=n(35944),o=n(10932),a=n(67294),r=n(92851);const s=o.Z.span`
  flex-shrink: 0;
  height: ${({height:e})=>e}px;
  text-transform: uppercase;
  font-size: 12px;
  line-height: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 16px;
  color: ${({intent:e})=>{switch(e){case"warning":case"info-alternate":return r.COLORS.DARK3;case"success":return r.COLORS.GREEN;default:return r.COLORS.WHITE}}};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({intent:e})=>{switch(e){case"info":default:return r.COLORS.BLUE3;case"info-alternate":return r.COLORS.BLUE1;case"success":return(0,r.CZ)(r.COLORS.GREEN,.2);case"error":return r.COLORS.RED2;case"warning":return r.COLORS.YELLOW;case"new":return r.COLORS.BLUE4}}};
`,d=(0,a.memo)((function({className:e,intent:t,children:n,height:o=20}){return(0,i.tZ)(s,{intent:t,className:e,height:o,children:n})}))},15618:(e,t,n)=>{n.d(t,{Z:()=>m});var i=n(35944),o=n(67294),a=n(92851),r=n(16590),s=n(10932);const d=s.Z.div`
  display: flex;
  background-color: ${(0,a.CZ)(a.COLORS.BLACK,.3)};
  border-radius: 10px;
  position: relative;
  min-height: 36px;
  flex-grow: 1;
`,l=s.Z.div`
  position: absolute;
  height: 100%;
  padding: 4px;
  box-sizing: border-box;
  transition: transform 250ms ease;
`,c=s.Z.div`
  border-radius: 6px;
  width: 100%;
  height: 100%;
  background-color: ${a.COLORS.DARK0};
`,p=s.Z.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding-left: 20px;
  padding-right: 20px;
  min-width: 0;
  height: 100%;
`;var u=n(25292),h=n(76777),g=n(83959);const m=o.memo((function({tabs:e,currentTabIndex:t,initialTabIndex:n,onClickTab:s,collapseInactiveTabs:m=!1}){const[f,b]=(0,o.useState)(n??0),Z=(0,o.useRef)(null),P=t??f,[x,y]=(0,o.useState)(0),[v,C]=(0,o.useState)(0);return(0,o.useEffect)((()=>{C(Z.current?.clientWidth??0),y(Z.current?.offsetLeft??0)}),[P,e]),(0,i.BX)(d,{children:[(0,i.tZ)(l,{style:{width:v,transform:`translateX(${x}px)`},children:(0,i.tZ)(c,{})}),e.map(((e,t)=>{const n=t===P;return(0,i.tZ)(g.Z,{content:e.disabled?e.disabledTooltipText:void 0,placement:"bottom",offset:4,children:(0,i.BX)(p,{onClick:()=>!e.disabled&&(e=>{b(e),s(e)})(t),ref:n?Z:null,css:[{cursor:e.disabled?"default":"pointer"},m?n?{flex:"1"}:{flex:"0"}:{flex:"1"}],"data-testid":e.testId,"data-selected":n,children:[e.icon?(0,i.tZ)(u.Z,{icon:e.icon,size:"sm",color:e.disabled?a.COLORS.GRAY3:n?a.COLORS.GRAY0:a.COLORS.GRAY2}):null,!(m&&!n)&&(0,i.tZ)(r.Z,{kind:"h4",color:e.disabled?a.COLORS.GRAY3:n?a.COLORS.GRAY0:a.COLORS.GRAY2,css:{flexShrink:0,...h.iL},children:e.label}),e.endContent]})},t)}))]})}))},49691:(e,t,n)=>{n.d(t,{Z:()=>d});var i=n(35944),o=n(64755),a=n(67294),r=n(7360),s=n(41242);const d=a.memo((function({date:e,...t}){const n=a.useMemo((()=>Object.entries((0,o.Ey)(r.SP)).map((t=>{const n=(0,o.Ez)(t[0],e);return{value:t[0],label:`${(0,o.sX)(n,"(",")")} ${t[1].long}`,offset:n}})).sort(((e,t)=>e.offset-t.offset))),[e]);return(0,i.tZ)(s.ZP,{options:n,...t})}))},65383:(e,t,n)=>{n.d(t,{Z:()=>p});var i=n(35944),o=n(67294),a=n(92851),r=n(25292),s=n(37884),d=n(68563),l=n(16590),c=n(35025);const p=o.memo((function({children:e,onClose:t,marginBottom:n,borderRadius:o=2,paddingY:p=3,paddingX:u=4,gap:h=2}){return(0,i.BX)(d.ZP,{display:"flex",alignItems:"center",backgroundColor:"#FFD7DB",borderRadius:o,paddingY:p,paddingX:u,gap:h,marginBottom:n||"auto",width:"100%",children:[(0,i.tZ)(r.Z,{size:"md",icon:(0,i.tZ)(s.P5S,{}),color:a.COLORS.RED2}),(0,i.tZ)(l.Z,{kind:"body1",color:a.COLORS.BLACK,children:e}),(0,c.isNotNil)(t)&&(0,i.tZ)(r.Z,{size:"md",icon:(0,i.tZ)(s.x8P,{}),color:a.COLORS.DARK2,css:{cursor:"pointer"},onClick:t})]})}))},849:(e,t,n)=>{n.d(t,{Z:()=>R});var i=n(35944),o=n(67294),a=n(68563),r=n(37884),s=n(92851),d=n(16590);const l=o.memo((function({children:e}){return(0,i.tZ)(d.Z,{kind:"body2",children:e})})),c=l;var p=n(47856);const u=(0,o.createContext)({kind:"danger"}),h={info:"tertiary",danger:"danger",warning:"white"},g=o.memo((function({children:e,onPress:t}){const{kind:n}=(0,o.useContext)(u);return(0,i.tZ)(p.Z,{kind:h[n],size:"sm",onPress:t,children:e})})),m=g;var f=n(78694);const b=o.memo((function({children:e}){return(0,i.tZ)(a.ZP,{children:e})})),Z={info:s.COLORS.BLUE4,danger:s.COLORS.RED0,warning:s.COLORS.YELLOW},P={info:s.COLORS.WHITE,danger:s.COLORS.WHITE,warning:s.COLORS.DARK5},x=o.memo((function({children:e,kind:t="info",onClose:n}){const{bannerDescription:s,bannerButton:d,bannerIcons:l}=(e=>{let t,n,i;return o.Children.forEach(e,(e=>{(0,o.isValidElement)(e)&&(e?.type===c&&(t=e),e?.type===m&&(n=e),e?.type===b&&(i=e))})),{bannerDescription:t,bannerButton:n,bannerIcons:i}})(e),p=(0,i.tZ)(a.ZP,{marginLeft:-4,children:(0,i.tZ)(f.Z,{kind:"inline-text",icon:(0,i.tZ)(r.x8P,{color:P[t]}),size:"md",onPress:n})});return(0,i.tZ)(u.Provider,{value:{kind:t},children:(0,i.BX)(a.ZP,{alignItems:"center",justifyContent:"center",width:"100%",backgroundColor:Z[t],minHeight:"44px",gap:4,paddingY:2,paddingX:6,children:[l,s,d,n&&p]})})}));x.displayName="BannerContainer",x.BannerDescription=c,x.BannerButton=m,x.BannerIcons=b;const y=x;var v=n(25292);const C=o.memo((function({icon:e}){return(0,i.tZ)(v.Z,{icon:e,color:s.COLORS.WHITE,size:"sm"})})),S=o.memo((function({onClose:e,icons:t,primaryAction:n,secondaryAction:o,text:a,kind:r}){return(0,i.BX)(y,{kind:r,onClose:e,children:[(0,i.tZ)(y.BannerDescription,{children:a}),n&&(0,i.tZ)(y.BannerButton,{onPress:n.onAction,children:n.text}),o&&(0,i.tZ)(y.BannerButton,{onPress:o.onAction,children:o.text}),t&&t.length>0&&(0,i.tZ)(y.BannerIcons,{children:t.map((({icon:e},t)=>(0,i.tZ)(C,{icon:e},t)))})]})})),R=S},79444:(e,t,n)=>{n.d(t,{Cp:()=>$,St:()=>N,XC:()=>M,Zy:()=>I,dp:()=>E,jt:()=>D,mC:()=>B,us:()=>k});var i=n(35944),o=n(17126),a=n(43289),r=n(82232),s=n(54144),d=n(68563),l=n(16590),c=n(92851),p=n(87316),u=n(55371),h=n(45211),g=n(44308),m=n(44389),f=n(74717),b=n(74229),Z=n(95473),P=n(16124),x=n(81697),y=n(35025);const v=["P6hMU1to6iF9nQrR\\HavenDigital","dfjtyRxoSHNN6Jgx\\Stone Co 01","6GB3fuw8d4H6QNmS\\Stone Co 02","kGkbb0W1YrT9O2j8\\BigHat Engineering","aS8YA2UcWXJWvSBQ\\PayFit","hhym8jsqfNsY5MvR\\ubh3","Vsikft6T1zukCoY1\\layerx","e9W2fIi13CUA7You\\LegalZoom","4yUv27pM6A5xOCTn\\LZLS","AVQ2IkcyNLX5kCdx\\CLS-Office","cMrZ10a4zEX7VGg1\\HD","sldOYAjNRQDj9Ewl\\Basetis","lM8n4MNiTQG0RamO\\LHHBranches","BGwLj7crsWV4kZ8p\\LHH","lm0a2s74474utmcZ\\MTL_digital_platform","0iQuF71CRkNZK8hM\\Gather Entry","GuaNBuZwXECwgoJz\\recruitics","Sqz5qjT32Jy5wAHu\\springfield","PAAJdRg1VR1aTBpf\\Sunrun","cno78M93Pzlqs8yc\\Exinity V1","E8iySRNTOKlKoMqA\\Limbheim","N0SHfWMVjBXsphKy\\h2gs","peMUc55BzsaV3WWo\\PlatinumGames","Sax1DGytkQeGcRtr\\Segment Infrastructure","X8PmUssqQrJshqhI\\prevision-produto-e-tech","EhL5LyldsqghwNnn\\Whitepages","HS8JNCLnjniJGz89\\moonlite","1YN0N9yIn6qVW1md\\Innovation","J1HgRjQ23phAv5Zs\\Second Dinner","MNtmFF33xOdMkslI\\Linear","r1BZgQiIkF9k9z25\\Grafana-k6","YzkPYEZxBlXwXPub\\mews-sa","xEFTEcguVfr3mkFx\\Resolution Rangers","A7O6tHab4VnXcWy7\\horatioworkforce","pUoDt9HVLZCoQur1\\headspace"],C=o.ou.fromISO("2026-01-15T19:00:00Z"),S="https://support.gather.town/hc/en-us/articles/39590892978196",R={hasBeenDismissedLocalPrefKey:s.pt.HasDismissedInitialPricingCommunicationSep8,initialDisplayDateTime:o.ou.fromISO("2025-09-08T19:00:00Z")},w=()=>window.open(S,"_blank"),O={primaryAction:{text:(0,r.ZP)("824d76b"),onAction:()=>{w()}},kind:"warning"},k={noActiveReservationBanner:{...R,key:"noActiveReservationBanner",hasBeenDismissedLocalPrefKey:void 0,shouldSkipRecentSpaceCreationCheck:!0,isUserCurrentlyEligible:()=>{if("freeTier"!==T())return!1;const e=A();if(!e.spaceReservationsLoaded)return!1;const t=!e.hasActiveReservation,n=(0,x.kKJ)(e.spaceTrialEndsAt)||o.ou.now().toMillis()>=e.spaceTrialEndsAt.toMillis();return t&&n},bannerNotifId:a.B.NoActiveReservationBanner,bannerProps:{kind:"warning",primaryAction:{text:(0,r.ZP)("378cbbf"),onAction:()=>{w()}},text:(0,i.BX)(d.ZP,{flexDirection:"column",children:[(0,i.tZ)(l.Z,{kind:"h4",color:c.COLORS.DARK5,children:(0,r.ZP)("b12e9d8")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("1b8e374")})]})},grapeMenuContent:{textContent:(0,r.ZP)("eed144c",{a:e=>(0,i.tZ)("a",{href:S,css:{textDecoration:"underline"},target:"_blank",children:e})}),actionContent:()=>null}},initialPricingCommunicationFreeTrial:{...R,key:"initialPricingCommunicationFreeTrial",isUserCurrentlyEligible:()=>!1,bannerNotifId:a.B.InitialPricingCommunicationFreeTrial,bannerProps:{...O,text:(0,i.BX)(d.ZP,{flexDirection:"column",children:[(0,i.tZ)(l.Z,{kind:"h4",color:c.COLORS.DARK5,children:(0,r.ZP)("8a9df7a")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("7a124e6")})]})},grapeMenuContent:{textContent:(0,r.ZP)("ef3e7f9",{a:e=>(0,i.tZ)("a",{href:S,css:{textDecoration:"underline"},target:"_blank",children:e})}),actionContent:()=>null}},initialPricingCommunicationPaidPlanMonthly:{...R,key:"initialPricingCommunicationPaidPlanMonthly",isUserCurrentlyEligible:()=>!1,bannerNotifId:a.B.InitialPricingCommunicationPaidMonthly,bannerProps:{...O,text:(0,i.BX)(d.ZP,{flexDirection:"column",children:[(0,i.tZ)(l.Z,{kind:"h4",color:c.COLORS.DARK5,children:(0,r.ZP)("c73dba6")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("e5ed106")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("24ef17e")})]})},grapeMenuContent:{textContent:(0,r.ZP)("566cab3"),actionContent:()=>(0,i.tZ)(P.Z,{isFullWidth:!0,kind:"insights-primary",onPress:w,children:(0,r.ZP)("824d76b")})}},initialPricingCommunicationPaidPlanAnnual:{...R,key:"initialPricingCommunicationPaidPlanAnnual",isUserCurrentlyEligible:()=>!1,bannerNotifId:a.B.InitialPricingCommunicationPaidAnnual,bannerProps:{...O,text:(0,i.BX)(d.ZP,{flexDirection:"column",children:[(0,i.tZ)(l.Z,{kind:"h4",color:c.COLORS.DARK5,children:(0,r.ZP)("c73dba6")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("28ffff3")})]})},grapeMenuContent:{textContent:(0,r.ZP)("94cbc95"),actionContent:()=>(0,i.tZ)(P.Z,{isFullWidth:!0,kind:"insights-primary",onPress:w,children:(0,r.ZP)("824d76b")})}},initialPricingCommunicationNonRemoteWork:{...R,key:"initialPricingCommunicationNonRemoteWork",isUserCurrentlyEligible:()=>!1,bannerNotifId:a.B.InitialPricingCommunicationNonRemoteWork,bannerProps:{...O,text:(0,i.BX)(d.ZP,{flexDirection:"column",children:[(0,i.tZ)(l.Z,{kind:"h4",color:c.COLORS.DARK5,children:(0,r.ZP)("c73dba6")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("b1856f0")})]})},grapeMenuContent:{textContent:(0,r.ZP)("20ef5c5",{a:e=>(0,i.tZ)("a",{href:S,css:{textDecoration:"underline"},target:"_blank",children:e}),br:()=>(0,i.tZ)("br",{})}),actionContent:()=>null}},reminderPricingCommunicationPaidMonthly:{...R,key:"reminderPricingCommunicationPaidMonthly",isUserCurrentlyEligible:()=>{const e=L()??o.ou.now();return"paidMonthly"===T()&&e.toMillis()<=C.toMillis()},hasBeenDismissedLocalPrefKey:s.pt.HasDismissedReminderPricingCommunicationPaidMonthly,bannerNotifId:a.B.ReminderPricingCommunicationPaidMonthly,bannerProps:{...O,text:(0,i.BX)(d.ZP,{flexDirection:"column",children:[(0,i.tZ)(l.Z,{kind:"h4",color:c.COLORS.DARK5,children:(0,r.ZP)("ebb8b4f")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("bedd893")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("24ef17e")})]})},grapeMenuContent:{textContent:(0,r.ZP)("bedd893"),actionContent:()=>(0,i.tZ)(P.Z,{isFullWidth:!0,kind:"insights-primary",onPress:w,children:(0,r.ZP)("824d76b")})}},nowInEffectPricingCommunicationPaidMonthly:{...R,key:"nowInEffectPricingCommunicationPaidMonthly",isUserCurrentlyEligible:()=>"paidMonthly"===T(),initialDisplayDateTime:C.plus({seconds:1}),hasBeenDismissedLocalPrefKey:s.pt.HasDismissedNowInEffectPricingCommunicationPaidMonthly,bannerNotifId:a.B.NowInEffectPricingCommunicationPaidMonthly,bannerProps:{...O,text:(0,i.BX)(d.ZP,{flexDirection:"column",children:[(0,i.tZ)(l.Z,{kind:"h4",color:c.COLORS.DARK5,children:(0,r.ZP)("79efa32")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("1c6b5bd")}),(0,i.tZ)(l.Z,{kind:"body2",color:c.COLORS.DARK5,children:(0,r.ZP)("24ef17e")})]})},grapeMenuContent:{textContent:(0,r.ZP)("1c6b5bd"),actionContent:()=>(0,i.tZ)(P.Z,{isFullWidth:!0,kind:"insights-primary",onPress:w,children:(0,r.ZP)("824d76b")})}}},L=()=>{const e=s.wI.get(s.gA.FakeISOStringNowForPricingCommunication);if(e)return o.ou.fromISO(e)};window.gatherDev={...window.gatherDev},window.gatherDev.getFakeNow=L,window.gatherDev.setFakeNow=e=>{const t=new Date(e);s.wI.set(s.gA.FakeISOStringNowForPricingCommunication,t.toISOString())},window.gatherDev.clearFakeNow=()=>{s.wI.delete(s.gA.FakeISOStringNowForPricingCommunication)};const D=e=>!(0,x.kKJ)(e.hasBeenDismissedLocalPrefKey)&&"true"===s.wI.getForRoom(e.hasBeenDismissedLocalPrefKey),I=(e,{spaceCreationDate:t,shouldSkipRecentSpaceCreationCheck:n})=>{const i=L()??o.ou.now();return!(!n&&(0,y.isNotNil)(t)&&i.toMillis()<t.plus({days:2}).toMillis())&&(e=>(L()??o.ou.now()).toMillis()>=e.initialDisplayDateTime.toMillis())(e)},E=e=>{if(D(e))return!1;const t=(0,p.Di)();return!!I(e,{spaceCreationDate:(0,y.isNotNil)(t?.creationDate)?o.ou.fromISO(t?.creationDate):void 0})&&e.isUserCurrentlyEligible()},A=()=>({spaceReservationsLoaded:(0,p.c)(),hasActiveReservation:(0,p.AB)(),currentlyActiveReservationPlan:(0,p.yM)(),spaceTrialLoaded:(0,p.Ji)(),spaceTrialEndsAt:(0,p.He)(),isRemoteWorkUseCase:(0,p.nN)()}),M=e=>e.spaceReservationsLoaded&&e.spaceTrialLoaded?(()=>{const e=(0,f.PM)()??"";return!(!v.includes(e)&&!b.qK.includes(e))})()?"enterprise":e.isRemoteWorkUseCase?e.hasActiveReservation?e.currentlyActiveReservationPlan===Z.ReservationPlan.Annual?"paidAnnual":"paidMonthly":!e.spaceTrialEndsAt||o.ou.now().toMillis()>=e.spaceTrialEndsAt.toMillis()?"freeTier":"freeTrial":"nonRemoteWork":null,T=()=>{const e=A();return M(e)},N=e=>{const t=M(e);if((0,x.kKJ)(t))return null;const n=(e=>{switch(e){case"freeTrial":return k.initialPricingCommunicationFreeTrial;case"freeTier":return k.noActiveReservationBanner;case"paidMonthly":return(L()??o.ou.now()).toMillis()<=C.toMillis()?k.reminderPricingCommunicationPaidMonthly:k.nowInEffectPricingCommunicationPaidMonthly;case"paidAnnual":return k.initialPricingCommunicationPaidPlanAnnual;case"nonRemoteWork":return k.initialPricingCommunicationNonRemoteWork;default:return null}})(t);return(0,x.kKJ)(n)?null:n},B=e=>{const t=N(e);return(0,x.kKJ)(t)?null:t.grapeMenuContent},$=()=>{const e=(0,p.Db)()??"",t=(0,u.Sq)((0,h.b)().getState(),e);return(0,g.hasSpaceRole)(t?.role,[m.CoreRole.Owner])}},24405:(e,t,n)=>{n.d(t,{P:()=>b,b:()=>f});var i=n(77736),o=n(53123),a=n(50658),r=n(12892),s=n(74717),d=n(13352),l=n(35025),c=n(67294),p=n(15445),u=n(93633),h=n(2948),g=n(2823);const m=async()=>{u.Y.error("UNBREAK NOW: A noop function in ModContext was invoked! Are you providing this context properly?")},f=c.createContext({calendarLink:"",banPlayer:m,kickPlayer:m,unbanPlayer:m,roomClosed:!1,setRoomClosedState:m,changeRoomClosed:m,changePassword:m,changeCalendar:m,changeForceMute:m,forceMute:!1,setForceMuteState:m}),b=e=>{const[t,n]=(0,c.useState)(""),[m,f]=(0,c.useState)(!1),[b,Z]=(0,c.useState)(!1),P=(0,c.useCallback)((async()=>{try{const t=await r.wP.get(g.HttpV2Paths.SpaceCalendar,{auth:!0,params:{path:{space:e}}});n((0,l.isNil)(t)?"":t)}catch(e){u.Y.log(e)}}),[e]);return(0,c.useEffect)((()=>{P()}),[P]),{calendarLink:t,banPlayer:async(e,t=(()=>{}))=>{p.H.banPlayer(e),t(),(0,h.NO)(d.MetricsEventName.BAN_USER,{spaceId:(0,s.PM)(),playerId:e})},kickPlayer:async(e,t=(()=>{}))=>{p.H.kickPlayer(e),t(),(0,h.NO)(d.MetricsEventName.KICK_USER,{spaceId:(0,s.PM)(),playerId:e})},changeRoomClosed:async t=>{const n=m;f(t);try{const n=await a.authTokenManager.waitForToken();await i.axios.post(o.v.apiURL+"/api/setRoomClosed",{room:e,token:n,closed:t}),t||window.location.reload()}catch{return f(n),Promise.reject(`Failed to ${t?"close":"open"} room.`)}},setRoomClosedState:f,roomClosed:m,changePassword:async t=>{try{const n=await a.authTokenManager.waitForToken();await i.axios.post(o.v.apiURL+"/api/changePassword",{room:e,token:n,newPassword:t})}catch{return Promise.reject("Failed to change password.")}},changeCalendar:async t=>{try{await r.wP.post(g.HttpV2Paths.SpaceCalendar,{auth:!0,params:{path:{space:e},body:{iCalLink:t}}}),n(t)}catch{return Promise.reject("Failed to change calendar.")}},changeForceMute:async t=>{const n=t;Z(t);try{const n=await a.authTokenManager.waitForToken();await i.axios.post(o.v.apiURL+"/api/setForceMute",{room:e,token:n,mute:t})}catch{return Z(n),Promise.reject("Failed to change calendar.")}},unbanPlayer:async()=>{},forceMute:b,setForceMuteState:Z}}},35133:(e,t,n)=>{n.d(t,{R:()=>r});var i=n(67294),o=n(79444),a=n(35025);const r=(e,{spaceCreationDate:t})=>{const n=(0,i.useRef)(null),[r,s]=(0,i.useState)(!1);return(0,i.useEffect)((()=>{const i=()=>{const n=(0,a.isNotNil)(e)&&(0,o.Zy)(e,{spaceCreationDate:t});s(n)};return i(),n.current=setInterval(i,6e4),()=>{n.current&&clearInterval(n.current)}}),[e,t]),{isEligible:r}}},3407:(e,t,n)=>{n.d(t,{Y:()=>a,m:()=>r});var i=n(10932),o=n(92851);const a=i.Z.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
  flex: 1;
`,r=i.Z.div`
  font-size: 13px;
  font-weight: 500;
  line-height: 17px;
  color: ${o.COLORS.WHITE};
  margin-bottom: 4px;
`},29774:(e,t,n)=>{n.d(t,{Z:()=>r});var i=n(35944),o=n(41242),a=n(3407);const r=({label:e,isRequired:t=!1,...n})=>(0,i.BX)(a.Y,{children:[(0,i.tZ)(a.m,{children:t?`${e}*`:e}),(0,i.tZ)(o.ZP,{...n})]})},48017:(e,t,n)=>{n.d(t,{Z:()=>s});var i=n(35944),o=n(67294),a=n(49691),r=n(3407);const s=o.memo((function({label:e,isRequired:t=!1,...n}){return(0,i.BX)(r.Y,{children:[(0,i.tZ)(r.m,{children:t?`${e}*`:e}),(0,i.tZ)(a.Z,{...n})]})}))},39662:(e,t,n)=>{n.d(t,{Y:()=>p});var i=n(35944),o=n(67294),a=n(849),r=n(82232),s=n(16590),d=n(92851),l=n(68563),c=n(54144);const p=o.memo((function(){const[e,t]=o.useState("true"===c.wI.getForRoom(c.pt.V1ToV2LinkingBannerDismissed));return e?null:(0,i.tZ)(a.Z,{kind:"info",primaryAction:{text:(0,r.ZP)("378cbbf"),onAction:()=>{window.open("https://gathertown.notion.site/link-1-0-subscription-to-2-0-space","_blank","noopener,noreferrer")}},onClose:()=>{c.wI.setForRoom(c.pt.V1ToV2LinkingBannerDismissed,"true"),t(!0)},text:(0,i.BX)(l.ZP,{flexDirection:"column",children:[(0,i.tZ)(s.Z,{kind:"h4",color:d.COLORS.LIGHT1,children:(0,r.ZP)("50675b0")}),(0,i.tZ)(s.Z,{kind:"body2",color:d.COLORS.LIGHT1,children:(0,r.ZP)("fadd14e")})]})})}))},68523:(e,t,n)=>{n.d(t,{On:()=>l,wN:()=>r,ze:()=>s});var i=n(85229),o=n(34857),a=n(43507);const r=(0,i.PH)("dashboardNotification/add",(function(e,t,n,i){return{payload:{key:e,type:t,message:n,params:i}}})),s=(0,i.PH)("dashboardNotification/cancel"),d={};function*l(){for(;;){const{notification:e,canceledNotification:t}=yield(0,o.S3)({notification:(0,o.qn)(r),canceledNotification:(0,o.qn)(s)});if(e){const t=e.payload.key;yield*c(t);const n=yield(0,o.rM)(p,e);d[t]=n}else if(t){const e=t.payload;yield*c(e)}}}function*c(e){const t=d[e];void 0!==t&&(yield(0,o.al)(t),yield(0,o.gz)((0,a.N5)(e)),delete d[e])}function*p(e){const{key:t,type:n,message:i,params:r}=e.payload;yield(0,o.gz)((0,a.bq)(t,n,i)),r?.shouldPersist||(yield(0,o.gw)(1e4),yield(0,o.gz)((0,a.N5)(t)),delete d[t])}},43507:(e,t,n)=>{n.d(t,{$H:()=>S,$U:()=>O,A7:()=>H,AO:()=>m,C9:()=>L,Cx:()=>E,Do:()=>ye,EM:()=>Ae,Fe:()=>C,Fu:()=>Se,G7:()=>ae,Gu:()=>ze,Hs:()=>Pe,IE:()=>se,IP:()=>oe,KK:()=>Te,M4:()=>$e,N5:()=>Y,NC:()=>he,NM:()=>ve,Ny:()=>ke,OP:()=>Ge,P0:()=>N,Qj:()=>ie,Qv:()=>He,R3:()=>q,Sh:()=>ne,Tm:()=>k,Tw:()=>xe,Us:()=>Z,YG:()=>Le,YX:()=>fe,_6:()=>we,_t:()=>f,av:()=>_,bK:()=>ge,bP:()=>Ue,bW:()=>le,bq:()=>X,dj:()=>Fe,eO:()=>re,eQ:()=>A,eT:()=>Ne,gy:()=>Q,iU:()=>J,ir:()=>me,ix:()=>K,kf:()=>ue,l$:()=>je,l4:()=>y,l6:()=>Xe,lS:()=>be,ot:()=>Re,pj:()=>G,q3:()=>de,qf:()=>Ee,qk:()=>M,sU:()=>B,tG:()=>Ve,uv:()=>De,vB:()=>R,wt:()=>w,xP:()=>Ze,xU:()=>ce,xs:()=>V,y7:()=>W,yo:()=>Ce,yq:()=>j,zJ:()=>ee,zg:()=>v});var i,o=n(85229),a=n(22222),r=n(44308),s=n(12306),d=n(95473),l=n(17126),c=n(35025),p=n(33968),u=n(28216),h=n(81697),g=n(54144),m=((i=m||{}).AVIssues="Audio / video quality and reliability",i.OtherTechIssues="Other technical issues (not related to audio / video)",i.Onboarding="Too difficult to onboard the team and get engagement",i.OtherTools="Too many other communication tools / switching to another tool",i.Expensive="Too expensive",i.MissingFeatures="Missing features",i.ReturnToOffice="Going back to in-person work",i.Downsizing="Shutting down the company / downsizing",i.OneOff="Used Gather for a one-time event that ended",i.SomethingElse="Something else",i);const f="Change subscription";var b,Z=((b=Z||{})[b.Warning=0]="Warning",b[b.Error=1]="Error",b[b.Success=2]="Success",b[b.Info=3]="Info",b);const P={authToken:void 0,spaceId:"",spaceInfo:void 0,spaceTrial:void 0,spaceTrialLoaded:!1,isLoading:!1,showModal:s.w8.None,modalConfirm:void 0,reservationPlan:d.ReservationPlan.Daily,reservationDetails:{},reservationDetailsV2:{},invoiceData:{},paymentDataV2:{},isPaymentDataComplete:!1,ephemeralStripePaymentInfo:void 0,customerStripePaymentInfo:void 0,priceDetailsV2:{},proratedPrice:void 0,isLoadingProratedPrice:!1,prorationDate:void 0,nextBillDate:void 0,annualPlanUpgradeDetails:void 0,notifications:[],reservations:[],pastReservations:void 0,editedReservation:void 0,hasEndedRecentPaymentFailedSubscription:!1,isPremium:!1,useCase:void 0,cancellationReasonsSelected:void 0,cancellationReasonMessage:"",subscriptionUpdateToken:null},x=(0,o.oM)({name:"dashboard",initialState:P,reducers:{setIsLoading:(e,t)=>{e.isLoading=t.payload},setSpaceId:(e,t)=>{e.spaceId=t.payload},setSpaceInfo:(e,t)=>{e.spaceInfo=t.payload,e.spaceSettings={...e.spaceSettings,...t.payload.settings}},setSpaceSettings:(e,t)=>{e.spaceSettings={...e.spaceSettings,...t.payload}},setSpaceTrial(e,t){e.spaceTrial=t.payload,e.spaceTrialLoaded=!0},setReservations:(e,t)=>{e.reservations=t.payload},setEditedReservation:(e,t)=>{e.editedReservation=t.payload},setHasEndedRecentPaymentFailedSubscription:(e,t)=>{e.hasEndedRecentPaymentFailedSubscription=t.payload},setIsPremium:(e,t)=>{e.isPremium=t.payload},postNotification:{reducer:(e,t)=>{e.notifications.push(t.payload)},prepare:(e,t,n)=>({payload:{key:e,type:t,message:n}})},dismissNotification:(e,t)=>{e.notifications=e.notifications.filter((e=>e.key!==t.payload))},setShowModal:{reducer:(e,t)=>{const{show:n,type:i}=t.payload;if(!n)return e.showModal=s.w8.None,void(e.modalConfirm=void 0);e.showModal=i,e.modalConfirm=t.payload.onConfirm},prepare:(e,t=s.w8.None,n)=>({payload:{show:e,type:t,onConfirm:n}})},resetReservation:e=>{e.reservationDetails={},e.reservationDetailsV2={},e.invoiceData={},e.paymentDataV2={},e.ephemeralStripePaymentInfo=void 0,e.priceDetailsV2={},e.proratedPrice=void 0,e.prorationDate=void 0,e.nextBillDate=void 0,e.editedReservation=void 0,e.modalConfirm=void 0,e.showModal=s.w8.None,e.cancellationReasonMessage="",e.cancellationReasonsSelected=[],e.subscriptionUpdateToken=null,e.annualPlanUpgradeDetails=void 0},setReservationPlan:(e,t)=>{t.payload.resetReservation&&x.caseReducers.resetReservation(e),e.reservationPlan=t.payload.plan,g.wI.set(g.gA.LastSelectedReservationPlan,t.payload.plan)},setReservationDetails:(e,t)=>{e.reservationDetails=t.payload},setReservationDetailsV2:(e,t)=>{e.reservationDetailsV2=t.payload},updateReservationDetailsV2:(e,t)=>{e.reservationDetailsV2={...e.reservationDetailsV2,...t.payload}},updatePaymentDataV2:(e,t)=>{e.paymentDataV2={...e.paymentDataV2,...t.payload}},setIsPaymentDataComplete:(e,t)=>{e.isPaymentDataComplete=t.payload},setEphemeralPaymentStripeInfo:(e,t)=>{e.ephemeralStripePaymentInfo=t.payload},setCustomerPaymentStripeInfo:(e,t)=>{e.customerStripePaymentInfo=t.payload},setPriceDetailsV2:(e,t)=>{e.priceDetailsV2=t.payload},setProratedPrice:(e,t)=>{e.proratedPrice=t.payload},setIsLoadingProratedPrice:(e,t)=>{e.isLoadingProratedPrice=t.payload},setProrationDate:(e,t)=>{e.prorationDate=t.payload},setNextBillDate:(e,t)=>{e.nextBillDate=t.payload},updateInvoiceData:(e,t)=>{e.invoiceData={...e.invoiceData,...t.payload}},setPastReservations:(e,t)=>{e.pastReservations=t.payload},setUseCase:(e,t)=>{e.useCase=t.payload},setCancellationReasonsSelected:(e,t)=>{e.cancellationReasonsSelected=t.payload},setCancellationReasonMessage:(e,t)=>{e.cancellationReasonMessage=t.payload},setSubscriptionUpdateToken:(e,t)=>{e.subscriptionUpdateToken=t.payload},setAnnualPlanUpgradeDetails:(e,t)=>{e.annualPlanUpgradeDetails=t.payload},clearAnnualPlanUpgradeDetails:e=>{e.annualPlanUpgradeDetails=void 0}}}),y=x.reducer,{setSpaceId:v,setSpaceInfo:C,setSpaceSettings:S,setSpaceTrial:R,setIsLoading:w,setShowModal:O,resetReservation:k,setReservationPlan:L,setReservationDetails:D,setReservationDetailsV2:I,updateReservationDetailsV2:E,updatePaymentDataV2:A,setIsPaymentDataComplete:M,setEphemeralPaymentStripeInfo:T,setCustomerPaymentStripeInfo:N,setPriceDetailsV2:B,setProratedPrice:$,setIsLoadingProratedPrice:z,setProrationDate:F,setNextBillDate:U,updateInvoiceData:j,setReservations:G,setEditedReservation:V,setHasEndedRecentPaymentFailedSubscription:H,setIsPremium:K,postNotification:X,dismissNotification:Y,setPastReservations:W,setUseCase:_,setCancellationReasonsSelected:J,setCancellationReasonMessage:q,setSubscriptionUpdateToken:Q,setAnnualPlanUpgradeDetails:ee,clearAnnualPlanUpgradeDetails:te}=x.actions,ne=e=>e.dashboard.spaceId,ie=(0,a.P1)(ne,(e=>e.split("\\")[1])),oe=e=>e.dashboard.spaceInfo,ae=e=>e.dashboard.spaceSettings,re=(0,a.P1)(ne,(e=>{const t=e.split("\\");return encodeURI(t.join("/"))})),se=e=>e.dashboard.spaceTrialLoaded,de=e=>e.dashboard.spaceTrial,le=e=>e.dashboard.spaceTrial?.endsAt?l.ou.fromISO(e.dashboard.spaceTrial.endsAt):void 0,ce=e=>e.dashboard.isLoading,pe=e=>e.dashboard.showModal,ue=()=>(0,u.v9)(pe),he=e=>e.dashboard.modalConfirm,ge=e=>e.dashboard.reservationPlan,me=e=>e.dashboard.reservationDetails,fe=e=>e.dashboard.reservationDetailsV2,be=e=>e.dashboard.invoiceData,Ze=e=>e.dashboard.paymentDataV2,Pe=e=>e.dashboard.isPaymentDataComplete,xe=e=>e.dashboard.customerStripePaymentInfo,ye=e=>e.dashboard.priceDetailsV2,ve=e=>e.dashboard.proratedPrice,Ce=e=>e.dashboard.isLoadingProratedPrice,Se=e=>e.dashboard.nextBillDate,Re=e=>e.dashboard.annualPlanUpgradeDetails,we=e=>e.dashboard.notifications,Oe=e=>e.dashboard.reservations,ke=e=>e.dashboard.useCase,Le=e=>e.dashboard.cancellationReasonsSelected,De=e=>e.dashboard.cancellationReasonMessage,Ie=(0,a.P1)(Oe,(e=>e.filter((e=>!e.subscription)))),Ee=(0,a.P1)(Oe,(e=>e.filter((e=>Boolean(e.subscription))))),Ae=(0,a.P1)(Ie,(e=>e.filter((e=>(0,p.sN)(e))))),Me=((0,a.P1)(Ae,(e=>e.filter((e=>!e.hasUnpaidInvoice)))),(0,a.P1)(Ae,(e=>e.filter((e=>e.hasUnpaidInvoice))))),Te=(0,a.P1)(Ie,(e=>e.filter((e=>e.paid&&!e.canceled&&(0,r.checkTimeInFuture)(new Date(e.startDate))&&!(0,p.sN)(e))))),Ne=((0,a.P1)(Te,(e=>e.filter((e=>!e.hasUnpaidInvoice)))),(0,a.P1)(Te,(e=>e.filter((e=>e.hasUnpaidInvoice)))),(0,a.P1)(Ie,(e=>e.filter((e=>!e.paid&&!e.canceled&&e.invoiceId))))),Be=(0,a.P1)(Ee,(e=>e.filter((e=>e.paid&&!e.canceled&&(0,c.isNil)(e.endDate))))),$e=(0,a.P1)([Ae,Te,Ne],((e,t,n)=>e.length+t.length+n.length)),ze=(0,a.P1)(Ee,p.ir),Fe=(0,a.P1)(Ne,Te,Me,Be,((e,t,n,i)=>e.length>0||t.length>0||n.length>0||i.length>0)),Ue=e=>e.dashboard.editedReservation,je=()=>(0,u.v9)(Ue),Ge=e=>e.dashboard.isPremium,Ve=e=>e.dashboard.hasEndedRecentPaymentFailedSubscription,He=(0,a.P1)((e=>e.dashboard.pastReservations),(e=>e?(0,h.GYS)((0,h.MRu)((e=>new Date(e.startDate).getTime()),e.filter((e=>e.subscription)))):[])),Ke=(0,a.P1)((e=>e.dashboard),(e=>e.subscriptionUpdateToken)),Xe=()=>(0,u.v9)(Ke)},26101:(e,t,n)=>{n.d(t,{Z:()=>h});var i=n(83105),o=n(85229),a=n(28654),r=n(34857),s=n(68523),d=n(93633);const l={dashboard:n(43507).l4},c=(0,i.UY)(l),p=(0,a.ZP)(),u=(0,o.xC)({reducer:c,devTools:{trace:!0,traceLimit:25},middleware:e=>e({immutableCheck:!1,serializableCheck:!1}).concat(p)});p.run((function*(){yield(0,r.$6)([s.On].map((e=>(0,r.Cs)((function*(){for(;;)try{yield(0,r.RE)(e);break}catch(e){d.Y.log(e)}})))))}));const h=u},12306:(e,t,n)=>{n.d(t,{Jb:()=>d,TI:()=>c,ut:()=>p,vq:()=>l,w8:()=>u});var i,o,a,r,s,d=((s=d||{}).Reservations="reservations",s.Preferences="preferences",s.SpaceAccess="space-access",s.SSO="sso",s.UserRoles="user-roles",s.BannedUsers="banned-users",s.ShutDownDelete="shut-down-delete",s.Announcements="announcements",s.Subscriptions="subscriptions",s),l=((r=l||{}).NewSubscriptionSurvey="new-subscription-survey",r.CreateReservation="create-reservation",r.CreateSubscription="create-subscription",r.ManageSubscription="manage-subscription",r.ManageOneTimeReservation="manage-reservation",r.ReservationSuccess="reservation-success",r.UpdateSubscriptionSuccess="update-subscription-success",r.Insights="insights",r),c=((a=c||{}).Subscription="subscription",a.OneTimeEvents="one-time-events",a),p=(e=>(e.Office="office",e.Members="members",e))(p||{}),u=((o=u||{}).None="None",o.DeleteSpace="DeleteSpace",o.DeleteGuestList="DeleteGuestList",o.PaymentInfoSummary="PaymentInfoSummary",o.UpdatePaymentInfo="UpdatePaymentInfo",o.ManageSubscription="ManageSubscription",o.TemporaryCapacityIncrease="TemporaryCapacityIncrease",o.ManageTemporaryReservation="ManageTemporaryReservation",o.UpdateSpaceCapacity="UpdateSpaceCapacity",o.CancelSubscriptionSelectReasons="CancelSubscriptionSelectReasons",o.CancelSubscriptionTextReason="CancelSubscriptionTextReason",o.CancelSubscriptionConfirmation="CancelSubscriptionConfirmation",o.UpdateOneTimeReservation="UpdateOneTimeReservation",o.UpdateOneTimeSpaceCapacity="UpdateOneTimeSpaceCapacity",o.ContactGather="ContactGather",o),h=((i=h||{})[i.Manage=0]="Manage",i[i.SelectReasons=1]="SelectReasons",i[i.TextReasons=2]="TextReasons",i[i.Confirmation=3]="Confirmation",i[i.SuccessAndFeedback=4]="SuccessAndFeedback",i[i.Thanks=5]="Thanks",i[i.Change=6]="Change",i)},22614:(e,t,n)=>{n.d(t,{Ix:()=>s,Ll:()=>d,xT:()=>r});var i=n(95551),o=n(95473),a=n(82232);const r=(0,i.enumToHuman)(o.ReservationPlan,{Daily:(0,a.EI)((0,a.ZP)("bfba919")),Monthly:(0,a.EI)((0,a.ZP)("d617425")),TwoHour:(0,a.EI)((0,a.ZP)("bfba919")),Annual:(0,a.EI)((0,a.ZP)("14a3d5a"))}),s=(e,t)=>(0,i.enumToHuman)(o.ReservationPlan,{Daily:t?(0,a.EI)((0,a.ZP)("days")):(0,a.EI)((0,a.ZP)("day")),Monthly:t?(0,a.EI)((0,a.ZP)("months")):(0,a.EI)((0,a.ZP)("month")),TwoHour:t?(0,a.EI)((0,a.ZP)("051f392")):(0,a.EI)((0,a.ZP)("826a40f")),Annual:t?(0,a.EI)((0,a.ZP)("months")):(0,a.EI)((0,a.ZP)("month"))})(e),d=(0,i.enumToHuman)(o.ReservationPlan,{Daily:(0,a.EI)((0,a.ZP)("1a8fa60")),Monthly:(0,a.EI)((0,a.ZP)("f8102d2")),TwoHour:(0,a.EI)((0,a.ZP)("1cb5c74")),Annual:(0,a.EI)((0,a.ZP)("617f5de"))})},36356:(e,t,n)=>{n.d(t,{D7:()=>u,Ny:()=>g,PU:()=>c,ZV:()=>h,_o:()=>b,kr:()=>Z});var i=n(64755),o=n(17126),a=n(7360),r=n(13143),s=n(81697),d=n(93633),l=n(44308);const c=()=>{const e=o.ou.now().zoneName;return((0,i.Ey)(a.SP)[e]?e:f(e))??e},p=(e,t)=>o.ou.fromJSDate(e).setZone(t,{keepLocalTime:!0}).toJSDate(),u=(e,t)=>o.ou.fromJSDate(e,{zone:t}).setZone(c(),{keepLocalTime:!0}).toJSDate(),h=(e,t)=>(0,r.Gn)(o.ou.fromJSDate(e,{zone:t??c()})),g=(e,t)=>{const n=e??c();return`${(0,i.sX)((0,i.Ez)(n,t),"(",")")} ${(0,i.HG)(n,a.SP)}`},m=Object.entries((0,i.Ey)(a.SP)).map((e=>({iana:e[0],label:e[1].long,offset:(0,i.Ez)(e[0])}))),f=e=>{const t=o.ou.now().setZone(e),n=t.zoneName;if((0,s.kKJ)(n))return d.Y.error("Zone name is not defined, with zone",new l.ErrorContext({zone:e})),e;const a=n.indexOf("/"),r=(0,i.Ez)(e);return m.filter((e=>e.offset===r)).map((e=>{let i=0;return o.ou.now().setZone(e.iana).isInDST===t.isInDST?(-1!==e.iana.toLowerCase().indexOf(n.substr(a+1))&&(i+=8),-1!==e.label.toLowerCase().indexOf(n.substr(a+1))&&(i+=4),e.iana.toLowerCase().indexOf(n.substr(0,a))&&(i+=2),i+=1):"GMT"===e.iana&&(i+=1),{tz:e,score:i}})).sort(((e,t)=>t.score-e.score))[0]?.tz.iana},b=(e,t)=>{const n=o.ou.fromJSDate(e).startOf("day").toJSDate();return p(n,t||c())},Z=(e,t)=>{const n=o.ou.fromJSDate(e).endOf("day").toJSDate();return p(n,t||c())}},42086:(e,t,n)=>{n.d(t,{y:()=>a});var i=n(74717),o=n(54809);const a=e=>`/${o.H.dashboard}/${((0,i.PM)()||"").replace("\\","/")}${e?`/${e}`:""}`},56674:(e,t,n)=>{n.d(t,{He:()=>u,Le:()=>l,Lz:()=>r,md:()=>c});var i=n(15267),o=n(97995),a=n(7360);const r=e=>(0,o.Lz)(e,(0,a.Kd)()),s={"en-US":"https://support.gather.town/hc/en-us/articles/15910368117012","pt-BR":"https://support.gather.town/hc/en-us/articles/15910381649812","ja-JP":"https://support.gather.town/hc/en-us/articles/15910370655508",[i.Sk]:"https://support.gather.town/hc/en-us/articles/15910368117012"},d={"en-US":"https://www.gather.town/contact-sales","pt-BR":"https://pt-br.gather.town/contact-sales","ja-JP":"https://ja.gather.town/contact-sales",[i.Sk]:"https://www.gather.town/contact-sales"},l=()=>d[(0,a.Kd)()]??d[i.ZW],c=()=>s[(0,a.Kd)()]??s[i.ZW],p={"en-US":"https://www.gather.town","pt-BR":"https://pt-br.gather.town","ja-JP":"https://ja.gather.town",[i.Sk]:"https://www.gather.town"},u=e=>`${p[(0,a.Kd)()]??p[i.ZW]}${e}`}}]);
//# sourceMappingURL=https://sourcemaps.us-east-1-a.prod.aws.gather.town/v1/gather-browser/72991861a/bundle.152ecb269889a0cd114d.js.map
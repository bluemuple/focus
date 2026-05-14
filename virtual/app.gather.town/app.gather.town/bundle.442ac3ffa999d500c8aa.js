"use strict";(self.webpackChunkgather_browser=self.webpackChunkgather_browser||[]).push([[2117],{57881:(e,o,t)=>{t.d(o,{J:()=>u,Z:()=>c});var r=t(35944),n=t(67294),i=t(50040),l=t(55184),a=t(68563),d=t(9781),s=t(30800);const c=(0,n.memo)((function({children:e}){const{modalContent:o}=(0,n.useContext)(i.tC),t=o||e;return t?(0,r.tZ)(u,{children:t}):null})),u=(0,n.memo)((function({children:e}){return(0,r.tZ)(a.ZP,{position:"fixed",top:"0",left:"0",width:"100vw",height:"100vh",zIndex:s.S.Modal,children:(0,r.tZ)(l.Z,{children:(0,r.tZ)(d.Z,{animate:!0,children:e})})})}))},9781:(e,o,t)=>{t.d(o,{Z:()=>s});var r=t(35944),n=t(67294),i=t(81472),l=t(99985);const a=t(10932).Z.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({overlay:e})=>`rgba(0, 0, 0, ${e?.5:0})`};
  pointer-events: ${({pointer:e})=>e?"auto":"none"};
`,d=n.memo((function({children:e,animate:o,overlay:t=!1,style:n,immediate:d=!1,onRest:s}){return(0,i.useTransition)(o,{from:{opacity:0,progress:0,pointer:!1},enter:{opacity:1,progress:1,pointer:!0},leave:{opacity:0,progress:0,pointer:!1},config:l.ip,immediate:d,onRest:s})((({opacity:o,progress:l,pointer:d},s)=>s&&(0,r.tZ)(a,{pointer:s&&t,overlay:t,children:(0,r.tZ)(i.animated.div,{css:n,style:{pointerEvents:d?"auto":"none",opacity:o,transform:l.to((e=>e<1?`\n                  translate3d(0, ${10*(1-e)}px, 0)\n                  scale3d(${1-.03*(1-e)}, ${1-.03*(1-e)}, 1)\n                `:""))},children:e})})))})),s=d},10815:(e,o,t)=>{t.d(o,{Z:()=>le});var r=t(35944),n=t(67294),i=t(82232),l=t(14142),a=t(20726),d=t(10932),s=t(89674),c=t(41684),u=t(88076),p=t(85761),m=t(91676),h=t(64663),b=t(49641),f=t(19910);const g=d.Z.button`
  background: none;
  padding: 8px;
  border: none;
  border-radius: 30px;
  outline: none;
  cursor: pointer;

  ${({theme:e,isDisabled:o})=>o&&`\n      background-color: ${e.button["low-key"].disabled.backgroundColor};\n      color: ${e.button["low-key"].disabled.foregroundColor};\n      cursor: default;\n      opacity: 0.5;\n    `}
  ${({theme:e,isDisabled:o,isFocusVisible:t})=>!o&&t&&`\n      background-color: ${e.button.primary.focus.backgroundColor};\n      color: ${e.button.primary.focus.foregroundColor};\n    `}

  ${({theme:e,isDisabled:o})=>!o&&`\n      &:hover {\n        background-color: ${e.button.primary.focus.backgroundColor};\n        color: ${e.button.primary.focus.foregroundColor};\n      }\n    `}
`,Z=n.memo((function(e){const o=(0,n.useRef)(null),{buttonProps:t}=(0,h.U)(e,o),{focusProps:i,isFocusVisible:l}=(0,b.Fx)();return(0,r.tZ)(g,{ref:o,...(0,f.dG)(t,i),isDisabled:e.isDisabled,isFocusVisible:l,children:e.children})})),x=Z,C=d.Z.td`
  position: relative;
  padding-top: 4px;
  padding-bottom: 4px;
`,v=d.Z.div`
  width: 36px;
  height: 36px;
  border-radius: 36px;
  ${({theme:e,isSelected:o,isInvalid:t})=>o&&t&&`\n      background-color: ${e.button.danger.disabled.backgroundColor};\n      color: ${e.button.danger.disabled.foregroundColor};\n    `}
`,O=d.Z.div`
  width: 100%;
  height: 100%;
  border-radius: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  // Disabled state
  ${({theme:e,isDisabled:o,isInvalid:t})=>o&&!t&&`\n    background-color: ${e.button["low-key"].disabled.backgroundColor};\n    color: ${e.button["low-key"].disabled.foregroundColor};\n    cursor: default;\n    opacity: 0.5;\n    `}
  // Selected state
  ${({theme:e,isDisabled:o,isSelected:t})=>t&&!o&&`\n      background-color: ${e.button.primary.active.backgroundColor};\n      color: ${e.button.primary.active.foregroundColor};\n      &:hover {\n        background-color: ${e.button.primary.focus.backgroundColor};\n        color: ${e.button.primary.focus.foregroundColor};\n      }\n    `}
  // Focus state, visible while the cell has keyboard focus
  ${({theme:e,isFocusVisible:o})=>o&&`\n      background-color: ${e.button.primary.focus.backgroundColor};\n      color: ${e.button.primary.focus.foregroundColor};\n    `}
`,R=n.memo((function({state:e,date:o}){const t=(0,s.u)(),i=(0,n.useRef)(null),{cellProps:l,buttonProps:a,isSelected:d,isOutsideVisibleRange:c,isDisabled:p,formattedDate:m,isInvalid:h}=(0,u.JK)({date:o},e,i),{focusProps:g,isFocusVisible:Z}=(0,b.Fx)();return(0,r.tZ)(C,{...l,children:(0,r.tZ)(v,{theme:t,...(0,f.dG)(a,g),ref:i,hidden:c,isSelected:d,isDisabled:p,isInvalid:h,children:(0,r.tZ)(O,{theme:t,isDisabled:p,isInvalid:h,isFocusVisible:Z,isSelected:d,children:m})})})})),y=R,S=d.Z.table`
  flex: 1 1 0%;
`,k=d.Z.thead`
  color: ${({theme:e})=>e.text.secondary};
`,L=d.Z.th`
  text-align: center;
`,$=n.memo((function({state:e,...o}){const t=(0,s.u)(),{locale:n}=(0,p.bU)(),{gridProps:i,headerProps:l,weekDays:a}=(0,u.QA)(o,e),d=(0,c.Rn)(e.visibleRange.start,n);return(0,r.BX)(S,{...i,cellPadding:"0",children:[(0,r.tZ)(k,{...l,theme:t,children:(0,r.tZ)("tr",{children:a.map(((e,o)=>(0,r.tZ)(L,{children:e},o)))})}),(0,r.tZ)("tbody",{children:[...new Array(d).keys()].map((o=>(0,r.tZ)("tr",{children:e.getDatesInWeek(o).map(((o,t)=>o?(0,r.tZ)(y,{state:e,date:o},t):(0,r.tZ)("td",{},t)))},o)))})]})}));var w=t(16590),D=t(37884),P=t(68563),I=t(73339);const E=d.Z.div`
  display: inline-block;
  background-color: ${({theme:e})=>e.background.secondary};
  color: ${({theme:e})=>e.text.primary};
  border: 1px solid ${({theme:e})=>e.textInput.borderColor.default};
  border-radius: 16px;
  margin-top: 8px;
  margin-bottom: 8px;
  padding: 8px;
`,B=n.memo((function(e){const o=(0,s.u)(),{locale:t}=(0,p.bU)(),i=(0,m.F)({...e,locale:t,createCalendar:c.YR}),l=(0,n.useRef)(null),{calendarProps:a,prevButtonProps:d,nextButtonProps:h,title:b}=(0,u.GX)(e,i);return(0,r.BX)(E,{...a,ref:l,theme:o,children:[(0,r.BX)(P.ZP,{display:"flex",alignItems:"center",padding:1,marginBottom:3,children:[(0,r.tZ)(P.ZP,{flex:"1",marginLeft:2,children:(0,r.tZ)(w.Z,{kind:"h2",children:b})}),(0,r.tZ)(x,{...d,children:(0,r.tZ)(I.Z,{icon:(0,r.tZ)(D.s$$,{})})}),(0,r.tZ)(x,{...h,children:(0,r.tZ)(I.Z,{icon:(0,r.tZ)(D._Qn,{})})})]}),(0,r.tZ)($,{state:i}),e.children]})})),A=B,M=d.Z.div`
  text-align: right;
  box-sizing: content-box;
  font-variant-numeric: tabular-nums;
  color: ${({theme:e})=>e.text.primary};

  &:first-of-type {
    padding-left: 4px;
  }
  ${({isSpacer:e})=>e&&"padding-left: 4px;"}

  &:focus {
    background-color: ${({theme:e})=>e.button.primary.focus.backgroundColor};
    color: ${({theme:e})=>e.button.primary.focus.foregroundColor};
  }
`,T=n.memo((function({segment:e,state:o}){const t=(0,s.u)(),i=(0,n.useRef)(null),{segmentProps:a}=(0,l.O7)(e,o,i);return(0,r.tZ)(M,{theme:t,ref:i,...a,isSpacer:" "===e.text,style:{...a.style},children:e.text})})),z=d.Z.div`
  display: flex;
`,U=d.Z.div`
  display: inline-flex;
`,F=n.memo((function(e){const{locale:o}=(0,p.bU)(),t=(0,a.RM)({...e,locale:o,createCalendar:c.YR}),i=(0,n.useRef)(null),{fieldProps:d}=(0,l.IZ)(e,t,i);return(0,r.tZ)(z,{children:(0,r.tZ)(U,{...d,ref:i,children:t.segments.map(((e,o)=>(0,r.tZ)(T,{segment:e,state:t},o)))})})})),G=d.Z.div`
  display: flex;
`,V=d.Z.div`
  display: inline-flex;
`,H=n.memo((function(e){const{locale:o}=(0,p.bU)(),t=(0,a.P$)({...e,locale:o}),i=(0,n.useRef)(null),{labelProps:d,fieldProps:s}=(0,l.C3)(e,t,i);return(0,r.BX)(G,{children:[(0,r.tZ)("span",{...d,children:e.label}),(0,r.tZ)(V,{...s,ref:i,children:t.segments.map(((e,o)=>(0,r.tZ)(T,{segment:e,state:t},o)))})]})}));var K=t(54889);const X=n.memo((function({children:e,...o}){const t=n.useRef(null),{dialogProps:i}=(0,K.R)(o,t);return(0,r.tZ)("div",{...i,ref:t,children:e})}));var Y=t(25634);const W=n.memo((function(e){const o=n.useRef(null),{state:t,children:i}=e,{popoverProps:l,underlayProps:a}=(0,Y.Sv)({...e,popoverRef:o},t);return(0,r.BX)(Y.aV,{children:[(0,r.tZ)("div",{...a}),(0,r.tZ)("div",{...l,ref:o,children:i})]})}));var N=t(92851),j=t(7360);const _=d.Z.div`
  font-size: 13px;
  font-weight: 500;
  line-height: 17px;
  margin-bottom: 4px;
  color: ${({theme:e})=>e.text.primary};
`,q=d.Z.div`
  display: flex;
  height: ${({compact:e})=>e?"40px":"48px"};
  line-height: ${({compact:e})=>e?"40px":"48px"};
  width: 100%;
`,J=(0,d.Z)(P.ZP)`
  border: 2px solid
    ${({theme:e,isOpen:o})=>o?e.textInput.borderColor.focus:e.textInput.borderColor.default};

  ${({theme:e,isInvalid:o})=>o&&`\n      border: 2px solid ${e.textInput.borderColor.error};\n    `}
  ${({theme:e,isOpen:o,isInvalid:t})=>!t&&`\n      border: 2px solid ${o?e.textInput.borderColor.focus:e.textInput.borderColor.default};\n    `}

  &:hover {
    border: 2px solid ${({theme:e})=>e.textInput.borderColor.hover};
  }
`,Q=n.memo((function({borderRadius:e="10px",compact:o=!1,hideTimeZone:t=!1,error:d=!1,errorText:c,granularity:u,...m}){const h=(0,s.u)(),b=(0,a.N3)(m),f=(0,n.useRef)(null),{labelProps:g,groupProps:Z,fieldProps:x,calendarProps:C,dialogProps:v}=(0,l.kt)(m,b,f);return(0,r.tZ)(p.bd,{locale:j.SP,children:(0,r.BX)(P.ZP,{position:"relative",display:"inline-flex",flexDirection:"column",textAlign:"left",flex:"1",marginBottom:2,children:[(0,r.BX)(_,{...g,theme:h,children:[m.label,m.isRequired?"*":""]}),(0,r.tZ)(q,{...Z,ref:f,onClick:()=>b.setOpen(!0),compact:o,children:(0,r.BX)(J,{position:"relative",display:"flex",alignItems:"center",borderRadius:e,flex:"1",paddingY:2,paddingX:4,cursor:"pointer",isOpen:b.isOpen,isInvalid:"invalid"===b.validationState||d,children:[(0,r.tZ)(I.Z,{icon:(0,r.tZ)(D.faS,{})}),(0,r.tZ)(F,{...x,hideTimeZone:t,granularity:u})]})}),b.isOpen&&(0,r.tZ)(W,{triggerRef:f,state:b,placement:"bottom start",children:(0,r.tZ)(X,{...v,children:(0,r.tZ)(A,{...C,children:"day"!==u&&(0,r.tZ)(P.ZP,{marginLeft:2,children:(0,r.tZ)(H,{label:(0,i.ZP)("Time"),hideTimeZone:t,value:b.timeValue,onChange:b.setTimeValue})})})})}),d&&c&&(0,r.tZ)(P.ZP,{paddingTop:1,children:(0,r.tZ)(w.Z,{kind:"caption3",color:N.COLORS.RED0,children:c})})]})})})),ee=Q;var oe=t(35025),te=t(93633),re=t(87613);const ne=(e,o)=>(0,oe.isNotNilAndNotEmpty)(e)?(0,c.u4)("string"==typeof e?new Date(e).toISOString():e.toISOString(),o):void 0,ie=n.memo((function(e){const{label:o,disabled:t,isRequired:n,minDate:i,value:l,onChange:a,timezone:d,borderRadius:s="10px",compact:u=!1,hideTimeZone:p,granularity:m,error:h,errorText:b}=e,f=d??(0,c.iT)();try{Intl.DateTimeFormat(void 0,{timeZone:f})}catch{return te.Y.error("Error: Invalid timezone.",new re.w({timeZone:f})),null}return(0,r.tZ)(ee,{label:o,isRequired:n,isDisabled:t,minValue:i?(0,c.u4)(i.toISOString(),f):void 0,value:ne(l,f),onChange:e=>a(e.toDate(f)),borderRadius:s,compact:u,hideTimeZone:p,granularity:m,error:h,errorText:h?b:void 0})})),le=ie},26369:(e,o,t)=>{t.d(o,{Z:()=>m,j:()=>p});var r=t(35944),n=t(67294),i=t(10932),l=t(92851),a=t(68563),d=t(27354);const s=i.Z.form`
  display: flex;
  flex-direction: column;

  & > *:last-child {
    margin-bottom: 0;
  }
`,c=i.Z.input`
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid #909ce2;
  border-radius: 50%;
  outline: none;
  margin: 2px;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 200ms ease;

  &:before {
    content: "";
    display: block;
    width: 10px;
    height: 10px;
    margin: 2px auto;
    border-radius: 50%;
  }

  &:checked {
    ${({kind:e})=>`border: 2px solid ${"primary"===e?l.COLORS.GREEN:l.COLORS.BLUE3};`}

    &:before {
      ${({kind:e})=>`background: ${"primary"===e?l.COLORS.GREEN:l.COLORS.BLUE3};`}
    }
  }

  &:disabled {
    border: 2px solid ${l.COLORS.GRAY3};
    cursor: default;
  }

  ${({isHovered:e,kind:o})=>e&&`border: 2px solid ${"primary"===o?l.COLORS.GREEN:l.COLORS.BLUE3};`}
`,u=i.Z.label`
  ${({compact:e})=>e?"":"margin-bottom: 10px;"};
  font-weight: 500;
  ${({fontSize:e})=>`font-size: ${e??15}px;`};
  font-size: 15px;
  line-height: 20px;
  ${({color:e})=>`color: ${e};`};
  ${({isDisabled:e})=>`cursor: ${e?"default":"pointer"};`};
  display: flex;
  align-items: ${({align:e="center"})=>e};
`,p=n.memo((function({value:e="",label:o="",option:t,name:n,isDisabled:i,currentOption:s,onChange:p,compact:m,align:h,color:b,fontSize:f,kind:g,labelCss:Z}){const{hoverProps:x,isHovered:C}=(0,d.XI)({}),[v,O]=t?[t,t]:[e,o];return(0,r.BX)(u,{compact:m,...x,align:h,css:Z,color:i?(0,l.CZ)(b??l.COLORS.GRAY2,.75):b??l.COLORS.GRAY2,fontSize:f,isDisabled:i,children:[(0,r.tZ)(c,{type:"radio",name:n,value:v,disabled:Boolean(i),checked:s===v,onChange:()=>p(v),isHovered:C,kind:g}),!m&&(0,r.tZ)(a.ZP,{marginLeft:2,children:O})]})})),m=n.memo((function({options:e,name:o,onChange:t,currentOption:n,kind:i,color:l,fontSize:a}){return(0,r.tZ)(s,{children:e.map((e=>(0,r.tZ)(p,{label:e.label,value:e.value,isDisabled:e.isDisabled,name:o,currentOption:n,onChange:t,kind:i,align:e.align,color:l,fontSize:a},e.value)))})}))},56562:(e,o,t)=>{t.d(o,{Z:()=>r.Z});var r=t(26369)},41242:(e,o,t)=>{t.d(o,{Z0:()=>b,ZP:()=>O,hk:()=>g});var r=t(35944),n=t(67294),i=t(9386),l=t(8990),a=t(65433),d=t(89674),s=t(35025),c=t(76777),u=t(92851),p=t(41731),m=t(25292),h=t(37884);const b=",|,";var f,g=((f=g||{}).Default="default",f.Dark="dark",f);const Z=n.memo((function(e){return(0,r.tZ)(l.c.MenuList,{...e,css:c.nV})})),x=n.memo((function(e){return(0,r.tZ)(l.c.DropdownIndicator,{...e,children:(0,r.tZ)(m.Z,{icon:(0,r.tZ)(h._ME,{}),color:e.isFocused?u.COLORS.BLUE4:u.COLORS.DARK1,css:e.isFocused?{transform:"rotate(180deg)"}:void 0})})})),C=n.memo((function(e){return(0,r.BX)(l.c.Option,{...e,children:[e.data.label,e.data.extraRight,e.data.icon&&(0,r.tZ)(m.Z,{icon:e.data.icon,color:u.COLORS.DARK3,size:4.5})]})})),v=n.forwardRef((function({options:e,onChange:o,value:t,disabled:l,placeholder:c,isSearchable:m=!1,menuPlacement:h="auto",menuPortalTarget:f,isMulti:g=!1,hasError:v=!1,errorMessage:O="",menuListMaxHeight:R="300px",kind:y="default",compact:S=!1,formatOptionLabel:k,styles:L,filterOption:$},w){const D=(0,d.u)(),{errorTextColor:P}=D.textInput,I=(0,n.useCallback)((e=>{if((0,s.isArray)(e)){const t=e?.map((e=>e.value)).join(b);o(t)}else e?.value&&o(e?.value)}),[o]),E=(0,n.useMemo)((()=>(({menuListMaxHeight:e,kind:o,compact:t,hasError:r,errorTextColor:n,customStyles:l})=>(0,i.m)({control:(e,i)=>({...e,borderColor:r?n:"transparent",borderWidth:r?2:0,borderRadius:t?10:12,backgroundColor:"default"===o?u.COLORS.BLUE0:u.COLORS.DARK0,boxShadow:i.isFocused?`0 0 0 2px ${u.COLORS.BLUE2}`:"none",cursor:"pointer",minHeight:t?"unset":48,opacity:i.isDisabled?.5:1,"&:hover":{boxShadow:`0 0 0 2px ${u.COLORS.BLUE2}`},transition:"all 0.2s -0.1s",svg:{color:"default"===o?i.isFocused?u.COLORS.BLUE4:u.COLORS.DARK1:u.COLORS.WHITE}}),indicatorSeparator:()=>({}),input:e=>({...e,fontSize:15,color:"default"===o?u.COLORS.DARK3:u.COLORS.WHITE,fontWeight:500,cursor:"text"}),noOptionsMessage:e=>({...e,fontSize:15,color:"default"===o?u.COLORS.DARK3:u.COLORS.WHITE,fontWeight:500}),singleValue:e=>({...e,color:"default"===o?u.COLORS.DARK3:u.COLORS.WHITE,fontSize:15,fontWeight:600}),placeholder:e=>({...e,fontSize:15,color:"default"===o?u.COLORS.GRAY5:u.COLORS.GRAY1,fontWeight:500}),menu:e=>({...e,backgroundColor:u.COLORS.BLUE0,borderRadius:12,overflow:"hidden"}),menuList:o=>({...o,padding:"8px 0",overflowY:"auto",maxHeight:e,scrollbarColor:(0,u.CZ)(u.COLORS.BLACK,.3),"::-webkit-scrollbar":{width:"4px",height:"0px"},"::-webkit-scrollbar-thumb":{background:(0,u.CZ)(u.COLORS.BLACK,.3),borderRadius:"8px"},"::-webkit-scrollbar-thumb:hover":{background:(0,u.CZ)(u.COLORS.BLACK,.6)}}),option:(e,o)=>({...e,color:u.COLORS.DARK3,fontSize:15,fontWeight:600,lineHeight:1.3,padding:t?"8px 16px":"8px 12px",backgroundColor:o.isFocused?u.COLORS.BLUE2:u.COLORS.BLUE0,":active":{backgroundColor:u.COLORS.BLUE2},cursor:o.isDisabled?"default":"pointer",display:"flex",justifyContent:"space-between"}),multiValue:e=>({...e,padding:"0px 8px",borderRadius:8,background:u.COLORS.DARK1,height:32,display:"grid",gridTemplateColumns:"1fr auto",gridGap:4,alignItems:"center"}),multiValueLabel:e=>({...e,padding:0,fontSize:15,fontWeight:500,color:u.COLORS.GRAY0}),multiValueRemove:e=>({...e,padding:2,"&:hover":{backgroundColor:u.COLORS.DARK0,color:u.COLORS.GRAY0},"& svg":{width:16,height:16}}),container:e=>({...e,width:"100%"})},l))({menuListMaxHeight:R,kind:y,compact:S,hasError:v,errorTextColor:P,customStyles:L})),[R,y,S,v,P,L]);return(0,r.BX)(r.HY,{children:[(0,r.tZ)(a.ZP,{options:e,onChange:I,value:g?e.filter((e=>(t??[]).includes(e.value))):e.find((e=>e.value===t))||null,styles:E,components:{DropdownIndicator:x,Option:C,MenuList:Z},isDisabled:l,menuPlacement:h,placeholder:c,isSearchable:m,isMulti:g,formatOptionLabel:k,menuPortalTarget:f,filterOption:$,ref:w}),v&&O&&(0,r.tZ)(p.Gs,{color:P,children:O})]})})),O=n.memo(v)},50040:(e,o,t)=>{t.d(o,{HG:()=>p,dd:()=>s,ny:()=>c,tC:()=>d});var r=t(35944),n=t(3332),i=t(67294),l=t(93633);const a=()=>{l.Y.error("UNBREAK NOW: A noop function in ModalContext was invoked! Are you providing this context properly?")},d=(0,i.createContext)({modalContent:null,setModal:a,hideModal:a,showAuthenticationModal:a,modalSettings:null}),s=()=>(0,i.useContext)(d),c=({children:e})=>{const o=(()=>{const[e,o]=(0,i.useState)(null),[t,l]=(0,i.useState)(null),a=(0,i.useCallback)((()=>{o(null),l(null)}),[o]);return{modalContent:e,setModal:(0,i.useCallback)(((e,t={showInMiniMode:!1})=>{o(e),l(t)}),[]),hideModal:a,showAuthenticationModal:()=>{o((0,r.tZ)(n.Z,{onClose:a}))},modalSettings:t}})();return(0,r.tZ)(d.Provider,{value:o,children:e})},u=new Map,p=({children:e,open:o,onClose:t,id:r="modal"})=>{const{hideModal:n,setModal:l,modalContent:a}=s();return(0,i.useEffect)((()=>{if(u.has(r)||u.set(r,!1),!o&&u.has(r)&&u.get(r))return n(),void u.delete(r);if(o){if(u.has(r)&&u.get(r))return;u.set(r,!0),l(e)}}),[e,n,l,o,a,r]),(0,i.useEffect)((()=>{a||(t(),u.clear())}),[a,t]),null}},88138:(e,o,t)=>{t.d(o,{Z:()=>n});var r=t(67294);const n=e=>{(0,r.useEffect)((()=>{document.title=e}),[e])}}}]);
//# sourceMappingURL=https://sourcemaps.us-east-1-a.prod.aws.gather.town/v1/gather-browser/72991861a/bundle.442ac3ffa999d500c8aa.js.map
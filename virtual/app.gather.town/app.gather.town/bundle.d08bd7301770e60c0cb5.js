"use strict";(self.webpackChunkgather_browser=self.webpackChunkgather_browser||[]).push([[4668],{20605:(e,t,r)=>{r.d(t,{_:()=>i});var n=r(25101),o=r(11983);async function i(){o.Z.set("isSignedIn",JSON.stringify(!1),{expires:365,domain:"gather.town"}),await n.I8.signOut(),await n.I8.signInAnonymously()}},8603:function(e,t,r){var n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0}),t.getLocalGoogleOauthRedirectUrl=t.isSSOAuthCallbackStateFromInternalSource=t.parseSSOAuthCallbackState=t.zodSSOCallbackStateObj=t.SSOCallbackStateSource=t.SSO_AUTH_CALLBACK_ORIGIN_APP_STATE=void 0;const o=n(r(76750));var i,a;t.SSO_AUTH_CALLBACK_ORIGIN_APP_STATE="origin_app",(a=i||(t.SSOCallbackStateSource=i={})).WebApp="WebApp",a.OutlookApp="OutlookApp",a.MobileApp="MobileApp",a.Unknown="Unknown",t.zodSSOCallbackStateObj=o.default.object({isInMicrosoftOfficeEnvironment:o.default.boolean().optional(),origin:o.default.string().max(300).optional(),source:o.default.nativeEnum(i)}),t.parseSSOAuthCallbackState=e=>{if(e===t.SSO_AUTH_CALLBACK_ORIGIN_APP_STATE||null===e)return e;try{return t.zodSSOCallbackStateObj.parse(JSON.parse(e))}catch{return{source:i.Unknown}}},t.isSSOAuthCallbackStateFromInternalSource=e=>e===t.SSO_AUTH_CALLBACK_ORIGIN_APP_STATE||null!==e&&"source"in e,t.getLocalGoogleOauthRedirectUrl=()=>`api.gather.town${"MISSING_ENV_VAR".GOOGLE_OAUTH_SIGNIN_PATH}`},60853:(e,t,r)=>{t.ae=t.Ip=t.Z9=t.PV=void 0;var n=r(8603);Object.defineProperty(t,"PV",{enumerable:!0,get:function(){return n.parseSSOAuthCallbackState}}),Object.defineProperty(t,"Z9",{enumerable:!0,get:function(){return n.isSSOAuthCallbackStateFromInternalSource}}),Object.defineProperty(t,"Ip",{enumerable:!0,get:function(){return n.SSOCallbackStateSource}}),Object.defineProperty(t,"ae",{enumerable:!0,get:function(){return n.getLocalGoogleOauthRedirectUrl}})},91638:(e,t,r)=>{t._v=void 0;var n=r(62678);Object.defineProperty(t,"_v",{enumerable:!0,get:function(){return n.isURLFromValidGatherOrigin}})},62678:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.isURLFromValidGatherOrigin=t.isLocalGatherOrigin=t.getURLBaseDomain=void 0;const n=r(55222);t.getURLBaseDomain=e=>{const t=new URL(e).host.split(".").slice(-2),r=t[0],n=t[1];return r&&n?`${r}.${n}`:null};const o=/^https?:\/\/((?:localhost:(?:3000|8080))|(?:.*ngrok(?:-free)?.app))/;t.isLocalGatherOrigin=e=>o.test(e),t.isURLFromValidGatherOrigin=e=>{const r="prod"===n.Env.local||"prod"===n.Env.test;return"gather.town"===(0,t.getURLBaseDomain)(e)||r&&(0,t.isLocalGatherOrigin)(e)}},27425:(e,t,r)=>{r.d(t,{Z:()=>m});var n=r(35944),o=r(10932),i=r(44388),a=r(67294),s=r(76777),c=r(68563),l=r(99471);const d=["https://cdn.gather.town/v0/b/gather-town.appspot.com/o/images%2Favatars%2Favatar_3_dancing.png?alt=media&token=2580754d-903b-4412-9b5c-123f71eb6ced","https://cdn.gather.town/v0/b/gather-town.appspot.com/o/images%2Favatars%2Favatar_19_dancing.png?alt=media&token=03c3e96f-9148-42f9-a667-e8aeeba6d558","https://cdn.gather.town/v0/b/gather-town.appspot.com/o/images%2Favatars%2Favatar_29_dancing.png?alt=media&token=507cc40a-a280-4f83-9600-69836b64522b","https://cdn.gather.town/v0/b/gather-town.appspot.com/o/images%2Favatars%2Favatar_32_dancing.png?alt=media&token=e7d9d5fa-b7bd-41d5-966e-817f147b63d7","https://cdn.gather.town/v0/b/gather-town.appspot.com/o/images%2Favatars%2Favatar_68_dancing.png?alt=media&token=6dd73945-7896-4121-bfba-ea359680d9be","https://cdn.gather.town/v0/b/gather-town.appspot.com/o/images%2Favatars%2Favatar_60_dancing.png?alt=media&token=ad303264-fb54-4f7f-a423-8d35a9832e60","https://cdn.gather.town/v0/b/gather-town.appspot.com/o/images%2Favatars%2Favatar_61_dancing.png?alt=media&token=63805b99-c7d4-4efe-a7e4-f7d6bbda393b"],h=o.Z.img`
  height: ${({isMobile:e})=>e?128:64}px;
  ${s.zG}
`,u=Object.keys(d).length,p=Math.floor(Math.random()*u),g=e=>d[(e+p+u)%u],m=a.memo((function(){const e=(0,i.Z)();return(0,n.BX)(n.HY,{children:[(0,n.tZ)(l.fU,{children:(0,n.BX)(c.ZP,{flexDirection:"row",justifyContent:"space-around",paddingX:14,children:[(0,n.tZ)(h,{src:g(1)}),(0,n.tZ)(h,{src:g(2)}),(0,n.tZ)(h,{src:g(3)})]})}),(0,n.tZ)(l.Hz,{children:(0,n.BX)(c.ZP,{width:"100%",justifyContent:"center",marginTop:4,children:[(0,n.tZ)(h,{isMobile:e,src:g(1)}),(0,n.tZ)(h,{isMobile:e,src:g(2)})]})})]})}))},30210:(e,t,r)=>{r.d(t,{Cz:()=>u,Fg:()=>l,MJ:()=>c,PQ:()=>p,g5:()=>d,yg:()=>h});var n=r(10932),o=r(68563),i=r(92851),a=r(54547),s=r(76777);const c=n.Z.div`
  text-align: center;
  color: ${({wizard:e,isMobile:t})=>t?i.COLORS.GRAY2:e?i.COLORS.GRAY0:i.COLORS.DARK2};
  font-weight: 500;
`,l=n.Z.a`
  text-decoration: underline;
  cursor: pointer;

  &:hover,
  &:focus {
    opacity: 0.8;
  }
`,d=(n.Z.input`
  flex: 1;
  min-width: 0;
  width: 100%;

  padding: 10px 10px;
  line-height: 28px;

  background: #e9e9e9;
  border: 0;
  border-radius: 5px;

  font-style: normal;
  font-weight: 300;
  font-size: 18px;
  font-family: inherit;

  &:focus {
    outline: none;
  }
`,n.Z.p`
  color: ${({error:e,success:t})=>e?i.COLORS.RED2:t?i.COLORS.GREEN:i.COLORS.GRAY5};
  font-weight: 500;
  font-size: 13px;
  margin: 8px 0px;
  text-align: center;
`),h=n.Z.input`
  width: 52px;
  height: 64px;
  border: 3px solid ${i.COLORS.GRAY2};
  border-radius: 16px;
  background-color: transparent;

  font-size: 24px;
  font-weight: 500;
  font-family: inherit;
  text-align: center;
  color: ${({wizard:e,isMobile:t})=>t?i.COLORS.WHITE:e?i.COLORS.GREEN:i.COLORS.DARK1};

  &:focus {
    border-color: ${({wizard:e,isMobile:t})=>t?i.COLORS.BLUE2:e?i.COLORS.GREEN:i.COLORS.GRAY5};
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  -moz-appearance: textfield;
`,u=(0,n.Z)(o.ZP)`
  margin-top: 12px;
`,p=(n.Z.img`
  height: ${({isMobile:e})=>e?128:64}px;
`,(0,n.Z)(o.ZP)`
  ${a.B.below("sm")`
    width: 100vw;
    height: 100%;
    background-color: ${i.COLORS.DARK3};
    background: ${s.oP};
  `}
  ${({wizard:e})=>a.B.above("sm")`
    background-color: ${e?i.COLORS.DARK2:i.COLORS.WHITE};
    width: 500px;
    border-radius: 32px;
    padding: 56px;
  `}
`)},61120:(e,t,r)=>{r.r(t),r.d(t,{SignInState:()=>he,default:()=>me});var n=r(35944),o=r(89674),i=r(37884),a=r(89975),s=r(12892),c=r(13352),l=r(44388),d=r(6668),h=r(67294),u=r(89250),p=r(11771),g=r(30195),m=r(57333),b=r(92851),Z=r(76777),f=r(30210),S=r(77736),O=r(25101),w=r(82232),E=r(18127),v=r(94975),C=r(25292),R=r(68563),_=r(16590),x=r(2948),I=r(2823),A=r(16124),P=r(1300),y=r(79655),L=r(80981);const k=h.memo((function(){const e=(0,L.Kp)()??"",t=(0,l.Z)(),r=(0,u.s0)(),o=(0,h.useCallback)((()=>{(0,P.Gs)(c.MetricsEventName.SSO_USE_SSO_LINK_CLICKED,{userId:e})}),[e]),i=(0,h.useCallback)((()=>{o(),r("/signin/sso")}),[o,r]);return t?(0,n.tZ)(A.Z,{kind:"ghost",size:"lg",onPress:i,children:(0,w.ZP)("b5d95d3")}):(0,n.tZ)(R.ZP,{marginY:2,justifyContent:"center",children:(0,n.tZ)(y.rU,{to:"/signin/sso",onClick:o,children:(0,n.tZ)(_.Z,{kind:"h3",color:b.COLORS.BLUE4,css:{textDecoration:"underline"},children:(0,w.ZP)("b5d95d3")})})})}));var G,N=r(87613),T=r(13045),M=r(93633),z=r(44308),D=((G=D||{})[G.ERROR_MESSAGE=0]="ERROR_MESSAGE",G[G.SUCCESS_MESSAGE=1]="SUCCESS_MESSAGE",G[G.CHECKING_CODE=2]="CHECKING_CODE",G);const H=[...Array(6).keys()],V=" ",U=Array(6).fill(V).join(""),$=h.memo((function({email:e,setSentOTP:t,isNewUser:r,wizard:o=!1,onSignInComplete:d=(()=>{})}){const[u,p]=(0,h.useState)(),[g,m]=(0,h.useState)(U),[y,L]=(0,h.useState)(""),G=(0,h.useRef)(H.reduce(((e,t)=>({...e,[t]:null})),{})),[D,$]=(0,h.useState)(!1),B=(0,l.Z)(),F=e=>t=>{t&&(G.current[e]=t)},j=e=>t=>{"Backspace"===t.code&&!G.current[e]?.value&&e>0&&G.current[e-1]?.focus()};(0,E.Z)((()=>(H.map((e=>{G.current[e]?.addEventListener("keydown",j(e))})),()=>{H.map((e=>{G.current[e]?.removeEventListener("keydown",j(e))}))}))),(0,v.Z)((async()=>{if(g!==U&&!g.includes(V)){p(2);try{const t=await s.wP.post(I.HttpV2Paths.AuthOtpRequestsVerify,{params:{body:{email:e,otp:g}}}),n=await O.I8.signInWithCustomToken(t.token);p(1),(0,x.Vg)(n?.user,r,a.zH.OTP,{browserContext:(0,P.xm)()}),d(n?.user?.uid)}catch(e){if(S.axios.isAxiosError(e)){if("MAX_OTA_ATTEMPTS_EXCEEDED"===e.response?.data.code)return $(!0),void(0,x.NO)(c.MetricsEventName.SIGN_IN_ERROR,{error:e.response?.data.message,method:a.zH.OTP,browserContext:(0,P.xm)()});if(e.response?.data.message)return p(0),L(e.response?.data.message),m(U),void(0,x.NO)(c.MetricsEventName.SIGN_IN_ERROR,{error:e.response?.data.message,method:a.zH.OTP,browserContext:(0,P.xm)()})}const t=(0,z.guaranteedError)(e);p(0),L(`Encountered the following error: ${t.message}. Please try sending a new code.`),M.Y.error("OTP login failed to submit",(0,N.d)(t)),(0,x.NO)(c.MetricsEventName.SIGN_IN_ERROR,{error:t.message,method:a.zH.OTP,browserContext:(0,P.xm)()})}}}),[g,e,r,d]);const X=(0,h.useCallback)((()=>{t(!1),$(!1)}),[t]),K=(0,h.useCallback)((e=>({target:{value:t}})=>{t?(m((r=>(0,T.replaceAt)(r,e,t))),G.current[Math.min(e+t.length,5)]?.focus()):m((t=>(0,T.replaceAt)(t,e,V)))}),[]),W=(0,h.useCallback)((e=>{if("-"===e.key||"+"===e.key)return e.preventDefault(),!1}),[]);return D?(0,n.tZ)(f.MJ,{children:(0,w.ZP)("b638e1b",{link:e=>(0,n.tZ)(f.Fg,{onClick:X,style:{color:o?b.COLORS.WHITE:void 0},children:e})})}):(0,n.BX)(n.HY,{children:[(0,n.tZ)(f.MJ,{wizard:o,isMobile:B,children:(0,w.ZP)("9a8af26",{email:e,link:e=>B?(0,n.tZ)("span",{children:e}):(0,n.tZ)(f.Fg,{onClick:X,style:{color:o?b.COLORS.BLUE1:b.COLORS.BLACK},children:e})})}),(0,n.tZ)(R.ZP,{flexDirection:"row",justifyContent:"space-between",marginY:5,children:H.map((e=>(0,n.tZ)(f.yg,{ref:F(e),value:g[e]===V?"":g[e],onChange:K(e),disabled:2===u,autoFocus:0===e,isMobile:B,wizard:o,onKeyDown:W,type:"number",inputMode:"numeric",pattern:"[0-9]*",min:"0"},`digit-${e}`)))}),2===u?(0,n.BX)(R.ZP,{flexDirection:"row",justifyContent:"center",children:[(0,n.tZ)(R.ZP,{css:Z.fS,children:(0,n.tZ)(C.Z,{icon:(0,n.tZ)(i.$jN,{}),color:b.COLORS.GRAY5,size:"xs"})}),(0,n.tZ)(f.g5,{style:{margin:"0px 8px"},children:(0,w.ZP)("27ee50d")})]}):0===u?(0,n.tZ)(f.g5,{error:!0,style:{margin:0},children:y}):1===u&&(0,n.tZ)(f.g5,{success:!0,style:{margin:0},children:(0,w.ZP)("9b131cb")}),(0,n.BX)(R.ZP,{marginTop:5,flexDirection:"column",gap:2,marginY:4,justifyContent:"center",children:[B&&(0,n.tZ)(A.Z,{kind:"secondary",size:"lg",onPress:X,children:(0,w.ZP)("a57d1f7")}),(0,n.tZ)(k,{}),B?(0,n.tZ)(A.Z,{kind:"ghost",size:"lg",onPress:()=>t(!1),children:(0,w.ZP)("Cancel")}):(0,n.tZ)(_.Z,{kind:B?"h3":"body1",style:{textAlign:"center",width:"100%"},children:(0,n.tZ)(f.Fg,{onClick:()=>t(!1),style:{color:o||B?b.COLORS.WHITE:b.COLORS.GRAY5,textDecoration:B?"none":void 0},children:(0,w.ZP)("Cancel")})})]})]})})),B=$;var F=r(99471),j=r(27425),X=r(64923);const K=async e=>s.wP.post(I.HttpV2Paths.AuthGoogleTokenSwap,{auth:!0,params:{body:{authCode:e}}});var W=r(55222),Y=r(80103),J=r(56540),Q=r(91638),q=r(60853),ee=Object.defineProperty,te=(e,t,r)=>(((e,t,r)=>{t in e?ee(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r})(e,"symbol"!=typeof t?t+"":t,r),r);class re{constructor(){te(this,"signInWithPopup",(()=>{const e=(()=>{const e=new URL("https://accounts.google.com/o/oauth2/v2/auth");return e.searchParams.append("scope","profile email"),e.searchParams.append("prompt","select_account"),e.searchParams.append("response_type","code"),e.searchParams.append("client_id",(0,W.switchEnv)({test:()=>"MISSING_ENV_VAR".DEV_GOOGLE_OAUTH_CLIENT_ID??"",local:()=>"MISSING_ENV_VAR".DEV_GOOGLE_OAUTH_CLIENT_ID??"",dev:()=>"MISSING_ENV_VAR".DEV_GOOGLE_OAUTH_CLIENT_ID??"",staging:()=>"MISSING_ENV_VAR".STAGING_GOOGLE_OAUTH_CLIENT_ID??"",prod:()=>"883417981727-kkmh070ce1uhtf3rdd8b69f2v2k6r8sv.apps.googleusercontent.com"})),e.searchParams.append("redirect_uri",(0,W.switchEnv)({test:()=>"MISSING_ENV_VAR".DEV_GOOGLE_OAUTH_SIGNIN_REDIRECT_URL??"",local:()=>(0,q.ae)()??"MISSING_ENV_VAR".DEV_GOOGLE_OAUTH_SIGNIN_REDIRECT_URL??"",dev:()=>"MISSING_ENV_VAR".DEV_GOOGLE_OAUTH_SIGNIN_REDIRECT_URL??"",staging:()=>"MISSING_ENV_VAR".STAGING_GOOGLE_OAUTH_SIGNIN_REDIRECT_URL??"",prod:()=>"https://api.gather.town/auth/signin/google/callback"})),e.searchParams.append("state",JSON.stringify({isInMicrosoftOfficeEnvironment:(0,Y.VQ)(),...(0,W.switchEnv)({test:()=>({}),local:()=>({origin:window.location.origin}),staging:()=>({}),prod:()=>({}),dev:()=>({origin:window.location.host})})})),e.toString()})();return(0,Y.VQ)()?this.signInViaMicrosoftDialog(e):this.signInViaWindowPopup(e)})),te(this,"signInViaMicrosoftDialog",(async e=>{const t=await(0,J.j)(e);return K(t)})),te(this,"getPopUpDisplayOptions",((e={})=>{const{height:t=600,width:r=600,left:n=(window.innerWidth-(e.width||r))/2,top:o=(window.innerHeight-(e.height||t))/2}=e;return`toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${r}, height=${t}, top=${o}, left=${n}`})),te(this,"signInViaWindowPopup",(async e=>{const t=window.open(e,"",this.getPopUpDisplayOptions());if(!t)throw new Error("Failed to login with Google");return new Promise(((e,r)=>{let n,o=!1;const i=async a=>{if(a.source===t&&a.data.authCode&&(0,Q._v)(a.origin)){o=!0;try{const t=await K(a.data.authCode);e(t)}catch(e){r(e)}t.close(),n&&(clearInterval(n),n=void 0),window.removeEventListener("message",i)}};window.addEventListener("message",i),n=setInterval((()=>{!t.closed||!n||o||(r(new Error("Auth window closed")),clearInterval(n),n=void 0,window.removeEventListener("message",i))}),1e3)}))}))}}var ne=r(28216),oe=r(39495),ie=r(85518),ae=r(66192),se=r(35025),ce=r(16791);var le=r(85903),de=r(47717),he=(e=>(e[e.DEFAULT=0]="DEFAULT",e[e.SENDING_OTP=1]="SENDING_OTP",e[e.ERROR_MESSAGE_GENERIC=2]="ERROR_MESSAGE_GENERIC",e[e.ERROR_MESSAGE_EMAIL_INVALID=3]="ERROR_MESSAGE_EMAIL_INVALID",e[e.ERROR_MESSAGE_CHALLENGE_INVALID=4]="ERROR_MESSAGE_CHALLENGE_INVALID",e))(he||{});const ue=g.Z_().email(),pe=h.memo((function({onSendLink:e,presetOTPEmail:t,wizard:r=!1,event:o=!1,onSignInComplete:g,signInText:m=(0,w.ZP)("9b32d38"),forceSignInText:E=!1,loginRedirect:v,emailLabel:C=(0,w.ZP)("0d02738"),disableGoogleAuth:y=!1}){(0,le.x)();const G=(0,L.Kp)()??"",[N,T]=(0,h.useState)(t??""),[D,H]=(0,h.useState)(0),[V,U]=(0,h.useState)(!1),[$,K]=(0,h.useState)(!1),W=(0,u.s0)(),J=(0,l.Z)(),Q=J?"md":"lg",q=(0,u.TH)(),ee=(0,h.useRef)(null),te=(0,h.useCallback)((e=>{e||H(4)}),[]),{isVerified:ne,isLoading:oe}=(({turnstileRef:e,theme:t,onChallengeCompleted:r})=>{const[n,o]=(0,h.useState)(!1),[i,a]=(0,h.useState)(!0),c=window.turnstile;return(0,h.useEffect)((()=>{if(o(!1),a(!0),!c||!e.current)return;const n=c.render(e.current,{action:ie.d?"desktop":"browser",sitekey:ce.isLocalOrTest?"1x00000000000000000000AA":(0,se.just)("0x4AAAAAAAI7X4HJ-naF8wDa"),theme:t,"response-field":!1,callback:async e=>{try{a(!0);const t=(await(0,ae.asyncRetry)((()=>s.wP.post(I.HttpV2Paths.CloudflareSiteVerify,{auth:!0,params:{body:{cf_token:e}}})),{maxRetries:5,delayMs:1e3})).success??!1;o(t),a(!1),r(t)}catch{c.reset(n),o(!1),a(!1)}},"timeout-callback":()=>o(!1),"error-callback":()=>{o(!1),a(!1)}});return()=>c.remove(n)}),[c,r,t,e]),{isVerified:n,isLoading:i}})({turnstileRef:ee,theme:r||J?"dark":"light",onChallengeCompleted:te}),he=r?"From creation flow":void 0;(0,h.useEffect)((()=>{G&&(0,P.Gs)(c.MetricsEventName.SIGN_IN_PAGE_VIEWED,{userId:G,location:he})}),[G,he]);const pe=(0,h.useCallback)(((e,t)=>{g?.(e),v?window.location.href=v:q?.state?.previousRoute?(W(q?.state?.previousRoute,{replace:!0}),window.location.reload()):t&&!g?window.location.reload():(0,Y.VQ)()&&(W("/",{replace:!0}),window.location.reload())}),[q?.state?.previousRoute,v,W,g]),ge=((e,t,r)=>{const n=(0,L.Kp)()??"",o=(0,u.s0)();return(0,h.useCallback)((async()=>{try{const t=new re;(0,x.NO)(c.MetricsEventName.GOOGLE_LOGIN,{location:r,browserContext:(0,P.xm)()});const n=await t.signInWithPopup();if(!n)throw new Error("No token and profile found");const o=await O.I8.signInWithCustomToken(n.token);(0,x.Vg)(o?.user,o?.additionalUserInfo?.isNewUser||!1,c.SignInMethods.Google,{browserContext:(0,P.xm)()}),e(o?.user?.uid)}catch(e){if((0,S.hasAPIErrorCode)(e,X.SM.SSO_ORGANIZATION_MEMBER))return(0,P.Gs)(c.MetricsEventName.SSO_REDIRECTED_MEMBER_TO_SSO,{userId:n,email:(0,z.buildErrorContext)(e)?.attributes.email?.toString()}),void o("/signin/sso?redirectedFrom=google");e instanceof Error&&t(e),M.Y.error("Error signing in with Google",(0,z.buildErrorContext)(e))}}),[r,o,n,e,t])})(pe,(e=>{(0,P.Gs)(c.MetricsEventName.SIGN_IN_ERROR,{userId:G,error:e.message,method:a.zH.Google,location:he}),H(2)}),he),me=async()=>{try{ue.parse(N)}catch{return void H(3)}U(!1),H(1),(0,P.Gs)(c.MetricsEventName.ATTEMPT_EMAIL_SEND,{userId:G,type:a.zH.OTP,location:he});try{const t=await s.wP.post(I.HttpV2Paths.AuthOtpRequests,{auth:!0,params:{body:{email:N}}});(0,P.Gs)(c.MetricsEventName.EMAIL_SENT,{userId:G,type:a.zH.OTP,location:he}),K(t.isNewUser),U(!0),H(0),e&&e(N)}catch(e){if((0,S.hasAPIErrorCode)(e,X.SM.SSO_ORGANIZATION_MEMBER))return(0,P.Gs)(c.MetricsEventName.SSO_REDIRECTED_MEMBER_TO_SSO,{userId:G,email:N}),void W("/signin/sso?redirectedFrom=otp");H(2),(0,P.Gs)(c.MetricsEventName.SIGN_IN_ERROR,{userId:G,error:"User entered invalid email address",location:he})}};return(0,n.BX)(f.PQ,{flexDirection:"column",wizard:r,css:J?void 0:Z.xJ,children:[!(0,Y.VQ)()&&(0,n.tZ)(F.Hz,{children:(0,n.tZ)(d.Z,{useNewStyles:J})}),(0,n.BX)(R.ZP,{flexDirection:"column",paddingX:J?6:void 0,children:[!(0,Y.VQ)()&&(0,n.tZ)(j.Z,{}),(0,n.tZ)(R.ZP,{marginY:5,children:(0,n.tZ)(_.Z,{kind:"h2",color:J||r?b.COLORS.WHITE:b.COLORS.DARK2,style:{textAlign:"center",width:"100%"},children:E?m:r?(0,w.ZP)("985597e",{event:o}):V?(0,w.ZP)("96733a5"):m})}),q?.state?.showNotice&&(0,n.tZ)(R.ZP,{marginBottom:5,children:(0,n.tZ)(_.Z,{kind:"h1",color:b.COLORS.RED1,style:{textAlign:"center",width:"100%"},children:(0,w.ZP)("aa5d6ca")})}),V?(0,n.tZ)(B,{email:N,setSentOTP:U,isNewUser:$,wizard:r,onSignInComplete:pe}):(0,n.BX)(n.HY,{children:[!y&&(0,n.BX)(n.HY,{children:[(0,n.tZ)(A.Z,{kind:J||r?"white":"secondary",startIcon:(0,n.tZ)(i.ieO,{}),size:Q,onPress:ge,children:(0,w.ZP)("4a0b728")}),(0,n.BX)(R.ZP,{marginY:J?8:2,alignItems:"center",justifyContent:"center",children:[J&&(0,n.tZ)(de.Z,{}),(0,n.tZ)(_.Z,{kind:"body1",color:J||r?b.COLORS.GRAY0:b.COLORS.GRAY5,style:{textAlign:"center",padding:"0 16px"},children:(0,w.ZP)("OR")}),J&&(0,n.tZ)(de.Z,{})]})]}),(0,n.tZ)(p.Z,{value:N,onChange:T,onSubmit:ne?me:void 0,placeholder:(0,w.ZP)("c09924a"),type:"email",size:"lg",label:J?(0,w.ZP)("c94d317"):r?C:(0,w.ZP)("Email")}),2===D&&(0,n.tZ)(f.g5,{error:!0,children:(0,w.ZP)("9b9256f")}),3===D&&(0,n.tZ)(f.g5,{error:!0,children:(0,w.ZP)("d2306dd")}),4===D&&(0,n.tZ)(f.g5,{error:!0,children:(0,w.ZP)("fc327a8")}),(0,n.BX)(R.ZP,{flexDirection:"column",gap:2,marginY:4,justifyContent:"center",children:[(0,n.tZ)(A.Z,{isDisabled:!ne,kind:"primary",size:Q,onPress:me,isLoading:oe||1===D,isFullWidth:!0,children:(0,w.ZP)("e1e3e77")}),(0,n.tZ)(k,{})]}),(0,n.tZ)(R.ZP,{marginTop:4,justifyContent:"center",children:(0,n.tZ)("div",{ref:ee})})]})]})]})})),ge=h.memo((function(e){const t=(0,l.Z)();return(0,n.tZ)(ne.zt,{store:oe.ZP,children:(0,n.tZ)(o.a,{theme:t||e.wizard?m.$:m.f,children:(0,n.tZ)(pe,{...e})})})})),me=ge},6668:(e,t,r)=>{r.d(t,{Z:()=>S});var n=r(35944),o=r(67294),i=r(82232),a=r(89674),s=r(10932),c=r(57333),l=r(92851),d=r(68563),h=r(96610),u=r(91381),p=r(76777),g=r(20605),m=r(16590),b=r(44308);s.Z.div`
  display: flex;
  align-items: center;
  text-align: center;
  margin: 16px 0;
  width: 100%;

  &::before,
  &::after {
    content: "";
    flex: 1;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  &:not(:empty) {
    &::before {
      margin-right: 16px;
    }

    &::after {
      margin-left: 16px;
    }
  }
`;const Z=(0,s.Z)(d.ZP)`
  border-bottom: ${({useNewStyles:e})=>e?"":"1px solid rgba(255, 255, 255, 0.1)"};
  background-color: ${({useNewStyles:e})=>e?void 0:l.COLORS.DARK1};
`,f=o.memo((function({hasSignIn:e,useNewStyles:t}){const{currUser:r}=(0,o.useContext)(u.St);return(0,n.tZ)(a.a,{theme:c.$,children:(0,n.BX)(Z,{minHeight:"55px",width:"100vw",justifyContent:"space-between",alignItems:"center",paddingX:6,useNewStyles:t,children:[(0,n.tZ)(h.Z,{height:"30px"}),e&&((0,b.isAnonymous)(r)?(0,n.tZ)("a",{href:"/signin",children:(0,n.tZ)(m.Z,{kind:"body1",children:(0,i.ZP)("Sign in")})}):(0,n.tZ)("button",{css:p.W6,onClick:g._,children:(0,n.tZ)(m.Z,{kind:"body1",children:(0,i.ZP)("dc1649a")})}))]})})})),S=o.memo(f)},96610:(e,t,r)=>{r.d(t,{Z:()=>h});var n=r(35944),o=r(89674),i=r(10932),a=r(67294);function s(){return s=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var r=arguments[t];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(e[n]=r[n])}return e},s.apply(this,arguments)}const c=({styles:e={},...t})=>a.createElement("svg",s({viewBox:"0 0 88 30",fill:"none",xmlns:"http://www.w3.org/2000/svg"},t),a.createElement("path",{d:"M0 0h87.868v30H0z"}),a.createElement("path",{fillRule:"evenodd",clipRule:"evenodd",d:"M3.623 1.338A.892.892 0 015.167.446l1.894 3.28c.024.005.05.01.074.017l4.357 1.168a.892.892 0 01-.461 1.722L7.096 5.58 6.043 9.51a.892.892 0 11-1.723-.462L5.488 4.69a.903.903 0 01.025-.08l-1.89-3.273zM60.55 8.55v13.117h2.34v-4.664c0-.826.213-1.47.64-1.93.438-.462.986-.693 1.644-.693.67 0 1.157.206 1.462.62.317.412.475 1.007.475 1.784v4.883h2.321v-5.101c0-1.36-.31-2.393-.932-3.097-.61-.704-1.474-1.057-2.595-1.057-.67 0-1.267.146-1.791.438-.512.279-.92.668-1.225 1.165V8.552H60.55zM30.86 21.067c.902.546 1.956.82 3.162.82.962 0 1.754-.165 2.376-.493a4.283 4.283 0 001.553-1.402l.183 1.676h2.156v-7.014h-5.592v1.749h3.235c-.122 1.02-.481 1.846-1.078 2.477-.585.62-1.456.93-2.614.93-1.182 0-2.12-.383-2.814-1.148-.683-.777-1.024-1.87-1.024-3.28 0-1.408.348-2.513 1.042-3.315.694-.813 1.681-1.22 2.96-1.22.805 0 1.463.17 1.974.51.512.328.865.79 1.06 1.384h2.614c-.293-1.263-.932-2.252-1.92-2.97-.986-.716-2.229-1.074-3.727-1.074-1.316 0-2.455.286-3.418.856a5.728 5.728 0 00-2.211 2.35c-.512.996-.768 2.15-.768 3.462 0 1.299.25 2.44.75 3.424.5.972 1.2 1.731 2.101 2.277zm12.856.455c.5.243 1.139.364 1.919.364.755 0 1.37-.158 1.846-.473a3.345 3.345 0 001.133-1.203l.219 1.458h1.992v-5.556c0-1.179-.372-2.09-1.115-2.733-.743-.644-1.76-.966-3.052-.966-.755 0-1.438.134-2.047.401a3.73 3.73 0 00-1.498 1.111 3.21 3.21 0 00-.658 1.713h2.284c.085-.437.305-.765.658-.984.353-.23.768-.346 1.243-.346.524 0 .962.146 1.316.437.353.292.53.747.53 1.367v.218h-2.303c-1.316 0-2.303.261-2.96.783-.659.523-.988 1.203-.988 2.04 0 .499.122.954.366 1.367.244.413.615.747 1.115 1.002zm4.002-2.113c-.366.437-.883.655-1.553.655-.439 0-.792-.097-1.06-.29-.268-.195-.402-.469-.402-.82 0-.329.134-.602.402-.82.268-.231.712-.347 1.334-.347h1.992c-.098.644-.335 1.184-.713 1.622zm9.179 2.259c-.95 0-1.712-.231-2.284-.693-.573-.461-.86-1.28-.86-2.459v-3.935H52.2v-1.949h1.554l.274-2.423h2.065v2.423h2.449v1.95h-2.45v3.952c0 .438.092.741.275.911.195.158.524.237.987.237h1.133v1.986h-1.59zm18.954.218c-.914 0-1.724-.194-2.43-.583a4.226 4.226 0 01-1.664-1.64c-.402-.704-.603-1.517-.603-2.44 0-.935.195-1.767.585-2.496a4.324 4.324 0 011.645-1.694c.707-.413 1.535-.62 2.485-.62.89 0 1.675.195 2.358.583a4.111 4.111 0 011.59 1.603c.39.668.585 1.415.585 2.241 0 .134-.007.273-.019.42 0 .145-.006.297-.018.455h-6.89c.049.704.293 1.256.731 1.657.451.401.993.602 1.627.602.475 0 .87-.104 1.188-.31.329-.219.572-.498.73-.838h2.376a4.31 4.31 0 01-.858 1.566 4.13 4.13 0 01-1.463 1.093c-.572.268-1.224.401-1.955.401zm.018-7.578c-.572 0-1.078.164-1.517.492-.438.316-.718.801-.84 1.457h4.514c-.037-.595-.256-1.069-.658-1.42-.402-.353-.902-.529-1.499-.529zm6.352-1.676v9.036h2.34V17.55c0-.693.109-1.233.328-1.622.232-.388.548-.662.95-.82a3.727 3.727 0 011.371-.236h.658v-2.46c-.768 0-1.438.176-2.01.529-.56.34-1.005.801-1.335 1.384l-.219-1.694h-2.083zm-69.362 2.937a3.593 3.593 0 10-3.594-6.224 3.593 3.593 0 003.594 6.224zm-.93-1.575a1.778 1.778 0 10-1.777-3.08 1.778 1.778 0 001.778 3.08zm-5.223.994a3.594 3.594 0 11-6.224 3.594 3.594 3.594 0 016.224-3.594zm-1.608.874A1.778 1.778 0 112.02 17.64a1.778 1.778 0 013.08-1.778zm8.382 8.86a3.594 3.594 0 10-3.594-6.224 3.594 3.594 0 003.594 6.224zm-.957-1.616a1.778 1.778 0 10-1.779-3.079 1.778 1.778 0 001.779 3.08zm9.765 1.503a3.594 3.594 0 11-6.224 3.594 3.594 3.594 0 016.224-3.594zm-1.596.894a1.778 1.778 0 11-3.079 1.778 1.778 1.778 0 013.08-1.778zm.283-5.109a3.593 3.593 0 10-3.593-6.223 3.593 3.593 0 003.593 6.223zm-.896-1.584a1.778 1.778 0 10-1.778-3.08 1.778 1.778 0 001.778 3.08zM21.67 6.332a3.593 3.593 0 11-6.224 3.594 3.593 3.593 0 016.224-3.594zm-1.607.862a1.778 1.778 0 11-3.08 1.778 1.778 1.778 0 013.08-1.778z",fill:"currentColor"}));var l=r(76777);const d=i.Z.button`
  height: ${e=>e.height};
  color: ${e=>e.color};

  & svg {
    width: auto;
    height: 100%;
  }
`,h=({height:e="35px",linkToHomepage:t=!0})=>{const r=(0,o.u)();return(0,n.tZ)(d,{height:e,color:r.icon,onClick:()=>t&&window.location.assign("/"),css:[l.W6,{cursor:t?"pointer":"inherit"}],children:(0,n.tZ)(c,{})})}},41731:(e,t,r)=>{r.d(t,{Fy:()=>h,Gs:()=>u,PQ:()=>s,fs:()=>c,j5:()=>l,lR:()=>d});var n=r(70917),o=r(10932),i=r(68563),a=r(92851);const s=(0,o.Z)(i.ZP)`
  ${({isDisabled:e})=>e&&"opacity: 30%; pointer-events: none;"}
`,c=n.iv`
  scrollbar-color: ${a.COLORS.DARK0} transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background-color: transparent;
  }

  ::-webkit-scrollbar-button:start:decrement {
    height: 6px;
  }
  ::-webkit-scrollbar-button:end:increment {
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    width: 8px;
    background-color: ${a.COLORS.DARK0};
    border-radius: 4px;

    &:hover,
    &:focus,
    &:active {
      background-color: ${a.COLORS.DARK0};
    }
  }
`,l=o.Z.div`
  width: 100%;
  border: 2px solid ${({borderColor:e})=>e};
  border-radius: ${({borderRadius:e})=>e};
  display: flex;
  flex-direction: row;
  align-items: center;
  transition: border 200ms ease;
  box-sizing: border-box;

  ${({hasChips:e,height:t})=>e?"min-height: 48px;":`height: ${t};`};

  padding: ${({hasChips:e})=>e?"2px 0px 2px 8px":"0 8px 0 16px"};
`,d=o.Z.div`
  width: 100%;
  height: 100%;
  display: flex;

  overflow-y: auto;
  overflow-x: hidden;
  max-height: 128px;
  flex-wrap: wrap;
`,h=o.Z.input`
  border: none;
  box-shadow: none;
  background: transparent;
  flex-grow: 1;
  font-weight: 500;
  font-size: 15px;
  font-family: inherit;
  line-height: 20px;
  color: ${({textColor:e})=>e};
  ${({hasChips:e})=>e?"min-width: 230px;":"width: 100%;"}
  ${({hasChips:e})=>!e&&"height: 100%;"}

  &::placeholder {
    font-weight: 500;
    font-size: 15px;
    line-height: 20px;
    color: ${({placeholderTextColor:e})=>e};
  }

  &:-moz-placeholder {
    /* Firefox 18- */
    line-height: ${({height:e})=>`calc(0.925 * ${e})`};
  }

  &::-moz-placeholder {
    /* Firefox 19+ */
    line-height: ${({height:e})=>`calc(0.925 * ${e})`};
  }

  &[type="number"] {
    // Hiding the arrow buttons because of some unexpected
    // side effects (hovering over up arrow will actually
    // affect the down arrow)
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      display: none;
    }
  }
`,u=o.Z.div`
  padding-top: 4px;
  font-weight: 500;
  font-size: 12px;
  line-height: 15px;
  color: ${({color:e})=>e};
`},11771:(e,t,r)=>{r.d(t,{Z:()=>x});var n=r(35944),o=r(70917),i=r(67294),a=r(37884),s=r(89674),c=r(27354),l=r(51504),d=r(34140),h=r(92851),u=r(25292),p=r(68563),g=r(16590),m=r(10932),b=r(76777);const Z=(0,m.Z)(p.ZP)`
  border: 1px solid ${({borderColor:e})=>e};
  margin: 4px 8px 4px 0;
  padding: 0 8px 0;
`,f=({id:e,value:t,hasError:r=!1,onRemove:o,chipColor:i})=>{const c=(0,s.u)(),{defaultChipColor:l,chipTextColor:d,defaultChipBorder:m}=c.textInput.chip;return(0,n.BX)(Z,{backgroundColor:r?"transparent":i??l,borderColor:r?h.COLORS.RED1:i??m,maxWidth:"100%",alignItems:"center",height:"32px",borderRadius:"8px",children:[r&&(0,n.tZ)(p.ZP,{paddingRight:1,children:(0,n.tZ)(u.Z,{icon:(0,n.tZ)(a.v3j,{}),size:"xs",color:h.COLORS.RED1})}),(0,n.tZ)(g.Z,{kind:"body1",style:b.iL,color:d,children:t}),o&&(0,n.tZ)(p.ZP,{paddingLeft:1,onClick:()=>o(e),cursor:"pointer",children:(0,n.tZ)(u.Z,{icon:(0,n.tZ)(a.x8P,{}),size:"xs"})})]})};var S=r(41731);let O=0;const w=e=>{const t=e.trim(),r=O;return O+=1,{id:r,value:t}},E=(e,t,r)=>{const n=w(e);t(""),r([n])},v=(e,t,r)=>{if(e.includes(",")){const n=e.split(",").filter((e=>e.trim().length>0)).map((e=>w(e)));t(""),r(n)}else t(e)};var C=r(35025),R=r(82232);const _=i.forwardRef((function(e,t){const{size:r="md",type:m="text",onChange:b,onSubmit:Z,value:O,label:w,hasError:_,errorMessage:x,startIcon:I,startElement:A,endElement:P,editingIcon:y,searchIcon:L,clearIcon:k,placeholder:G,isDisabled:N,maxLength:T,width:M="100%",maxWidth:z,autoComplete:D,autoFocus:H,onClear:V,useChips:U,onBlur:$,onFocus:B,shouldBlurOnSubmit:F}=e,j=i.useRef(null),[X,K]=(0,i.useState)(!!H),W=(0,s.u)(),{hoverProps:Y,isHovered:J}=(0,c.XI)({}),{visuallyHiddenProps:Q}=(0,d.S)();(0,i.useImperativeHandle)(t,(()=>(0,C.just)(j.current)));const{chipList:q,removeChip:ee,setCurrentChipValue:te,updateChipList:re,chipColor:ne}=U??{},oe=void 0!==U,ie=oe&&q&&q.length>0,ae=void 0!==G?(0,R.EI)(G):void 0,{labelProps:se,inputProps:ce}=(0,l.E)({...e,onFocusChange:e=>{e&&B&&B(),K(e)},onBlur:()=>{$&&$(),te&&re&&O.trim().length>0&&E(O,te,re)},label:w||ae,placeholder:ae},j),le=(({isFocused:e,isHovered:t,hasError:r})=>{if(r&&!ie)return"error";switch(!0){case e:return"focus";case t:return"hover";default:return"default"}})({isFocused:X,isHovered:J,hasError:_}),de=(e=>{switch(e){case"lg":return"48px";case"md":return"40px";case"sm":return"36px"}})(r),he=(e=>{switch(e){case"lg":return"12px";case"md":return"10px";case"sm":return"8px"}})(r),ue=W.textInput.borderColor[le],{iconColor:pe,labelTextColor:ge,placeholderTextColor:me,errorTextColor:be,textColor:Ze}=W.textInput,fe=q?.map((e=>(0,o.az)(f,{...e,onRemove:ee,key:e.id,chipColor:ne}))),[Se,Oe]=(0,i.useState)(!1),we=(0,n.BX)(S.j5,{hasChips:oe,borderColor:ue,borderRadius:he,height:de,...Y,children:[(0,n.BX)(S.lR,{css:S.fs,children:[oe&&fe,(0,n.tZ)(S.Fy,{hasChips:oe,...ce,type:m,placeholder:ie?void 0:ae,placeholderTextColor:me,value:O,maxLength:T,onChange:U&&te&&re&&(e=>v(e.target.value,te,re)),onKeyDown:e=>{if(te&&re&&ee){if("Enter"===e.key||"Tab"===e.code||"Comma"===e.code||"Space"===e.code){e.preventDefault();const t=O.trim();t.length>0&&U&&E(t,te,re)}0===O.length&&"Backspace"===e.code&&(e.preventDefault(),q&&ee(q[q.length-1].id))}},autoComplete:D,autoFocus:H,textColor:Ze,ref:j})]}),ie&&(0,n.tZ)(p.ZP,{width:"8px"}),_&&!ie&&(0,n.tZ)(p.ZP,{marginRight:2,children:(0,n.tZ)(u.Z,{icon:(0,n.tZ)(a.v3j,{}),size:"sm",color:h.COLORS.RED1})})]});return(0,n.BX)(S.PQ,{flexDirection:"column",width:M,maxWidth:z,isDisabled:N,children:[w?(0,n.tZ)(p.ZP,{marginBottom:1,...w?Q:{},children:(0,n.tZ)("label",{...se,children:(0,n.tZ)(g.Z,{kind:"caption1",color:ge,children:w})})}):null,oe?we:(0,n.BX)(S.j5,{hasChips:oe,borderColor:ue,borderRadius:he,height:de,...Y,children:[L?(0,n.tZ)(p.ZP,{marginRight:2,children:(0,n.tZ)(u.Z,{icon:(0,n.tZ)(a.olm,{}),size:"sm",color:pe})}):I?(0,n.tZ)(p.ZP,{marginLeft:-2,children:(0,n.tZ)(u.Z,{icon:I,size:"xs",color:(0,h.CZ)(h.COLORS.WHITE,.4)})}):A||null,(0,n.tZ)(S.Fy,{hasChips:oe,...ce,type:"password"===m&&Se?"text":m,placeholder:ae,placeholderTextColor:me,value:O,maxLength:T,onChange:b&&(e=>b(e.target.value)),onKeyPress:e=>{("Enter"===e.nativeEvent?.key||"Enter"===e.key)&&(Z&&Z(O),F&&j.current?.blur())},autoComplete:D,autoFocus:H,textColor:Ze,readOnly:void 0===b,ref:j}),P||("password"===m?(0,n.tZ)(u.Z,{icon:Se?(0,n.tZ)(a._jl,{}):(0,n.tZ)(a.bAj,{}),onClick:()=>Oe((e=>!e)),css:{cursor:"pointer"}}):null),_?(0,n.tZ)(p.ZP,{marginRight:2,children:(0,n.tZ)(u.Z,{icon:(0,n.tZ)(a.v3j,{}),size:"sm",color:h.COLORS.RED1})}):k&&O.length>0?(0,n.tZ)(p.ZP,{onClick:V||b&&(()=>b("")),cursor:"pointer",children:(0,n.tZ)(u.Z,{icon:(0,n.tZ)(a.ej,{}),size:"sm",color:pe})}):y&&X?(0,n.tZ)(p.ZP,{marginLeft:1,children:(0,n.tZ)(u.Z,{icon:(0,n.tZ)(a.GmO,{}),size:"xs"})}):null]}),_&&x&&(0,n.tZ)(S.Gs,{color:be,children:x})]})})),x=i.memo(_)},99471:(e,t,r)=>{r.d(t,{Hz:()=>s,PX:()=>h,fU:()=>a,nZ:()=>d});var n=r(35944),o=r(44388),i=r(85518);const a=({children:e})=>(0,o.Z)()?null:(0,n.tZ)(n.HY,{children:e}),s=({children:e})=>(0,o.Z)()?(0,n.tZ)(n.HY,{children:e}):null,c=({children:e})=>(0,n.tZ)(n.HY,{children:e}),l=()=>null,d=i.tq?l:c,h=i.tq?c:l},44388:(e,t,r)=>{r.d(t,{Z:()=>i});var n=r(67294),o=r(54547);const i=()=>{const[e,t]=(0,n.useState)(window.innerWidth<o.U.sm);return(0,n.useEffect)((()=>{const e=()=>t(window.innerWidth<o.U.sm);return window.addEventListener("resize",e),()=>window.removeEventListener("resize",e)}),[]),e}},85903:(e,t,r)=>{r.d(t,{x:()=>s});var n=r(67294),o=r(91381),i=r(28216),a=r(80981);const s=()=>{const e=(0,i.I0)(),{currUser:t}=(0,n.useContext)(o.St);(0,n.useEffect)((()=>{t?.id&&e((0,a.hB)(t?.id))}),[e,t?.id])}},56540:(e,t,r)=>{r.d(t,{j:()=>l});var n=r(16791),o=r(80103),i=r(91638),a=r(82232),s=r(26948);const c={width:150,height:250},l=(e,t)=>new Promise(((r,l)=>{Office.context.ui.displayDialogAsync(e,{...c},(e=>{t&&window.addEventListener("message",t,!1);const c=e.value;c.addEventHandler(Office.EventType.DialogMessageReceived,(async e=>{if(s.newRelicManager?.addPageAction("ms-office-addin-dialog-message-received"),"error"in e)return void l(new o.J7((0,a.EI)((0,a.ZP)("619c774",{error:e.error}))));const{authCode:t}=JSON.parse(e.message);t?n.isLocalOrTest||e.origin&&(0,i._v)(e.origin)?(r(t),c.close()):l(new o.J7((0,a.EI)((0,a.ZP)("efb255f",{origin:e.origin})))):l(new o.J7((0,a.EI)((0,a.ZP)("f105b4c"))))}))}))}))}}]);
//# sourceMappingURL=https://sourcemaps.us-east-1-a.prod.aws.gather.town/v1/gather-browser/72991861a/bundle.d08bd7301770e60c0cb5.js.map
!function(){let e={upsert:"upsertData",user:"upsertData",record:"appendData",append:"appendData",upsertMultiple:"upsertMultipleData",appendMultiple:"appendMultipleData"},t,r,a,n,i,u,s=null,o=[],l=-1,d="userId",p="userId",f="timestamp";function c(c,g,$=()=>{}){if("init"===c){if(!g){console.warn("Missing required init params.");return}let m=(g.workspace||"").replace(/[^a-zA-Z0-9.]/g,"");return t=`https://${m=m?m+".api":"api"}.abacus.ai/api`,r="streamingToken="+g.streamingToken,u=g.featureGroups||{},n=g.deploymentId||null,i="deploymentToken="+g.deploymentToken,d=g.userKey||d,(p=g.userKey||p)in g&&g[p]?a=g[p]:(p in g&&console.warn("Invalid value for userId field, using cookie instead."),function t(r){let n=document.cookie.split(";").find(function(e){return e.trim().startsWith("abacusAiUserId=")});n?a=n.split("=")[1].trim():(a="abacusai/"+"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(e){let t=16*Math.random()|0;return("x"===e?t:3&t|8).toString(16)}),document.cookie=`abacusAiUserId=${a}; path="/"; max-age=86400`,"user"in u&&u.user&&(o.push({method:e.user,featureGroupId:u.user,data:{[p]:a,_timezone:new Date().getTimezoneOffset(),_referrer:document.referrer,_useragent:navigator.userAgent,_screendim:window.screen.width+"x"+window.screen.height,...r}}),null==s&&(s=setTimeout(x,10))))}(g.newUserAttributes)),$(a),a}if("setUser"===c){g&&(a=g);return}if("getUser"===c)return $(a),a;if(c in e){if(!g){console.log("Missing streaming data");return}if(!u||!(c in u)){console.warn("No feature group configured for method "+c);return}Array.isArray(g)||(g=[g]);let y=[];l=Math.max(l+1,Date.now()),g.forEach(e=>{let t=Object.assign({},e);f in e||(t[f]=l),p in e||(t[p]=a),y.push(t)}),y&&o.push({method:e[c],featureGroupId:u[c],data:c.endsWith("Multiple")?y:y[0]}),null==s&&(s=setTimeout(x,10));return}if("predict"===c){g?null==g.data&&(g.data={}):g={data:{}},!d||g.data&&d in g.data||(g.data[d]=a),x(),g.reaiRetryNum=0,function e(r,a){let u=new XMLHttpRequest;u.open("POST",`${t}/predict?${i}&deploymentId=${n}`,!0),u.onload=function(){200===u.status?a(JSON.parse(u.response).result,null):u.status>=500&&r.reaiRetryNum<3?(console.warn("Prediction recording interactions: "+u.status),r.reaiRetryNum+=1,setTimeout(function(){e(r,a)},5e3*r.reaiRetryNum)):u.status>=400?a(null,JSON.parse(u.response).error):a(null,"Error making prediction call: "+u.status)},u.setRequestHeader("Content-Type","application/json"),u.send(JSON.stringify({queryData:r.data,...r.options}))}(g,$);return}console.error("Unrecognized reaitag command "+c)}function x(){if(s=null,0===o.length)return;let e={event:o.shift(),reaiRetryNum:0};(function e(a){var n,i;let u=new XMLHttpRequest;u.open("POST",(n=a.event.method,`${t}/${n}?${r}&featureGroupId=${i=a.event.featureGroupId}`),!0),u.onload=function(){u.status>=500&&a.reaiRetryNum<3&&(console.warn("Error recording interactions: "+u.status),a.reaiRetryNum+=1,setTimeout(function(){e(a)},5e3*a.reaiRetryNum))},u.setRequestHeader("Content-Type","application/json"),u.send(JSON.stringify({data:a.event.data}))})(e),o.length>0&&(s=setTimeout(x,200))}if(window.reaitag&&window.reaitag.toString()===c.toString()){console.info("reaitag already loaded");return}window.reaitag=c;let g=function(){if(window.reDataList&&window.reDataList.length){let e=window.reDataList.slice(0);window.reDataList=[],e.forEach(function(e){c.apply(this,e)})}setTimeout(g,1e3)};g()}();
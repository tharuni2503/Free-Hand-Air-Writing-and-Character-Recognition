(() => {
const video=document.getElementById('camera'), canvas=document.getElementById('drawCanvas'), ctx=canvas.getContext('2d');
const status=document.getElementById('status'), cameraBtn=document.getElementById('cameraBtn'), clearOverlayBtn=document.getElementById('clearOverlayBtn'), recognizeOverlayBtn=document.getElementById('recognizeOverlayBtn');
const mode=document.getElementById('mode'), result=document.getElementById('result'), confidence=document.getElementById('confidence');
ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#ff2020';ctx.lineWidth=12;
let currentColor='#ff2020', erasing=false;
document.querySelectorAll('[data-color]').forEach(btn=>btn.addEventListener('click',()=>{currentColor=btn.dataset.color;erasing=false;document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b===btn));document.getElementById('eraserBtn').classList.remove('active');}));
document.getElementById('eraserBtn').addEventListener('click',()=>{erasing=true;document.getElementById('eraserBtn').classList.add('active');document.querySelectorAll('[data-color]').forEach(b=>b.classList.remove('active'));});
let stream=null, camera=null, hands=null, lastPoint=null, drawing=false, lastPrediction=0, openPalmSince=null, clearGestureLatched=false, hoverTarget=null, hoverSince=null, hoverLatched=false, recognizeGestureSince=null, recognizeGestureLatched=false;
function setStatus(s){status.textContent=s;}
function clearCanvas(){ctx.clearRect(0,0,canvas.width,canvas.height);lastPoint=null;result.textContent='—';confidence.textContent='';}
clearOverlayBtn.addEventListener('click',clearCanvas);
function drawSegment(a,b){if(!a||!b)return;ctx.globalCompositeOperation=erasing?'destination-out':'source-over';ctx.strokeStyle=currentColor;ctx.lineWidth=erasing?34:12;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalCompositeOperation='source-over';}
async function startCamera(){
 if(!navigator.mediaDevices?.getUserMedia){setStatus('This browser does not support camera access. Try a recent browser over HTTPS.');return;}
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});video.srcObject=stream;await video.play();
  if(!window.Hands||!window.Camera){setStatus('Camera started, but hand-tracking scripts failed to load. Mouse/touch drawing still works.');return;}
  hands=new Hands({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
  hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:.65,minTrackingConfidence:.6});
  hands.onResults(onResults);
  camera=new Camera(video,{onFrame:async()=>{if(hands)await hands.send({image:video});},width:640,height:480});
  await camera.start();cameraBtn.textContent='Stop camera';setStatus('Camera is running. Show one hand; point your index finger to draw.');
 }catch(err){setStatus('Could not start camera: '+(err.message||err)+' — check browser camera permission.');}
}
function stopCamera(){if(camera){camera.stop();camera=null;}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}if(hands){hands.close();hands=null;}video.srcObject=null;cameraBtn.textContent='Start camera';lastPoint=null;setStatus('Camera stopped. Mouse/touch drawing is still available.');}
cameraBtn.addEventListener('click',()=>{if(stream)stopCamera();else startCamera();});
function onResults(res){
 if(!res.multiHandLandmarks||!res.multiHandLandmarks.length){lastPoint=null;openPalmSince=null;clearGestureLatched=false;recognizeGestureSince=null;recognizeGestureLatched=false;resetHover();return;}
 const lm=res.multiHandLandmarks[0];
 const indexUp=lm[8].y<lm[6].y, middleUp=lm[12].y<lm[10].y;
 const ringUp=lm[16].y<lm[14].y, pinkyUp=lm[20].y<lm[18].y;
 const openPalm=indexUp&&middleUp&&ringUp&&pinkyUp;
 // Hold index + middle fingers up to recognize the current drawing hands-free.
 if(indexUp&&middleUp&&!ringUp&&!pinkyUp){
  lastPoint=null;resetHover();
  if(!recognizeGestureLatched){if(recognizeGestureSince===null)recognizeGestureSince=Date.now();const elapsed=Date.now()-recognizeGestureSince;setStatus(elapsed>=900?'Recognizing your drawing…':'Hold index + middle fingers up to recognize…');if(elapsed>=900){recognizeCharacter();recognizeGestureLatched=true;recognizeGestureSince=null;}}
  return;
 }else{recognizeGestureSince=null;recognizeGestureLatched=false;}
 // Hold an open palm for 1.2 seconds to clear; one clear per gesture.
 if(openPalm){
  lastPoint=null;
  if(!clearGestureLatched){
   if(openPalmSince===null)openPalmSince=Date.now();
   const elapsed=Date.now()-openPalmSince;
   setStatus(elapsed>=1200?'Open-palm gesture detected — clearing canvas.':'Hold open palm to clear canvas…');
   if(elapsed>=1200){clearCanvas();setStatus('Canvas cleared by gesture. Point your index finger to write.');clearGestureLatched=true;openPalmSince=null;}
  }
  return;
 }else{openPalmSince=null;clearGestureLatched=false;}
 // Map fingertip from the camera to the full page, including toolbar controls.
 if(indexUp&&!middleUp){
  const ws=document.getElementById('workspace').getBoundingClientRect();
  const screenX=ws.left+(1-lm[8].x)*ws.width, screenY=ws.top+lm[8].y*ws.height;
  const hit=document.elementFromPoint(screenX,screenY);
  const target=hit&&hit.closest('[data-color],#eraserBtn,#clearOverlayBtn,#recognizeOverlayBtn,#mode');
  if(target){lastPoint=null;handleHover(target);return;}
  resetHover();
  if(screenY>=ws.top&&screenY<=ws.bottom&&screenX>=ws.left&&screenX<=ws.right){
   const p={x:(screenX-ws.left)/ws.width*canvas.width,y:(screenY-ws.top)/ws.height*canvas.height};
   if(lastPoint)drawSegment(lastPoint,p);lastPoint=p;
   setStatus('Writing with index finger. Point at a toolbar control and hold to activate.');
  }else{lastPoint=null;}
 }else{lastPoint=null;resetHover();if(middleUp)setStatus('Drawing paused. Point at a toolbar control to use it.');}
}

function resetHover(){if(hoverTarget)hoverTarget.classList.remove('gesture-hover');hoverTarget=null;hoverSince=null;hoverLatched=false;}
function handleHover(target){if(hoverTarget!==target){resetHover();hoverTarget=target;hoverSince=Date.now();}target.classList.add('gesture-hover');const elapsed=Date.now()-hoverSince;setStatus('Hold fingertip over '+(target.getAttribute('aria-label')||target.title||target.textContent.trim())+'…');if(elapsed<850||hoverLatched)return;hoverLatched=true;if(target.matches('[data-color]')){currentColor=target.dataset.color;erasing=false;document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b===target));document.getElementById('eraserBtn').classList.remove('active');setStatus('Pen color selected.');}else if(target.id==='eraserBtn'){erasing=true;target.classList.add('active');document.querySelectorAll('[data-color]').forEach(b=>b.classList.remove('active'));setStatus('Eraser selected.');}else if(target.id==='clearOverlayBtn'){clearCanvas();setStatus('Canvas cleared.');}else if(target.id==='recognizeOverlayBtn'){recognizeCharacter();}else if(target.id==='mode'){mode.value=mode.value==='alphabet'?'number':'alphabet';setStatus('Recognition mode: '+mode.value+'.');}}
async function recognizeCharacter(){
 if(Date.now()-lastPrediction<1200)return;lastPrediction=Date.now();
 // Model expects white ink on black; preserve only transparent-canvas strokes and ignore camera background.
 const prep=document.createElement('canvas');prep.width=canvas.width;prep.height=canvas.height;const pctx=prep.getContext('2d');pctx.fillStyle='#000';pctx.fillRect(0,0,prep.width,prep.height);const src=ctx.getImageData(0,0,canvas.width,canvas.height), ink=pctx.createImageData(canvas.width,canvas.height);for(let i=0;i<src.data.length;i+=4){if(src.data[i+3]>10){ink.data[i]=255;ink.data[i+1]=255;ink.data[i+2]=255;ink.data[i+3]=255;}}pctx.putImageData(ink,0,0);
 const image=prep.toDataURL('image/png');result.textContent='…';confidence.textContent='Running CNN prediction…';
 try{const res=await fetch('/api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,mode:mode.value})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Prediction failed');result.textContent=data.label;const alt=(data.alternatives||[]).slice(0,3).map(x=>x.label+' '+(x.confidence*100).toFixed(0)+'%').join(' · ');confidence.textContent='Confidence: '+(data.confidence*100).toFixed(1)+'%'+(alt?' | Top: '+alt:'');setStatus('Prediction complete.');}
 catch(err){result.textContent='—';confidence.textContent=err.message;setStatus('Could not recognize this drawing.');}
}
recognizeOverlayBtn.addEventListener('click',recognizeCharacter);
window.addEventListener('pagehide',()=>{if(stream)stopCamera();});
})();